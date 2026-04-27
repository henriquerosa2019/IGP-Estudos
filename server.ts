import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import multer from "multer";
import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");
import { GoogleGenerativeAI } from "@google/generative-ai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
let db: any;
let auth: any;

try {
  // Always initialize without explicit projectId to use ambient credentials in AI Studio
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  const app = admin.app();

  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    // Use the specific database ID if provided, otherwise default
    if (firebaseConfig.firestoreDatabaseId) {
      db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
      console.log(`Firebase Admin initialized. Project: ${admin.app().options.projectId || 'Default'}, Database: ${firebaseConfig.firestoreDatabaseId}`);
    } else {
      db = getFirestore(app);
      console.log(`Firebase Admin initialized with default database.`);
    }
  } else {
    db = getFirestore(app);
    console.log(`Firebase Admin initialized (no config file found).`);
  }
  auth = admin.auth();
} catch (configError) {
  console.error("Error initializing Firebase Admin:", configError);
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  db = admin.firestore();
  auth = admin.auth();
}

// Gemini Initialization
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
if (!genAI) {
  console.warn("Gemini API Key missing - Server-side OCR will be disabled.");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Multer for file uploads with size limit (50MB)
  const upload = multer({ 
    dest: 'uploads/',
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
  });

  // Middleware to verify Firebase Token
  const verifyToken = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split('Bearer ')[1];
    try {
      const decodedToken = await auth.verifyIdToken(token);
      req.user = decodedToken;
      next();
    } catch (error) {
      console.error('Token verification error:', error);
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  // API Routes
  app.get("/api/debug/env", verifyToken, async (req: any, res: any) => {
    try {
      res.json({ 
        projectIdEnv: process.env.GOOGLE_CLOUD_PROJECT,
        firebaseProjectId: admin.app().options.projectId,
        geminiKeyLength: (GEMINI_API_KEY || "").length,
        geminiKeyStart: (GEMINI_API_KEY || "").substring(0, 4)
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/usage/increment", verifyToken, async (req: any, res: any) => {
    const uid = req.user.uid;
    const today = new Date().toISOString().split('T')[0];
    try {
      const usageRef = db.collection('usage').doc(uid);
      const usageDoc = await usageRef.get();
      if (!usageDoc.exists || usageDoc.data()?.lastReset !== today) {
        await usageRef.set({ count: 1, lastReset: today, updatedAt: new Date().toISOString() }, { merge: true });
      } else {
        await usageRef.update({ count: admin.firestore.FieldValue.increment(1), updatedAt: new Date().toISOString() });
      }
      res.json({ success: true });
    } catch (e: any) {
      console.error("Increment error:", e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get("/api/usage/stats", verifyToken, async (req: any, res: any) => {
    const uid = req.user.uid;
    const today = new Date().toISOString().split('T')[0];
    try {
      const usageDoc = await db.collection('usage').doc(uid).get();
      let count = 0;
      if (usageDoc.exists && usageDoc.data()?.lastReset === today) {
        count = usageDoc.data()?.count || 0;
      }
      res.json({ count });
    } catch (error) {
      console.error("Failed to fetch usage stats:", error);
      res.json({ count: 0 });
    }
  });

  app.post("/api/upload/extract-text", verifyToken, upload.single('file'), async (req: any, res: any) => {
    console.log("POST /api/upload/extract-text hit");
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    
    try {
      const dataBuffer = fs.readFileSync(req.file.path);
      let text = "";
      
      if (req.file.mimetype === 'application/pdf') {
        try {
          const data = await pdf(dataBuffer);
          text = data.text;
          
          // Se o texto extraído for muito curto ou inexistente, pode ser um PDF escaneado
          // Nesses casos, usamos o Gemini como OCR (Reconhecimento Óptico de Caracteres)
          if (!text || text.trim().length < 50) {
            console.log("PDF sem camada de texto detectado. Iniciando extração via IA (OCR)...");
            
            if (!genAI) throw new Error("IA não configurada no servidor para OCR.");

            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const result = await model.generateContent([
              {
                inlineData: {
                  data: dataBuffer.toString("base64"),
                  mimeType: "application/pdf",
                },
              },
              "Extraia todo o texto deste documento PDF. Mantenha a fidelidade absoluta ao conteúdo escrito. " +
              "Se houver imagens com texto, transcreva-as. Não adicione comentários, apenas o texto do documento."
            ]);
            
            text = result.response.text();
            console.log("Extração via IA concluída com sucesso.");
          }
        } catch (pdfError: any) {
          console.error("Erro no pdf-parse, tentando IA diretamente:", pdfError);
          
          if (!genAI) throw pdfError;
          
          const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
          const result = await model.generateContent([
            {
              inlineData: {
                data: dataBuffer.toString("base64"),
                mimeType: "application/pdf",
              },
            },
            "Extraia todo o texto deste PDF."
          ]);
          text = result.response.text();
          console.log("Extração via IA (fallback) concluída.");
        }
      } else {
        text = dataBuffer.toString('utf-8');
      }
      
      // Delete temporary file
      fs.unlinkSync(req.file.path);

      res.json({ text });
    } catch (error: any) {
      console.error("Upload error:", error);
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
