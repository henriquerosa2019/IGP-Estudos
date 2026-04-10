import { useState, useEffect } from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Sparkles, 
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Trash2,
  ExternalLink,
  Save,
  ArrowLeft,
  Play,
  Square,
  Layers,
  Timer,
  Pause as PauseIcon,
  RotateCcw,
  Coffee,
  Settings2
} from "lucide-react";
import { generateStudyPlan, generateStudyPlanFromNotices } from "@/lib/gemini";
import { StudyPlan as StudyPlanType, ExamNotice } from "@/types";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { collection, doc, setDoc, deleteDoc, updateDoc, onSnapshot, query, where } from "firebase/firestore";
import { db, auth, handleFirestoreError, OperationType } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { PlanViewer } from "@/components/PlanViewer";

export default function StudyPlan() {
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<StudyPlanType | null>(null);
  const [savedPlans, setSavedPlans] = useState<StudyPlanType[]>([]);
  
  // Manual Plan State
  const [goal, setGoal] = useState("");
  const [subjects, setSubjects] = useState("");
  const [hours, setHours] = useState(4);
  
  // Notice Plan State
  const [savedNotices, setSavedNotices] = useState<ExamNotice[]>([]);
  const [selectedNoticeIds, setSelectedNoticeIds] = useState<string[]>([]);
  const [examDate, setExamDate] = useState("");
  
  const [error, setError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<'calendar' | 'vertical'>('calendar');
  const [user, setUser] = useState<any>(null);

  // Timer State
  const [timerTime, setTimerTime] = useState(25 * 60);
  const [timerActive, setTimerActive] = useState(false);
  const [timerMode, setTimerMode] = useState<'study' | 'break'>('study');
  const [studyDuration, setStudyDuration] = useState(25);
  const [breakDuration, setBreakDuration] = useState(5);
  const [showTimerSettings, setShowTimerSettings] = useState(false);

  const getUid = () => {
    if (auth.currentUser) return auth.currentUser.uid;
    let localUid = localStorage.getItem('localUid');
    if (!localUid) {
      localUid = 'anon_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('localUid', localUid);
    }
    return localUid;
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerActive && timerTime > 0) {
      interval = setInterval(() => {
        setTimerTime((prev) => prev - 1);
      }, 1000);
    } else if (timerTime === 0) {
      setTimerActive(false);
      toast.success(timerMode === 'study' ? "Hora da pausa!" : "Hora de voltar aos estudos!");
      // Auto switch mode
      const nextMode = timerMode === 'study' ? 'break' : 'study';
      setTimerMode(nextMode);
      setTimerTime((nextMode === 'study' ? studyDuration : breakDuration) * 60);
    }
    return () => clearInterval(interval);
  }, [timerActive, timerTime, timerMode, studyDuration, breakDuration]);

  const toggleTimer = () => setTimerActive(!timerActive);
  
  const resetTimer = () => {
    setTimerActive(false);
    setTimerTime((timerMode === 'study' ? studyDuration : breakDuration) * 60);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    const uid = getUid();
    const qPlans = query(collection(db, "plans"), where("uid", "==", uid));
    const unsubscribePlans = onSnapshot(qPlans, (snapshot) => {
      const parsedPlans = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as StudyPlanType));
      setSavedPlans(parsedPlans);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "plans");
    });

    const qNotices = query(collection(db, "notices"), where("uid", "==", uid));
    const unsubscribeNotices = onSnapshot(qNotices, (snapshot) => {
      const parsedNotices = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ExamNotice));
      setSavedNotices(parsedNotices);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "notices");
    });

    return () => {
      unsubscribePlans();
      unsubscribeNotices();
    };
  }, [user]);

  const handleCreateManualPlan = async () => {
    setLoading(true);
    setError(null);
    const toastId = toast.loading("Gerando seu plano de estudos...");
    
    try {
      const result = await generateStudyPlan(
        goal, 
        subjects.split(",").map(s => s.trim()), 
        hours
      );
      setPlan(result);
      toast.success("Plano gerado!", { id: toastId });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      setError(message);
      toast.error(message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNoticePlan = async () => {
    const selectedNotices = savedNotices.filter(n => selectedNoticeIds.includes(n.id));
    if (selectedNotices.length === 0) {
      toast.error("Selecione pelo menos um edital.");
      return;
    }
    setLoading(true);
    setError(null);
    const toastId = toast.loading("Analisando editais e cruzando matérias...");
    
    try {
      const result = await generateStudyPlanFromNotices(
        selectedNotices,
        examDate,
        hours
      );
      setPlan(result);
      toast.success("Plano unificado gerado com sucesso!", { id: toastId });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      setError(message);
      toast.error(message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const toggleNoticeSelection = (id: string) => {
    setSelectedNoticeIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSavePlan = async (planToSave?: StudyPlanType) => {
    const targetPlan = planToSave || plan;
    if (!targetPlan) return;
    
    const exists = savedPlans.some(p => p.id === targetPlan.id);
    if (exists) {
      toast.info("Este plano já está salvo.");
      return;
    }

    try {
      const planRef = doc(collection(db, "plans"));
      await setDoc(planRef, { ...targetPlan, id: planRef.id, uid: getUid() });
      toast.success("Plano salvo com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar plano:", error);
      toast.error("Erro ao salvar plano.");
    }
  };

  const deletePlan = async (id: string) => {
    try {
      await deleteDoc(doc(db, "plans", id));
      toast.success("Plano removido.");
      if (plan?.id === id) {
        setPlan(null);
      }
    } catch (error) {
      console.error("Erro ao remover plano:", error);
      toast.error("Erro ao remover plano.");
    }
  };

  const toggleTopicCompletion = async (dayIdx: number, topicIdx: number) => {
    if (!plan) return;
    
    const newPlan = { ...plan };
    const topic = newPlan.schedule[dayIdx].topics[topicIdx];
    
    if (!topic.completed) {
      // Starting study
      if (!topic.startTime) {
        topic.startTime = new Date().toISOString();
        toast.info(`Estudo iniciado: ${topic.title}`);
      } else {
        // Completing study
        topic.endTime = new Date().toISOString();
        topic.completed = true;
        topic.completedAt = new Date().toISOString();
        
        const start = new Date(topic.startTime).getTime();
        const end = new Date(topic.endTime).getTime();
        topic.actualDuration = Math.round((end - start) / (1000 * 60));
        
        toast.success(`Concluído! Você estudou por ${topic.actualDuration} minutos.`);
      }
    } else {
      // Un-completing
      topic.completed = false;
      topic.startTime = undefined;
      topic.endTime = undefined;
      topic.actualDuration = undefined;
      topic.completedAt = undefined;
    }
    
    setPlan(newPlan);
    
    // Update in Firestore if it's a saved plan
    if (newPlan.id) {
      try {
        await updateDoc(doc(db, "plans", newPlan.id), { schedule: newPlan.schedule });
      } catch (error) {
        console.error("Erro ao atualizar progresso:", error);
      }
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-5xl tracking-wide text-red-600" style={{ fontFamily: "'Deutsch Gothic', serif" }}>Plano de Estudos</h1>
          <p className="text-zinc-900 dark:text-white font-bold mt-2 text-2xl" style={{ fontFamily: "'Deutsch Gothic', serif" }}>Personalização avançada com inteligência artificial.</p>
        </div>
        {plan && (
          <div className="flex gap-2">
            <Button onClick={() => handleSavePlan()} variant="outline" className="gap-2">
              <Save className="w-4 h-4" />
              Salvar Plano
            </Button>
            <Button onClick={() => setPlan(null)} variant="ghost" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {!plan ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Tabs defaultValue="manual" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-8">
                <TabsTrigger value="manual">Manual</TabsTrigger>
                <TabsTrigger value="notices">Análise de Editais</TabsTrigger>
                <TabsTrigger value="saved">Meus Planos</TabsTrigger>
              </TabsList>

              <TabsContent value="manual">
                <Card className="max-w-2xl mx-auto">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-indigo-500" />
                      Gerador Rápido
                    </CardTitle>
                    <CardDescription>Crie um plano com base em objetivos diretos.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label>Objetivo do Concurso</Label>
                      <Input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Ex: Auditor Fiscal" />
                    </div>
                    <div className="space-y-2">
                      <Label>Matérias</Label>
                      <Input value={subjects} onChange={(e) => setSubjects(e.target.value)} placeholder="Ex: Direito, Contabilidade" />
                    </div>
                    <div className="space-y-2">
                      <Label>Horas por Dia</Label>
                      <Input type="number" value={hours} onChange={(e) => setHours(Number(e.target.value))} />
                    </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <span 
                              onClick={handleCreateManualPlan} 
                              className={cn(
                                "w-full inline-flex items-center justify-center rounded-md text-sm font-bold bg-red-600 text-white hover:bg-red-700 h-10 px-4 py-2 cursor-pointer transition-opacity",
                                loading && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              {loading ? "Gerando..." : "Gerar Plano"}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="bg-zinc-900 text-white border-zinc-800 max-w-xs">
                            <p>A ação Gerar Plano utiliza Inteligência Artificial para criar um cronograma personalizado com base nos seus objetivos, matérias e tempo disponível.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="notices">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <Card>
                    <CardHeader>
                      <CardTitle>Configuração do Plano</CardTitle>
                      <CardDescription>Defina os parâmetros para o cruzamento de editais.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-2">
                        <Label>Data Prevista da Prova</Label>
                        <Input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Horas por Dia</Label>
                        <Input type="number" value={hours} onChange={(e) => setHours(Number(e.target.value))} />
                        <p className="text-[10px] text-zinc-400 italic">Dica: Se você escolher 4 horas, a IA distribuirá os tópicos para cobrir o edital respeitando esse limite diário.</p>
                      </div>
                      <Button 
                        className="w-full bg-indigo-600 h-12 text-lg font-bold shadow-lg shadow-indigo-200"
                        disabled={loading || selectedNoticeIds.length === 0}
                        onClick={handleCreateNoticePlan}
                      >
                        {loading ? "Analisando e Gerando..." : "Gerar Plano Inteligente"}
                      </Button>
                    </CardContent>
                  </Card>

                  <div className="space-y-6">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0">
                        <div>
                          <CardTitle>Selecionar Editais ({selectedNoticeIds.length})</CardTitle>
                          <CardDescription>Escolha os editais que deseja cruzar.</CardDescription>
                        </div>
                        <Link to="/editais">
                          <Button variant="outline" size="sm" className="gap-2">
                            <Plus className="w-4 h-4" /> Gerenciar
                          </Button>
                        </Link>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {savedNotices.length === 0 && (
                          <div className="text-center py-8">
                            <p className="text-zinc-400 text-sm italic mb-4">Nenhum edital cadastrado.</p>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Link to="/editais" className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 h-9 px-3">
                                    Cadastrar Editais
                                  </Link>
                                </TooltipTrigger>
                                <TooltipContent className="bg-zinc-900 text-white border-zinc-800 max-w-xs">
                                  <p>Cadastre editais (ex: PRF, PF, PC, PM) para que a IA cruze os dados, determine as matérias comuns da carreira policial e ajude na criação de um planejamento mais efetivo para sua aprovação.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        )}
                        {savedNotices.map(n => (
                          <div 
                            key={n.id} 
                            onClick={() => toggleNoticeSelection(n.id)}
                            className={cn(
                              "flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer",
                              selectedNoticeIds.includes(n.id)
                                ? "bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200"
                                : "bg-zinc-50 border-zinc-100 hover:border-zinc-300"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                                selectedNoticeIds.includes(n.id) ? "bg-indigo-600 border-indigo-600" : "bg-white border-zinc-300"
                              )}>
                                {selectedNoticeIds.includes(n.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
                              </div>
                              <div className="flex items-center gap-2">
                                <FileText className={cn("w-4 h-4", selectedNoticeIds.includes(n.id) ? "text-indigo-600" : "text-zinc-400")} />
                                <span className={cn("font-medium text-sm", selectedNoticeIds.includes(n.id) ? "text-indigo-900" : "text-zinc-700")}>
                                  {n.name}
                                </span>
                              </div>
                            </div>
                            <Badge variant="outline" className="text-[10px]">
                              {n.subjects.length} mat.
                            </Badge>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="saved">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {savedPlans.length === 0 && (
                    <div className="col-span-full py-12 text-center border-2 border-dashed border-zinc-200 rounded-xl">
                      <p className="text-zinc-400">Você ainda não salvou nenhum plano.</p>
                    </div>
                  )}
                  {savedPlans.map(p => (
                    <Card key={p.id} className="group hover:border-indigo-200 transition-all">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">{p.title}</CardTitle>
                        <CardDescription>{p.goal}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex gap-2 items-center pt-4">
                          <Button onClick={() => { setPlan(p); setViewMode('calendar'); }} variant="secondary" size="sm" className="gap-2 flex-1">
                            <CalendarIcon className="w-4 h-4" /> Calendário
                          </Button>
                          <Button onClick={() => { setPlan(p); setViewMode('vertical'); }} variant="outline" size="sm" className="gap-2 flex-1 border-indigo-200 text-indigo-600">
                            <Layers className="w-4 h-4" /> Vertical
                          </Button>
                          <Button onClick={() => deletePlan(p.id)} variant="ghost" size="sm" className="text-zinc-400 hover:text-red-500">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            <div className="bg-white border border-zinc-100 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between shadow-sm gap-4">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-indigo-100 rounded-xl">
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="font-bold text-zinc-900">{plan.title}</h2>
                  <p className="text-xs text-zinc-500">{plan.goal}</p>
                </div>
              </div>

              <div className="flex-1 max-w-xs px-4">
                <div className="flex justify-between text-[10px] font-bold text-zinc-400 mb-1 uppercase tracking-wider">
                  <span>Progresso do Edital</span>
                  <span>{Math.round((plan.schedule.reduce((acc, day) => acc + day.topics.filter(t => t.completed).length, 0) / plan.schedule.reduce((acc, day) => acc + day.topics.length, 1)) * 100)}%</span>
                </div>
                <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-600 transition-all duration-500" 
                    style={{ width: `${(plan.schedule.reduce((acc, day) => acc + day.topics.filter(t => t.completed).length, 0) / plan.schedule.reduce((acc, day) => acc + day.topics.length, 1)) * 100}%` }}
                  />
                </div>
                <p className="text-[9px] text-zinc-400 mt-1">
                  {plan.schedule.reduce((acc, day) => acc + day.topics.filter(t => t.completed).length, 0)} de {plan.schedule.reduce((acc, day) => acc + day.topics.length, 0)} tópicos concluídos
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex bg-zinc-100 p-1 rounded-lg">
                  <Button 
                    variant={viewMode === 'calendar' ? 'secondary' : 'ghost'} 
                    size="sm" 
                    className="h-8 text-[10px] px-3"
                    onClick={() => setViewMode('calendar')}
                  >
                    Calendário
                  </Button>
                  <Button 
                    variant={viewMode === 'vertical' ? 'secondary' : 'ghost'} 
                    size="sm" 
                    className="h-8 text-[10px] px-3"
                    onClick={() => setViewMode('vertical')}
                  >
                    Verticalizado
                  </Button>
                </div>
                <Button variant="outline" size="sm" className="gap-2 h-9 border-indigo-200 text-indigo-600" onClick={() => handleSavePlan(plan)}>
                  <Save className="w-4 h-4" /> Salvar Plano
                </Button>
              </div>
            </div>

            <PlanViewer 
              plan={plan} 
              viewMode={viewMode} 
              onToggleTopic={toggleTopicCompletion} 
            />
          </motion.div>
        )}
      </AnimatePresence>

      {plan && (
        <div className="fixed bottom-6 right-6 z-50">
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="bg-black border border-red-900/50 rounded-2xl shadow-2xl overflow-hidden w-72"
          >
            <div className={cn(
              "p-4 flex items-center justify-between border-b",
              timerMode === 'study' ? "bg-red-700 text-white border-red-900/50" : "bg-zinc-900 text-red-600 border-red-900/50"
            )}>
              <div className="flex items-center gap-2">
                {timerMode === 'study' ? <Timer className="w-4 h-4" /> : <Coffee className="w-4 h-4" />}
                <span className="text-xs font-bold uppercase tracking-widest" style={{ fontFamily: "'Deutsch Gothic', serif" }}>
                  {timerMode === 'study' ? 'Foco' : 'Pausa'}
                </span>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className={cn("h-6 w-6", timerMode === 'study' ? "text-white hover:bg-white/20" : "text-red-600 hover:bg-red-900/20")}
                onClick={() => setShowTimerSettings(!showTimerSettings)}
              >
                <Settings2 className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-6 text-center">
              <div className="text-5xl font-black text-white mb-6 font-mono tracking-tighter">
                {formatTimer(timerTime)}
              </div>

              <AnimatePresence>
                {showTimerSettings && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden mb-6 space-y-4 text-left"
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-zinc-400">Estudo (min)</Label>
                        <Input 
                          type="number" 
                          value={studyDuration} 
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setStudyDuration(val);
                            if (timerMode === 'study' && !timerActive) setTimerTime(val * 60);
                          }}
                          className="h-8 text-xs bg-zinc-900 border-zinc-800 text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-zinc-400">Pausa (min)</Label>
                        <Input 
                          type="number" 
                          value={breakDuration} 
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setBreakDuration(val);
                            if (timerMode === 'break' && !timerActive) setTimerTime(val * 60);
                          }}
                          className="h-8 text-xs bg-zinc-900 border-zinc-800 text-white"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex gap-2">
                <Button 
                  className={cn(
                    "flex-1 h-10 font-bold",
                    timerActive 
                      ? "bg-zinc-900 text-red-600 border border-red-900/50 hover:bg-zinc-800" 
                      : "bg-red-700 text-white hover:bg-red-600 shadow-md shadow-red-900/20"
                  )}
                  onClick={toggleTimer}
                >
                  {timerActive ? (
                    <><PauseIcon className="w-4 h-4 mr-2" /> Pausar</>
                  ) : (
                    <><Play className="w-4 h-4 mr-2" /> Iniciar</>
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-10 w-10 border-red-900/50 bg-zinc-900 hover:bg-zinc-800"
                  onClick={resetTimer}
                >
                  <RotateCcw className="w-4 h-4 text-red-600" />
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
