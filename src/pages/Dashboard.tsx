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
  Tooltip, 
  ResponsiveContainer,
} from "recharts";
import { 
  CheckCircle2, 
  Clock, 
  Trophy, 
  TrendingUp 
} from "lucide-react";
import { useEffect, useState } from "react";
import { StudyPlan } from "@/types";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function Dashboard() {
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [stats, setStats] = useState([
    { label: "Tópicos Concluídos", value: "0", icon: CheckCircle2, color: "text-green-500" },
    { label: "Horas de Estudo", value: "0h", icon: Clock, color: "text-blue-500" },
    { label: "Ofensiva", value: "0 dias", icon: Trophy, color: "text-orange-500" },
    { label: "Precisão", value: "0%", icon: TrendingUp, color: "text-indigo-500" },
  ]);
  const [subjectProgress, setSubjectProgress] = useState<{subject: string, progress: number}[]>([]);

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
    const q = query(collection(db, "plans"));
    const unsubscribePlans = onSnapshot(q, (snapshot) => {
      const parsedPlans = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as StudyPlan));
      setPlans(parsedPlans);

      // Calculate stats
      let totalCompleted = 0;
      let totalMinutes = 0;
      const subjects: Record<string, { total: number, completed: number }> = {};

      parsedPlans.forEach(plan => {
        plan.schedule.forEach(day => {
          day.topics.forEach(topic => {
            if (topic.completed) {
              totalCompleted++;
              totalMinutes += topic.actualDuration || 0;
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

      const hours = (totalMinutes / 60).toFixed(1);
      const progressList = Object.entries(subjects).map(([name, data]) => ({
        subject: name,
        progress: Math.round((data.completed / data.total) * 100)
      })).sort((a, b) => b.progress - a.progress);

      setSubjectProgress(progressList);
      setStats([
        { label: "Tópicos Concluídos", value: totalCompleted.toString(), icon: CheckCircle2, color: "text-green-500" },
        { label: "Horas de Estudo", value: `${hours}h`, icon: Clock, color: "text-blue-500" },
        { label: "Ofensiva", value: "1 dia", icon: Trophy, color: "text-orange-500" },
        { label: "Precisão", value: "100%", icon: TrendingUp, color: "text-indigo-500" },
      ]);
    });

    return () => unsubscribePlans();
  }, []);

  return (
    <div className="space-y-8 text-zinc-900">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900">Bem-vindo de volta!</h1>
          <p className="text-zinc-500 mt-2 text-lg">Seu progresso é medido por cada tópico concluído nos seus editais.</p>
        </div>
        <div className="p-4 bg-black rounded-2xl border border-zinc-800 shadow-sm flex flex-col items-center justify-center gap-2">
          <img 
            src="https://www.dropbox.com/scl/fi/r0kvtpyqeb86r34575k6r/kverna.PNG?rlkey=oswgo2suwgyx4yms3jtrpuhn1&st=0tj8q1se&raw=1" 
            alt="Kverna Logo" 
            className="h-24 w-auto object-contain"
            referrerPolicy="no-referrer"
          />
          <span className="text-red-600 text-3xl tracking-wide" style={{ fontFamily: "'Deutsch Gothic', serif" }}>Kverna Concurso</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-zinc-500">
                {stat.label}
              </CardTitle>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Atividade Semanal</CardTitle>
            <CardDescription>Horas dedicadas por dia (Simulado)</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { name: "Seg", horas: 4 },
                { name: "Ter", horas: 3 },
                { name: "Qua", horas: 5 },
                { name: "Qui", horas: 2 },
                { name: "Sex", horas: 4 },
                { name: "Sáb", horas: 6 },
                { name: "Dom", horas: 1 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} />
                <Tooltip 
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
                  <span className="truncate max-w-[200px] text-zinc-700">{item.subject}</span>
                  <span className="text-indigo-600 font-bold">{item.progress}%</span>
                </div>
                <Progress value={item.progress} className="h-2.5 bg-zinc-100" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
