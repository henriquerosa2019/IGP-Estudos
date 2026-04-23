import { useMemo } from "react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ExamNotice, Subject } from "@/types";
import { 
  CheckCircle2, 
  AlertCircle, 
  Zap, 
  Clock, 
  Layers, 
  Users,
  ChevronRight,
  TrendingDown
} from "lucide-react";
import { motion } from "motion/react";

interface NoticeCrossProps {
  notices: ExamNotice[];
  selectedNotice?: ExamNotice | null;
}

export function NoticeCross({ notices, selectedNotice }: NoticeCrossProps) {
  // Normalização de nomes de matérias para agrupamento
  const normalizeSubjectName = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove acentos
      .replace(/\./g, "")
      .replace(/\s+/g, "")
      .replace(/direito/g, "dir")
      .replace(/administrativo/g, "adm")
      .replace(/constitucional/g, "const")
      .replace(/portuguesa/g, "port")
      .replace(/raciocinio/g, "rl")
      .replace(/logico/g, "l")
      .replace(/informatica/g, "info")
      .replace(/penal/g, "p")
      .replace(/processual/g, "proc")
      .trim();
  };

  const crossData = useMemo(() => {
    if (notices.length < 2) return null;

    const subjectGroups: Record<string, {
      originalName: string;
      notices: string[];
      topics: Set<string>;
      importance: 'low' | 'medium' | 'high';
      weight: number;
    }> = {};

    notices.forEach(notice => {
      notice.subjects.forEach(subject => {
        const normalized = normalizeSubjectName(subject.name);
        if (!subjectGroups[normalized]) {
          subjectGroups[normalized] = {
            originalName: subject.name,
            notices: [notice.name],
            topics: new Set(subject.topics || []),
            importance: subject.importance,
            weight: subject.weight || 1
          };
        } else {
          subjectGroups[normalized].notices.push(notice.name);
          (subject.topics || []).forEach(t => subjectGroups[normalized].topics.add(t));
          // Se aparecer em mais editais, geralmente a importância sobe
          if (subject.importance === 'high') subjectGroups[normalized].importance = 'high';
        }
      });
    });

    const subjects = Object.values(subjectGroups).sort((a, b) => b.notices.length - a.notices.length);
    
    // Matérias que aparecem em TODOS os editais selecionados (core curriculum)
    const commonSubjects = subjects.filter(s => s.notices.length === notices.length);
    
    // Cálculo de economia de tempo (estimativa)
    // Se você estuda 1 matéria comum, você "economiza" o tempo de estudar ela N vezes
    const overlappingCount = subjects.filter(s => s.notices.length > 1).length;
    const overlapPercent = Math.round((overlappingCount / subjects.length) * 100);
    
    // Estimativa de horas economizadas (20h por matéria sobreposta)
    const hoursSaved = overlappingCount * 20;

    return {
      subjects,
      commonSubjects,
      overlapPercent,
      hoursSaved,
      totalSubjects: subjects.length
    };
  }, [notices]);

  if (!crossData) {
    return (
      <Card className="border-dashed border-2 border-zinc-200">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center text-zinc-500">
          <Layers className="w-12 h-12 mb-4 opacity-20" />
          <p>Adicione pelo menos 2 editais para ver o cruzamento de matérias.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumo do Cruzamento */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-primary text-black border-none shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Zap className="w-4 h-4" /> Sobreposição de Conteúdo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black">{crossData.overlapPercent}%</span>
              <span className="text-xs font-bold opacity-70">de similaridade</span>
            </div>
            <p className="text-[10px] font-bold mt-2 opacity-80">
              Mede quanto do conteúdo programático é idêntico entre os editais. Quanto maior, mais eficiente é seu estudo para múltiplos concursos.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-emerald-600 text-white border-none shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <TrendingDown className="w-4 h-4" /> Economia Projetada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black">~{crossData.hoursSaved}h</span>
              <span className="text-xs font-bold opacity-70">poupadas</span>
            </div>
            <p className="text-[10px] opacity-80 mt-2">
              Estimativa de tempo que você deixa de "gastar" ao unificar o estudo das matérias comuns, evitando estudar o mesmo tema de forma isolada.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
              <CheckCircle2 className="w-4 h-4" /> Matérias "Coringa"
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-white">{crossData.commonSubjects.length}</span>
              <span className="text-xs text-zinc-500 font-bold">disciplinas base</span>
            </div>
            <p className="text-[10px] text-zinc-400 mt-2">
              Matérias que aparecem em TODOS os concursos selecionados. Devem ser sua prioridade número 1 para formar sua base de aprovação.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" />
          Mapeamento de Disciplinas Cruzadas
        </h3>
        
        <div className="grid grid-cols-1 gap-3">
          {crossData.subjects.map((group, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Card className={`overflow-hidden border-zinc-100 transition-all hover:border-primary/20 bg-card group`}>
                <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center ${group.notices.length === notices.length ? 'bg-primary text-black' : 'bg-background border border-zinc-100 text-zinc-400'}`}>
                      <span className="text-lg font-black leading-none">{group.notices.length}</span>
                      <span className="text-[8px] uppercase font-black">Editais</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-white uppercase tracking-tight">{group.originalName}</h4>
                        <Badge variant={group.importance === 'high' ? 'destructive' : 'secondary'} className="text-[8px] py-0">
                          {group.importance === 'high' ? 'PRIORIDADE' : 'PADRÃO'}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {group.notices.map((n, i) => (
                          <span key={i} className="text-[10px] text-zinc-400 bg-background px-1.5 py-0.5 rounded border border-zinc-200">
                            {n}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-[10px] text-zinc-400 font-bold uppercase">Volume de Conteúdo</p>
                      <p className="text-sm font-bold text-white">{group.topics.size} tópicos unidos</p>
                    </div>
                    <div className="w-24">
                      <Progress value={(group.notices.length / notices.length) * 100} className="h-1.5" />
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="p-6 bg-primary/5 border border-primary/10 rounded-3xl">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-primary/20 rounded-2xl text-primary">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-primary">Estratégia do Especialista: Otimização de Carreira</h4>
            <div className="space-y-4 mt-2">
              <p className="text-sm text-zinc-300 leading-relaxed">
                Ao utilizar o cruzamento de editais, você deixa de estudar para **um concurso** e passa a estudar para uma **carreira**.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-white flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-primary" /> Foco no Core (Núcleo)
                  </p>
                  <p className="text-[10px] text-zinc-400">Domine primeiro as matérias comuns. Quando sair um edital surpresa, você já terá {crossData.overlapPercent}% do caminho andado.</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-white flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-primary" /> Redução de Ansiedade
                  </p>
                  <p className="text-[10px] text-zinc-400">Saber que está estudando para PF, PRF e PC ao mesmo tempo aumenta sua confiança e flexibilidade de provas.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
