import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Calendar as CalendarIcon, CheckCircle2, Clock, Play, Square, Layers } from "lucide-react";
import { StudyPlan } from "@/types";

interface PlanViewerProps {
  plan: StudyPlan;
  viewMode: 'calendar' | 'vertical';
  onToggleTopic: (dayIdx: number, topicIdx: number) => void;
}

export function PlanViewer({ plan, viewMode, onToggleTopic }: PlanViewerProps) {
  if (viewMode === 'calendar') {
    return (
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
                      </div>
                    </div>
                  </div>

                  {!topic.completed && (
                    <div className="flex gap-2 mt-1 pl-8">
                      {!topic.startTime ? (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-7 text-[10px] border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                          onClick={() => onToggleTopic(idx, tIdx)}
                        >
                          <Play className="w-3 h-3 mr-1" /> Iniciar
                        </Button>
                      ) : (
                        <Button 
                          size="sm" 
                          className="h-7 text-[10px] bg-indigo-600 hover:bg-indigo-700"
                          onClick={() => onToggleTopic(idx, tIdx)}
                        >
                          <Square className="w-3 h-3 mr-1" /> Finalizar
                        </Button>
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
    );
  }

  return (
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
                </div>
                <p className="text-[10px] text-zinc-500 mt-0.5">{topic.subject}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[10px] text-zinc-400 whitespace-nowrap">
                  {topic.completed ? `${topic.actualDuration} min` : `${topic.duration} min`}
                </span>
                {!topic.completed ? (
                  <Button 
                    size="sm" 
                    variant={topic.startTime ? "default" : "outline"}
                    className={cn(
                      "h-8 text-[10px] gap-1 px-3",
                      topic.startTime ? "bg-indigo-600 text-white" : "border-indigo-200 text-indigo-600"
                    )}
                    onClick={() => onToggleTopic(topic.dIdx, topic.tIdx)}
                  >
                    {topic.startTime ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    {topic.startTime ? "Fim" : "Início"}
                  </Button>
                ) : (
                  <div className="w-[60px] flex justify-center">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
