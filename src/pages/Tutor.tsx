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
  Plus
} from "lucide-react";
import { ai } from "@/lib/gemini";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import Markdown from "react-markdown";
import { collection, query, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
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
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("aestudamos_tutor_chats");
    if (saved) {
      setSavedConversations(JSON.parse(saved));
    }

    // Daily count logic
    const today = new Date().toLocaleDateString();
    const storedDaily = localStorage.getItem("aestudamos_tutor_daily");
    if (storedDaily) {
      const { count, date } = JSON.parse(storedDaily);
      if (date === today) {
        setDailyCount(count);
      } else {
        setDailyCount(0);
        localStorage.setItem("aestudamos_tutor_daily", JSON.stringify({ count: 0, date: today }));
      }
    } else {
      localStorage.setItem("aestudamos_tutor_daily", JSON.stringify({ count: 0, date: today }));
    }

    // Fetch user context
    const fetchContext = async () => {
      try {
        // Check for initial context from ContentLibrary
        const initialContext = localStorage.getItem('tutor_initial_context');
        let extraContext = "";
        if (initialContext) {
          const ctx = JSON.parse(initialContext);
          extraContext = `\nO aluno quer tirar dúvidas sobre o conteúdo: "${ctx.title}" (${ctx.subject}).\nResumo: ${ctx.summary || 'Não disponível'}.`;
          localStorage.removeItem('tutor_initial_context');
          
          // Add a welcoming message from the tutor
          setMessages([{
            role: 'assistant',
            content: `Olá! Vi que você quer estudar sobre **${ctx.title}**. Como posso te ajudar com este conteúdo hoje?`
          }]);
        }

        const q = query(collection(db, "plans"));
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
  }, []);

  const updateDailyCount = (newCount: number) => {
    setDailyCount(newCount);
    const today = new Date().toLocaleDateString();
    localStorage.setItem("aestudamos_tutor_daily", JSON.stringify({ count: newCount, date: today }));
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSaveConversation = () => {
    if (messages.length <= 1) {
      toast.error("Inicie uma conversa antes de salvar.");
      return;
    }

    const title = messages.find(m => m.role === 'user')?.content.substring(0, 30) + "..." || "Conversa sem título";
    const newConversation: SavedConversation = {
      id: Date.now().toString(),
      title,
      date: new Date().toLocaleString('pt-BR'),
      messages: [...messages]
    };

    const updated = [newConversation, ...savedConversations];
    setSavedConversations(updated);
    localStorage.setItem("aestudamos_tutor_chats", JSON.stringify(updated));
    toast.success("Conversa salva com sucesso!");
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
    if (!input.trim() || !ai) return;

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
      if (!ai) throw new Error("A chave da API do Gemini não foi configurada.");

      // Use generateContent with history to "continue" the conversation
      const history = newMessages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: history,
        config: {
          systemInstruction: `Você é um tutor de estudos objetivo e estruturado. Responda de forma clara, organizada (usando tópicos se necessário) e em linguagem simples para leigos. Evite rodeios e explicações excessivamente longas.
          
          ${userContext}`,
        }
      });

      if (!response.text) throw new Error("A IA não retornou resposta.");
      
      setMessages(prev => [...prev, { role: 'assistant', content: response.text }]);
      updateDailyCount(dailyCount + 1);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Erro desconhecido";
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
          <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
            <BrainCircuit className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-5xl tracking-wide text-red-600" style={{ fontFamily: "'Deutsch Gothic', serif" }}>IgpAI</h1>
            <p className="text-zinc-900 dark:text-white font-bold mt-2 text-2xl" style={{ fontFamily: "'Deutsch Gothic', serif" }}>Tire suas dúvidas em tempo real com inteligência artificial.</p>
          </div>
        </div>
        <div className="flex gap-2">
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
            size="sm" 
            className="gap-2 bg-black text-[#FF9900] hover:bg-zinc-900 hover:text-[#FF9900]"
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
              className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center p-6"
            >
              <Card className="max-w-md w-full border-indigo-100 shadow-2xl">
                <CardHeader className="text-center">
                  <CardTitle className="text-lg">Encerrar Conversa</CardTitle>
                  <p className="text-sm text-zinc-500">Deseja salvar esta conversa no seu histórico antes de sair?</p>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <Button 
                    className="w-full bg-indigo-600 hover:bg-indigo-700 gap-2"
                    onClick={() => { handleSaveConversation(); handleNewChat(); }}
                  >
                    <Save className="w-4 h-4" />
                    Sim, Salvar e Encerrar
                  </Button>
                  <Button 
                    variant="outline"
                    className="w-full gap-2 text-red-600 hover:bg-red-50 hover:text-red-700"
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
                <CardHeader className="py-4 border-b bg-zinc-50/50">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-indigo-600" />
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
                            className="group flex items-center justify-between p-3 rounded-lg hover:bg-indigo-50 cursor-pointer transition-colors border border-transparent hover:border-indigo-100"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-zinc-700 truncate group-hover:text-indigo-700">
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

        <Card className="flex-1 flex flex-col overflow-hidden border-zinc-200">
          <CardHeader className="border-b bg-zinc-50/50 py-4">
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
          <CardContent className="flex-1 p-0 flex flex-col">
            <ScrollArea className="flex-1 p-6" ref={scrollRef}>
              <div className="space-y-6">
                <AnimatePresence initial={false}>
                  {messages.map((msg, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                      <Avatar className={msg.role === 'assistant' ? 'bg-indigo-600' : 'bg-zinc-200'}>
                        {msg.role === 'assistant' ? (
                          <AvatarFallback className="bg-indigo-600 text-white"><Bot className="w-5 h-5" /></AvatarFallback>
                        ) : (
                          <AvatarFallback className="bg-zinc-800 text-white"><User className="w-5 h-5" /></AvatarFallback>
                        )}
                      </Avatar>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        msg.role === 'assistant' 
                          ? 'bg-zinc-100 text-zinc-800 rounded-tl-none' 
                          : 'bg-indigo-600 text-white rounded-tr-none'
                      }`}>
                        <div className="prose prose-sm max-w-none prose-indigo dark:prose-invert">
                          <Markdown>{msg.content}</Markdown>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {loading && (
                  <div className="flex gap-4">
                    <Avatar className="bg-indigo-600">
                      <AvatarFallback className="bg-indigo-600 text-white"><Bot className="w-5 h-5" /></AvatarFallback>
                    </Avatar>
                    <div className="bg-zinc-100 rounded-2xl rounded-tl-none px-4 py-3 flex gap-1 items-center">
                      <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" />
                      <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="p-4 border-t bg-white">
              <form 
                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                className="flex gap-2"
              >
                <Input 
                  placeholder="Pergunte qualquer coisa sobre seus estudos..." 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="flex-1"
                  disabled={loading}
                />
                <Button type="submit" disabled={loading || !input.trim()} className="bg-indigo-600 hover:bg-indigo-700">
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
