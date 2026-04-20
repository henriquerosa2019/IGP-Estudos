import { useState, useRef, useEffect } from "react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { 
  Send, 
  Sparkles, 
  User, 
  Bot,
  BrainCircuit,
  Save,
  History,
  Trash2,
  ChevronRight,
  MessageSquare,
  LogOut,
  CheckCircle2,
  XCircle,
  Plus,
  BookOpen,
  FileText,
  Video,
  Link as LinkIcon,
  Type,
  ArrowDown,
  Folder
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { GEMINI_MODEL, generateWithFallback, getUsageStats } from "@/lib/gemini";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import Markdown from "react-markdown";
import { collection, query, getDocs, where, onSnapshot } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { StudyPlan } from "@/types";

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface SavedConversation {
  id: string;
  title: string;
  date: string;
  messages: Message[];
}

export default function Tutor() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Olá! Eu sou seu tutor IA. Em que posso te ajudar com seus estudos hoje?' }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [savedConversations, setSavedConversations] = useState<SavedConversation[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [dailyCount, setDailyCount] = useState(0);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [userContext, setUserContext] = useState<string>("");
  const [user, setUser] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedContent, setSelectedContent] = useState<{ title: string; content: string; type: string } | null>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [libraryItems, setLibraryItems] = useState<any[]>([]);
  const [libraryView, setLibraryView] = useState<'folders' | 'items'>('folders');
  const [selectedLibrarySubject, setSelectedLibrarySubject] = useState<string | null>(null);
  const [isPasteOpen, setIsPasteOpen] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [pastedTitle, setPastedTitle] = useState("");
  const [showScrollButton, setShowScrollButton] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsubscribeAuth();
  }, []);

  // Fetch library items for the "Import" dialog
  useEffect(() => {
    if (!authReady) return;
    const uid = user?.uid || localStorage.getItem('igp_local_uid');
    if (!uid) return;

    const isAdmin = user && (
      user.email === "henrique.rosa@poli.ufrj.br" || 
      user.email === "brunool.rj@gmail.com"
    );

    let q;
    if (isAdmin) {
      q = query(collection(db, "contentItems"));
    } else {
      q = query(collection(db, "contentItems"), where("uid", "==", uid));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLibraryItems(items);
    });
    return () => unsubscribe();
  }, [authReady, user]);

  useEffect(() => {
    const saved = localStorage.getItem("aestudamos_tutor_chats");
    if (saved) {
      setSavedConversations(JSON.parse(saved));
    }

    // Daily count logic
    const fetchUsage = async () => {
      try {
        const stats = await getUsageStats();
        setDailyCount(stats.count);
      } catch (err) {
        console.warn("Falha ao buscar estatísticas de uso.");
      }
    };
    fetchUsage();

    // Fetch user context
    const fetchContext = async () => {
      if (!authReady) return;
      
      try {
        // Check for initial context from ContentLibrary
        const initialContext = localStorage.getItem('tutor_initial_context');
        let extraContext = "";
        if (initialContext) {
          const ctx = JSON.parse(initialContext);
          extraContext = `\nO aluno quer estudar o conteúdo: "${ctx.title}" (${ctx.subject}).\nResumo: ${ctx.summary || 'Não disponível'}.\nConteúdo Completo: ${ctx.content || 'Não disponível'}.`;
          setSelectedContent({ title: ctx.title, content: ctx.content, type: ctx.type });
          localStorage.removeItem('tutor_initial_context');
          
          // Add a welcoming message from the tutor
          setMessages([{
            role: 'assistant',
            content: `Olá! Vi que você quer estudar sobre **${ctx.title}**. Eu já li o material e estou pronto para te ajudar! 
            
Posso te explicar de forma simples (para leigos), gerar exercícios práticos ou dar exemplos do dia a dia sobre este conteúdo. O que prefere começar?`
          }]);
        }

        const getUids = () => {
          const uids = [];
          if (user) uids.push(user.uid);
          const localUid = localStorage.getItem('igp_local_uid');
          if (localUid) uids.push(localUid);
          return Array.from(new Set(uids));
        };

        const uids = getUids();
        const allowedUids = uids.filter(id => id.startsWith('anon_') || (user && id === user.uid));
        
        if (allowedUids.length === 0) return;

        const isAdmin = user && (user.email === "henrique.rosa@poli.ufrj.br" || user.email === "brunool.rj@gmail.com");

        let q;
        if (isAdmin) {
          q = query(collection(db, "plans"));
        } else {
          q = allowedUids.length === 1
            ? query(collection(db, "plans"), where("uid", "==", allowedUids[0]))
            : query(collection(db, "plans"), where("uid", "in", allowedUids));
        }
        
        const snapshot = await getDocs(q);
        const plans = snapshot.docs.map(doc => doc.data() as StudyPlan);
        
        let completedTopics: string[] = [];
        let currentTopics: string[] = [];
        
        plans.forEach(plan => {
          plan.schedule.forEach(day => {
            day.topics.forEach(topic => {
              if (topic.completed) {
                completedTopics.push(`${topic.subject}: ${topic.title}`);
              } else {
                currentTopics.push(`${topic.subject}: ${topic.title}`);
              }
            });
          });
        });

        const contextStr = `
        Contexto do Aluno:
        - Tópicos já estudados recentemente: ${completedTopics.slice(-5).join(", ") || "Nenhum ainda"}
        - Tópicos pendentes no plano: ${currentTopics.slice(0, 5).join(", ") || "Nenhum plano ativo"}
        ${extraContext}
        
        Use esse contexto para personalizar suas respostas, dar exemplos relevantes às matérias que ele está estudando e motivá-lo com base no seu progresso.
        `;
        setUserContext(contextStr);
      } catch (error) {
        console.error("Erro ao buscar contexto:", error);
      }
    };
    
    fetchContext();
  }, [authReady, user]);

  const updateDailyCount = (newCount: number) => {
    setDailyCount(newCount);
    const today = new Date().toLocaleDateString();
    localStorage.setItem("aestudamos_tutor_daily", JSON.stringify({ count: newCount, date: today }));
  };

  const handlePasteSubmit = () => {
    if (!pastedText.trim()) {
      toast.error("Cole algum texto primeiro.");
      return;
    }
    const title = pastedTitle || `Texto Colado ${new Date().toLocaleTimeString()}`;
    setSelectedContent({ title, content: pastedText, type: 'text' });
    setMessages([{
      role: 'assistant',
      content: `Recebi seu texto sobre **${title}**. 
      
Como posso te ajudar a estudar este conteúdo? Posso explicar de forma simples, dar exemplos ou gerar exercícios sobre este tema.`
    }]);
    setIsPasteOpen(false);
    setPastedText("");
    setPastedTitle("");
    toast.success("Texto importado para o Tutor!");
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100;
    setShowScrollButton(!isAtBottom);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSaveConversation = async () => {
    if (messages.length <= 1) {
      toast.error("Inicie uma conversa antes de salvar.");
      return;
    }

    const toastId = toast.loading("Gerando título e salvando...");
    let title = "Conversa de Estudo";

    try {
      // Tentar gerar um título curto com IA baseado no contexto da conversa
      if (messages.length >= 2) {
        const firstUserMessage = messages.find(m => m.role === 'user');
        const contentForTitle = firstUserMessage?.content || "";
        
        try {
          const prompt = `Gere um título curto, direto e profissional (máximo de 5 palavras) em português para uma conversa de estudo que começou com: "${contentForTitle.substring(0, 150)}". Responda APENAS o título, sem aspas ou pontos finais desnecessários.`;
          
          const response = await generateWithFallback({
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
          });
          
          if (response.text) {
            title = response.text.replace(/"/g, '').replace(/\.$/, '').trim();
          } else {
            title = contentForTitle.substring(0, 30) + "...";
          }
        } catch (aiError) {
          console.warn("Falha ao gerar título com IA:", aiError);
          title = contentForTitle.substring(0, 30) + "...";
        }
      } else {
        const firstUserContent = messages.find(m => m.role === 'user')?.content || "Conversa de Estudo";
        title = firstUserContent.substring(0, 30) + "...";
      }

      const newConversation: SavedConversation = {
        id: Date.now().toString(),
        title,
        date: new Date().toLocaleString('pt-BR'),
        messages: [...messages]
      };

      const updated = [newConversation, ...savedConversations];
      setSavedConversations(updated);
      localStorage.setItem("aestudamos_tutor_chats", JSON.stringify(updated));
      toast.success(`Conversa "${title}" salva com sucesso!`, { id: toastId });
    } catch (error) {
      console.error("Erro ao salvar conversa:", error);
      toast.error("Erro ao salvar conversa.", { id: toastId });
    }
  };

  const loadConversation = (conv: SavedConversation) => {
    setMessages(conv.messages);
    setShowHistory(false);
    toast.info(`Carregada: ${conv.title}`);
  };

  const deleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedConversations.filter(c => c.id !== id);
    setSavedConversations(updated);
    localStorage.setItem("aestudamos_tutor_chats", JSON.stringify(updated));
    toast.success("Conversa excluída.");
  };

  const handleNewChat = () => {
    setMessages([{ role: 'assistant', content: 'Olá! Eu sou seu tutor IA. Em que posso te ajudar com seus estudos hoje?' }]);
    setShowSaveConfirm(false);
    toast.info("Nova conversa iniciada.");
  };

  const handleFinishSession = () => {
    if (messages.length <= 1) {
      handleNewChat();
      return;
    }
    setShowSaveConfirm(true);
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    // Check limits
    const userQuestions = messages.filter(m => m.role === 'user').length;
    if (userQuestions >= 5) {
      toast.error("Limite de 5 perguntas por conversa atingido. Inicie uma nova conversa.");
      return;
    }

    if (dailyCount >= 20) {
      toast.error("Limite diário de 20 perguntas atingido. Volte amanhã!");
      return;
    }

    const userMessage: Message = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      // Use generateContent with history to "continue" the conversation
      const history = newMessages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));

      const response = await generateWithFallback({ 
        contents: history,
        config: {
          systemInstruction: `Você é um tutor de estudos objetivo e estruturado chamado IgpAI. 
            Sua missão é ajudar o aluno a entender profundamente o conteúdo fornecido.
            
            DIRETRIZES DE RESPOSTA:
            1. Se houver um material de estudo selecionado, use-o como base principal.
            2. Explique conceitos complexos de forma simples, como se estivesse explicando para um leigo (ELI5).
            3. Sempre que possível, forneça exemplos práticos do dia a dia.
            4. Ao final de explicações importantes, sugira um pequeno exercício ou pergunta de reflexão para testar o conhecimento do aluno.
            5. Mantenha um tom motivador e encorajador.
            6. Use Markdown para formatar suas respostas (negrito, listas, tabelas).
            
            ${userContext}
            ${selectedContent ? `CONTEÚDO ATUAL EM ESTUDO:
            Título: ${selectedContent.title}
            Tipo: ${selectedContent.type}
            Conteúdo: ${selectedContent.content}` : ''}`,
        }
      });
      const text = response.text;

      if (!text) throw new Error("A IA não retornou resposta.");
      
      setMessages(prev => [...prev, { role: 'assistant', content: text }]);
      
      // Sync usage after success
      const stats = await getUsageStats();
      setDailyCount(stats.count);
    } catch (error: any) {
      console.error(error);
      const message = error.message || "Erro desconhecido";
      if (message.includes("limit reached")) {
        toast.error("Você atingiu seu limite diário de créditos IA.");
      }
      setMessages(prev => [...prev, { role: 'assistant', content: `Houve um erro: ${message}. Tente novamente mais tarde.` }]);
      toast.error(`Erro no IgpAI: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
            <BrainCircuit className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-5xl tracking-wide text-primary" style={{ fontFamily: "'Deutsch Gothic', serif" }}>IgpAI</h1>
            <p className="text-white  font-bold mt-2 text-2xl" style={{ fontFamily: "'Deutsch Gothic', serif" }}>Tire suas dúvidas em tempo real com inteligência artificial.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog open={isPasteOpen} onOpenChange={setIsPasteOpen}>
            <DialogTrigger render={
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 border-primary/20 text-primary hover:bg-primary/10"
              >
                <Type className="w-4 h-4" />
                Colar Texto
              </Button>
            } />
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Colar Texto para Estudo</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Título (Opcional)</Label>
                  <Input 
                    placeholder="Dê um nome para este texto..." 
                    value={pastedTitle}
                    onChange={(e) => setPastedTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Conteúdo do Texto</Label>
                  <Textarea 
                    placeholder="Cole aqui o texto que você quer que a IA analise..." 
                    className="min-h-[300px]"
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsPasteOpen(false)}>Cancelar</Button>
                <Button onClick={handlePasteSubmit} className="bg-primary hover:bg-primary/80">
                  Importar para o Tutor
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isLibraryOpen} onOpenChange={(open) => {
            setIsLibraryOpen(open);
            if (!open) {
              setLibraryView('folders');
              setSelectedLibrarySubject(null);
            }
          }}>
            <DialogTrigger render={
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 border-primary/20 text-primary hover:bg-primary/10"
              >
                <BookOpen className="w-4 h-4" />
                Importar do Acervo
              </Button>
            } />
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <div className="flex items-center gap-2">
                  {libraryView === 'items' && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8" 
                      onClick={() => {
                        setLibraryView('folders');
                        setSelectedLibrarySubject(null);
                      }}
                    >
                      <ArrowDown className="w-4 h-4 rotate-90" />
                    </Button>
                  )}
                  <DialogTitle>
                    {libraryView === 'folders' ? 'Importar do Acervo Inteligente' : `Acervo: ${selectedLibrarySubject}`}
                  </DialogTitle>
                </div>
              </DialogHeader>
              <div className="py-4">
                <p className="text-sm text-zinc-500 mb-4">
                  {libraryView === 'folders' 
                    ? 'Selecione uma disciplina para ver os materiais disponíveis.' 
                    : 'Selecione um material para estudar com o apoio da IgpAI.'}
                </p>
                <ScrollArea className="h-[350px] pr-4">
                  <div className="space-y-2">
                    {libraryItems.length === 0 ? (
                      <p className="text-center py-8 text-zinc-400 text-sm italic">Seu acervo está vazio.</p>
                    ) : libraryView === 'folders' ? (
                      // Display unique subjects as folders
                      Array.from(new Set(libraryItems.map(item => item.subject))).map((subject) => {
                        const count = libraryItems.filter(i => i.subject === subject).length;
                        return (
                          <button
                            key={subject}
                            onClick={() => {
                              setSelectedLibrarySubject(subject);
                              setLibraryView('items');
                            }}
                            className="w-full flex items-center gap-3 p-4 rounded-xl border border-zinc-100 hover:border-primary/20 hover:bg-primary/10 transition-all text-left group"
                          >
                            <div className="p-3 bg-primary/10 rounded-xl text-primary group-hover:bg-yellow-100">
                              <Folder className="w-5 h-5 fill-current opacity-40" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-bold text-zinc-300">{subject}</p>
                              <p className="text-[10px] text-zinc-400 font-bold uppercase">{count} ite{count === 1 ? 'm' : 'ns'}</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-yellow-400" />
                          </button>
                        );
                      })
                    ) : (
                      // Display items within the selected subject
                      libraryItems
                        .filter(item => item.subject === selectedLibrarySubject)
                        .map((item) => (
                          <button
                            key={item.id}
                            onClick={() => {
                              setSelectedContent({ title: item.title, content: item.content, type: item.type });
                              setMessages([{
                                role: 'assistant',
                                content: `Olá! Vamos estudar sobre **${item.title}**. Eu já processei o conteúdo do seu acervo.
                                
  Como posso te ajudar? Posso explicar de forma simples, dar exemplos ou gerar exercícios sobre este tema.`
                              }]);
                              setIsLibraryOpen(false);
                              toast.success(`Material "${item.title}" importado!`);
                            }}
                            className="w-full flex items-center gap-3 p-3 rounded-xl border border-zinc-100 hover:border-primary/20 hover:bg-primary/10 transition-all text-left group"
                          >
                            <div className="p-2 bg-card rounded-lg text-zinc-500 group-hover:bg-yellow-100 group-hover:text-primary">
                              {item.type === 'pdf' ? <FileText className="w-4 h-4" /> : 
                               item.type === 'video' ? <Video className="w-4 h-4" /> : 
                               item.type === 'link' ? <LinkIcon className="w-4 h-4" /> :
                               <Type className="w-4 h-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-zinc-300 truncate">{item.title}</p>
                              <p className="text-[10px] text-zinc-400 uppercase font-black">{item.subCategory || item.subject}</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-yellow-400" />
                          </button>
                        ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </DialogContent>
          </Dialog>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            onClick={() => setShowHistory(!showHistory)}
          >
            <History className="w-4 h-4" />
            Histórico
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-2 text-primary hover:bg-red-50 hover:text-red-700"
            onClick={handleFinishSession}
          >
            <LogOut className="w-4 h-4" />
            Encerrar Conversa
          </Button>
          <Button 
            size="sm" 
            className="gap-2 bg-black text-primary hover:bg-zinc-900 hover:text-primary"
            onClick={handleFinishSession}
          >
            <Plus className="w-4 h-4" />
            Novo Chat
          </Button>
        </div>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden relative">
        <AnimatePresence>
          {showSaveConfirm && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6"
            >
              <Card className="max-w-md w-full border-primary/10 shadow-2xl">
                <CardHeader className="text-center">
                  <CardTitle className="text-lg">Encerrar Conversa</CardTitle>
                  <p className="text-sm text-zinc-500">Deseja salvar esta conversa no seu histórico antes de sair?</p>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <Button 
                    className="w-full bg-primary hover:bg-primary/80 gap-2"
                    onClick={async () => { await handleSaveConversation(); handleNewChat(); }}
                  >
                    <Save className="w-4 h-4" />
                    Sim, Salvar e Encerrar
                  </Button>
                  <Button 
                    variant="outline"
                    className="w-full gap-2 text-primary hover:bg-red-50 hover:text-red-700"
                    onClick={handleNewChat}
                  >
                    <XCircle className="w-4 h-4" />
                    Não, apenas Encerrar
                  </Button>
                  <Button 
                    variant="ghost"
                    className="w-full"
                    onClick={() => setShowSaveConfirm(false)}
                  >
                    Cancelar
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="h-full overflow-hidden"
            >
              <Card className="h-full flex flex-col border-zinc-200">
                <CardHeader className="py-4 border-b bg-background/50">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    Conversas Salvas
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 p-0">
                  <ScrollArea className="h-full">
                    <div className="p-2 space-y-1">
                      {savedConversations.length === 0 ? (
                        <div className="p-4 text-center text-xs text-zinc-400 italic">
                          Nenhuma conversa salva ainda.
                        </div>
                      ) : (
                        savedConversations.map((conv) => (
                          <div
                            key={conv.id}
                            onClick={() => loadConversation(conv)}
                            className="group flex items-center justify-between p-3 rounded-lg hover:bg-primary/10 cursor-pointer transition-colors border border-transparent hover:border-primary/10"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-zinc-300 truncate group-hover:text-yellow-700">
                                {conv.title}
                              </p>
                              <p className="text-[10px] text-zinc-400 mt-0.5">{conv.date}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 hover:bg-red-50"
                              onClick={(e) => deleteConversation(conv.id, e)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <Card className="flex-1 flex flex-col overflow-hidden border-zinc-200 min-h-0">
          <CardHeader className="border-b bg-background/50 py-4 shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Sessão Ativa
              </CardTitle>
              <div className="flex gap-4 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                <span>Perguntas na conversa: {messages.filter(m => m.role === 'user').length}/5</span>
                <span>Uso diário: {dailyCount}/20</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0 flex flex-col relative min-h-0">
            <ScrollArea 
              className="flex-1 p-6 min-h-0" 
              ref={scrollRef}
              onScroll={handleScroll}
            >
              <div className="space-y-6">
                <AnimatePresence initial={false}>
                  {messages.map((msg, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                      <Avatar className={msg.role === 'assistant' ? 'bg-primary' : 'bg-zinc-200'}>
                        {msg.role === 'assistant' ? (
                          <AvatarFallback className="bg-primary text-white"><Bot className="w-5 h-5" /></AvatarFallback>
                        ) : (
                          <AvatarFallback className="bg-zinc-800 text-white"><User className="w-5 h-5" /></AvatarFallback>
                        )}
                      </Avatar>
                      <div className={`max-w-[85%] rounded-2xl px-6 py-4 text-lg leading-relaxed ${
                        msg.role === 'assistant' 
                          ? 'bg-card text-white rounded-tl-none' 
                          : 'bg-primary text-white rounded-tr-none'
                      }`}>
                        <div className="prose prose-lg max-w-none prose-yellow dark:prose-invert prose-p:my-4 first:prose-p:mt-0 last:prose-p:mb-0">
                          <Markdown>{msg.content}</Markdown>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {loading && (
                  <div className="flex gap-4">
                    <Avatar className="bg-primary">
                      <AvatarFallback className="bg-primary text-white"><Bot className="w-5 h-5" /></AvatarFallback>
                    </Avatar>
                    <div className="bg-card rounded-2xl rounded-tl-none px-4 py-3 flex gap-1 items-center">
                      <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" />
                      <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <AnimatePresence>
              {showScrollButton && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={scrollToBottom}
                  className="absolute bottom-24 right-8 w-10 h-10 bg-primary text-white rounded-full shadow-lg flex items-center justify-center hover:bg-primary/80 transition-colors z-10"
                >
                  <ArrowDown className="w-5 h-5" />
                </motion.button>
              )}
            </AnimatePresence>

            <div className="p-4 border-t bg-background">
              <form 
                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                className="flex gap-2 items-end"
              >
                <Textarea 
                  placeholder="Pergunte qualquer coisa sobre seus estudos... (Shift+Enter para nova linha)" 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="flex-1 min-h-[44px] max-h-[200px] py-3 resize-none"
                  disabled={loading}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <Button 
                  type="submit" 
                  disabled={loading || !input.trim()} 
                  className="bg-primary hover:bg-primary/80 h-[44px] w-[44px] p-0 shrink-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
