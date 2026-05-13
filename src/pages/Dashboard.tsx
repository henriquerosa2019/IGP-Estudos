import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
} from "recharts";
import { 
  CheckCircle2, 
  Clock, 
  Trophy, 
  TrendingUp,
  AlertTriangle,
  Mail as MailIcon,
  Calendar as CalendarIcon,
  Target,
  ArrowRight,
  Book,
  Play,
  RotateCcw,
  List,
  Layers
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { StudyPlan } from "@/types";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db, auth, handleFirestoreError, OperationType } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function Dashboard() {
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState([
    { label: "Tópicos Concluídos", value: "0", icon: CheckCircle2, color: "text-green-500", description: "", tooltip: "" },
    { label: "Horas de Estudo", value: "0h", icon: Clock, color: "text-blue-500", description: "", tooltip: "" },
    { label: "Ofensiva", value: "0 dias", icon: Trophy, color: "text-orange-500", description: "Dias seguidos de estudo", tooltip: "Sua ofensiva aumenta a cada dia consecutivo que você conclui pelo menos um tópico de estudo." },
    { label: "Precisão", value: "0%", icon: TrendingUp, color: "text-primary", description: "Acertos nos flashcards", tooltip: "Sua precisão é calculada com base na quantidade de flashcards que você acertou (marcou como fácil) durante as revisões." },
  ]);
  const [subjectProgress, setSubjectProgress] = useState<{subject: string, progress: number}[]>([]);
  const [unauthorizedAttempts, setUnauthorizedAttempts] = useState<any[]>([]);
  const [examAlerts, setExamAlerts] = useState<any[]>([]);

  const [weeklyData, setWeeklyData] = useState<{name: string, horas: number}[]>([
    { name: "Seg", horas: 0 }, { name: "Ter", horas: 0 }, { name: "Qua", horas: 0 },
    { name: "Qui", horas: 0 }, { name: "Sex", horas: 0 }, { name: "Sáb", horas: 0 }, { name: "Dom", horas: 0 }
  ]);

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
    return uids;
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
      
    let qFlashcards;
    if (isAdmin) {
      qFlashcards = query(collection(db, "flashcardReviews"));
    } else {
      qFlashcards = allowedUids.length === 1
        ? query(collection(db, "flashcardReviews"), where("uid", "==", allowedUids[0]))
        : query(collection(db, "flashcardReviews"), where("uid", "in", allowedUids));
    }

    let flashcardsData: any[] = [];
    
    const unsubscribeFlashcards = onSnapshot(qFlashcards, (snapshot) => {
      flashcardsData = snapshot.docs.map(doc => doc.data());
      updateStats();
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "flashcardReviews");
    });

    let plansData: StudyPlan[] = [];

    const unsubscribePlans = onSnapshot(qPlans, (snapshot) => {
      plansData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as StudyPlan));
      setPlans(plansData);
      updateStats();
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "plans");
    });

    let unsubscribeAttempts = () => {};
    if (user?.email === "henrique.rosa@poli.ufrj.br") {
      const qAttempts = query(collection(db, "unauthorized_attempts"));
      unsubscribeAttempts = onSnapshot(qAttempts, (snapshot) => {
        const attempts = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        setUnauthorizedAttempts(attempts.sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp)));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, "unauthorized_attempts");
      });
    }

    const updateStats = () => {
      // Calculate stats
      let totalCompleted = 0;
      let totalMinutes = 0;
      const subjects: Record<string, { total: number, completed: number }> = {};
      const completedDates = new Set<string>();
      
      // For weekly activity
      const today = new Date();
      const last7Days = Array.from({length: 7}).map((_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        return {
          dateStr: d.toISOString().split('T')[0],
          dayName: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
          minutes: 0
        };
      }).reverse();

      plansData.forEach(plan => {
        plan.schedule.forEach(day => {
          day.topics.forEach(topic => {
            if (topic.completed) {
              totalCompleted++;
              totalMinutes += topic.actualDuration || 0;
              
              if (topic.completedAt) {
                const dateStr = topic.completedAt.split('T')[0];
                completedDates.add(dateStr);
                
                const weekDay = last7Days.find(d => d.dateStr === dateStr);
                if (weekDay) {
                  weekDay.minutes += (topic.actualDuration || 0);
                }
              }
            }
            
            if (!subjects[topic.subject]) {
              subjects[topic.subject] = { total: 0, completed: 0 };
            }
            subjects[topic.subject].total++;
            if (topic.completed) {
              subjects[topic.subject].completed++;
            }
          });
        });
      });

      // Calculate Streak
      const sortedDates = Array.from(completedDates).sort((a, b) => b.localeCompare(a));
      let streak = 0;
      let currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);
      
      const todayStr = currentDate.toISOString().split('T')[0];
      const yesterday = new Date(currentDate);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (sortedDates.includes(todayStr) || sortedDates.includes(yesterdayStr)) {
        let checkDate = sortedDates.includes(todayStr) ? new Date(currentDate) : new Date(yesterday);
        
        for (const dateStr of sortedDates) {
          const expectedStr = checkDate.toISOString().split('T')[0];
          if (dateStr === expectedStr) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else if (dateStr < expectedStr) {
            break;
          }
        }
      }

      // Calculate Accuracy from Flashcards (easeFactor > 2.0 = good)
      let accuracy = "N/A";
      if (flashcardsData.length > 0) {
        const reviewedCards = flashcardsData.filter(c => c.repetitions && c.repetitions > 0);
        if (reviewedCards.length > 0) {
          const correctCards = reviewedCards.filter(c => c.easeFactor && c.easeFactor >= 2.0);
          accuracy = `${Math.round((correctCards.length / reviewedCards.length) * 100)}%`;
        }
      }

      const hours = (totalMinutes / 60).toFixed(1);
      const progressList = Object.entries(subjects).map(([name, data]) => ({
        subject: name,
        progress: Math.round((data.completed / data.total) * 100)
      })).sort((a, b) => b.progress - a.progress);

      setSubjectProgress(progressList);
      setWeeklyData(last7Days.map(d => ({
        name: d.dayName.charAt(0).toUpperCase() + d.dayName.slice(1),
        horas: Number((d.minutes / 60).toFixed(1))
      })));

      setStats([
        { label: "Tópicos Concluídos", value: totalCompleted.toString(), icon: CheckCircle2, color: "text-green-500", description: "", tooltip: "" },
        { label: "Horas de Estudo", value: `${hours}h`, icon: Clock, color: "text-blue-500", description: "", tooltip: "" },
        { label: "Ofensiva", value: `${streak} dia${streak !== 1 ? 's' : ''}`, icon: Trophy, color: "text-orange-500", description: "Dias seguidos de estudo", tooltip: "Sua ofensiva aumenta a cada dia consecutivo que você conclui pelo menos um tópico de estudo." },
        { label: "Precisão", value: accuracy, icon: TrendingUp, color: "text-primary", description: "Acertos nos flashcards", tooltip: "Sua precisão é calculada com base na quantidade de flashcards que você acertou (marcou como fácil) durante as revisões." },
      ]);
    };

    // Load exam alerts
    try {
      const key = user ? `calendar-events-${user.uid}` : "calendar-events-guest";
      const savedEvents = localStorage.getItem(key);
      if (savedEvents) {
        const events = JSON.parse(savedEvents);
        
        const alerts = events.filter((e: any) => {
          let targetDateStr = null;
          if (e.dataProva) {
            targetDateStr = e.dataProva;
          } else if (e.tipo === 'prova' && e.data) {
            targetDateStr = e.data;
          }
          
          if (!targetDateStr) return false;
          
          const today = new Date();
          today.setHours(0,0,0,0);
          
          const [y, m, d] = targetDateStr.split('-');
          const targetDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
          targetDate.setHours(0,0,0,0);
          
          const diffInMs = targetDate.getTime() - today.getTime();
          const diffInDays = Math.round(diffInMs / (1000 * 60 * 60 * 24));
          
          return diffInDays >= 0 && diffInDays <= 7;
        }).map((e: any) => {
           let targetDateStr = e.dataProva || (e.tipo === 'prova' ? e.data : '');
           
           const today = new Date();
           today.setHours(0,0,0,0);
           
           const [y, m, d] = targetDateStr.split('-');
           const targetDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
           targetDate.setHours(0,0,0,0);
           
           const diffInMs = targetDate.getTime() - today.getTime();
           const diffInDays = Math.round(diffInMs / (1000 * 60 * 60 * 24));
           
           return { ...e, diasRestantes: diffInDays };
        });
        
        alerts.sort((a: any, b: any) => a.diasRestantes - b.diasRestantes);
        
        setExamAlerts(alerts);
      }
    } catch (err) {
      console.error(err);
    }

    return () => {
      unsubscribePlans();
      unsubscribeFlashcards();
      unsubscribeAttempts();
    };
  }, [authReady, user]);

  const [todayTopics, setTodayTopics] = useState<{estudo: any[], revisao: any[]}>({estudo: [], revisao: []});

  useEffect(() => {
    if (!plans || plans.length === 0) return;
    
    // Find active plan or just use first one for now
    const activePlan = plans[0];
    const todayName = new Date().toLocaleDateString('pt-BR', { weekday: 'long' }).split('-')[0].toLowerCase();
    
    const todaySchedule = activePlan.schedule.find(s => 
      s.day.toLowerCase().includes(todayName) || 
      (todayName === 'domingo' && s.day.toLowerCase().includes('dom'))
    );

    if (todaySchedule) {
      setTodayTopics({
        estudo: todaySchedule.topics.filter(t => t.type === 'study'),
        revisao: todaySchedule.topics.filter(t => t.type === 'revision')
      });
    }
  }, [plans]);

  return (
    <div className="space-y-8 text-white dark:text-zinc-50 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-5xl font-black tracking-tighter text-white uppercase italic">
            Dashboard <span className="text-primary italic">IGP</span>
          </h1>
          <p className="text-zinc-400 font-bold mt-2 text-xl tracking-tight leading-tight">
            Seu progresso é medido por cada tópico concluído nos seus editais.
          </p>
        </div>
        <div className="p-4 bg-zinc-900 rounded-3xl border border-zinc-800 shadow-2xl flex flex-col items-center justify-center gap-2">
          <img 
            src="https://www.dropbox.com/scl/fi/3mbpui4v6ujy3qpietkz3/file_00000000f3e071f5b7b9002a82001ba3.png?rlkey=brg42q31mtfniaz0nblqzdwrf&st=ffx5om1y&raw=1" 
            alt="IGP Estudos Logo" 
            className="w-[200px] h-auto object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link to="/questoes">
              <Card className="bg-primary/5 border-primary/20 hover:border-primary/40 transition-all cursor-pointer group relative overflow-hidden h-full">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl rounded-full -mr-8 -mt-8"></div>
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className="p-3 bg-primary/20 rounded-2xl">
                    <Target className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-black text-white uppercase italic">Banco de Questões</CardTitle>
                    <CardDescription className="text-zinc-400 font-medium tracking-tight">Resolva questões inéditas do TRT 2025</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-primary font-bold text-sm">
                    Acesse agora <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link to="/plano?view=vertical">
              <Card className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer group h-full">
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className="p-3 bg-zinc-800 rounded-2xl border border-zinc-700">
                    <Layers className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-black text-white uppercase italic">Edital Verticalizado</CardTitle>
                    <CardDescription className="text-zinc-400 font-medium tracking-tight">Status de cada disciplina e assunto</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-primary font-bold text-sm">
                    Visualizar edital <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link to="/plano">
              <Card className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer group h-full">
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className="p-3 bg-zinc-800 rounded-2xl border border-zinc-700">
                    <CalendarIcon className="w-8 h-8 text-zinc-400" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-black text-white uppercase italic">Cronograma</CardTitle>
                    <CardDescription className="text-zinc-400 font-medium tracking-tight">Sua rotina diária de estudos</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-zinc-400 font-bold text-sm">
                    Ver dias de estudo <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Today's Tasks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-zinc-900 border-zinc-800 rounded-[2rem] overflow-hidden">
              <CardHeader className="bg-zinc-950/50 border-b border-zinc-800 p-6">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-black text-white uppercase italic flex items-center gap-2">
                    <Book className="w-5 h-5 text-primary" />
                    Estudo do dia
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">HOJE</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {todayTopics.estudo.length === 0 ? (
                  <p className="text-zinc-500 text-sm italic py-4">Nenhum estudo planejado para hoje.</p>
                ) : (
                  todayTopics.estudo.map((topic, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-zinc-950 border border-zinc-800 rounded-2xl hover:border-primary/50 transition-colors">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black">
                        {i+1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-primary uppercase tracking-tighter truncate">{topic.subject}</p>
                        <p className="text-sm font-bold text-white truncate">{topic.title}</p>
                      </div>
                      <Link to="/plano">
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-zinc-600 hover:text-white">
                          <Play className="w-4 h-4" />
                        </Button>
                      </Link>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="bg-zinc-900 border-zinc-800 rounded-[2rem] overflow-hidden">
              <CardHeader className="bg-zinc-950/50 border-b border-zinc-800 p-6">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-black text-white uppercase italic flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary" />
                    Revisão do dia
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400 font-bold">{todayTopics.revisao.length} PENDENTES</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {todayTopics.revisao.length === 0 ? (
                  <p className="text-zinc-500 text-sm italic py-4">Nenhuma revisão pendente para hoje.</p>
                ) : (
                  todayTopics.revisao.map((topic, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-zinc-950 border border-zinc-800 rounded-2xl hover:border-primary/50 transition-colors">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <RotateCcw className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-primary uppercase tracking-tighter truncate">{topic.subject}</p>
                        <p className="text-sm font-bold text-white truncate">{topic.title}</p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            {stats.map((stat) => (
              <Card key={stat.label} className="bg-zinc-900 border-zinc-800 h-32 flex flex-col justify-between p-4 rounded-3xl">
                <div className="flex items-start justify-between">
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{stat.label}</span>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <div className="text-2xl font-black text-white tracking-tighter">{stat.value}</div>
              </Card>
            ))}
          </div>

          <Card className="bg-zinc-900 border-zinc-800 rounded-[2rem] overflow-hidden">
            <CardHeader>
              <CardTitle className="text-md font-black text-white uppercase italic">Progresso Real</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {subjectProgress.length === 0 && (
                <p className="text-zinc-500 text-sm italic text-center py-8">Nenhum progresso registrado.</p>
              )}
              {subjectProgress.map((item) => (
                <div key={item.subject} className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="truncate max-w-[150px] text-zinc-300 uppercase tracking-tighter">{item.subject}</span>
                    <span className="text-primary font-black">{item.progress}%</span>
                  </div>
                  <Progress value={item.progress} className="h-1.5 bg-zinc-950" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="bg-zinc-900 border-zinc-800 rounded-[2rem] overflow-hidden">
          <CardHeader>
            <CardTitle className="text-md font-black text-white uppercase italic">Atividade Semanal</CardTitle>
            <CardDescription className="text-zinc-500 text-xs font-bold uppercase">Horas dedicadas por dia</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] pr-6 pb-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#71717a', fontSize: 10, fontWeight: 'bold'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#71717a', fontSize: 10, fontWeight: 'bold'}} />
                <RechartsTooltip 
                  cursor={{fill: '#18181b'}}
                  contentStyle={{backgroundColor: '#09090b', borderRadius: '16px', border: '1px solid #27272a', color: '#fff'}}
                />
                <Bar dataKey="horas" fill="#6366f1" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
