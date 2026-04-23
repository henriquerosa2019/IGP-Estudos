import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";
import admin from "firebase-admin";
import multer from "multer";
import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: "luminous-girder-479214-f6",
  });
}

const db = admin.firestore();
const auth = admin.auth();

// Gemini Initialization
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

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
  app.post("/api/gemini/generate", verifyToken, async (req: any, res: any) => {
    if (!genAI) return res.status(500).json({ error: "Gemini not configured" });
    const { contents, config, model: modelNameRequested } = req.body;
    const modelName = modelNameRequested || "gemini-3-flash-preview";
    
    try {
      // Usage Check
      const uid = req.user.uid;
      const today = new Date().toISOString().split('T')[0];
      const usageRef = db.collection('usage').doc(uid);
      const usageDoc = await usageRef.get();
      
      let currentCount = 0;
      const usageData = usageDoc.exists ? usageDoc.data() : null;
      
      if (usageData && usageData.lastReset === today) {
        currentCount = usageData.count || 0;
      }

      // Allow admins more usage or different limits
      const isAdmin = req.user.email === "henrique.rosa@poli.ufrj.br" || req.user.email === "brunool.rj@gmail.com";
      // Harmonized with usageControl.ts: free:10, starter:50, pro:200, admin:1000
      // We set server limit to 200 for common users to allow Pro users to work, 
      // while the frontend handles more granular free/starter display.
      const limit = isAdmin ? 1000 : 200; 

      if (currentCount >= limit) {
        return res.status(429).json({ error: "Daily limit reached. Try again tomorrow!" });
      }

      const { systemInstruction, ...generationConfig } = config || {};
      const model = genAI.getGenerativeModel({ 
        model: modelName,
        systemInstruction: systemInstruction
      });
      
      const result = await model.generateContent({
        contents: typeof contents === 'string' ? [{ role: 'user', parts: [{ text: contents }] }] : contents,
        ...generationConfig
      });

      // Increment Usage
      if (!usageDoc.exists || usageData?.lastReset !== today) {
        await usageRef.set({
          count: 1,
          lastReset: today,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } else {
        await usageRef.update({
          count: admin.firestore.FieldValue.increment(1),
          updatedAt: new Date().toISOString()
        });
      }

      res.json({ text: result.response.text() });
    } catch (error: any) {
      console.error("Gemini error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/gemini/generate-questions", verifyToken, async (req: any, res: any) => {
    if (!genAI) return res.status(500).json({ error: "Gemini not configured" });
    const { content, count = 10, bancaContext } = req.body;
    
    try {
      const uid = req.user.uid;
      const today = new Date().toISOString().split('T')[0];
      const usageRef = db.collection('usage').doc(uid);
      const usageDoc = await usageRef.get();
      
      let currentCount = 0;
      const usageData = usageDoc.exists ? usageDoc.data() : null;
      if (usageData && usageData.lastReset === today) {
        currentCount = usageData.count || 0;
      }

      const isAdmin = req.user.email === "henrique.rosa@poli.ufrj.br" || req.user.email === "brunool.rj@gmail.com";
      const limit = isAdmin ? 1000 : 200; 

      if (currentCount >= limit) {
        return res.status(429).json({ error: "Daily limit reached. Try again tomorrow!" });
      }

      const systemInstruction = `Você é um especialista em concursos e exames da OAB e Carreiras Policiais. Sua tarefa é analisar o material fornecido e gerar uma lista de questões de múltipla escolha rigorosas e de alto nível. 
      ${bancaContext?.banca ? `A banca examinadora alvo é: ${bancaContext.banca}.` : ''}
      ${bancaContext?.characteristics ? `IMPORTANTE - Siga estas características da banca para as questões: ${bancaContext.characteristics}` : ''}
      Retorne APENAS o JSON no formato: { "questions": [ { "question": "...", "options": ["...", "...", "...", "...", "..."], "correctIndex": 0, "explanation": "..." } ] }`;

      const model = genAI.getGenerativeModel({ 
        model: "gemini-3-flash-preview",
        systemInstruction
      });
      
      const prompt = `Gere ${count} questões de múltipla escolha (estilo ${bancaContext?.banca || 'FCC/VUNESP/CESPE'}) baseadas exclusivamente no seguinte conteúdo:
      
      --- MATERIAL PARA ANÁLISE ---
      ${content.substring(0, 50000)}
      --- FIM DO MATERIAL ---
      
      REGRAS:
      1. Use 5 alternativas (A, B, C, D, E).
      2. Mantenha o foco em pegadinhas e detalhes técnicos típicos da banca.
      3. A explicação deve ser clara e explicar por que as outras estão erradas.`;

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });

      // Increment Usage (questions generation counts as 1 credit for now)
      if (!usageDoc.exists || usageData?.lastReset !== today) {
        await usageRef.set({
          count: 1,
          lastReset: today,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } else {
        await usageRef.update({
          count: admin.firestore.FieldValue.increment(1),
          updatedAt: new Date().toISOString()
        });
      }

      res.json({ text: result.response.text() });
    } catch (error: any) {
      console.error("Generate questions error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/usage/stats", verifyToken, async (req: any, res: any) => {
    const uid = req.user.uid;
    const today = new Date().toISOString().split('T')[0];
    const usageDoc = await db.collection('usage').doc(uid).get();
    
    let count = 0;
    if (usageDoc.exists && usageDoc.data()?.lastReset === today) {
      count = usageDoc.data()?.count || 0;
    }
    res.json({ count });
  });

  app.post("/api/upload/extract-text", verifyToken, upload.single('file'), async (req: any, res: any) => {
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

            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
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
          
          const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
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
