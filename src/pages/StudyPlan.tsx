import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
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

  const location = useLocation();
  const [viewMode, setViewMode] = useState<'calendar' | 'vertical'>('calendar');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const view = params.get('view');
    if (view === 'vertical') {
      setViewMode('vertical');
    } else if (view === 'calendar') {
      setViewMode('calendar');
    }
  }, [location]);
  const [user, setUser] = useState<any>(null);

  // Timer State
  const [timerTime, setTimerTime] = useState(25 * 60);
  const [timerActive, setTimerActive] = useState(false);
  const [timerMode, setTimerMode] = useState<'study' | 'break'>('study');
  const [studyDuration, setStudyDuration] = useState(25);
  const [breakDuration, setBreakDuration] = useState(5);
  const [showTimerSettings, setShowTimerSettings] = useState(false);

  // Editing Dates State
  const [showEditDates, setShowEditDates] = useState(false);
  const [editStartDate, setEditStartDate] = useState("");
  const [editHours, setEditHours] = useState(4);

  const formatLocalDate = (isoString?: string) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
    } catch {
      return "";
    }
  };

  useEffect(() => {
    if (plan && showEditDates) {
      setEditStartDate(formatLocalDate(plan.startDate) || formatLocalDate(new Date().toISOString()));
      // If the plan has hours stored, we could try to guess them, but sticking to 4 or current average is fine. 
      // A safe default is 4 if we don't have a specific stored editHours.
    }
  }, [plan, showEditDates]);

  const handleUpdateDates = async () => {
    if (!plan) return;
    if (!editStartDate) {
      toast.error("Por favor, selecione uma data de início.");
      return;
    }
    if (!editHours || editHours <= 0) {
      toast.error("Por favor, selecione um tempo de estudo válido (em horas).");
      return;
    }
    
    const sDate = new Date(`${editStartDate}T00:00:00`);
    
    const allTopics = plan.schedule.flatMap(day => day.topics);
    const newSchedule: typeof plan.schedule = [];
    
    let currentDayTopics: typeof allTopics = [];
    let currentDayMinutes = 0;
    let dayIndex = 0;
    
    const maxMinutesPerDay = Math.round(editHours * 60);

    for (let i = 0; i < allTopics.length; i++) {
      const topic = allTopics[i];
      const topicDuration = topic.duration || 60; // fallback
      
      if (currentDayTopics.length > 0 && currentDayMinutes + topicDuration > maxMinutesPerDay) {
        const currentDate = new Date(sDate);
        currentDate.setDate(sDate.getDate() + dayIndex);
        
        newSchedule.push({
          day: `Dia ${dayIndex + 1} - ${currentDate.toLocaleDateString('pt-BR')}`,
          topics: currentDayTopics
        });
        
        dayIndex++;
        currentDayTopics = [];
        currentDayMinutes = 0;
      }
      
      currentDayTopics.push(topic);
      currentDayMinutes += topicDuration;
    }
    
    if (currentDayTopics.length > 0) {
      const currentDate = new Date(sDate);
      currentDate.setDate(sDate.getDate() + dayIndex);
      
      newSchedule.push({
        day: `Dia ${dayIndex + 1} - ${currentDate.toLocaleDateString('pt-BR')}`,
        topics: currentDayTopics
      });
      dayIndex++;
    }

    const eDate = new Date(sDate);
    if (dayIndex > 0) {
      eDate.setDate(sDate.getDate() + dayIndex - 1);
    }

    const updatedPlan = {
      ...plan,
      startDate: sDate.toISOString(),
      endDate: eDate.toISOString(),
      schedule: newSchedule
    };

    setPlan(updatedPlan);
    setShowEditDates(false);
    toast.success("Datas recalculadas com sucesso!");
    
    if (plan.id) {
        try {
          await updateDoc(doc(db, "plans", plan.id), { 
            startDate: updatedPlan.startDate, 
            endDate: updatedPlan.endDate, 
            schedule: updatedPlan.schedule 
          });
        } catch (error) {
            console.error("Erro ao salvar datas", error);
            toast.error("Erro ao salvar as datas atualizadas no banco de dados.");
        }
    }
  };

  const getUid = () => {
    if (user) return user.uid;
    let localUid = localStorage.getItem('igp_local_uid');
    if (!localUid) {
      localUid = 'anon_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('igp_local_uid', localUid);
    }
    return localUid;
  };

  const getUids = () => {
    const uids = [];
    if (user) uids.push(user.uid);
    const localUid = localStorage.getItem('igp_local_uid');
    if (localUid) uids.push(localUid);
    if (uids.length === 0) {
      const newLocal = 'anon_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('igp_local_uid', newLocal);
      uids.push(newLocal);
    }
    return Array.from(new Set(uids));
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

  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    
    const isAdmin = user && (user.email === "henrique.rosa@poli.ufrj.br" || user.email === "brunool.rj@gmail.com");
    const uids = getUids();
    
    // Filter UIDs to only include those the current user has permission to read
    // This prevents "Missing or insufficient permissions" errors on list operations
    const allowedUids = uids.filter(id => id.startsWith('anon_') || (user && id === user.uid));
    
    if (allowedUids.length === 0) return;

    let qPlans;
    if (isAdmin) {
      qPlans = query(collection(db, "plans"));
    } else {
      qPlans = allowedUids.length === 1
        ? query(collection(db, "plans"), where("uid", "==", allowedUids[0]))
        : query(collection(db, "plans"), where("uid", "in", allowedUids));
    }
      
    const unsubscribePlans = onSnapshot(qPlans, (snapshot) => {
      const parsedPlans = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as StudyPlanType));
      setSavedPlans(parsedPlans);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "plans");
    });

    let qNotices;
    if (isAdmin) {
      qNotices = query(collection(db, "notices"));
    } else {
      qNotices = allowedUids.length === 1
        ? query(collection(db, "notices"), where("uid", "==", allowedUids[0]))
        : query(collection(db, "notices"), where("uid", "in", allowedUids));
    }
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
  }, [authReady, user]);

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
          <h1 className="text-5xl tracking-wide text-primary" style={{ fontFamily: "'Deutsch Gothic', serif" }}>Plano de Estudos</h1>
          <p className="text-white  font-bold mt-2 text-2xl" style={{ fontFamily: "'Deutsch Gothic', serif" }}>Personalização avançada com inteligência artificial.</p>
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
                <Card className="max-w-2xl mx-auto bg-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-primary uppercase">
                      <Sparkles className="w-5 h-5 text-primary" />
                      Gerador Rápido
                    </CardTitle>
                    <CardDescription className="text-white">Crie um plano com base em objetivos diretos.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label className="text-white">Objetivo do Concurso</Label>
                      <Input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Ex: Auditor Fiscal" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-white">Matérias</Label>
                      <Input value={subjects} onChange={(e) => setSubjects(e.target.value)} placeholder="Ex: Direito, Contabilidade" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-white">Horas por Dia</Label>
                      <Input type="number" value={hours} onChange={(e) => setHours(Number(e.target.value))} />
                    </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <span 
                              onClick={handleCreateManualPlan} 
                              className={cn(
                                "w-full inline-flex items-center justify-center rounded-md text-sm font-bold bg-primary text-black hover:bg-primary/80 h-10 px-4 py-2 cursor-pointer transition-opacity",
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
                  <Card className="bg-card">
                    <CardHeader>
                      <CardTitle className="text-primary uppercase">Configuração do Plano</CardTitle>
                      <CardDescription className="text-white">Defina os parâmetros para o cruzamento de editais.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-2">
                        <Label className="text-white">Data Prevista da Prova</Label>
                        <Input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-white">Horas por Dia</Label>
                        <Input type="number" value={hours} onChange={(e) => setHours(Number(e.target.value))} />
                        <p className="text-[10px] text-zinc-400 italic">Dica: Se você escolher 4 horas, a IA distribuirá os tópicos para cobrir o edital respeitando esse limite diário.</p>
                      </div>
                      <Button 
                        className="w-full bg-primary h-12 text-lg font-bold shadow-lg shadow-yellow-200"
                        disabled={loading || selectedNoticeIds.length === 0}
                        onClick={handleCreateNoticePlan}
                      >
                        {loading ? "Analisando e Gerando..." : "Gerar Plano Inteligente"}
                      </Button>
                    </CardContent>
                  </Card>

                  <div className="space-y-6">
                    <Card className="bg-card">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0">
                        <div>
                          <CardTitle className="text-primary uppercase">Selecionar Editais ({selectedNoticeIds.length})</CardTitle>
                          <CardDescription className="text-white">Escolha os editais que deseja cruzar.</CardDescription>
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
                                ? "bg-primary/10 border-primary/20 ring-1 ring-yellow-200"
                                : "bg-background border-zinc-100 hover:border-zinc-300"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                                selectedNoticeIds.includes(n.id) ? "bg-primary border-primary" : "bg-background border-zinc-300"
                              )}>
                                {selectedNoticeIds.includes(n.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
                              </div>
                              <div className="flex items-center gap-2">
                                <FileText className={cn("w-4 h-4", selectedNoticeIds.includes(n.id) ? "text-primary" : "text-zinc-400")} />
                                <span className={cn("font-medium text-sm", selectedNoticeIds.includes(n.id) ? "text-yellow-900" : "text-zinc-300")}>
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
                    <Card key={p.id} className="group hover:border-primary/20 transition-all bg-card">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg text-primary uppercase">{p.title}</CardTitle>
                        <CardDescription className="text-white font-medium">{p.goal}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex gap-2 items-center pt-4">
                          <Button onClick={() => { setPlan(p); setViewMode('calendar'); }} variant="secondary" size="sm" className="gap-2 flex-1">
                            <CalendarIcon className="w-4 h-4" /> Calendário
                          </Button>
                          <Button onClick={() => { setPlan(p); setViewMode('vertical'); }} variant="outline" size="sm" className="gap-2 flex-1 border-primary/20 text-primary">
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
            <div className="bg-background border border-zinc-100 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between shadow-sm gap-4">
              <div className="flex items-start gap-4 flex-col sm:flex-row sm:items-center">
                <div className="p-2 bg-yellow-100 rounded-xl hidden sm:block">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-bold text-white max-w-sm truncate" title={plan.title}>{plan.title}</h2>
                  <p className="text-xs text-zinc-500 max-w-sm truncate" title={plan.goal}>{plan.goal}</p>
                  <p className="text-xs text-primary font-medium mt-1">
                    {formatLocalDate(plan.startDate).split('-').reverse().join('/')} até {formatLocalDate(plan.endDate).split('-').reverse().join('/')}
                  </p>
                </div>
              </div>

              <div className="flex-1 max-w-xs px-4">
                <div className="flex justify-between text-[10px] font-bold text-zinc-400 mb-1 uppercase tracking-wider">
                  <span>Progresso do Edital</span>
                  <span>{Math.round((plan.schedule.reduce((acc, day) => acc + day.topics.filter(t => t.completed).length, 0) / plan.schedule.reduce((acc, day) => acc + day.topics.length, 1)) * 100)}%</span>
                </div>
                <div className="h-2 bg-card rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-500" 
                    style={{ width: `${(plan.schedule.reduce((acc, day) => acc + day.topics.filter(t => t.completed).length, 0) / plan.schedule.reduce((acc, day) => acc + day.topics.length, 1)) * 100}%` }}
                  />
                </div>
                <p className="text-[9px] text-zinc-400 mt-1">
                  {plan.schedule.reduce((acc, day) => acc + day.topics.filter(t => t.completed).length, 0)} de {plan.schedule.reduce((acc, day) => acc + day.topics.length, 0)} tópicos concluídos
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-9 text-xs border-primary/20 text-primary"
                  onClick={() => setShowEditDates(!showEditDates)}
                >
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  Editar Datas
                </Button>
                <div className="flex bg-card p-1 rounded-lg">
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
                <Button variant="outline" size="sm" className="gap-2 h-9 border-primary/20 text-primary" onClick={() => handleSavePlan(plan)}>
                  <Save className="w-4 h-4" /> Salvar Plano
                </Button>
              </div>
            </div>
            
            <AnimatePresence>
              {showEditDates && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-card border border-zinc-100 p-4 rounded-xl flex flex-wrap items-end gap-4 shadow-sm mb-2 mt-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-zinc-400">Data de Início</Label>
                      <Input 
                        type="date" 
                        value={editStartDate} 
                        onChange={(e) => setEditStartDate(e.target.value)}
                        className="bg-background text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-zinc-400">Tempo de Estudo (Horas/Dia)</Label>
                      <Input 
                        type="number" 
                        min="1"
                        max="24"
                        value={editHours} 
                        onChange={(e) => setEditHours(Number(e.target.value))}
                        className="bg-background text-sm w-32"
                      />
                    </div>
                    <Button onClick={handleUpdateDates} className="bg-primary hover:bg-primary/90 text-black font-bold h-10">
                      Recalcular Dias
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

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
              timerMode === 'study' ? "bg-red-700 text-white border-red-900/50" : "bg-zinc-900 text-primary border-red-900/50"
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
                className={cn("h-6 w-6", timerMode === 'study' ? "text-white hover:bg-background/20" : "text-primary hover:bg-red-900/20")}
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
                      ? "bg-zinc-900 text-primary border border-red-900/50 hover:bg-zinc-800" 
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
                  <RotateCcw className="w-4 h-4 text-primary" />
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
