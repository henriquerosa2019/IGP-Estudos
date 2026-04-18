import { useMemo } from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
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
  Line
} from "recharts";
import { 
  BrainCircuit, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  Layers,
  Calendar
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FlashcardReview {
  id?: string;
  uid: string;
  question: string;
  answer: string;
  subject: string;
  status: 'easy' | 'medium' | 'hard';
  nextReviewDate: string;
  createdAt: string;
  deckId?: string;
  cardId?: string;
}

interface FlashcardMetricsProps {
  reviews: FlashcardReview[];
}

export function FlashcardMetrics({ reviews }: FlashcardMetricsProps) {
  const stats = useMemo(() => {
    const total = reviews.length;
    const now = new Date();
    const readyToReview = reviews.filter(r => new Date(r.nextReviewDate) <= now).length;
    
    const easyCount = reviews.filter(r => r.status === 'easy').length;
    const mediumCount = reviews.filter(r => r.status === 'medium').length;
    const hardCount = reviews.filter(r => r.status === 'hard').length;
    
    const retentionRate = total > 0 ? Math.round((easyCount / total) * 100) : 0;

    const subjectsData: Record<string, { total: number, easy: number }> = {};
    const dailyActivity: Record<string, number> = {};

    reviews.forEach(r => {
      if (!subjectsData[r.subject]) {
        subjectsData[r.subject] = { total: 0, easy: 0 };
      }
      subjectsData[r.subject].total++;
      if (r.status === 'easy') subjectsData[r.subject].easy++;

      if (r.createdAt) {
        const date = r.createdAt.split('T')[0];
        dailyActivity[date] = (dailyActivity[date] || 0) + 1;
      }
    });

    const subjectStats = Object.entries(subjectsData).map(([name, data]) => ({
      name,
      total: data.total,
      retention: Math.round((data.easy / data.total) * 100)
    })).sort((a, b) => b.total - a.total).slice(0, 5);

    const activityData = Object.entries(dailyActivity)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7);

    const pieData = [
      { name: "Fácil", value: easyCount, color: "#10b981" },
      { name: "Médio", value: mediumCount, color: "#f59e0b" },
      { name: "Difícil", value: hardCount, color: "#ef4444" }
    ];

    return {
      total,
      readyToReview,
      retentionRate,
      subjectStats,
      activityData,
      pieData
    };
  }, [reviews]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h2 className="text-4xl tracking-wide text-primary" style={{ fontFamily: "'Deutsch Gothic', serif" }}>Métricas de Desempenho</h2>
        <p className="text-zinc-400 font-medium mt-1">Acompanhe sua evolução e retenção de conteúdo.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-none shadow-md bg-background ">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Total de Cards</CardTitle>
            <Layers className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white ">{stats.total}</div>
            <p className="text-[10px] text-zinc-400 mt-1">Cards na sua biblioteca</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-background ">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Prontos para Revisar</CardTitle>
            <AlertCircle className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white ">{stats.readyToReview}</div>
            <p className="text-[10px] text-zinc-400 mt-1">Aguardando sua revisão</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-background ">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Taxa de Retenção</CardTitle>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white ">{stats.retentionRate}%</div>
            <Progress value={stats.retentionRate} className="h-1.5 mt-2 bg-card" />
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-background ">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Nível de Domínio</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white ">
              {stats.retentionRate > 80 ? 'Excelente' : stats.retentionRate > 50 ? 'Bom' : 'Em evolução'}
            </div>
            <p className="text-[10px] text-zinc-400 mt-1">Baseado no seu desempenho</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-none shadow-md">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-primary" />
              Domínio por Disciplina
            </CardTitle>
            <CardDescription>Quantidade de cards e taxa de acerto</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.subjectStats} layout="vertical" margin={{ left: 20, right: 20 }}>
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
                  <Bar dataKey="total" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              Distribuição de Dificuldade
            </CardTitle>
            <CardDescription>Status atual dos seus cards</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center">
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
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
                  <span className="font-bold text-white">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-md">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Criação de Novos Cards
          </CardTitle>
          <CardDescription>Volume de novos flashcards nos últimos 7 dias</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] w-full">
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
    </div>
  );
}

function Progress({ value, className }: { value: number, className?: string }) {
  return (
    <div className={cn("w-full h-2 bg-card rounded-full overflow-hidden", className)}>
      <div 
        className="h-full bg-primary/100 transition-all duration-500" 
        style={{ width: `${value}%` }}
      />
    </div>
  );
}
