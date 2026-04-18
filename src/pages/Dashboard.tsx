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
  Calendar as CalendarIcon
} from "lucide-react";
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

    return () => {
      unsubscribePlans();
      unsubscribeFlashcards();
      unsubscribeAttempts();
    };
  }, [authReady, user]);

  return (
    <div className="space-y-8 text-white dark:text-zinc-50">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-5xl tracking-wide text-primary" style={{ fontFamily: "'Deutsch Gothic', serif" }}>Bem-vindo de volta!</h1>
          <p className="text-white  font-bold mt-2 text-2xl" style={{ fontFamily: "'Deutsch Gothic', serif" }}>Seu progresso é medido por cada tópico concluído nos seus editais.</p>
        </div>
        <div className="p-4 bg-background rounded-2xl border border-zinc-900 shadow-sm flex flex-col items-center justify-center gap-2">
          <img 
            src="https://www.dropbox.com/scl/fi/3mbpui4v6ujy3qpietkz3/file_00000000f3e071f5b7b9002a82001ba3.png?rlkey=brg42q31mtfniaz0nblqzdwrf&st=ffx5om1y&raw=1" 
            alt="IGP Estudos Logo" 
            className="w-[300px] h-auto object-contain rounded-lg"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Tooltip key={stat.label}>
            <TooltipTrigger>
              <Card className="cursor-help transition-colors hover:border-zinc-300 dark:hover:border-zinc-700">
                <CardHeader className="flex flex-row items-start justify-between pb-2 space-y-0">
                  <div>
                    <CardTitle className="text-sm font-medium text-zinc-500">
                      {stat.label}
                    </CardTitle>
                    {stat.description && (
                      <p className="text-[10px] text-zinc-400 mt-0.5">{stat.description}</p>
                    )}
                  </div>
                  <stat.icon className={`w-4 h-4 ${stat.color} mt-1`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            {stat.tooltip && (
              <TooltipContent className="max-w-[250px] text-center bg-zinc-900 text-white border-zinc-800">
                <p>{stat.tooltip}</p>
              </TooltipContent>
            )}
          </Tooltip>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Atividade Semanal</CardTitle>
            <CardDescription>Horas dedicadas por dia</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} />
                <RechartsTooltip 
                  cursor={{fill: '#f8f8f8'}}
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                />
                <Bar dataKey="horas" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Progresso Real por Matéria</CardTitle>
            <CardDescription>Baseado nos tópicos concluídos nos seus editais</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 max-h-[300px] overflow-y-auto pr-2">
            {subjectProgress.length === 0 && (
              <p className="text-zinc-400 text-sm italic text-center py-8">Nenhum progresso registrado ainda.</p>
            )}
            {subjectProgress.map((item) => (
              <div key={item.subject} className="space-y-2">
                <div className="flex justify-between items-center text-sm font-medium">
                  <span className="truncate max-w-[200px] text-zinc-300">{item.subject}</span>
                  <span className="text-primary font-bold">{item.progress}%</span>
                </div>
                <Progress value={item.progress} className="h-2.5 bg-card" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {user?.email === "henrique.rosa@poli.ufrj.br" && unauthorizedAttempts.length > 0 && (
        <Card className="border-red-200 bg-red-50/30">
          <CardHeader>
            <CardTitle className="text-primary flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Tentativas de Acesso Não Autorizadas
            </CardTitle>
            <CardDescription>Usuários que tentaram se cadastrar sem permissão</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {unauthorizedAttempts.map((attempt) => (
                <div key={attempt.id} className="flex items-center justify-between p-3 bg-background border border-red-100 rounded-xl shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-red-100 rounded-full">
                      <MailIcon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-bold text-white">{attempt.email}</p>
                      <p className="text-xs text-zinc-500">
                        {attempt.details?.name} {attempt.details?.surname} • {attempt.details?.whatsapp}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-medium">
                      <CalendarIcon className="w-3 h-3" />
                      {new Date(attempt.timestamp).toLocaleString('pt-BR')}
                    </div>
                    <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Bloqueado</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
