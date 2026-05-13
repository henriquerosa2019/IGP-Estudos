import { useState, Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  Clock, 
  Play, 
  Square, 
  Layers, 
  Copy, 
  Check, 
  ExternalLink, 
  CheckCircle,
  Search,
  Book,
  Menu,
  Target,
  ChevronRight,
  MoreVertical,
  MousePointer2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { StudyPlan } from "@/types";
import { toast } from "sonner";

interface PlanViewerProps {
  plan: StudyPlan;
  viewMode: 'calendar' | 'vertical';
  onToggleTopic: (dayIdx: number, topicIdx: number, manualDuration?: number) => void;
}

export function PlanViewer({ plan, viewMode, onToggleTopic }: PlanViewerProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [finishingTopic, setFinishingTopic] = useState<{ dayIdx: number, topicIdx: number } | null>(null);
  const [manualMinutes, setManualMinutes] = useState<string>("");
  const [activeMenu, setActiveMenu] = useState<{ x: number, y: number, topic: any } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const handleFinish = (dayIdx: number, topicIdx: number, currentStartTime?: string, currentActualDuration?: number) => {
    let initialMinutes = "";
    if (currentActualDuration !== undefined) {
      initialMinutes = currentActualDuration.toString();
    } else if (currentStartTime) {
      const start = new Date(currentStartTime).getTime();
      const now = new Date().getTime();
      initialMinutes = Math.round((now - start) / (1000 * 60)).toString();
    }
    setManualMinutes(initialMinutes);
    setFinishingTopic({ dayIdx, topicIdx });
  };

  const confirmFinish = () => {
    if (finishingTopic) {
      const mins = parseInt(manualMinutes);
      if (isNaN(mins) || mins < 0) {
        toast.error("Por favor, insira um tempo válido em minutos.");
        return;
      }
      onToggleTopic(finishingTopic.dayIdx, finishingTopic.topicIdx, mins);
      setFinishingTopic(null);
      setManualMinutes("");
    }
  };

  const formatVideoUrl = (url?: string) => {
    if (!url) return "";
    const hotmartBase = "https://hotmart.com";
    
    // If it's a relative path, add the Hotmart base
    if (url.startsWith('/')) return `${hotmartBase}${url}`;
    
    // If it somehow got the app's own domain, fix it
    if (url.includes(window.location.host)) {
      const path = url.split(window.location.host)[1];
      return `${hotmartBase}${path}`;
    }

    // Ensure it uses the domain provided by the user
    if (url.includes('app.hotmart.com') || url.includes('app-vlc.hotmart.com')) {
      return url.replace(/https:\/\/[^/]+/, hotmartBase);
    }
    
    return url;
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success(`${field} copiado!`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const HotmartHelper = () => (
    <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-amber-100 rounded-lg">
          <ExternalLink className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-amber-900">Acesso Rápido Hotmart</h4>
          <p className="text-xs text-amber-700">Use as credenciais abaixo se o site pedir login:</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center bg-background border border-amber-200 rounded-lg overflow-hidden">
          <span className="px-2 py-1 text-[10px] font-mono text-zinc-500 border-r border-amber-100">brunool.rj@gmail.com</span>
          <button 
            onClick={() => copyToClipboard("brunool.rj@gmail.com", "E-mail")}
            className="p-1.5 hover:bg-amber-50 text-amber-600 transition-colors"
            title="Copiar E-mail"
          >
            {copiedField === "E-mail" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
        <div className="flex items-center bg-background border border-amber-200 rounded-lg overflow-hidden">
          <span className="px-2 py-1 text-[10px] font-mono text-zinc-500 border-r border-amber-100">Ad16eoh28@=</span>
          <button 
            onClick={() => copyToClipboard("Ad16eoh28@=", "Senha")}
            className="p-1.5 hover:bg-amber-50 text-amber-600 transition-colors"
            title="Copiar Senha"
          >
            {copiedField === "Senha" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );

  if (viewMode === 'calendar') {
    return (
      <div className="space-y-6">
        <HotmartHelper />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plan.schedule.map((day, idx) => (
          <Card key={idx} className="border-zinc-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="bg-background/50 border-b border-zinc-100 py-4 flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-zinc-400" />
                {day.day}
              </CardTitle>
              <Badge variant="outline" className="text-zinc-500 bg-background">
                {Math.round(day.topics.reduce((acc, t) => acc + (t.duration || 0), 0) / 60 * 10) / 10}h
              </Badge>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              {day.topics.map((topic, tIdx) => (
                <div key={tIdx} className={cn(
                  "flex flex-col gap-3 group p-3 rounded-xl border transition-all",
                  topic.completed 
                    ? "bg-green-50/30 border-green-100" 
                    : topic.startTime 
                      ? "bg-primary/10/50 border-primary/20 shadow-sm" 
                      : "bg-background border-zinc-100 hover:border-primary/20"
                )}>
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      <CheckCircle2 
                        className={cn(
                          "w-5 h-5 transition-colors",
                          topic.completed ? "text-green-500" : "text-zinc-200"
                        )} 
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 mb-1">
                        <div className="shrink-0 mt-0.5">
                          <Badge variant={topic.type === 'revision' ? 'secondary' : 'default'} className="text-[10px] uppercase tracking-wider h-4 px-1.5">
                            {topic.type === 'revision' ? 'Revisão' : 'Estudo'}
                          </Badge>
                        </div>
                        <p className={cn(
                          "font-semibold text-sm leading-tight flex-1 break-words",
                          topic.completed ? "text-zinc-400 line-through" : "text-white"
                        )}>
                          {topic.title}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-[10px] font-medium text-zinc-500 bg-card px-2 py-0.5 rounded shrink-0">
                          {topic.subject}
                        </span>
                        <span className="text-[10px] text-zinc-400 flex items-center gap-1 shrink-0">
                          <Clock className="w-3 h-3" />
                          {topic.completed ? `${topic.actualDuration} min (real)` : `${topic.duration} min`}
                        </span>
                        {topic.videoUrl && (
                          <a 
                            href={formatVideoUrl(topic.videoUrl)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[10px] text-primary hover:underline flex items-center gap-1 shrink-0"
                          >
                            <Play className="w-3 h-3" /> Ver Aula
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {topic.completed && (
                    <div className="pl-8 mt-1">
                      {finishingTopic?.dayIdx === idx && finishingTopic?.topicIdx === tIdx ? (
                        <div className="flex flex-col gap-2 bg-green-50/80 p-3 rounded-xl border border-green-200 shadow-sm max-w-[200px]">
                          <div className="space-y-2">
                            <p className="text-[10px] font-bold text-green-700 uppercase flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Editar minutos:
                            </p>
                            <div className="flex items-center gap-2">
                              <Input 
                                type="number" 
                                value={manualMinutes} 
                                onChange={(e) => setManualMinutes(e.target.value)}
                                className="h-9 w-20 text-sm bg-background border-green-200 focus-visible:ring-green-500 font-bold"
                                autoFocus
                              />
                              <div className="flex flex-col gap-1">
                                <Button size="sm" className="h-7 px-3 text-[10px] bg-green-600 hover:bg-green-700 font-bold" onClick={confirmFinish}>Salvar</Button>
                                <Button size="sm" variant="ghost" className="h-7 px-3 text-[10px] text-green-700 hover:bg-green-100" onClick={() => setFinishingTopic(null)}>Cancelar</Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 text-[9px] text-zinc-400 hover:text-primary p-0"
                          onClick={() => handleFinish(idx, tIdx, undefined, topic.actualDuration)}
                        >
                          <Clock className="w-3 h-3 mr-1" /> Editar tempo
                        </Button>
                      )}
                    </div>
                  )}

                  {!topic.completed && (
                    <div className="flex flex-col gap-2 mt-1 pl-8">
                      {finishingTopic?.dayIdx === idx && finishingTopic?.topicIdx === tIdx ? (
                        <div className="flex flex-col gap-2 bg-primary/10/80 p-3 rounded-xl border border-primary/20 shadow-sm max-w-[220px]">
                          <div className="space-y-2">
                            <p className="text-[10px] font-bold text-yellow-700 uppercase flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Minutos estudados:
                            </p>
                            <div className="flex items-center gap-2">
                              <Input 
                                type="number" 
                                value={manualMinutes} 
                                onChange={(e) => setManualMinutes(e.target.value)}
                                className="h-9 w-20 text-sm bg-background border-primary/20 focus-visible:ring-yellow-500 font-bold"
                                autoFocus
                              />
                              <div className="flex flex-col gap-1">
                                <Button size="sm" className="h-7 px-3 text-[10px] bg-primary hover:bg-primary/80 font-bold" onClick={confirmFinish}>Confirmar</Button>
                                <Button size="sm" variant="ghost" className="h-7 px-3 text-[10px] text-yellow-700 hover:bg-yellow-100" onClick={() => setFinishingTopic(null)}>Cancelar</Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {!topic.startTime ? (
                            <>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-7 text-[10px] border-primary/20 text-primary hover:bg-primary/10 shrink-0"
                                onClick={() => onToggleTopic(idx, tIdx)}
                              >
                                <Play className="w-3 h-3 mr-1" /> Iniciar
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-7 text-[10px] text-zinc-400 hover:text-primary shrink-0"
                                onClick={() => handleFinish(idx, tIdx)}
                              >
                                <CheckCircle className="w-3 h-3 mr-1" /> Concluir
                              </Button>
                            </>
                          ) : (
                            <Button 
                              size="sm" 
                              className="h-7 text-[10px] bg-primary hover:bg-primary/80 shrink-0"
                              onClick={() => handleFinish(idx, tIdx, topic.startTime)}
                            >
                              <Square className="w-3 h-3 mr-1" /> Finalizar
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {topic.startTime && !topic.completed && (
                    <div className="pl-8">
                      <span className="text-[10px] text-primary font-bold animate-pulse flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-ping" />
                        ESTUDANDO DESDE {new Date(topic.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
    );
  }

  const handleContextMenu = (e: React.MouseEvent, topic: any) => {
    e.preventDefault();
    setActiveMenu({ x: e.clientX, y: e.clientY, topic });
  };

  if (viewMode === 'vertical') {
    const allTopics = plan.schedule.flatMap((day, dIdx) => 
      day.topics.map((topic, tIdx) => ({ ...topic, dayName: day.day, dIdx, tIdx }))
    );
    
    const filteredTopics = allTopics.filter(t => 
      t.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      t.subject.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Group by subject
    const groupedTopics = filteredTopics.reduce((acc, topic) => {
      if (!acc[topic.subject]) acc[topic.subject] = [];
      acc[topic.subject].push(topic);
      return acc;
    }, {} as Record<string, typeof filteredTopics>);

    const toggleRevision = (dayIdx: number, topicIdx: number, revIdx: number) => {
      const topic = plan.schedule[dayIdx].topics[topicIdx];
      const newRevisions = [...(topic.revisions || [false, false, false, false, false, false])];
      newRevisions[revIdx] = !newRevisions[revIdx];
      // Force update by triggering topic toggle without minutes
      onToggleTopic(dayIdx, topicIdx, undefined); 
      topic.revisions = newRevisions;
    };

    const toggleTheory = (dayIdx: number, topicIdx: number) => {
      const topic = plan.schedule[dayIdx].topics[topicIdx];
      topic.theoryCompleted = !topic.theoryCompleted;
      onToggleTopic(dayIdx, topicIdx, undefined);
    };

    return (
      <div className="space-y-4 pb-20" onClick={() => setActiveMenu(null)}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-xl">
               <Layers className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">
                Edital Verticalizado
              </h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Acompanhamento Completo do Edital</p>
            </div>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input 
              placeholder="Buscar disciplina/assunto..." 
              className="bg-zinc-950 border-zinc-800 pl-10 h-10 rounded-xl text-white focus:ring-primary/50 placeholder:text-zinc-700"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] overflow-hidden overflow-x-auto custom-scrollbar shadow-2xl">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-zinc-950 text-[10px] uppercase font-black text-zinc-400 tracking-widest border-b border-zinc-800">
                <th className="p-5 w-[35%] text-left pl-10 border-r border-zinc-800/50">Tópicos e Assuntos</th>
                <th className="p-5 text-center w-20 border-r border-zinc-800/50">Teoria</th>
                <th className="p-5 text-center w-20 border-r border-zinc-800/50">Materiais</th>
                <th className="p-5 text-center border-l border-zinc-800" colSpan={6}>Revisão (Espaçada)</th>
                <th className="p-5 text-center border-l border-zinc-800" colSpan={2}>Aproveitamento</th>
              </tr>
              <tr className="bg-zinc-950/80 text-[9px] font-black text-zinc-600 border-b border-zinc-800 uppercase tracking-widest">
                <th colSpan={3} className="border-r border-zinc-800/50"></th>
                <th className="p-2 text-center border-l border-zinc-800 bg-zinc-900/20">1ª</th>
                <th className="p-2 text-center bg-zinc-900/20">2ª</th>
                <th className="p-2 text-center bg-zinc-900/20">3ª</th>
                <th className="p-2 text-center bg-zinc-900/20">4ª</th>
                <th className="p-2 text-center bg-zinc-900/20">5ª</th>
                <th className="p-2 text-center bg-zinc-900/20">6ª</th>
                <th className="p-2 text-center border-l border-zinc-800 text-primary">Meu %</th>
                <th className="p-2 text-center text-zinc-700">Geral %</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(groupedTopics).map(([subject, topics]) => (
                <Fragment key={subject}>
                  <tr className="bg-zinc-950/80 border-y border-zinc-800">
                    <td colSpan={12} className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-6 bg-primary rounded-full shadow-[0_0_10px_rgba(var(--primary),0.5)]"></div>
                        <span className="text-sm font-black text-white uppercase italic tracking-wider">{subject}</span>
                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 ml-2">
                          {topics.length} tópicos
                        </Badge>
                      </div>
                    </td>
                  </tr>
                  {topics.map((topic, idx) => {
                    const revisions = topic.revisions || [false, false, false, false, false, false];
                    return (
                      <tr 
                        key={`${subject}-${idx}`} 
                        className="hover:bg-zinc-800/30 transition-colors group cursor-default border-b border-zinc-800/30"
                        onContextMenu={(e) => handleContextMenu(e, topic)}
                      >
                        <td className="p-4 pl-10">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-2 h-2 rounded-full",
                              topic.completed ? "bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]" : "bg-zinc-700"
                            )}></div>
                            <div className="flex flex-col relative">
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "text-sm font-bold tracking-tight",
                                  topic.completed ? "text-zinc-500 line-through" : "text-zinc-200"
                                )}>
                                  {topic.title}
                                </span>
                                <button 
                                  className="p-1 hover:bg-zinc-800 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setActiveMenu({ x: rect.right, y: rect.top, topic });
                                  }}
                                >
                                  <MoreVertical className="w-4 h-4 text-zinc-600 hover:text-white" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-9 w-9 rounded-xl text-zinc-600 hover:text-primary hover:bg-primary/10 transition-all" 
                            onClick={() => onToggleTopic(topic.dIdx, topic.tIdx)}
                          >
                            <Clock className="w-4 h-4" />
                          </Button>
                        </td>
                        <td className="p-4 text-center">
                          {topic.videoUrl ? (
                            <a 
                              href={formatVideoUrl(topic.videoUrl)} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-zinc-600 hover:text-primary hover:bg-primary/10 transition-all"
                            >
                              <Book className="w-4 h-4" />
                            </a>
                          ) : (
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-zinc-800 cursor-not-allowed">
                              <Book className="w-4 h-4" />
                            </Button>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <button 
                            onClick={() => toggleTheory(topic.dIdx, topic.tIdx)}
                            className={cn(
                              "w-5 h-5 rounded-lg border transition-all mx-auto flex items-center justify-center",
                              topic.theoryCompleted ? "bg-green-500 border-green-500" : "border-zinc-800 bg-zinc-950 hover:border-zinc-600 shadow-inner"
                            )}
                          >
                            {topic.theoryCompleted && <Check className="w-3 h-3 text-black font-black" />}
                          </button>
                        </td>
                        {revisions.map((done, rIdx) => (
                          <td key={rIdx} className={cn("p-2 text-center", rIdx === 0 ? "border-l border-zinc-800" : "")}>
                            <button 
                              onClick={() => toggleRevision(topic.dIdx, topic.tIdx, rIdx)}
                              className={cn(
                                "w-5 h-5 rounded-lg border transition-all mx-auto flex items-center justify-center",
                                done ? "bg-primary border-primary shadow-[0_0_10px_rgba(var(--primary),0.3)]" : "border-zinc-800 bg-zinc-950 hover:border-zinc-600 shadow-inner"
                              )}
                            >
                              {done && <Check className="w-3 h-3 text-black font-black" />}
                            </button>
                          </td>
                        ))}
                        <td className="p-4 text-center border-l border-zinc-800">
                          <span className="text-[11px] font-black text-primary">{topic.performance || 0}%</span>
                        </td>
                        <td className="p-4 text-center">
                          <span className="text-[11px] font-black text-zinc-700">0%</span>
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Context Menu Overlay */}
        <AnimatePresence>
          {activeMenu && (
            <>
              <div className="fixed inset-0 z-[90]" onClick={() => setActiveMenu(null)} />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -10 }}
                className="fixed z-[100] w-64 bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl p-2 shadow-primary/30"
                style={{ 
                  left: Math.min(activeMenu.x, window.innerWidth - 270), 
                  top: Math.min(activeMenu.y, window.innerHeight - 300) 
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-4 py-3 border-b border-zinc-800 mb-2">
                  <p className="text-[10px] font-black text-primary uppercase tracking-tighter">{activeMenu.topic.subject}</p>
                  <p className="text-sm font-black text-white truncate">{activeMenu.topic.title}</p>
                </div>
                
                <div className="p-1 space-y-1">
                  <button className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all text-xs font-bold group">
                    <div className="p-2 bg-zinc-800 rounded-xl group-hover:bg-primary/20 transition-colors">
                      <Play className="w-4 h-4 text-zinc-400 group-hover:text-primary" />
                    </div>
                    Aulas
                  </button>
                  <button onClick={() => {
                    setActiveMenu(null);
                    window.location.href = `/questoes?subject=${activeMenu.topic.subject}`;
                  }} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all text-xs font-bold group">
                    <div className="p-2 bg-zinc-800 rounded-xl group-hover:bg-primary/20 transition-colors">
                      <Target className="w-4 h-4 text-zinc-400 group-hover:text-primary" />
                    </div>
                    Resolver no banco de questões
                  </button>
                  <button className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all text-xs font-bold group">
                    <div className="p-2 bg-zinc-800 rounded-xl group-hover:bg-primary/20 transition-colors">
                      <Clock className="w-4 h-4 text-zinc-400 group-hover:text-primary" />
                    </div>
                    Criar e resolver simulado
                  </button>
                  <button onClick={() => {
                    setActiveMenu(null);
                    window.location.href = `/questoes?tab=flashcards&subject=${activeMenu.topic.subject}`;
                  }} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all text-xs font-bold group">
                    <div className="p-2 bg-zinc-800 rounded-xl group-hover:bg-primary/20 transition-colors">
                      <Layers className="w-4 h-4 text-zinc-400 group-hover:text-primary" />
                    </div>
                    Resolver cards
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <HotmartHelper />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plan.schedule.flatMap((day, dIdx) => 
          day.topics.map((topic, tIdx) => ({ ...topic, dayName: day.day, dIdx, tIdx }))
        ).map((topic, idx) => (
          <div key={idx} className={cn(
            "flex items-center gap-4 p-4 rounded-3xl border transition-all",
            topic.completed ? "bg-green-500/5 border-green-500/20" : topic.startTime ? "bg-primary/5 border-primary/20" : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
          )}>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-black text-primary uppercase tracking-tighter">{topic.subject}</span>
              <p className={cn(
                "font-bold text-sm leading-tight whitespace-nowrap overflow-hidden text-ellipsis mb-1",
                topic.completed ? "text-zinc-500 line-through" : "text-white"
              )}>
                {topic.title}
              </p>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{topic.dayName}</span>
                <span className="text-[10px] text-zinc-500">•</span>
                <span className="text-[10px] text-zinc-500">{topic.duration} min</span>
              </div>
            </div>
            <Button 
              size="icon" 
              variant="ghost" 
              className={cn(
                "rounded-2xl transition-all",
                topic.completed ? "text-green-500" : "text-zinc-600 hover:text-primary"
              )}
              onClick={() => onToggleTopic(topic.dIdx, topic.tIdx)}
            >
              <CheckCircle2 className="w-6 h-6" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
