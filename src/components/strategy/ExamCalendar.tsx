import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Download, Plus, ChevronLeft, ChevronRight, Bell } from "lucide-react";

export interface CalendarEvent {
  id: string;
  concurso: string;
  orgao: string;
  tipo: "inscricao" | "prova" | "resultado" | "prazo";
  data: string;
  cargo: string;
  vagas: string;
  link: string;
  obs: string;
  area: "Federal" | "Estadual" | "Municipal" | "";
  salario: string;
  dataProva?: string;
}

const TIPOS = {
  inscricao: { label: "Inscrição aberta", color: "bg-amber-500/20 text-amber-500 border-amber-500/30" },
  prova: { label: "Realização da prova", color: "bg-blue-500/20 text-blue-500 border-blue-500/30" },
  resultado: { label: "Resultado / gabarito", color: "bg-green-500/20 text-green-500 border-green-500/30" },
  prazo: { label: "Prazo / encerramento", color: "bg-red-500/20 text-red-500 border-red-500/30" }
};

const MESES_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MESES_ABR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const DIAS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const defaultEvents: CalendarEvent[] = [
  { id: "1", concurso: "IBGE — Analista", orgao: "Cebraspe", tipo: "inscricao", data: "2025-05-05", cargo: "Analista de TI", vagas: "150", link: "", obs: "", area: "Federal", salario: "8900" },
  { id: "2", concurso: "Receita Federal", orgao: "Esaf", tipo: "prova", data: "2025-05-18", cargo: "Auditor", vagas: "400", link: "", obs: "", area: "Federal", salario: "21000" },
];

export function ExamCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [currentEvent, setCurrentEvent] = useState<Partial<CalendarEvent>>({});
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [filterArea, setFilterArea] = useState<string>("Todas");

  useEffect(() => {
    const loadEvents = () => {
      const user = auth.currentUser;
      const key = user ? `calendar-events-${user.uid}` : "calendar-events-guest";
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          setEvents(JSON.parse(saved));
        } catch (e) {
          console.error(e);
        }
      } else {
        setEvents(defaultEvents);
      }
    };
    loadEvents();
    const unsubscribe = auth.onAuthStateChanged(loadEvents);
    return () => unsubscribe();
  }, []);

  const saveEvents = (newEvents: CalendarEvent[]) => {
    setEvents(newEvents);
    const user = auth.currentUser;
    const key = user ? `calendar-events-${user.uid}` : "calendar-events-guest";
    localStorage.setItem(key, JSON.stringify(newEvents));
  };

  const handleSaveModal = () => {
    if (!currentEvent.concurso || !currentEvent.data) {
      alert("Preencha ao menos o concurso e a data.");
      return;
    }
    const evt: CalendarEvent = {
      id: currentEvent.id || Date.now().toString(),
      concurso: currentEvent.concurso || "",
      orgao: currentEvent.orgao || "",
      tipo: currentEvent.tipo || "inscricao",
      data: currentEvent.data,
      cargo: currentEvent.cargo || "",
      vagas: currentEvent.vagas || "",
      link: currentEvent.link || "",
      obs: currentEvent.obs || "",
      area: currentEvent.area as any || "",
      salario: currentEvent.salario || "",
      dataProva: currentEvent.dataProva || ""
    };

    if (currentEvent.id) {
      saveEvents(events.map(e => e.id === evt.id ? evt : e));
    } else {
      saveEvents([...events, evt]);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm("Excluir este evento?")) {
      saveEvents(events.filter(e => e.id !== id));
      setIsDetailOpen(false);
    }
  };

  const filteredEvents = events.filter(e => filterArea === "Todas" || e.area === filterArea);

  const getTodayStr = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  const todayStr = getTodayStr();

  const stats = {
    inscricao: filteredEvents.filter(e => e.tipo === "inscricao" && e.data >= todayStr).length,
    prova: filteredEvents.filter(e => {
      const dateToCompare = e.dataProva || (e.tipo === "prova" ? e.data : null);
      return dateToCompare && dateToCompare >= todayStr;
    }).length,
    prazo: filteredEvents.filter(e => e.tipo === "prazo" && e.data >= todayStr).length,
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDays = new Date(year, month, 0).getDate();
    
    let days = [];
    for(let i = firstDay - 1; i >= 0; i--) {
      days.push({ day: prevDays - i, month: month - 1, other: true });
    }
    for(let d = 1; d <= daysInMonth; d++) {
      days.push({ day: d, month: month, other: false });
    }
    while(days.length % 7 !== 0) {
      days.push({ day: days.length - daysInMonth - firstDay + 1, month: month + 1, other: true });
    }

    return (
      <div className="mt-4">
        <div className="flex justify-between items-center mb-4">
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(new Date(year, month - 1, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-lg font-bold text-white">{MESES_PT[month]} {year}</span>
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(new Date(year, month + 1, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="grid grid-cols-7 gap-1">
          {DIAS_PT.map(d => <div key={d} className="text-center text-xs font-bold text-zinc-500 py-2">{d}</div>)}
          {days.map((c, i) => {
            const y = c.month < 0 ? year - 1 : c.month > 11 ? year + 1 : year;
            const m = ((c.month % 12) + 12) % 12;
            const dateStr = `${y}-${String(m+1).padStart(2, '0')}-${String(c.day).padStart(2, '0')}`;
            const isToday = dateStr === new Date().toISOString().split('T')[0];
            const dayEvents = filteredEvents.filter(e => e.data === dateStr);

            return (
              <div key={i} className={`min-h-24 p-1 border ${c.other ? 'bg-zinc-900/40 border-zinc-900/50' : 'bg-zinc-900/80 border-zinc-800'} ${isToday ? 'border-primary ring-1 ring-primary' : ''} rounded-md`}>
                <div className={`text-xs mb-1 ${isToday ? 'text-primary font-bold' : 'text-zinc-400'}`}>{c.day}</div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map(e => (
                    <div 
                      key={e.id}
                      onClick={() => { setSelectedEventId(e.id); setIsDetailOpen(true); }}
                      className={`text-[10px] px-1.5 py-0.5 rounded truncate cursor-pointer border ${e.tipo && TIPOS[e.tipo] ? TIPOS[e.tipo].color : 'bg-zinc-800 border-zinc-700'}`}
                    >
                      {e.concurso}
                    </div>
                  ))}
                  {dayEvents.length > 3 && <div className="text-[10px] text-zinc-500 text-center">+{dayEvents.length - 3} mais</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderList = () => {
    const sorted = [...filteredEvents].sort((a, b) => a.data.localeCompare(b.data));
    if (sorted.length === 0) return <div className="text-center p-8 text-zinc-500">Nenhum evento encontrado.</div>;
    
    return (
      <div className="space-y-3 mt-4">
        {sorted.map(e => {
          const parts = e.data.split('-');
          return (
            <div key={e.id} onClick={() => { setSelectedEventId(e.id); setIsDetailOpen(true); }} className="flex items-center gap-4 p-3 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:border-zinc-500 cursor-pointer transition-colors">
              <div className="text-center w-12 shrink-0">
                <div className="text-2xl font-bold text-white">{parts[2]}</div>
                <div className="text-xs uppercase text-zinc-500">{MESES_ABR[parseInt(parts[1]) - 1]}</div>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-white truncate">{e.concurso}</h4>
                <div className="text-xs text-zinc-400 truncate">{e.orgao} • {e.cargo} {e.salario && `• R$ ${e.salario}`}</div>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                {e.area && <span className="text-[10px] px-2 py-1 rounded-full bg-zinc-800 text-zinc-300">{e.area}</span>}
                <span className={`text-[10px] px-2 py-1 rounded-full border ${e.tipo && TIPOS[e.tipo] ? TIPOS[e.tipo].color : 'bg-zinc-800'}`}>
                  {e.tipo && TIPOS[e.tipo]?.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const selectedEvent = events.find(e => e.id === selectedEventId);

  const exportCSV = () => {
    const header = ['Concurso', 'Órgão', 'Tipo', 'Data', 'Cargo', 'Vagas', 'Salário', 'Área', 'Link', 'Observações'];
    const rows = [header, ...events.map(e => [e.concurso, e.orgao, TIPOS[e.tipo]?.label, e.data, e.cargo, e.vagas, e.salario, e.area, e.link, e.obs])];
    const csv = rows.map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'calendario-provas.csv';
    a.click();
  };

  return (
    <Card className="bg-zinc-900/50 border-zinc-800 col-span-full">
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
        <div>
          <CardTitle className="text-primary flex items-center gap-2">
            Calendário de Concursos
          </CardTitle>
          <CardDescription className="text-zinc-400 mt-1">
            Agenda e notificações de editais e provas.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} className="border-zinc-700">
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
          <Button size="sm" className="bg-primary text-black font-bold" onClick={() => { setCurrentEvent({ tipo: 'inscricao', area: '' }); setIsModalOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" />
            Novo
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
          <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-lg">
            <div className="text-2xl font-bold text-white">{filteredEvents.length}</div>
            <div className="text-xs text-zinc-500">Total</div>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg">
            <div className="text-2xl font-bold text-amber-500">{stats.inscricao}</div>
            <div className="text-xs text-amber-500/70">Inscrições Abertas</div>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg">
            <div className="text-2xl font-bold text-blue-500">{stats.prova}</div>
            <div className="text-xs text-blue-500/70">Provas Futuras</div>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg">
            <div className="text-2xl font-bold text-red-500">{stats.prazo}</div>
            <div className="text-xs text-red-500/70">Prazos Próximos</div>
          </div>
        </div>

        <Tabs defaultValue="calendar">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800 pb-2">
            <TabsList className="bg-black border border-zinc-800">
              <TabsTrigger value="calendar" className="text-primary font-medium data-[state=active]:bg-primary data-[state=active]:text-black hover:bg-primary hover:text-black dark:hover:bg-primary dark:hover:text-black transition-colors">Calendário</TabsTrigger>
              <TabsTrigger value="list" className="text-primary font-medium data-[state=active]:bg-primary data-[state=active]:text-black hover:bg-primary hover:text-black dark:hover:bg-primary dark:hover:text-black transition-colors">Lista</TabsTrigger>
            </TabsList>
            <Select value={filterArea} onValueChange={setFilterArea}>
              <SelectTrigger className="w-[180px] bg-zinc-900 border-zinc-800">
                <SelectValue placeholder="Filtrar por Área" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todas">Todas as Áreas</SelectItem>
                <SelectItem value="Federal">Federal</SelectItem>
                <SelectItem value="Estadual">Estadual</SelectItem>
                <SelectItem value="Municipal">Municipal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <TabsContent value="calendar">{renderCalendar()}</TabsContent>
          <TabsContent value="list">{renderList()}</TabsContent>
        </Tabs>
      </CardContent>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto w-[95vw] bg-zinc-950 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">{currentEvent.id ? "Editar Evento" : "Novo Evento"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 col-span-full">
                <Label>Concurso / Prova *</Label>
                <Input value={currentEvent.concurso || ""} onChange={e => setCurrentEvent({...currentEvent, concurso: e.target.value})} className="bg-zinc-900 border-zinc-700" placeholder="Ex: Receita Federal" />
              </div>
              <div className="space-y-2">
                <Label>Órgão / Banca</Label>
                <Input value={currentEvent.orgao || ""} onChange={e => setCurrentEvent({...currentEvent, orgao: e.target.value})} className="bg-zinc-900 border-zinc-700" placeholder="Ex: FGV" />
              </div>
              <div className="space-y-2">
                <Label>Área</Label>
                <Select value={currentEvent.area || ""} onValueChange={(v) => setCurrentEvent({...currentEvent, area: v as any})}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-700"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Federal">Federal</SelectItem>
                    <SelectItem value="Estadual">Estadual</SelectItem>
                    <SelectItem value="Municipal">Municipal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo de evento *</Label>
                <Select value={currentEvent.tipo} onValueChange={(v) => setCurrentEvent({...currentEvent, tipo: v as any})}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-700"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inscricao">Inscrição aberta</SelectItem>
                    <SelectItem value="prova">Realização da prova</SelectItem>
                    <SelectItem value="resultado">Resultado / Gabarito</SelectItem>
                    <SelectItem value="prazo">Prazo / Encerramento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data *</Label>
                <Input type="date" value={currentEvent.data || ""} onChange={e => setCurrentEvent({...currentEvent, data: e.target.value})} className="bg-zinc-900 border-zinc-700" />
              </div>
              <div className="space-y-2">
                <Label>Data da Prova (opcional)</Label>
                <Input type="date" value={currentEvent.dataProva || ""} onChange={e => setCurrentEvent({...currentEvent, dataProva: e.target.value})} className="bg-zinc-900 border-zinc-700" />
              </div>
              <div className="space-y-2">
                <Label>Cargo</Label>
                <Input value={currentEvent.cargo || ""} onChange={e => setCurrentEvent({...currentEvent, cargo: e.target.value})} className="bg-zinc-900 border-zinc-700" />
              </div>
              <div className="space-y-2 grid grid-cols-2 gap-2">
                <div>
                  <Label>Vagas</Label>
                  <Input type="number" value={currentEvent.vagas || ""} onChange={e => setCurrentEvent({...currentEvent, vagas: e.target.value})} className="bg-zinc-900 border-zinc-700" />
                </div>
                <div>
                  <Label>Salário (R$)</Label>
                  <Input type="number" value={currentEvent.salario || ""} onChange={e => setCurrentEvent({...currentEvent, salario: e.target.value})} className="bg-zinc-900 border-zinc-700" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Link do edital</Label>
              <Input value={currentEvent.link || ""} onChange={e => setCurrentEvent({...currentEvent, link: e.target.value})} className="bg-zinc-900 border-zinc-700" placeholder="https://" />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={currentEvent.obs || ""} onChange={e => setCurrentEvent({...currentEvent, obs: e.target.value})} className="bg-zinc-900 border-zinc-700 min-h-20" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button className="bg-primary text-black font-bold" onClick={handleSaveModal}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-[425px] bg-zinc-950 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white text-xl">{selectedEvent?.concurso}</DialogTitle>
            <DialogDescription className="text-zinc-400">{selectedEvent?.orgao}</DialogDescription>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-md font-medium ${TIPOS[selectedEvent.tipo]?.color || ""}`}>
                  {TIPOS[selectedEvent.tipo]?.label}
                </span>
                {selectedEvent.area && <span className="text-xs px-2 py-1 bg-zinc-800 text-zinc-300 rounded-md">{selectedEvent.area}</span>}
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-zinc-500 mb-1">Data</div>
                  <div className="text-white font-medium">{selectedEvent.data.split('-').reverse().join('/')}</div>
                </div>
                {selectedEvent.dataProva && (
                  <div>
                    <div className="text-zinc-500 mb-1">Data da Prova</div>
                    <div className="text-white font-medium">{selectedEvent.dataProva.split('-').reverse().join('/')}</div>
                  </div>
                )}
                {selectedEvent.cargo && (
                  <div>
                    <div className="text-zinc-500 mb-1">Cargo</div>
                    <div className="text-white">{selectedEvent.cargo}</div>
                  </div>
                )}
                {selectedEvent.vagas && (
                  <div>
                    <div className="text-zinc-500 mb-1">Vagas</div>
                    <div className="text-white">{selectedEvent.vagas}</div>
                  </div>
                )}
                {selectedEvent.salario && (
                  <div>
                    <div className="text-zinc-500 mb-1">Salário</div>
                    <div className="text-white font-medium text-green-400">R$ {selectedEvent.salario}</div>
                  </div>
                )}
              </div>
              {selectedEvent.link && (
                <div>
                  <div className="text-zinc-500 text-sm mb-1">Edital / Link</div>
                  <a href={selectedEvent.link} target="_blank" rel="noopener noreferrer" className="text-primary text-sm hover:underline break-all">
                    Acessar Link Externo ↗
                  </a>
                </div>
              )}
              {selectedEvent.obs && (
                <div className="bg-zinc-900 p-3 rounded-lg border border-zinc-800">
                  <div className="text-zinc-500 text-sm mb-1">Observações</div>
                  <div className="text-zinc-300 text-sm">{selectedEvent.obs}</div>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex justify-between sm:justify-between items-center sm:space-x-0 w-full mt-2">
            <Button variant="destructive" size="sm" onClick={() => handleDelete(selectedEvent!.id)}>Excluir</Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsDetailOpen(false)}>Fechar</Button>
              <Button size="sm" onClick={() => { setIsDetailOpen(false); setCurrentEvent(selectedEvent!); setIsModalOpen(true); }} className="bg-zinc-800 text-white hover:bg-zinc-700 border-zinc-700">Editar</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
