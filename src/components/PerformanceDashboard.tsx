import { useMemo } from "react";
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
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from "recharts";
import { 
  CheckCircle2, 
  Clock, 
  TrendingUp,
  Target,
  BookOpen,
  Calendar
} from "lucide-react";
import { StudyPlan } from "@/types";
import { cn } from "@/lib/utils";

interface PerformanceDashboardProps {
  plan: StudyPlan;
}

export function PerformanceDashboard({ plan }: PerformanceDashboardProps) {
  const stats = useMemo(() => {
    let totalTopics = 0;
    let completedTopics = 0;
    let totalPlannedMinutes = 0;
    let totalActualMinutes = 0;
    const subjectsData: Record<string, { total: number, completed: number, plannedTime: number, actualTime: number }> = {};
    const dailyActivity: Record<string, number> = {};

    plan.schedule.forEach(day => {
      day.topics.forEach(topic => {
        totalTopics++;
        totalPlannedMinutes += topic.duration;
        
        if (!subjectsData[topic.subject]) {
          subjectsData[topic.subject] = { total: 0, completed: 0, plannedTime: 0, actualTime: 0 };
        }
        
        subjectsData[topic.subject].total++;
        subjectsData[topic.subject].plannedTime += topic.duration;

        if (topic.completed) {
          completedTopics++;
          totalActualMinutes += topic.actualDuration || 0;
          subjectsData[topic.subject].completed++;
          subjectsData[topic.subject].actualTime += topic.actualDuration || 0;

          if (topic.completedAt) {
            const date = topic.completedAt.split('T')[0];
            dailyActivity[date] = (dailyActivity[date] || 0) + 1;
          }
        }
      });
    });

    const progressPercentage = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;
    
    const subjectProgress = Object.entries(subjectsData).map(([name, data]) => ({
      name,
      progress: Math.round((data.completed / data.total) * 100),
      plannedTime: Math.round(data.plannedTime / 60),
      actualTime: Math.round(data.actualTime / 60),
      topicsCount: data.total,
      completedCount: data.completed
    })).sort((a, b) => b.progress - a.progress);

    const activityData = Object.entries(dailyActivity)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7); // Last 7 days of activity

    const pieData = [
      { name: "Concluído", value: completedTopics, color: "#10b981" },
      { name: "Pendente", value: totalTopics - completedTopics, color: "#e2e8f0" }
    ];

    return {
      totalTopics,
      completedTopics,
      totalPlannedHours: Math.round(totalPlannedMinutes / 60),
      totalActualHours: Math.round(totalActualMinutes / 60),
      progressPercentage,
      subjectProgress,
      activityData,
      pieData
    };
  }, [plan]);

  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-none shadow-md bg-white dark:bg-zinc-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Progresso Geral</CardTitle>
            <Target className="w-4 h-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-900 dark:text-white">{stats.progressPercentage}%</div>
            <Progress value={stats.progressPercentage} className="h-1.5 mt-2 bg-zinc-100" />
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-white dark:bg-zinc-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Tópicos</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-900 dark:text-white">{stats.completedTopics} / {stats.totalTopics}</div>
            <p className="text-[10px] text-zinc-400 mt-1">Itens concluídos no plano</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-white dark:bg-zinc-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Tempo Real</CardTitle>
            <Clock className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-900 dark:text-white">{stats.totalActualHours}h</div>
            <p className="text-[10px] text-zinc-400 mt-1">Dedicadas ao estudo efetivo</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-white dark:bg-zinc-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Meta Planejada</CardTitle>
            <TrendingUp className="w-4 h-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-900 dark:text-white">{stats.totalPlannedHours}h</div>
            <p className="text-[10px] text-zinc-400 mt-1">Carga total do edital</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-none shadow-md">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-500" />
              Desempenho por Disciplina
            </CardTitle>
            <CardDescription>Comparativo de conclusão e tempo investido</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.subjectProgress} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false} 
                    width={100}
                    tick={{ fill: '#666', fontSize: 10, fontWeight: 600 }}
                  />
                  <RechartsTooltip 
                    cursor={{ fill: '#f8f8f8' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="progress" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="w-5 h-5 text-emerald-500" />
              Distribuição
            </CardTitle>
            <CardDescription>Status de conclusão dos tópicos</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center">
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2 w-full">
              {stats.pieData.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-zinc-600">{item.name}</span>
                  </div>
                  <span className="font-bold text-zinc-900">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-none shadow-md">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-500" />
              Atividade Recente
            </CardTitle>
            <CardDescription>Tópicos concluídos nos últimos 7 dias</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.activityData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#888', fontSize: 10 }}
                    tickFormatter={(value) => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 10 }} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.1)' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#4f46e5" 
                    strokeWidth={3} 
                    dot={{ r: 4, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Detalhamento por Matéria</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-zinc-100 max-h-[300px] overflow-y-auto px-6">
              {stats.subjectProgress.map((item, idx) => (
                <div key={idx} className="py-4 flex items-center justify-between">
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="text-sm font-bold text-zinc-900 truncate">{item.name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-500 transition-all duration-500" 
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-indigo-600">{item.progress}%</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-zinc-900">{item.actualTime}h / {item.plannedTime}h</p>
                    <p className="text-[10px] text-zinc-400">{item.completedCount} de {item.topicsCount} tópicos</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
