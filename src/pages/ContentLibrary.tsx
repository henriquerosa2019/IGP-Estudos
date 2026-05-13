import { useState, useEffect } from "react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Search, 
  Plus, 
  FileText, 
  Video, 
  Type, 
  Download, 
  ExternalLink, 
  BrainCircuit, 
  Trash2,
  Filter,
  MoreVertical,
  Loader2,
  BookOpen,
  Sparkles,
  Zap,
  Link as LinkIcon,
  Folder,
  FolderOpen,
  ChevronRight,
  ArrowLeft,
  Edit2,
  MessageSquare,
  Info,
  Save
} from "lucide-react";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { auth, db, storage, handleFirestoreError, OperationType } from "@/lib/firebase";
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  deleteDoc, 
  doc,
  updateDoc,
  orderBy,
  writeBatch
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { onAuthStateChanged } from "firebase/auth";
import * as pdfjsLib from 'pdfjs-dist';

// Configurar o worker do PDF.js usando um CDN confiável (Unpkg)
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
import { ContentItem } from "@/types";
import { 
  analyzeContent, 
  generateFlashcardsFromMultimodal, 
  generateQuestions,
  extractTextFromFile 
} from "@/lib/gemini";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function ContentLibrary() {
  console.log("ContentLibrary rendering...");
  const navigate = useNavigate();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSubject, setFilterSubject] = useState("all");
  const [sortBy, setSortBy] = useState<"date" | "title" | "subject">("date");
  const [user, setUser] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  // Upload Modal State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isQuestionsOpen, setIsQuestionsOpen] = useState(false);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [isSavingQuestions, setIsSavingQuestions] = useState(false);
  const [itemForQuestions, setItemForQuestions] = useState<ContentItem | null>(null);
  const [generatedQuestions, setGeneratedQuestions] = useState<any[]>([]);
  const [viewingQuestionBank, setViewingQuestionBank] = useState<ContentItem | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isExtracting, setIsExtracting] = useState(false);

  // Folder Navigation State
  type FolderState = null | { contest: string; subject?: string; subCategory?: string };
  const [currentFolder, setCurrentFolder] = useState<FolderState>(null);

  // Edit and Delete State
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<FolderState>(null);
  const [itemToEdit, setItemToEdit] = useState<ContentItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContest, setEditContest] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editSubCategory, setEditSubCategory] = useState("");
  const [editBanca, setEditBanca] = useState("");
  const [editBancaCharacteristics, setEditBancaCharacteristics] = useState("");

  // Função para extrair texto do PDF localmente (Fallback para erro de CORS)
  const extractTextFromPDF = async (file: File): Promise<string> => {
    try {
      console.log("Iniciando extração local de texto do PDF...");
      const arrayBuffer = await file.arrayBuffer();
      
      // Garantir que o worker está configurado
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
      }

      const loadingTask = pdfjsLib.getDocument({ 
        data: arrayBuffer,
        useWorkerFetch: true,
        isEvalSupported: false
      });
      
      const pdf = await loadingTask.promise;
      let fullText = "";
      
      console.log(`PDF carregado com sucesso. Total de páginas: ${pdf.numPages}`);
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => 'str' in item ? item.str : '')
          .join(" ");
        fullText += pageText + "\n";
      }
      
      const result = fullText.trim();
      if (!result) {
        console.warn("O texto extraído está vazio. O PDF pode ser uma imagem (escaneado).");
      }
      return result;
    } catch (error) {
      console.error("Erro técnico na extração PDF.js:", error);
      throw error;
    }
  };
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<'pdf' | 'text' | 'video' | 'link'>('text');
  const [newContent, setNewContent] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newContest, setNewContest] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newSubCategory, setNewSubCategory] = useState("");
  const [newBanca, setNewBanca] = useState("");
  const [newBancaCharacteristics, setNewBancaCharacteristics] = useState("");
  const [existingSubjects, setExistingSubjects] = useState<string[]>([]);
  const [existingContests, setExistingContests] = useState<string[]>([]);
  const [isCreatingNewSubject, setIsCreatingNewSubject] = useState(false);
  const [isCreatingNewContest, setIsCreatingNewContest] = useState(false);

  useEffect(() => {
    console.log("ContentLibrary: Iniciando monitoramento de Auth...");
    const authTimeout = setTimeout(() => {
      if (!authReady) {
        console.warn("Auth demorando demais, forçando inicialização...");
        setAuthReady(true);
      }
    }, 3000); // Reduced to 3s for faster feedback

    try {
      const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
        console.log("ContentLibrary: Auth status alterado", u ? "Logado" : "Anônimo");
        clearTimeout(authTimeout);
        setUser(u);
        setAuthReady(true);
      }, (err) => {
        console.error("Erro no onAuthStateChanged:", err);
        setAuthReady(true); // Still proceed to try loading
      });
      return () => {
        unsubscribeAuth();
        clearTimeout(authTimeout);
      };
    } catch (e) {
      console.error("Falha ao iniciar listener de Auth:", e);
      setAuthReady(true);
      return () => clearTimeout(authTimeout);
    }
  }, []);

  const getUid = () => {
    if (user) return user.uid;
    let localUid = localStorage.getItem('igp_local_uid');
    if (!localUid) {
      localUid = 'anon_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('igp_local_uid', localUid);
    }
    return localUid;
  };

  useEffect(() => {
    if (!authReady) return;

    let unsubscribe: () => void = () => {};
    let timeoutId: NodeJS.Timeout;

    try {
      const uid = getUid();
      console.log("ContentLibrary: Buscando dados para UID:", uid);
      
      if (!db) {
        setLoadError("Erro: Banco de dados não inicializado corretamente.");
        setLoading(false);
        return;
      }

      const isAdmin = user && (
        user.email === "henrique.rosa@poli.ufrj.br" || 
        user.email === "brunool.rj@gmail.com"
      );
      
      let q;
      if (isAdmin) {
        console.log("ContentLibrary: Admin detectado (" + user.email + "), buscando todos os itens do banco.");
        // Busca tudo sem filtro de UID para o admin
        q = query(collection(db, "contentItems"), orderBy("createdAt", "desc"));
      } else {
        q = query(
          collection(db, "contentItems"),
          where("uid", "==", uid),
          orderBy("createdAt", "desc")
        );
      }

      timeoutId = setTimeout(() => {
        if (loading) {
          console.error("TIMEOUT GLOBAL: O sistema não respondeu em 10 segundos.");
          setLoading(false);
          setIsConnected(false);
          setLoadError("O sistema de arquivos não respondeu. Isso pode ser um bloqueio de rede no AI Studio ou falha na conexão com o servidor.");
        }
      }, 10000);

      unsubscribe = onSnapshot(q, (snapshot) => {
        clearTimeout(timeoutId);
        console.log("Acervo: Snapshot recebido com", snapshot.size, "itens");
        const contentItems: ContentItem[] = [];
        const subjectsSet = new Set<string>();
        const contestsSet = new Set<string>();
        
        snapshot.forEach((doc) => {
          const data = doc.data() as ContentItem;
          contentItems.push({ ...data, id: doc.id });
          if (data.subject) subjectsSet.add(data.subject);
          contestsSet.add(data.contest || "Carreiras Policiais");
        });
        
        // Ensure "Carreiras Policiais" is always an option
        if (!contestsSet.has("Carreiras Policiais")) {
          contestsSet.add("Carreiras Policiais");
        }
        
        setItems(contentItems);
        setExistingSubjects(Array.from(subjectsSet).sort());
        setExistingContests(Array.from(contestsSet).sort());
        setLoading(false);
        setLoadError(null);
        setIsConnected(true);
      }, (error) => {
        clearTimeout(timeoutId);
        console.error("ERRO CRÍTICO FIRESTORE:", error);
        setLoading(false);
        setIsConnected(false);
        const detailedError = `Erro: ${error.message} (Código: ${error.name})`;
        setLoadError(detailedError);
        toast.error("Erro de conexão com o banco.");
      });
    } catch (e: any) {
      console.error("Erro ao configurar busca de dados:", e);
      setLoadError(`Erro de configuração: ${e.message}`);
      setLoading(false);
    }

    return () => {
      unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [authReady, user]);

  const handleUpload = async () => {
    console.log("handleUpload triggered. Type:", newType, "File selected:", !!newFile);
    
    if (!newTitle) {
      toast.error("Por favor, dê um título ao seu material.");
      return;
    }

    if (!newSubject) {
      toast.error("Por favor, selecione ou crie uma disciplina.");
      return;
    }

    if (newType === 'pdf' && !newFile) {
      toast.error("Por favor, selecione um arquivo PDF.");
      return;
    }

    if ((newType === 'video' || newType === 'link' || newType === 'text') && !newContent && !newFile) {
      toast.error("Por favor, insira o conteúdo ou link.");
      return;
    }

    setUploadLoading(true);
    setUploadProgress(5);
    const uid = getUid();
    const loadingToast = toast.loading("Preparando envio...");

    try {
      let contentValue = newContent;
      let finalType = newType;

      if (newType === 'pdf' && newFile) {
        console.log("Tentando upload de PDF...");
        toast.loading("Enviando arquivo PDF...", { id: loadingToast });
        
        const sanitizedName = newFile.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const storageRef = ref(storage, `content/${uid}/${Date.now()}_${sanitizedName}`);
        
        try {
          // Tenta o upload direto para o Firebase Storage primeiro
          const uploadPromise = uploadBytes(storageRef, newFile);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("CORS_OR_TIMEOUT")), 6000)
          );

          await Promise.race([uploadPromise, timeoutPromise]);
          contentValue = await getDownloadURL(storageRef);
          setUploadProgress(100);
        } catch (error: any) {
          console.warn("Upload direto falhou. Tentando extração local...");
          setIsExtracting(true);
          toast.loading("Lendo arquivo localmente (mais rápido)...", { id: loadingToast });
          
          try {
            // Tenta extração local (PDF.js) - Bypassa servidor e limites de rede
            const localText = await extractTextFromPDF(newFile);
            
            if (localText && localText.trim().length > 100) {
              contentValue = localText;
              finalType = 'text';
              toast.success("Leitura local concluída!", { id: loadingToast });
            } else {
              // Se a extração local falhar ou trouxer pouco texto (PDF escaneado), tenta OCR via servidor
              console.log("Pouco texto local. Chamando IA via servidor para OCR...");
              toast.loading("Arquivo sem texto direto. Usando IA para ler imagem...", { id: loadingToast });
              
              const serverText = await extractTextFromFile(newFile);
              if (!serverText || serverText.trim().length === 0) {
                throw new Error("Não conseguimos ler este arquivo nem mesmo com IA.");
              }
              contentValue = serverText;
              finalType = 'text';
              toast.success("O material foi lido e transcrito pela IA!", { id: loadingToast });
            }
          } catch (extractError: any) {
            console.error("Falha em todos os métodos de extração:", extractError);
            if (extractError.message?.includes("Failed to fetch")) {
              throw new Error("O arquivo é muito grande para o servidor. Tente reduzir o tamanho ou copiar o texto para a aba 'Texto'.");
            }
            throw new Error(`Não conseguimos ler este PDF: ${extractError.message}. Tente usar a aba 'Texto'.`);
          } finally {
            setIsExtracting(false);
          }
        }
      }

      toast.loading("Salvando no acervo...", { id: loadingToast });
      
      // IA Analysis (Optional & Fast)
      let analysis = { summary: "", topics: [] as string[] };
      if (newType === 'text' && newContent && newContent.length > 50) {
        try {
          // Add a timeout to analysis so it doesn't block forever
          const analysisPromise = analyzeContent(newContent, 'text');
          const timeoutPromise = new Promise((_, r) => setTimeout(() => r(new Error("Timeout")), 5000));
          const result = await Promise.race([analysisPromise, timeoutPromise]) as any;
          analysis = { summary: result.summary, topics: result.topics };
        } catch (e) {
          console.warn("AI Analysis skipped or failed", e);
        }
      }

      await addDoc(collection(db, "contentItems"), {
        uid,
        title: newTitle,
        type: finalType,
        content: contentValue,
        contest: newContest || "Carreiras Policiais",
        subject: newSubject,
        subCategory: newSubCategory,
        banca: newBanca || null,
        bancaCharacteristics: newBancaCharacteristics || null,
        createdAt: new Date().toISOString(),
        summary: analysis.summary,
        topics: analysis.topics
      });

      toast.success("Conteúdo adicionado com sucesso!", { id: loadingToast });
      setIsUploadOpen(false);
      resetUploadForm();
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(`Falha ao salvar: ${error.message || "Verifique sua conexão"}`, { id: loadingToast });
    } finally {
      setUploadLoading(false);
      setUploadProgress(0);
    }
  };

  const resetUploadForm = () => {
    setNewTitle("");
    setNewType('text');
    setNewContent("");
    setNewFile(null);
    setNewContest("");
    setNewSubject("");
    setNewSubCategory("");
    setNewBanca("");
    setNewBancaCharacteristics("");
    setIsCreatingNewSubject(false);
    setIsCreatingNewContest(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "contentItems", id));
      toast.success("Conteúdo excluído.");
      setItemToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `contentItems/${id}`);
      toast.error("Erro ao excluir conteúdo.");
    }
  };

  const handleDeleteFolder = async () => {
    if (!folderToDelete) return;
    
    const loadingToast = toast.loading("Excluindo pasta e conteúdos...");
    try {
      // Find all items belonging to this folder/hierarchy
      const itemsToDeleteInFolder = items.filter(item => {
        const matchesContest = (item.contest || "Carreiras Policiais") === folderToDelete.contest;
        const matchesSubject = !folderToDelete.subject || item.subject === folderToDelete.subject;
        const matchesSubCategory = !folderToDelete.subCategory || item.subCategory === folderToDelete.subCategory;
        return matchesContest && matchesSubject && matchesSubCategory;
      });

      if (itemsToDeleteInFolder.length > 0) {
        const batch = writeBatch(db);
        itemsToDeleteInFolder.forEach(item => {
          batch.delete(doc(db, "contentItems", item.id));
        });
        await batch.commit();
      }

      toast.success(`${itemsToDeleteInFolder.length} itens excluídos com sucesso.`, { id: loadingToast });
      setFolderToDelete(null);
      setCurrentFolder(null); // Return to root after deleting a folder for simplicity
    } catch (error) {
      console.error("Erro ao excluir pasta:", error);
      toast.error("Erro ao excluir pasta.", { id: loadingToast });
    }
  };

  const handleEditSave = async () => {
    if (!itemToEdit) return;
    if (!editTitle.trim()) {
      toast.error("O título não pode ficar vazio.");
      return;
    }
    if (!editSubject.trim()) {
      toast.error("A disciplina não pode ficar vazia.");
      return;
    }

    try {
      await updateDoc(doc(db, "contentItems", itemToEdit.id), {
        title: editTitle,
        contest: editContest || "Carreiras Policiais",
        subject: editSubject,
        subCategory: editSubCategory || null,
        banca: editBanca || null,
        bancaCharacteristics: editBancaCharacteristics || null
      });
      toast.success("Conteúdo atualizado com sucesso!");
      setItemToEdit(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `contentItems/${itemToEdit.id}`);
      toast.error("Erro ao atualizar conteúdo.");
    }
  };

  const handleGenerateQuestions = async (item: ContentItem) => {
    setItemForQuestions(item);
    setIsGeneratingQuestions(true);
    setIsQuestionsOpen(true);
    setGeneratedQuestions([]);
    const toastId = toast.loading("Gerando banco de questões...");

    try {
      let text = item.content;
      if (item.type === 'pdf') {
        const response = await fetch(item.content);
        const blob = await response.blob();
        const file = new File([blob], "material.pdf", { type: "application/pdf" });
        text = await extractTextFromFile(file);
      }
      
      const q = await generateQuestions(text, 10, {
        banca: item.banca,
        characteristics: item.bancaCharacteristics
      });
      setGeneratedQuestions(q);
      toast.success("Banco de questões gerado com sucesso!", { id: toastId });
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao gerar questões: " + (error.message || "Erro desconhecido"), { id: toastId });
      setIsQuestionsOpen(false);
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  const handleSaveQuestions = async () => {
    if (!itemForQuestions || generatedQuestions.length === 0) return;
    
    setIsSavingQuestions(true);
    const toastId = toast.loading("Salvando banco de questões...");
    
    try {
      const uid = getUid();
      await addDoc(collection(db, "contentItems"), {
        uid,
        title: `Caderno de Questões: ${itemForQuestions.title}`,
        type: "questionBank",
        content: JSON.stringify(generatedQuestions),
        contest: itemForQuestions.contest || "Carreiras Policiais",
        subject: itemForQuestions.subject,
        subCategory: itemForQuestions.subCategory || "IA",
        createdAt: new Date().toISOString(),
        summary: `Banco de ${generatedQuestions.length} questões gerado a partir de ${itemForQuestions.title}.`
      });
      
      toast.success("Banco de questões salvo no seu acervo!", { id: toastId });
      setIsQuestionsOpen(false);
    } catch (error) {
      console.error("Erro ao salvar questões:", error);
      toast.error("Erro ao salvar o banco de questões.", { id: toastId });
    } finally {
      setIsSavingQuestions(false);
    }
  };

  const handleGenerateFlashcards = async (item: ContentItem) => {
    toast.promise(
      (async () => {
        let textToProcess = item.content;
        
        if (item.type === 'pdf') {
          // For PDF, we'd ideally extract text. For now, we'll use the title and summary if available
          textToProcess = `Conteúdo: ${item.title}\nResumo: ${item.summary || ''}\nTópicos: ${(item.topics || []).join(', ')}`;
        } else if (item.type === 'video') {
          // For video, we'd need transcription. For now, use title
          textToProcess = `Vídeo sobre: ${item.title}`;
        }

        const parts = [{ text: textToProcess }];
        const generatedCards = await generateFlashcardsFromMultimodal(parts, item.title);
        
        const uid = user?.uid || localStorage.getItem('localUid');
        
        // Save to library (localStorage for now to match existing logic, or Firestore if you prefer)
        const savedDecksStr = localStorage.getItem('aestudamos_flashcards');
        const savedDecks = savedDecksStr ? JSON.parse(savedDecksStr) : [];
        
        const newDeck = {
          id: `deck-${Date.now()}`,
          name: `IA: ${item.title}`,
          cards: generatedCards.map((c: any) => ({
            ...c,
            id: `card-${Math.random().toString(36).substring(2, 11)}`,
            subject: item.subject
          }))
        };
        
        localStorage.setItem('aestudamos_flashcards', JSON.stringify([...savedDecks, newDeck]));
        
        return "Flashcards gerados com sucesso!";
      })(),
      {
        loading: 'IA processando conteúdo e gerando flashcards...',
        success: (data) => {
          return (
            <div className="flex flex-col gap-2">
              <span className="font-medium text-green-600 dark:text-green-400">{data}</span>
              <Button 
                size="sm" 
                onClick={() => navigate('/flashcards')}
                className="bg-green-600 hover:bg-green-700 text-white w-full mt-1"
              >
                Ir para Flashcards
              </Button>
            </div>
          );
        },
        error: (err: any) => {
          console.error("Erro detalhado na geração de flashcards:", err);
          return err.message || 'Erro ao gerar flashcards.';
        }
      }
    );
  };

  const filteredItems = items
    .filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           item.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (item.contest && item.contest.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesFilter = filterSubject === "all" || item.subject === filterSubject;
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      if (sortBy === "date") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === "title") return a.title.localeCompare(b.title);
      if (sortBy === "subject") return a.subject.localeCompare(b.subject);
      return 0;
    });

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] w-full bg-background  rounded-3xl p-8 text-center">
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-full mb-4">
          <BrainCircuit className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-white  mb-2">Ops! Algo deu errado</h2>
        <p className="text-zinc-500 mb-6 max-w-md">{loadError}</p>
        <div className="flex flex-col gap-2 items-center">
          <Button 
            onClick={() => window.location.reload()}
            className="bg-primary hover:bg-[#e68a00] text-white w-fit"
          >
            Tentar Novamente
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowDebug(!showDebug)}
            className="text-zinc-400 text-xs"
          >
            {showDebug ? "Ocultar Detalhes" : "Ver Detalhes Técnicos"}
          </Button>
          {showDebug && (
            <div className="mt-4 p-4 bg-card  rounded-lg text-left text-[10px] font-mono overflow-auto max-w-md w-full">
              <p>UID: {getUid()}</p>
              <p>Auth Ready: {authReady ? "Sim" : "Não"}</p>
              <p>User: {user ? user.email : "Anônimo"}</p>
              <p>Items: {items.length}</p>
              <p>Config: {db.app.options.projectId}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!authReady || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] w-full bg-background  rounded-3xl">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="text-zinc-500 font-medium">
          {!authReady ? "Iniciando Acervo Inteligente..." : "Carregando seus materiais..."}
        </p>
        <div className="mt-8 text-[10px] text-zinc-400 flex flex-col items-center gap-1">
          <p>Se demorar mais de 10 segundos, verifique sua conexão.</p>
          <p>UID: {getUid()}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] py-8 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-primary" />
              Acervo Inteligente
            </h1>
            <p className="text-zinc-400 mt-1">Organize seus materiais por disciplina e gere flashcards com IA.</p>
          </div>
        
        <div className="flex gap-3">
          <Button 
            variant="outline"
            className="border-primary text-primary hover:bg-orange-50 font-bold"
            onClick={async () => {
              const uid = getUid();
              const loadingToast = toast.loading("Importando material de Direito Penal...");
              try {
                await addDoc(collection(db, "contentItems"), {
                  uid,
                  title: "Dolo e Culpa",
                  type: "text",
                  content: `KVERNA CONCURSOS – AÇÃO E OMISSÃO / DOLO E CULPA\nDIREITO PENAL\n\n1) Prova: CESPE/CEBRASPE - TJ MA - Juiz de Direito Substituto - 2022\nO agente que imagina já ter obtido o resultado pensado por ele, sem tê-lo alcançado, e, por isso, pratica outra conduta que efetivamente alcança o objetivo primário realiza a conduta em dolo geral ou erro sucessivo.\nGabarito: Certo\n\n2) Prova: FGV - PC RJ - Inspetor de Polícia - 2022\nTício, com a intenção de matar Mévio, desferiu-lhe diversos golpes de faca. Acreditando que Mévio já estava morto, Tício o enterrou no quintal de sua casa. Posteriormente, o laudo pericial constatou que a causa da morte de Mévio foi asfixia por soterramento. Diante desse quadro, Tício deverá responder por: homicídio doloso consumado.\nGabarito: A\n\n[CONTEÚDO IMPORTADO DO CHAT]`,
                  subject: "Direito Penal",
                  subCategory: "Prof Marlon",
                  createdAt: new Date().toISOString(),
                  summary: "Material sobre dolo e culpa no Direito Penal, incluindo questões de concursos como CESPE e FGV.",
                  topics: ["Dolo", "Culpa", "Direito Penal"]
                });
                toast.success("Material importado com sucesso!", { id: loadingToast });
              } catch (e) {
                toast.error("Erro ao importar material.", { id: loadingToast });
              }
            }}
          >
            <Zap className="w-4 h-4 mr-2" /> Importar Chat
          </Button>

          <Button 
            className="bg-primary hover:bg-primary/80 text-black font-bold gap-2"
            onClick={() => {
              setNewType('pdf');
              setNewSubCategory('Simulado / Prova');
              setIsUploadOpen(true);
            }}
          >
            <FileText className="w-4 h-4" /> Enviar Prova
          </Button>

          <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
            <DialogTrigger render={
              <Button className="bg-primary hover:bg-primary/80 text-black font-bold gap-2">
                <Plus className="w-4 h-4" /> Adicionar
              </Button>
            } />
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader className="shrink-0">
              <DialogTitle className="text-2xl font-bold text-primary">Novo Conteúdo</DialogTitle>
              <DialogDescription className="text-zinc-400">
                Adicione materiais de estudo ou envie uma <b>prova anterior (PDF)</b> para que a IA gere um simulado personalizado de questões.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 overflow-y-auto flex-1 pr-1">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input 
                  placeholder="Ex: Resumo de Direito Penal - Parte 1" 
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Concurso / Carreira</Label>
                <div className="flex gap-2">
                  {!isCreatingNewContest ? (
                    <Select 
                      value={newContest} 
                      onValueChange={(val) => {
                        if (val === "_new") {
                          setIsCreatingNewContest(true);
                          setNewContest("");
                        } else {
                          setNewContest(val);
                        }
                      }}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Selecione ou crie um concurso..." />
                      </SelectTrigger>
                      <SelectContent>
                        {existingContests.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                        <SelectItem value="_new" className="text-primary font-bold">+ Criar Novo Concurso</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input 
                      placeholder="Nome do concurso (ex: PRF, PF, Policial)..." 
                      value={newContest}
                      onChange={(e) => setNewContest(e.target.value)}
                      autoFocus
                    />
                  )}
                  {isCreatingNewContest && (
                    <Button variant="ghost" size="sm" onClick={() => {
                      setIsCreatingNewContest(false);
                      setNewContest("");
                    }}>Voltar</Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Disciplina</Label>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-[10px] text-primary gap-1 hover:text-[#e68a00] hover:bg-orange-50"
                    onClick={async () => {
                      if (!newContent && !newFile) {
                        toast.error("Adicione conteúdo primeiro para a IA analisar.");
                        return;
                      }
                      toast.promise(
                        (async () => {
                          let textToAnalyze = newContent;
                          if (newType === 'pdf' && newFile) {
                            textToAnalyze = `Arquivo: ${newFile.name}`; // Limited for now
                          }
                          const result = await analyzeContent(textToAnalyze, newType);
                          setNewSubject(result.suggestedSubject);
                          if (!newTitle) setNewTitle(result.topics[0] || "");
                          return `Sugestão: ${result.suggestedSubject}`;
                        })(),
                        {
                          loading: 'IA analisando...',
                          success: (data) => data,
                          error: 'Erro na análise.'
                        }
                      );
                    }}
                  >
                    <Sparkles className="w-3 h-3" /> Sugerir com IA
                  </Button>
                </div>
                <div className="flex gap-2">
                  {!isCreatingNewSubject ? (
                    <Select 
                      value={newSubject} 
                      onValueChange={(val) => {
                        if (val === "_new") {
                          setIsCreatingNewSubject(true);
                          setNewSubject("");
                        } else {
                          setNewSubject(val);
                        }
                      }}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Selecione ou crie uma..." />
                      </SelectTrigger>
                      <SelectContent>
                        {existingSubjects.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                        <SelectItem value="_new" className="text-primary font-bold">+ Criar Nova Disciplina</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input 
                      placeholder="Nome da nova disciplina..." 
                      value={newSubject}
                      onChange={(e) => setNewSubject(e.target.value)}
                      autoFocus
                    />
                  )}
                  {isCreatingNewSubject && (
                    <Button variant="ghost" size="sm" onClick={() => {
                      setIsCreatingNewSubject(false);
                      setNewSubject("");
                    }}>Voltar</Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Subpasta / Professor (Opcional)</Label>
                <Input 
                  placeholder="Ex: Prof Marlon, Módulo 1..." 
                  value={newSubCategory}
                  onChange={(e) => setNewSubCategory(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo de Conteúdo</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Button 
                    variant={newType === 'text' ? 'default' : 'outline'} 
                    onClick={() => setNewType('text')}
                    className="gap-2 text-xs px-2"
                  >
                    <Type className="w-4 h-4" /> Texto
                  </Button>
                  <Button 
                    variant={newType === 'pdf' ? 'default' : 'outline'} 
                    onClick={() => setNewType('pdf')}
                    className="gap-2 text-xs px-2"
                  >
                    <FileText className="w-4 h-4" /> PDF
                  </Button>
                  <Button 
                    variant={newType === 'video' ? 'default' : 'outline'} 
                    onClick={() => setNewType('video')}
                    className="gap-2 text-xs px-2"
                  >
                    <Video className="w-4 h-4" /> Vídeo
                  </Button>
                  <Button 
                    variant={newType === 'link' ? 'default' : 'outline'} 
                    onClick={() => setNewType('link')}
                    className="gap-2 text-xs px-2"
                  >
                    <LinkIcon className="w-4 h-4" /> Link
                  </Button>
                </div>
              </div>

              {newType === 'text' && (
                <div className="space-y-2">
                  <Label>Conteúdo (Texto)</Label>
                  <Textarea 
                    placeholder="Cole seu texto aqui..." 
                    className="min-h-[150px]"
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                  />
                </div>
              )}

              {newType === 'pdf' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Arquivo PDF</Label>
                    <Input 
                      type="file" 
                      accept=".pdf" 
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        console.log("File selected:", file?.name, "Size:", file?.size);
                        setNewFile(file);
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>Banca Examinadora</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger render={
                            <Info className="w-4 h-4 text-zinc-500 cursor-help" />
                          } />
                          <TooltipContent className="bg-zinc-900 border-zinc-800 text-white max-w-[250px]">
                            <p className="text-xs">
                              <b>Dica:</b> Pesquise no Google ou pergunte ao ChatGPT: 
                              "Quais as principais características e pegadinhas da banca [Nome da Banca] em provas de [Sua Área]?" 
                              Copie e cole os pontos principais ao lado para questões mais assertivas.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Input 
                      placeholder="Ex: CESPE, FGV, VUNESP..." 
                      value={newBanca}
                      onChange={(e) => setNewBanca(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Características da Banca (Opcional)</Label>
                    <Textarea 
                      placeholder="Ex: Gosta de jurisprudência atualizada, enunciados longos, pegadinhas em prazos..." 
                      className="min-h-[80px]"
                      value={newBancaCharacteristics}
                      onChange={(e) => setNewBancaCharacteristics(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {newType === 'video' && (
                <div className="space-y-2">
                  <Label>Link do Vídeo (YouTube)</Label>
                  <Input 
                    placeholder="https://youtube.com/watch?v=..." 
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                  />
                </div>
              )}

              {newType === 'link' && (
                <div className="space-y-2">
                  <Label>Link Externo (Artigo, Notícia, etc.)</Label>
                  <Input 
                    placeholder="https://exemplo.com/artigo" 
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                  />
                </div>
              )}
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              {uploadLoading && newType === 'pdf' && (
                <div className="w-full mb-4 px-1">
                  <div className="flex justify-between text-xs mb-2 font-medium text-zinc-400">
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin text-primary" />
                      {uploadProgress === 100 ? "Processando..." : "Enviando arquivo..."}
                    </span>
                    <span className="text-primary">{uploadProgress > 0 ? `${uploadProgress}%` : "Aguarde..."}</span>
                  </div>
                  <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden border border-zinc-700">
                    <div 
                      className="h-full bg-primary transition-all duration-500 ease-out"
                      style={{ width: `${uploadProgress > 0 ? uploadProgress : 5}%` }}
                    />
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2 w-full">
                <Button variant="outline" onClick={() => setIsUploadOpen(false)}>Cancelar</Button>
                <Button 
                  onClick={handleUpload} 
                  disabled={uploadLoading}
                  className="bg-primary hover:bg-[#e68a00] text-white border-none"
                >
                  {uploadLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Salvar Conteúdo
                </Button>
              </div>
              {uploadLoading && (
                <div className="w-full mt-4 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-100 dark:border-orange-800">
                  <p className="text-[10px] text-orange-700 dark:text-orange-300 leading-relaxed">
                    <strong>Dica IgpAI:</strong> Arquivos PDF muito grandes ou com bloqueio de segurança podem demorar para processar. Se falhar, use a aba <b>'Texto'</b> para colar o conteúdo diretamente.
                  </p>
                </div>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={isQuestionsOpen} onOpenChange={(open) => {
          setIsQuestionsOpen(open);
          if (!open) setViewingQuestionBank(null);
        }}>
          <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto bg-[#121212] border-zinc-800 text-white">
            <DialogHeader>
              <DialogTitle className="text-primary text-2xl font-bold flex items-center gap-2">
                <Sparkles className="w-6 h-6" /> Banco de Questões Inteligente
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {!isGeneratingQuestions && generatedQuestions.length > 0 && !viewingQuestionBank && (
                <div className="flex justify-between items-center bg-primary/10 p-4 rounded-xl border border-primary/20 mb-4">
                  <div className="flex items-center gap-2">
                    <Save className="w-5 h-5 text-primary" />
                    <span className="text-sm font-medium text-primary">Estas questões ainda não estão salvas no seu acervo.</span>
                  </div>
                  <Button 
                    size="sm"
                    className="bg-primary hover:bg-primary/80 text-black font-bold h-9 rounded-lg"
                    disabled={isSavingQuestions}
                    onClick={handleSaveQuestions}
                  >
                    {isSavingQuestions ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Salvar Agora
                  </Button>
                </div>
              )}
              {isGeneratingQuestions ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <Loader2 className="w-12 h-12 text-primary animate-spin" />
                  <p className="text-zinc-400 animate-pulse">A IgpAI está formulando questões de alto nível para você...</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {generatedQuestions.map((q, idx) => (
                    <div key={idx} className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800 relative group overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                      <h4 className="font-bold text-lg mb-4 text-zinc-100 flex gap-3">
                        <span className="text-primary">Q{idx + 1}.</span> {q.question}
                      </h4>
                      <div className="space-y-3">
                        {q.options.map((option: string, oIdx: number) => (
                          <div 
                            key={oIdx} 
                            className={cn(
                              "p-3 rounded-xl border transition-all cursor-pointer",
                              oIdx === q.correctIndex 
                                ? "bg-green-500/10 border-green-500/30 text-green-400" 
                                : "bg-zinc-900 border-zinc-800 hover:border-zinc-600 text-zinc-400"
                            )}
                          >
                            <span className="font-bold mr-2">{String.fromCharCode(65 + oIdx)})</span>
                            {option}
                          </div>
                        ))}
                      </div>
                      <div className="mt-6 p-4 bg-primary/5 rounded-xl border border-primary/20">
                        <p className="text-xs font-bold text-primary mb-1 uppercase tracking-wider">Fundamentação IgpAI:</p>
                        <p className="text-sm text-zinc-300 leading-relaxed italic">{q.explanation}</p>
                      </div>
                    </div>
                  ))}
                  <Button 
                    className="w-full bg-primary hover:bg-primary/80 text-black font-bold h-12 rounded-xl"
                    disabled={isSavingQuestions || !!viewingQuestionBank}
                    onClick={handleSaveQuestions}
                  >
                    {isSavingQuestions ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Salvando...</>
                    ) : viewingQuestionBank ? (
                      "Caderno já está no seu Acervo"
                    ) : (
                      "Salvar Banco de Questões no Acervo"
                    )}
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
          <Input 
            placeholder="Buscar por título ou disciplina..." 
            className="pl-10 focus-visible:ring-[#FF9900]"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (e.target.value) setCurrentFolder(null); // Reset folder view on search
            }}
          />
        </div>
        
        <div className="flex gap-2">
          <div className="flex-1">
            <Select value={filterSubject} onValueChange={setFilterSubject}>
              <SelectTrigger className="focus:ring-[#FF9900]">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-primary" />
                  <SelectValue placeholder="Disciplina" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Disciplinas</SelectItem>
                {existingSubjects.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex-1">
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Data (Novo)</SelectItem>
                <SelectItem value="title">Título (A-Z)</SelectItem>
                <SelectItem value="subject">Disciplina</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
          <p className="text-zinc-500">Carregando seu acervo...</p>
        </div>
      ) : filteredItems.length > 0 ? (
        <div className="space-y-6">
          {/* Breadcrumbs */}
          {!searchTerm && currentFolder && (
            <div className="flex items-center gap-2 text-sm text-zinc-400 mb-6 bg-[#1a1a1a] p-2 px-4 rounded-full w-fit border border-zinc-800">
              <button 
                onClick={() => setCurrentFolder(null)}
                className="hover:text-primary transition-colors flex items-center gap-1 font-medium"
              >
                <Folder className="w-4 h-4" /> Acervo
              </button>
              
              <ChevronRight className="w-3 h-3 opacity-50" />
              <button 
                onClick={() => setCurrentFolder({ contest: currentFolder.contest })}
                className={cn(
                  "hover:text-primary transition-colors font-medium",
                  !currentFolder.subject && "text-white"
                )}
              >
                {currentFolder.contest}
              </button>

              {currentFolder.subject && (
                <>
                  <ChevronRight className="w-3 h-3 opacity-50" />
                  <button 
                    onClick={() => setCurrentFolder({ contest: currentFolder.contest, subject: currentFolder.subject })}
                    className={cn(
                      "hover:text-primary transition-colors font-medium",
                      !currentFolder.subCategory && "text-white"
                    )}
                  >
                    {currentFolder.subject}
                  </button>
                </>
              )}

              {currentFolder.subCategory && (
                <>
                  <ChevronRight className="w-3 h-3 opacity-50" />
                  <span className="text-white font-medium">
                    {currentFolder.subCategory}
                  </span>
                </>
              )}
            </div>
          )}

              {/* Folder View Logic */}
          {(() => {
            const renderItemCard = (item: ContentItem) => (
              <div key={item.id}>
                <Card className="group bg-background border-none transition-all duration-300 shadow-lg hover:shadow-xl overflow-hidden flex flex-col h-full rounded-[2rem]">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="p-3 bg-orange-100 rounded-2xl text-primary">
                        {item.type === 'pdf' ? <FileText className="w-6 h-6" /> : 
                         item.type === 'video' ? <Video className="w-6 h-6" /> : 
                         item.type === 'link' ? <LinkIcon className="w-6 h-6" /> :
                         item.type === 'questionBank' ? <BrainCircuit className="w-6 h-6" /> :
                         <Type className="w-6 h-6" />}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger className={cn(
                          buttonVariants({ variant: "ghost", size: "icon" }),
                          "h-8 w-8 p-0 text-zinc-400 hover:text-white"
                        )}>
                          <MoreVertical className="w-5 h-5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setEditTitle(item.title);
                            setEditContest(item.contest || "Carreiras Policiais");
                            setEditSubject(item.subject);
                            setEditSubCategory(item.subCategory || "");
                            setEditBanca(item.banca || "");
                            setEditBancaCharacteristics(item.bancaCharacteristics || "");
                            setItemToEdit(item);
                          }}>
                            <Edit2 className="w-4 h-4 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-primary" onClick={() => setItemToDelete(item.id)}>
                            <Trash2 className="w-4 h-4 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="mt-4">
                      <div className="flex flex-wrap gap-2 mb-3">
                        <Badge className="bg-black text-primary hover:bg-black border-none px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-full">
                          {item.subject}
                        </Badge>
                        {item.subCategory && (
                          <Badge className="bg-background0 text-white hover:bg-background0 border-none px-3 py-1 text-[10px] font-bold rounded-full">
                            {item.subCategory}
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-xl font-bold text-white leading-tight">
                        {item.title}
                      </CardTitle>
                      <CardDescription className="text-zinc-400 text-xs mt-1 font-medium">
                        Adicionado em {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col pt-0">
                    {item.summary && (
                      <p className="text-sm text-zinc-500 line-clamp-2 mb-4">
                        {item.summary}
                      </p>
                    )}
                    
                    <div className="mt-auto pt-4 flex flex-wrap gap-2">
                      {item.type === 'pdf' ? (
                        <a 
                          href={item.content} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "flex-1 gap-2 rounded-xl border-zinc-200 text-zinc-400 hover:bg-background"
                          )}
                        >
                          <Download className="w-4 h-4" /> Baixar
                        </a>
                      ) : item.type === 'video' || item.type === 'link' ? (
                        <a 
                          href={item.content} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "flex-1 gap-2 rounded-xl border-zinc-200 text-zinc-400 hover:bg-background"
                          )}
                        >
                          <ExternalLink className="w-4 h-4" /> Abrir
                        </a>
                      ) : item.type === 'questionBank' ? (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1 gap-2 rounded-xl border-zinc-300 text-zinc-400 hover:bg-background font-bold"
                          onClick={() => {
                            try {
                              const questions = JSON.parse(item.content);
                              setGeneratedQuestions(questions);
                              setViewingQuestionBank(item);
                              setIsQuestionsOpen(true);
                            } catch (e) {
                              toast.error("Erro ao carregar caderno de questões.");
                            }
                          }}
                        >
                          <BrainCircuit className="w-4 h-4" /> Abrir Caderno
                        </Button>
                      ) : (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1 gap-2 rounded-xl border-zinc-300 text-zinc-400 hover:bg-background font-bold"
                          onClick={() => {
                            toast.info("Conteúdo de texto: " + item.title);
                          }}
                        >
                          <Type className="w-4 h-4" /> Ver Texto
                        </Button>
                      )}
                      
                      <Button 
                        className="flex-1 gap-2 bg-black hover:bg-zinc-900 text-primary font-bold rounded-xl border-none" 
                        size="sm"
                        onClick={() => handleGenerateQuestions(item)}
                      >
                        <Sparkles className="w-4 h-4" /> Questões
                      </Button>
                      
                      <Button 
                        className="flex-1 gap-2 bg-black hover:bg-zinc-900 text-primary font-bold rounded-xl border-none" 
                        size="sm"
                        onClick={() => handleGenerateFlashcards(item)}
                      >
                        <BrainCircuit className="w-4 h-4" /> Flashcards
                      </Button>
                      
                      <Button 
                        className="flex-1 gap-2 bg-black hover:bg-zinc-900 text-primary font-bold rounded-xl border-none" 
                        size="sm"
                        onClick={() => {
                          localStorage.setItem('tutor_initial_context', JSON.stringify({
                            title: item.title,
                            subject: item.subject,
                            summary: item.summary,
                            content: item.content,
                            type: item.type
                          }));
                          window.location.href = '/tutor';
                        }}
                      >
                        <MessageSquare className="w-4 h-4" /> Tutor
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );

            const renderFolderCard = (title: string, count: number, onClick: () => void, folderData: FolderState) => (
              <Card 
                key={title}
                className="cursor-pointer bg-[#1a1a1a] border-zinc-800 hover:border-primary transition-all flex items-center p-5 gap-4 shadow-xl rounded-2xl group"
                onClick={onClick}
              >
                <div className="p-3 bg-zinc-800 rounded-xl text-primary group-hover:bg-primary group-hover:text-black transition-colors">
                  <Folder className="w-6 h-6 fill-current opacity-40" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-white line-clamp-1 text-lg tracking-tight">{title}</h3>
                  <p className="text-sm text-zinc-500 font-medium">{count} ite{count === 1 ? 'm' : 'ns'}</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger onClick={(e) => e.stopPropagation()} render={
                      <Button variant="ghost" size="icon" className="h-8 w-8 p-0 text-zinc-500 hover:text-white hover:bg-zinc-800">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    } />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        className="text-primary font-bold" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setFolderToDelete(folderData);
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Excluir Pasta
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <ChevronRight className="w-5 h-5 text-zinc-300 group-hover:text-primary transition-colors" />
                </div>
              </Card>
            );

            if (searchTerm) {
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredItems.map(renderItemCard)}
                </div>
              );
            }

            if (currentFolder === null) {
              const contests = Array.from(new Set(filteredItems.map(i => i.contest || "Carreiras Policiais")));
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {contests.map(contest => {
                    const count = filteredItems.filter(i => (i.contest || "Carreiras Policiais") === contest).length;
                    return renderFolderCard(contest, count, () => setCurrentFolder({ contest }), { contest });
                  })}
                </div>
              );
            }

            if (!currentFolder.subject) {
              const contestItems = filteredItems.filter(i => (i.contest || "Carreiras Policiais") === currentFolder.contest);
              const subjects = Array.from(new Set(contestItems.map(i => i.subject)));
              
              return (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {subjects.map(subject => {
                      const count = contestItems.filter(i => i.subject === subject).length;
                      return renderFolderCard(subject, count, () => setCurrentFolder({ contest: currentFolder.contest, subject }), { contest: currentFolder.contest, subject });
                    })}
                  </div>
                </div>
              );
            }

            if (!currentFolder.subCategory) {
              const subjectItems = filteredItems.filter(i => 
                (i.contest || "Carreiras Policiais") === currentFolder.contest && 
                i.subject === currentFolder.subject
              );
              const subCategories = Array.from(new Set(subjectItems.filter(i => i.subCategory).map(i => i.subCategory as string)));
              const itemsWithoutSub = subjectItems.filter(i => !i.subCategory);

              return (
                <div className="space-y-8">
                  {subCategories.length > 0 && (
                    <div>
                      <h3 className="text-xs font-black text-zinc-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                        <FolderOpen className="w-4 h-4" /> Professores / Módulos
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {subCategories.map(sub => {
                          const count = subjectItems.filter(i => i.subCategory === sub).length;
                          return renderFolderCard(sub, count, () => setCurrentFolder({ 
                            contest: currentFolder.contest, 
                            subject: currentFolder.subject, 
                            subCategory: sub 
                          }), { contest: currentFolder.contest, subject: currentFolder.subject, subCategory: sub });
                        })}
                      </div>
                    </div>
                  )}
                  
                  {itemsWithoutSub.length > 0 && (
                    <div>
                      <h3 className="text-xs font-black text-zinc-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                        <FileText className="w-4 h-4" /> Arquivos em {currentFolder.subject}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {itemsWithoutSub.map(renderItemCard)}
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            const finalLevelItems = filteredItems.filter(i => 
              (i.contest || "Carreiras Policiais") === currentFolder.contest && 
              i.subject === currentFolder.subject && 
              i.subCategory === currentFolder.subCategory
            );
            return (
              <div>
                <h3 className="text-xs font-black text-zinc-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Arquivos em {currentFolder.subCategory}
                </h3>
                {finalLevelItems.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {finalLevelItems.map(renderItemCard)}
                  </div>
                ) : (
                  <p className="text-zinc-500 text-center py-10">Esta subpasta está vazia.</p>
                )}
              </div>
            );
          })()}
        </div>
      ) : (
        <div className="text-center py-20 bg-background /50 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
          <div className="bg-background  w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
            <BookOpen className="w-8 h-8 text-zinc-300" />
          </div>
          <h3 className="text-lg font-bold text-white ">Nenhum conteúdo encontrado</h3>
          <p className="text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto mt-2">
            Comece adicionando PDFs, textos ou vídeos para organizar seu acervo inteligente.
          </p>
          <Button 
            variant="outline" 
            className="mt-6 border-orange-200 text-primary hover:bg-orange-50"
            onClick={() => setIsUploadOpen(true)}
          >
            Adicionar Primeiro Conteúdo
          </Button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Excluir Conteúdo</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-zinc-600 dark:text-zinc-400">
              Tem certeza que deseja excluir este material? Esta ação não pode ser desfeita.
            </p>
          </div>
          <DialogFooter className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setItemToDelete(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => itemToDelete && handleDelete(itemToDelete)}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Folder Delete Confirmation Dialog */}
      <Dialog open={!!folderToDelete} onOpenChange={(open) => !open && setFolderToDelete(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Excluir Pasta</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-zinc-600 dark:text-zinc-400">
              Tem certeza que deseja excluir esta pasta? <strong>Todos os materiais dentro dela serão excluídos permanentemente.</strong> Esta ação não pode ser desfeita.
            </p>
          </div>
          <DialogFooter className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setFolderToDelete(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteFolder}>
              Excluir Pasta e Conteúdos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!itemToEdit} onOpenChange={(open) => !open && setItemToEdit(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Conteúdo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Concurso / Carreira</Label>
              <Select value={editContest} onValueChange={setEditContest}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o concurso..." />
                </SelectTrigger>
                <SelectContent>
                  {existingContests.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-zinc-500">Mude o concurso para mover este material entre pastas principais.</p>
            </div>
            <div className="space-y-2">
              <Label>Título</Label>
              <Input 
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Disciplina</Label>
              <Input 
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Subpasta / Professor (Opcional)</Label>
              <Input 
                value={editSubCategory}
                onChange={(e) => setEditSubCategory(e.target.value)}
              />
            </div>
            {itemToEdit?.type === 'pdf' && (
              <>
                <div className="space-y-2">
                  <Label>Banca Examinadora</Label>
                  <Input 
                    value={editBanca}
                    onChange={(e) => setEditBanca(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Características da Banca (Opcional)</Label>
                  <Textarea 
                    value={editBancaCharacteristics}
                    onChange={(e) => setEditBancaCharacteristics(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setItemToEdit(null)}>
              Cancelar
            </Button>
            <Button className="bg-primary hover:bg-[#e68a00] text-white" onClick={handleEditSave}>
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  </div>
);
}
