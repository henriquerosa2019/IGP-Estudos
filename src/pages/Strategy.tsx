import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, Target, BookOpen, Brain, Bell, HeartPulse, Lightbulb } from "lucide-react";
import { auth } from "@/lib/firebase";
import { ExamCalendar } from "@/components/strategy/ExamCalendar";

interface ChecklistItem {
  id: string;
  phase: number;
  phaseTitle: string;
  text: string;
}

const checklistItems: ChecklistItem[] = [
  // Fase 1
  { id: "f1-1", phase: 1, phaseTitle: "Fase 1 — Escolha e planejamento", text: "Defini minha escolaridade e área de interesse" },
  { id: "f1-2", phase: 1, phaseTitle: "Fase 1 — Escolha e planejamento", text: "Escolhi 1 a 2 concursos-alvo com salário ≥ R$ 6.000" },
  { id: "f1-3", phase: 1, phaseTitle: "Fase 1 — Escolha e planejamento", text: "Ativei alertas nos portais de concursos" },
  { id: "f1-4", phase: 1, phaseTitle: "Fase 1 — Escolha e planejamento", text: "Criei um calendário com datas de inscrição e prova" },
  // Fase 2
  { id: "f2-1", phase: 2, phaseTitle: "Fase 2 — Preparação", text: "Li o edital completo e o conteúdo programático" },
  { id: "f2-2", phase: 2, phaseTitle: "Fase 2 — Preparação", text: "Montei cronograma semanal por matéria" },
  { id: "f2-3", phase: 2, phaseTitle: "Fase 2 — Preparação", text: "Escolhi plataforma de estudos (Gran, Estratégia, Qconcursos etc.)" },
  { id: "f2-4", phase: 2, phaseTitle: "Fase 2 — Preparação", text: "Pesquisei provas anteriores da banca organizadora" },
  // Fase 3
  { id: "f3-1", phase: 3, phaseTitle: "Fase 3 — Execução e revisão", text: "Estou fazendo simulados semanais" },
  { id: "f3-2", phase: 3, phaseTitle: "Fase 3 — Execução e revisão", text: "Aplico revisão espaçada (1 dia, 7 dias, 30 dias)" },
  { id: "f3-3", phase: 3, phaseTitle: "Fase 3 — Execução e revisão", text: "Paguei a inscrição dentro do prazo" },
  { id: "f3-4", phase: 3, phaseTitle: "Fase 3 — Execução e revisão", text: "Confirmei local e horário da prova com antecedência" },
];

export default function Strategy() {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Load from local storage
    const loadChecklist = () => {
      const user = auth.currentUser;
      const key = user ? `strategy-checklist-${user.uid}` : "strategy-checklist-guest";
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          setCheckedItems(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to parse checklist items:", e);
        }
      }
    };

    loadChecklist();

    const unsubscribe = auth.onAuthStateChanged(() => {
      loadChecklist();
    });

    return () => unsubscribe();
  }, []);

  const handleToggle = (id: string) => {
    setCheckedItems(prev => {
      const updated = { ...prev, [id]: !prev[id] };
      const user = auth.currentUser;
      const key = user ? `strategy-checklist-${user.uid}` : "strategy-checklist-guest";
      localStorage.setItem(key, JSON.stringify(updated));
      return updated;
    });
  };

  const completedCount = Object.values(checkedItems).filter(Boolean).length;
  const totalItems = checklistItems.length;
  const progressPercent = Math.round((completedCount / totalItems) * 100);

  const phase1Items = checklistItems.filter(item => item.phase === 1);
  const phase2Items = checklistItems.filter(item => item.phase === 2);
  const phase3Items = checklistItems.filter(item => item.phase === 3);

  return (
    <div className="flex-1 p-8 space-y-8 bg-zinc-950 overflow-y-auto">
      <div>
        <h1 className="text-5xl tracking-wide text-primary" style={{ fontFamily: "'Deutsch Gothic', serif" }}>
          Estratégia de Estudos
        </h1>
        <p className="text-zinc-400 mt-2">
          Um método comprovado para acelerar sua aprovação.
        </p>
      </div>

      <Tabs defaultValue="fases" className="w-full">
        <TabsList className="bg-black border border-zinc-800 p-1 flex-wrap h-auto gap-1">
          <TabsTrigger value="fases" className="text-primary font-medium data-[state=active]:bg-primary data-[state=active]:text-black py-2 hover:bg-primary hover:text-black dark:hover:bg-primary dark:hover:text-black transition-all">
            Estratégia em 5 Fases
          </TabsTrigger>
          <TabsTrigger value="sites" className="text-primary font-medium data-[state=active]:bg-primary data-[state=active]:text-black py-2 hover:bg-primary hover:text-black dark:hover:bg-primary dark:hover:text-black transition-all">
            Sites/Portais Concursos
          </TabsTrigger>
          <TabsTrigger value="checklist" className="text-primary font-medium data-[state=active]:bg-primary data-[state=active]:text-black py-2 hover:bg-primary hover:text-black dark:hover:bg-primary dark:hover:text-black transition-all">
            Checklist de Aprovação
          </TabsTrigger>
          <TabsTrigger value="calendar" className="text-primary font-medium data-[state=active]:bg-primary data-[state=active]:text-black py-2 hover:bg-primary hover:text-black dark:hover:bg-primary dark:hover:text-black transition-all">
            Calendário de Provas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fases" className="mt-6 space-y-6">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-2xl text-primary mb-2">Um método comprovado em 5 fases, do zero à aprovação:</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-primary border border-primary/20">
                  <span className="text-2xl font-bold font-serif">1</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" /> Escolha seu alvo (1-2 concursos)
                  </h3>
                  <p className="text-zinc-400 mt-1">
                    Avalie: nível de escolaridade, data prevista da prova, concorrência estimada, conteúdo programático e se o salário vale seu esforço. Não atire para todos os lados.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-primary border border-primary/20">
                  <span className="text-2xl font-bold font-serif">2</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-primary" /> Analise o edital a fundo
                  </h3>
                  <p className="text-zinc-400 mt-1">
                    Leia o conteúdo programático com atenção. Separe as matérias por peso (nº de questões) e monte um cronograma proporcional. Mais questões = mais tempo de estudo.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-primary border border-primary/20">
                  <span className="text-2xl font-bold font-serif">3</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Brain className="w-5 h-5 text-primary" /> Estude com método (não com volume)
                  </h3>
                  <p className="text-zinc-400 mt-1">
                    Teoria rápida → muita questão → revisão espaçada.<br/>
                    Revise 1 dia depois, 7 dias e 30 dias após o primeiro estudo. Faça simulados semanais no formato da prova real. Qualidade supera quantidade.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-primary border border-primary/20">
                  <span className="text-2xl font-bold font-serif">4</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Bell className="w-5 h-5 text-primary" /> Monitore editais e inscrições
                  </h3>
                  <p className="text-zinc-400 mt-1">
                    Ative alertas em portais (JC Concursos, Gran, Estratégia). Perder o prazo de inscrição é o erro mais comum e mais evitável. Crie um calendário só para datas de concursos.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-primary border border-primary/20">
                  <span className="text-2xl font-bold font-serif">5</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <HeartPulse className="w-5 h-5 text-primary" /> Cuide da saúde e da constância
                  </h3>
                  <p className="text-zinc-400 mt-1">
                    Concurso é maratona, não sprint. Sono adequado, exercício e pausas aumentam retenção. Estude todos os dias, mesmo que 30 minutos, em vez de 8h num dia e zero no outro.
                  </p>
                </div>
              </div>

              <div className="mt-8 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <h4 className="text-yellow-500 font-bold flex items-center gap-2 mb-2">
                  <Lightbulb className="w-5 h-5" /> Dica de ouro
                </h4>
                <p className="text-zinc-300">
                  Estude provas anteriores da banca organizadora (Cebraspe, FCC, FGV, etc.) — cada banca tem um estilo diferente. Quem conhece a banca leva enorme vantagem.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sites" className="mt-6">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-primary">Os melhores recursos para monitorar editais e estudar:</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-primary border border-primary/20">
                  <span className="text-xl font-bold font-serif">JC</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    JC Concursos
                  </h3>
                  <p className="text-zinc-400 mt-1">
                    Lista atualizada diária de editais abertos com vagas e salários
                  </p>
                  <a href="https://jcconcursos.com.br" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 mt-2 text-sm">
                    jcconcursos.com.br ↗
                  </a>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-primary border border-primary/20">
                  <span className="text-xl font-bold font-serif">GC</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    Gran Cursos Online
                  </h3>
                  <p className="text-zinc-400 mt-1">
                    Concursos abertos + material de estudo e simulados
                  </p>
                  <a href="https://www.grancursosonline.com.br/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 mt-2 text-sm">
                    grancursosonline.com.br ↗
                  </a>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-primary border border-primary/20">
                  <span className="text-xl font-bold font-serif">EC</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    Estratégia Concursos
                  </h3>
                  <p className="text-zinc-400 mt-1">
                    Previsões detalhadas, cursos e notícias atualizadas
                  </p>
                  <a href="https://www.estrategiaconcursos.com.br/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 mt-2 text-sm">
                    estrategiaconcursos.com.br ↗
                  </a>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-primary border border-primary/20">
                  <span className="text-xl font-bold font-serif">QC</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    QConcursos / Folha Dirigida
                  </h3>
                  <p className="text-zinc-400 mt-1">
                    Questões de provas anteriores e editais previstos
                  </p>
                  <a href="https://www.qconcursos.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 mt-2 text-sm">
                    qconcursos.com ↗
                  </a>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-primary border border-primary/20">
                  <span className="text-xl font-bold font-serif">AC</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    Ache Concursos
                  </h3>
                  <p className="text-zinc-400 mt-1">
                    Monitoramento completo com status de cada certame
                  </p>
                  <a href="https://www.acheconcursos.com.br/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 mt-2 text-sm">
                    acheconcursos.com.br ↗
                  </a>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-primary border border-primary/20">
                  <span className="text-xl font-bold font-serif">DOU</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    Diário Oficial da União
                  </h3>
                  <p className="text-zinc-400 mt-1">
                    Fonte oficial onde todos os editais federais são publicados
                  </p>
                  <a href="https://www.in.gov.br/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 mt-2 text-sm">
                    in.gov.br ↗
                  </a>
                </div>
              </div>

            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="checklist" className="mt-6">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-primary">Checklist Estratégico</CardTitle>
              <CardDescription className="text-zinc-400">
                Marque cada etapa conforme avança. Sua evolução fica salva nessa conversa.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-8 p-4 bg-zinc-950 border border-zinc-800 rounded-lg sticky top-0 z-10 shadow-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-white font-bold text-sm uppercase tracking-wider">Progresso: {completedCount}/{totalItems} etapas concluídas</span>
                  <span className="text-primary font-bold">{progressPercent}%</span>
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>

              <div className="space-y-8">
                {/* Phase 1 */}
                <div>
                  <h3 className="text-lg font-bold text-white mb-4 border-b border-zinc-800 pb-2">Fase 1 — Escolha e planejamento</h3>
                  <div className="space-y-3">
                    {phase1Items.map(item => (
                      <div 
                        key={item.id} 
                        className="flex items-start gap-3 p-3 rounded-lg hover:bg-zinc-800/50 transition-colors cursor-pointer border border-transparent hover:border-zinc-800"
                        onClick={() => handleToggle(item.id)}
                      >
                        <div className="pt-0.5">
                          {checkedItems[item.id] ? (
                            <CheckCircle2 className="w-5 h-5 text-primary" />
                          ) : (
                            <Circle className="w-5 h-5 text-zinc-500" />
                          )}
                        </div>
                        <span className={checkedItems[item.id] ? "text-zinc-500 line-through" : "text-zinc-300"}>
                          {item.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Phase 2 */}
                <div>
                  <h3 className="text-lg font-bold text-white mb-4 border-b border-zinc-800 pb-2">Fase 2 — Preparação</h3>
                  <div className="space-y-3">
                    {phase2Items.map(item => (
                      <div 
                        key={item.id} 
                        className="flex items-start gap-3 p-3 rounded-lg hover:bg-zinc-800/50 transition-colors cursor-pointer border border-transparent hover:border-zinc-800"
                        onClick={() => handleToggle(item.id)}
                      >
                        <div className="pt-0.5">
                          {checkedItems[item.id] ? (
                            <CheckCircle2 className="w-5 h-5 text-primary" />
                          ) : (
                            <Circle className="w-5 h-5 text-zinc-500" />
                          )}
                        </div>
                        <span className={checkedItems[item.id] ? "text-zinc-500 line-through" : "text-zinc-300"}>
                          {item.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Phase 3 */}
                <div>
                  <h3 className="text-lg font-bold text-white mb-4 border-b border-zinc-800 pb-2">Fase 3 — Execução e revisão</h3>
                  <div className="space-y-3">
                    {phase3Items.map(item => (
                      <div 
                        key={item.id} 
                        className="flex items-start gap-3 p-3 rounded-lg hover:bg-zinc-800/50 transition-colors cursor-pointer border border-transparent hover:border-zinc-800"
                        onClick={() => handleToggle(item.id)}
                      >
                        <div className="pt-0.5">
                          {checkedItems[item.id] ? (
                            <CheckCircle2 className="w-5 h-5 text-primary" />
                          ) : (
                            <Circle className="w-5 h-5 text-zinc-500" />
                          )}
                        </div>
                        <span className={checkedItems[item.id] ? "text-zinc-500 line-through" : "text-zinc-300"}>
                          {item.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar" className="mt-6">
          <ExamCalendar />
        </TabsContent>
      </Tabs>
    </div>
  );
}
