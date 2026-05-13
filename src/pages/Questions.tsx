import { useState, useEffect } from "react";
import { trtQuestoes, trtFlashcards } from "../data/trtQuestions";
import { Questao, Flashcard, Nivel, TipoQuestao, ContentItem } from "../types";
import { auth, db } from "../lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { 
  ChevronLeft, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  Lightbulb, 
  Tag, 
  Target,
  Trophy,
  History,
  Clock,
  LayoutGrid,
  List,
  Sparkles,
  BookOpen
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "../components/ui/select";
import { Progress } from "../components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";

const NIVEL_COLORS: Record<Nivel, string> = {
  facil: "text-green-500 bg-green-500/10 border-green-500/20",
  medio: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20",
  dificil: "text-red-500 bg-red-500/10 border-red-500/20",
};

export default function Questions() {
  const [selectedTab, setSelectedTab] = useState<"bank" | "simulated" | "flashcards">("bank");
  const [filterSubject, setFilterSubject] = useState("all");
  const [filterDifficulty, setFilterDifficulty] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  
  const [currentQuestion, setCurrentQuestion] = useState<Questao | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [history, setHistory] = useState<{id: number, correct: boolean, date: string}[]>([]);
  const [userQuestions, setUserQuestions] = useState<Questao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const q = query(
          collection(db, "contentItems"), 
          where("uid", "==", user.uid),
          where("type", "==", "questionBank")
        );

        const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
          const questions: Questao[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data() as ContentItem;
            try {
              const bankQuestions = JSON.parse(data.content);
              bankQuestions.forEach((q: any, idx: number) => {
                questions.push({
                  id: 10000 + questions.length, // Ensure unique ID
                  disciplina: data.subject,
                  assunto: data.subCategory || "IA",
                  concurso: data.contest || "Meu Acervo",
                  banca: data.banca || "IgpAI",
                  ano: new Date(data.createdAt).getFullYear() || 2024,
                  nivel: "medio",
                  tipo: "multipla_escolha",
                  enunciado: q.question,
                  alternativas: q.options.map((opt: string, optIdx: number) => ({
                    letra: String.fromCharCode(65 + optIdx),
                    texto: opt,
                    correta: optIdx === q.correctIndex,
                    analise: optIdx === q.correctIndex ? "Alternativa correta conforme fundamentação." : "Alternativa incorreta."
                  })),
                  gabarito: String.fromCharCode(65 + (q.correctIndex || 0)),
                  comentario: q.explanation,
                  tags: ["IA", data.subject]
                });
              });
            } catch (e) {
              console.error("Erro ao processar banco de questões:", e);
            }
          });
          setUserQuestions(questions);
          setLoading(false);
        });

        return () => unsubscribeSnapshot();
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const allQuestions = [...trtQuestoes, ...userQuestions];

  // Filter logic
  const filteredQuestions = allQuestions.filter(q => {
    const matchesSubject = filterSubject === "all" || q.disciplina === filterSubject;
    const matchesDifficulty = filterDifficulty === "all" || q.nivel === filterDifficulty;
    const matchesSearch = q.enunciado.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         q.assunto.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSubject && matchesDifficulty && matchesSearch;
  });

  const subjects = Array.from(new Set(allQuestions.map(q => q.disciplina)));

  const handleOpenQuestion = (q: Questao) => {
    setCurrentQuestion(q);
    setSelectedOption(null);
    setShowAnswer(false);
  };

  const handleSelectOption = (letra: string) => {
    if (showAnswer) return;
    setSelectedOption(letra);
  };

  const handleSubmit = () => {
    if (!selectedOption) {
      toast.error("Selecione uma alternativa primeiro.");
      return;
    }
    setShowAnswer(true);
    const isCorrect = selectedOption === currentQuestion?.gabarito;
    
    if (isCorrect) {
      toast.success("Resposta Correta!");
    } else {
      toast.error("Resposta Incorreta.");
    }

    setHistory(prev => [{
      id: currentQuestion!.id,
      correct: isCorrect,
      date: new Date().toISOString()
    }, ...prev]);
  };

  const nextQuestion = () => {
    const currentIndex = filteredQuestions.findIndex(q => q.id === currentQuestion?.id);
    if (currentIndex < filteredQuestions.length - 1) {
      handleOpenQuestion(filteredQuestions[currentIndex + 1]);
    } else {
      toast.info("Você chegou ao fim dos resultados filtrados.");
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-7xl animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-2">
            <Target className="w-8 h-8 text-primary" />
            Banco de Questões
          </h1>
          <p className="text-zinc-500 font-medium flex items-center gap-2 mt-1">
            <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary">TRT 2025</Badge>
            <span>•</span>
            <span>{trtQuestoes.length} questões cadastradas</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            className="bg-primary hover:bg-primary/80 text-black font-bold gap-2"
            onClick={() => window.location.href = '/acervo'}
          >
            <Sparkles className="w-4 h-4" />
            Gerar Questões com IA
          </Button>
          <div className="bg-zinc-800/50 p-3 rounded-2xl border border-zinc-700/50 flex items-center gap-4">
            <div className="text-center px-4 border-r border-zinc-700">
              <div className="text-xl font-black text-primary">{history.filter(h => h.correct).length}</div>
              <div className="text-[10px] text-zinc-500 uppercase font-bold">Acertos</div>
            </div>
            <div className="text-center px-4">
              <div className="text-xl font-black text-white">{history.length}</div>
              <div className="text-[10px] text-zinc-500 uppercase font-bold">Resolvidas</div>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="bank" onValueChange={(v) => setSelectedTab(v as any)} className="space-y-6">
        <TabsList className="bg-zinc-900 border border-zinc-800 p-1 h-auto grid grid-cols-3 md:w-[400px]">
          <TabsTrigger value="bank" className="data-[state=active]:bg-primary data-[state=active]:text-black font-bold h-10">
            Banco
          </TabsTrigger>
          <TabsTrigger value="simulated" className="data-[state=active]:bg-primary data-[state=active]:text-black font-bold h-10">
            Simulado
          </TabsTrigger>
          <TabsTrigger value="flashcards" className="data-[state=active]:bg-primary data-[state=active]:text-black font-bold h-10">
            Cards
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bank" className="space-y-6 m-0 outline-none">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-zinc-900/30 p-4 rounded-2xl border border-zinc-800/50">
            <div className="relative col-span-1 md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input 
                placeholder="Buscar no enunciado ou assunto..." 
                className="pl-10 bg-zinc-950 border-zinc-800"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={filterSubject} onValueChange={setFilterSubject}>
              <SelectTrigger className="bg-zinc-950 border-zinc-800">
                <SelectValue placeholder="Assunto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Disciplinas</SelectItem>
                {subjects.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterDifficulty} onValueChange={setFilterDifficulty}>
              <SelectTrigger className="bg-zinc-950 border-zinc-800">
                <SelectValue placeholder="Dificuldade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Complexidades</SelectItem>
                <SelectItem value="facil">Fácil</SelectItem>
                <SelectItem value="medio">Médio</SelectItem>
                <SelectItem value="dificil">Difícil</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredQuestions.map((q) => (
                <motion.div
                  key={q.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <Card 
                    className="bg-zinc-900 border-zinc-800 hover:border-primary/30 transition-all cursor-pointer group flex flex-col h-full"
                    onClick={() => handleOpenQuestion(q)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex gap-2">
                          <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider border-zinc-700 text-zinc-400">
                            ID: {q.id}
                          </Badge>
                          {q.id >= 10000 && (
                            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] uppercase font-bold flex gap-1 items-center">
                              <Sparkles className="w-2.5 h-2.5" />
                              IgpAI
                            </Badge>
                          )}
                        </div>
                        <Badge className={`${NIVEL_COLORS[q.nivel]} border text-[10px] uppercase font-black`}>
                          {q.nivel}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg text-white font-bold group-hover:text-primary transition-colors line-clamp-2">
                        {q.disciplina}
                      </CardTitle>
                      <CardDescription className="text-zinc-500 font-medium">
                        {q.assunto}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <p className="text-sm text-zinc-400 line-clamp-3 mb-6">
                        {q.enunciado}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-auto">
                        {q.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="text-[10px] px-2 py-1 bg-zinc-800 text-zinc-400 rounded-md">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </TabsContent>

        <TabsContent value="simulated">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-12 text-center space-y-6">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/20">
                <Clock className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-2xl font-black text-white uppercase italic">Modo Simulado em Breve</h2>
              <p className="text-zinc-500 max-w-sm mx-auto">
                Estamos preparando um modo de simulado cronometrado com ranking e estatísticas detalhadas.
              </p>
              <Button onClick={() => setSelectedTab("bank")} className="bg-primary hover:bg-primary/80 text-black font-bold">
                Voltar para o Banco
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="flashcards">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trtFlashcards.map((f) => (
              <Card key={f.id} className="bg-zinc-900 border-zinc-800 p-6 flex flex-col justify-between group hover:border-primary/50 transition-all cursor-pointer min-h-[220px]">
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <Badge variant="outline" className="text-xs text-primary border-primary/20 bg-primary/5">
                      {f.assunto}
                    </Badge>
                  </div>
                  <p className="text-white font-bold leading-relaxed">
                    {f.frente}
                  </p>
                </div>
                <div className="mt-8 flex justify-between items-center">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Toque para ver</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Question Detail Overlay */}
      <AnimatePresence>
        {currentQuestion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
          >
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              className="bg-zinc-900 border border-zinc-800 rounded-[2rem] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl shadow-primary/10"
            >
              <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50">
                <div className="flex items-center gap-4">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setCurrentQuestion(null)}
                    className="rounded-xl hover:bg-zinc-800"
                  >
                    <ChevronLeft className="w-6 h-6 text-white" />
                  </Button>
                  <div>
                    <h3 className="text-white font-black uppercase text-sm">{currentQuestion.disciplina}</h3>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{currentQuestion.assunto}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-zinc-700 text-zinc-400">ID: {currentQuestion.id}</Badge>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="rounded-full text-zinc-500 hover:text-white"
                    onClick={() => setCurrentQuestion(null)}
                  >
                    <XCircle className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 custom-scrollbar">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-primary text-black text-[10px] font-black rounded-full uppercase italic">Questão</span>
                    <span className="text-zinc-600 font-medium text-xs font-mono">{currentQuestion.banca} • {currentQuestion.ano}</span>
                  </div>
                  <p className="text-xl md:text-2xl text-white font-bold leading-snug">
                    {currentQuestion.enunciado}
                  </p>
                </div>

                <div className="space-y-3">
                  {currentQuestion.alternativas.map((alt) => {
                    const isSelected = selectedOption === alt.letra;
                    const isCorrect = alt.letra === currentQuestion.gabarito;
                    const showCorrect = showAnswer && isCorrect;
                    const showWrong = showAnswer && isSelected && !isCorrect;

                    return (
                      <button
                        key={alt.letra}
                        disabled={showAnswer}
                        onClick={() => handleSelectOption(alt.letra)}
                        className={`
                          w-full p-5 rounded-2xl border text-left transition-all relative overflow-hidden group
                          ${isSelected && !showAnswer ? "border-primary bg-primary/5" : "border-zinc-800 bg-zinc-950/50 hover:bg-zinc-800/50"}
                          ${showCorrect ? "border-green-500/50 bg-green-500/10" : ""}
                          ${showWrong ? "border-red-500/50 bg-red-500/10" : ""}
                          ${showAnswer && !isSelected && !isCorrect ? "opacity-40" : ""}
                        `}
                      >
                        <div className="flex items-start gap-4 z-10 relative">
                          <span className={`
                            w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm flex-shrink-0 transition-colors
                            ${isSelected ? "bg-primary text-black" : "bg-zinc-800 text-zinc-400 group-hover:text-white"}
                            ${showCorrect ? "bg-green-500 text-white" : ""}
                            ${showWrong ? "bg-red-500 text-white" : ""}
                          `}>
                            {alt.letra}
                          </span>
                          <p className="text-white font-medium pr-8">{alt.texto}</p>
                        </div>
                        
                        {showCorrect && <CheckCircle2 className="absolute right-5 top-1/2 -translate-y-1/2 w-6 h-6 text-green-500" />}
                        {showWrong && <XCircle className="absolute right-5 top-1/2 -translate-y-1/2 w-6 h-6 text-red-500" />}
                      </button>
                    );
                  })}
                </div>

                <AnimatePresence>
                  {showAnswer && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-6 md:p-8 bg-zinc-950 rounded-3xl border border-zinc-800 space-y-6"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-yellow-500/10 rounded-2xl border border-yellow-500/20">
                          <Lightbulb className="w-6 h-6 text-yellow-500" />
                        </div>
                        <div>
                          <h4 className="text-white font-black uppercase text-sm">Gabarito e Comentário</h4>
                          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Entenda o porquê</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-400 font-bold">Alternativa Correta:</span>
                          <span className="w-6 h-6 bg-green-500 text-white rounded flex items-center justify-center font-black">{currentQuestion.gabarito}</span>
                        </div>
                        <p className="text-zinc-300 leading-relaxed italic border-l-2 border-primary pl-4">
                          {currentQuestion.comentario}
                        </p>
                      </div>

                      <div className="pt-6 border-t border-zinc-800 space-y-4">
                        <h5 className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Análise das Alternativas</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {currentQuestion.alternativas.map(alt => (
                            <div key={alt.letra} className="text-xs p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                              <span className="font-black text-primary mr-2">{alt.letra}:</span>
                              <span className="text-zinc-400">{alt.analise}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="p-6 border-t border-zinc-800 bg-zinc-950/80 backdrop-blur-md flex flex-wrap gap-4 justify-between items-center">
                <div className="flex gap-2">
                  {currentQuestion.tags.map(tag => (
                    <Badge key={tag} variant="outline" className="text-[10px] border-zinc-800 text-zinc-500">#{tag}</Badge>
                  ))}
                </div>
                <div className="flex gap-3">
                  {!showAnswer ? (
                    <Button 
                      onClick={handleSubmit} 
                      className="bg-primary hover:bg-primary/80 text-black font-black px-8 h-12 rounded-xl"
                    >
                      CONFIRMAR RESPOSTA
                    </Button>
                  ) : (
                    <Button 
                      onClick={nextQuestion} 
                      className="bg-zinc-800 hover:bg-zinc-700 text-white font-black px-8 h-12 rounded-xl border border-zinc-700"
                    >
                      PRÓXIMA QUESTÃO
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
