import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Calendar as CalendarIcon, CheckCircle2, Clock, Play, Square, Layers, Copy, Check, ExternalLink, CheckCircle } from "lucide-react";
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
        <div className="flex items-center bg-white border border-amber-200 rounded-lg overflow-hidden">
          <span className="px-2 py-1 text-[10px] font-mono text-zinc-500 border-r border-amber-100">brunool.rj@gmail.com</span>
          <button 
            onClick={() => copyToClipboard("brunool.rj@gmail.com", "E-mail")}
            className="p-1.5 hover:bg-amber-50 text-amber-600 transition-colors"
            title="Copiar E-mail"
          >
            {copiedField === "E-mail" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
        <div className="flex items-center bg-white border border-amber-200 rounded-lg overflow-hidden">
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
            <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 py-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-zinc-400" />
                {day.day}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              {day.topics.map((topic, tIdx) => (
                <div key={tIdx} className={cn(
                  "flex flex-col gap-3 group p-3 rounded-xl border transition-all",
                  topic.completed 
                    ? "bg-green-50/30 border-green-100" 
                    : topic.startTime 
                      ? "bg-indigo-50/50 border-indigo-200 shadow-sm" 
                      : "bg-white border-zinc-100 hover:border-indigo-200"
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
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={topic.type === 'revision' ? 'secondary' : 'default'} className="text-[10px] uppercase tracking-wider h-4">
                          {topic.type === 'revision' ? 'Revisão' : 'Estudo'}
                        </Badge>
                        <p className={cn(
                          "font-semibold text-sm",
                          topic.completed ? "text-zinc-400 line-through" : "text-zinc-900"
                        )}>
                          {topic.title}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-medium text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">
                          {topic.subject}
                        </span>
                        <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {topic.completed ? `${topic.actualDuration} min (real)` : `${topic.duration} min`}
                        </span>
                        {topic.videoUrl && (
                          <a 
                            href={formatVideoUrl(topic.videoUrl)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[10px] text-indigo-600 hover:underline flex items-center gap-1"
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
                        <div className="flex items-center gap-2 bg-green-50 p-2 rounded-lg border border-green-100">
                          <div className="flex-1">
                            <p className="text-[9px] font-bold text-green-600 uppercase mb-1">Editar minutos:</p>
                            <Input 
                              type="number" 
                              value={manualMinutes} 
                              onChange={(e) => setManualMinutes(e.target.value)}
                              className="h-7 text-xs bg-white"
                              autoFocus
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <Button size="sm" className="h-7 text-[10px] bg-green-600 hover:bg-green-700" onClick={confirmFinish}>Salvar</Button>
                            <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setFinishingTopic(null)}>Cancelar</Button>
                          </div>
                        </div>
                      ) : (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 text-[9px] text-zinc-400 hover:text-indigo-600 p-0"
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
                        <div className="flex items-center gap-2 bg-indigo-50 p-2 rounded-lg border border-indigo-100">
                          <div className="flex-1">
                            <p className="text-[9px] font-bold text-indigo-600 uppercase mb-1">Minutos estudados:</p>
                            <Input 
                              type="number" 
                              value={manualMinutes} 
                              onChange={(e) => setManualMinutes(e.target.value)}
                              className="h-7 text-xs bg-white"
                              autoFocus
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <Button size="sm" className="h-7 text-[10px] bg-indigo-600" onClick={confirmFinish}>Confirmar</Button>
                            <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setFinishingTopic(null)}>Cancelar</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          {!topic.startTime ? (
                            <>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-7 text-[10px] border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                                onClick={() => onToggleTopic(idx, tIdx)}
                              >
                                <Play className="w-3 h-3 mr-1" /> Iniciar
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-7 text-[10px] text-zinc-400 hover:text-indigo-600"
                                onClick={() => handleFinish(idx, tIdx)}
                              >
                                <CheckCircle className="w-3 h-3 mr-1" /> Concluir Manual
                              </Button>
                            </>
                          ) : (
                            <Button 
                              size="sm" 
                              className="h-7 text-[10px] bg-indigo-600 hover:bg-indigo-700"
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
                      <span className="text-[10px] text-indigo-600 font-bold animate-pulse flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-ping" />
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

  return (
    <div className="space-y-6">
      <HotmartHelper />
      <Card className="border-none shadow-lg shadow-zinc-100 overflow-hidden">
      <CardHeader className="bg-zinc-50/50 border-b border-zinc-100">
        <CardTitle className="text-lg flex items-center gap-2 text-zinc-800">
          <Layers className="w-5 h-5 text-indigo-500" />
          Plano de Estudos Verticalizado
        </CardTitle>
        <CardDescription>Lista completa de todos os tópicos do edital distribuídos por ordem de estudo.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-zinc-100">
          {plan.schedule.flatMap((day, dIdx) => 
            day.topics.map((topic, tIdx) => ({ ...topic, dayName: day.day, dIdx, tIdx }))
          ).map((topic, idx) => (
            <div key={idx} className={cn(
              "flex items-center gap-4 p-4 transition-colors",
              topic.completed ? "bg-green-50/20" : topic.startTime ? "bg-indigo-50/30" : "hover:bg-zinc-50/50"
            )}>
              <div className="flex-shrink-0 w-8 text-center text-xs font-bold text-zinc-300">
                {idx + 1}
              </div>
              <div className="w-32 text-[10px] font-bold text-zinc-400 uppercase tracking-tighter leading-tight">
                {topic.dayName}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant={topic.type === 'revision' ? 'secondary' : 'default'} className="text-[9px] h-3.5 px-1">
                    {topic.type === 'revision' ? 'REV' : 'EST'}
                  </Badge>
                  <p className={cn(
                    "font-semibold text-sm truncate",
                    topic.completed ? "text-zinc-400 line-through" : "text-zinc-900"
                  )}>
                    {topic.title}
                  </p>
                  {topic.videoUrl && (
                    <a 
                      href={formatVideoUrl(topic.videoUrl)} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[10px] text-indigo-600 hover:underline flex items-center gap-1 ml-2"
                    >
                      <Play className="w-2.5 h-2.5" /> Aula
                    </a>
                  )}
                </div>
                <p className="text-[10px] text-zinc-500 mt-0.5">{topic.subject}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[10px] text-zinc-400 whitespace-nowrap">
                  {topic.completed ? `${topic.actualDuration} min` : `${topic.duration} min`}
                </span>
                {!topic.completed ? (
                  <div className="flex items-center gap-2">
                    {finishingTopic?.dayIdx === topic.dIdx && finishingTopic?.topicIdx === topic.tIdx ? (
                      <div className="flex items-center gap-2 bg-indigo-50 p-1 rounded-lg border border-indigo-100">
                        <Input 
                          type="number" 
                          value={manualMinutes} 
                          onChange={(e) => setManualMinutes(e.target.value)}
                          className="h-7 w-16 text-xs bg-white"
                          autoFocus
                        />
                        <Button size="sm" className="h-7 text-[10px] bg-indigo-600 px-2" onClick={confirmFinish}>Ok</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2" onClick={() => setFinishingTopic(null)}>X</Button>
                      </div>
                    ) : (
                      <>
                        <Button 
                          size="sm" 
                          variant={topic.startTime ? "default" : "outline"}
                          className={cn(
                            "h-8 text-[10px] gap-1 px-3",
                            topic.startTime ? "bg-indigo-600 text-white" : "border-indigo-200 text-indigo-600"
                          )}
                          onClick={topic.startTime ? () => handleFinish(topic.dIdx, topic.tIdx, topic.startTime) : () => onToggleTopic(topic.dIdx, topic.tIdx)}
                        >
                          {topic.startTime ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                          {topic.startTime ? "Fim" : "Início"}
                        </Button>
                        {!topic.startTime && (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 text-[10px] text-zinc-400 hover:text-indigo-600 px-2"
                            onClick={() => handleFinish(topic.dIdx, topic.tIdx)}
                            title="Concluir Manualmente"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="w-[60px] flex justify-center items-center gap-2">
                    {finishingTopic?.dayIdx === topic.dIdx && finishingTopic?.topicIdx === topic.tIdx ? (
                      <div className="flex items-center gap-2 bg-green-50 p-1 rounded-lg border border-green-100">
                        <Input 
                          type="number" 
                          value={manualMinutes} 
                          onChange={(e) => setManualMinutes(e.target.value)}
                          className="h-7 w-16 text-xs bg-white"
                          autoFocus
                        />
                        <Button size="sm" className="h-7 text-[10px] bg-green-600 px-2" onClick={confirmFinish}>Ok</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2" onClick={() => setFinishingTopic(null)}>X</Button>
                      </div>
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 w-6 p-0 text-zinc-300 hover:text-indigo-600"
                          onClick={() => handleFinish(topic.dIdx, topic.tIdx, undefined, topic.actualDuration)}
                          title="Editar tempo"
                        >
                          <Clock className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  </div>
  );
}
