import { useState, useEffect, useMemo } from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  FileText, 
  Plus, 
  Trash2, 
  Search, 
  Sparkles, 
  ChevronRight,
  Calendar,
  Layers,
  ArrowLeft,
  LayoutList,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  BarChart3,
  LogIn,
  LogOut as LogOutIcon,
  UserPlus,
  AlertCircle,
  Clock
} from "lucide-react";
import { Link } from "react-router-dom";
import { ExamNotice, Subject } from "@/types";
import { extractSubjectsFromNotice, generateStudyPlanFromNotices } from "@/lib/gemini";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Type } from "@google/genai";
import { auth, db, googleProvider } from "@/lib/firebase";
import { ai } from "@/lib/gemini";
import { signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  setDoc
} from "firebase/firestore";

import { PlanViewer } from "@/components/PlanViewer";
import { StudyPlan } from "@/types";
import { cn } from "@/lib/utils";

export default function Notices() {
  const [notices, setNotices] = useState<ExamNotice[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<ExamNotice | null>(null);
  const [expandedSubject, setExpandedSubject] = useState<number | null>(null);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [examDate, setExamDate] = useState("");
  const [url, setUrl] = useState("");
  const [manualText, setManualText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [planProgress, setPlanProgress] = useState(0);
  const [extractedSubjects, setExtractedSubjects] = useState<any[] | null>(null);

  // Plan viewing state
  const [currentPlan, setCurrentPlan] = useState<StudyPlan | null>(null);
  const [noticeViewMode, setNoticeViewMode] = useState<'subjects' | 'vertical' | 'calendar'>('subjects');
  const [dailyStudyHours, setDailyStudyHours] = useState<number>(4);
  const [manualExamDate, setManualExamDate] = useState<string>("");

  const estimates = useMemo(() => {
    if (!currentPlan) return null;

    const totalMinutes = currentPlan.schedule.reduce((acc, day) => {
      return acc + day.topics.reduce((tAcc, topic) => tAcc + (topic.duration || 0), 0);
    }, 0);

    const remainingMinutes = currentPlan.schedule.reduce((acc, day) => {
      return acc + day.topics.reduce((tAcc, topic) => {
        if (topic.completed) return tAcc;
        return tAcc + (topic.duration || 0);
      }, 0);
    }, 0);

    const dailyMinutes = dailyStudyHours * 60;
    const daysToFinish = Math.ceil(remainingMinutes / dailyMinutes);
    
    const finishDate = new Date();
    finishDate.setDate(finishDate.getDate() + daysToFinish);

    const targetExamDate = selectedNotice?.examDate || manualExamDate;
    let status: 'on-track' | 'behind' | 'no-date' = 'no-date';
    let daysDiff = 0;
    let requiredDailyHours = 0;

    if (targetExamDate) {
      const exam = new Date(targetExamDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffTime = exam.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays > 0) {
        requiredDailyHours = (remainingMinutes / diffDays) / 60;
      }

      if (daysToFinish <= diffDays) {
        status = 'on-track';
      } else {
        status = 'behind';
      }
      daysDiff = diffDays;
    }

    return {
      totalMinutes,
      remainingMinutes,
      daysToFinish,
      finishDate,
      status,
      daysDiff,
      targetExamDate,
      requiredDailyHours
    };
  }, [currentPlan, dailyStudyHours, manualExamDate, selectedNotice?.examDate]);

  const getUid = () => {
    if (user) return user.uid;
    let localUid = localStorage.getItem('localUid');
    if (!localUid) {
      localUid = 'anon_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('localUid', localUid);
    }
    return localUid;
  };

  useEffect(() => {
    if (!selectedNotice) {
      setCurrentPlan(null);
      return;
    }

    const q = query(collection(db, "plans"), where("notices", "array-contains", selectedNotice.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setCurrentPlan({ ...snapshot.docs[0].data(), id: snapshot.docs[0].id } as StudyPlan);
      } else {
        setCurrentPlan(null);
      }
    });

    return () => unsubscribe();
  }, [selectedNotice, user]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "notices"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ExamNotice));
      setNotices(data);
    }, (error) => {
      console.error("Firestore error:", error);
      toast.error("Erro ao carregar editais do Firebase.");
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success("Login realizado com sucesso!");
    } catch (error) {
      toast.error("Erro ao fazer login.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setSelectedNotice(null);
      toast.success("Sessão encerrada.");
    } catch (error) {
      toast.error("Erro ao sair.");
    }
  };

  const handleAddNotice = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name || !content) {
      toast.error("Preencha o nome e o conteúdo do edital.");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Analisando edital com IA...");

    try {
      console.log("Iniciando análise de disciplinas...");
      const subjects = await extractSubjectsFromNotice(content);
      console.log("Disciplinas extraídas:", subjects);
      
      if (!subjects || subjects.length === 0) {
        throw new Error("Não foi possível extrair as disciplinas. Verifique o conteúdo do edital.");
      }

      const newNotice = {
        uid: getUid(),
        name,
        content,
        subjects: subjects.map((s: any) => ({ 
          name: s.name || "Matéria sem nome",
          weight: s.weight || 1,
          importance: s.importance || "medium",
          topics: s.topics || [],
          progress: 0 
        })),
        examDate: examDate || null,
        hasPlanoVertical: true,
        hasCalendario: true
      };

      console.log("Salvando edital no Firebase...");
      await addDoc(collection(db, "notices"), newNotice);
      console.log("Edital salvo com sucesso!");
      
      setIsAdding(false);
      setName("");
      setContent("");
      setExamDate("");
      toast.success("Edital analisado e salvo no Firebase!", { id: toastId });
    } catch (error) {
      console.error("Erro detalhado ao salvar edital:", error);
      toast.error("Erro ao analisar ou salvar edital: " + (error instanceof Error ? error.message : "Erro desconhecido"), { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const toggleTopicCompletion = async (dayIdx: number, topicIdx: number, manualDuration?: number) => {
    if (!currentPlan || !user) return;
    
    const newPlan = { ...currentPlan };
    const topic = newPlan.schedule[dayIdx].topics[topicIdx];
    
    if (manualDuration !== undefined) {
      topic.completed = true;
      topic.actualDuration = manualDuration;
      topic.endTime = new Date().toISOString();
      if (!topic.startTime) topic.startTime = new Date().toISOString();
      toast.success(`Tempo atualizado: ${manualDuration} minutos.`);
    } else if (!topic.completed) {
      if (!topic.startTime) {
        topic.startTime = new Date().toISOString();
        toast.info(`Estudo iniciado: ${topic.title}`);
      } else {
        topic.endTime = new Date().toISOString();
        topic.completed = true;
        
        const start = new Date(topic.startTime).getTime();
        const end = new Date(topic.endTime).getTime();
        topic.actualDuration = Math.round((end - start) / (1000 * 60));
        
        toast.success(`Concluído! Você estudou por ${topic.actualDuration} minutos.`);
      }
    } else {
      topic.completed = false;
      topic.startTime = undefined;
      topic.endTime = undefined;
      topic.actualDuration = undefined;
    }

    try {
      const planRef = doc(db, "plans", currentPlan.id);
      await updateDoc(planRef, { schedule: newPlan.schedule });
    } catch (error) {
      console.error("Erro ao atualizar tópico:", error);
      toast.error("Erro ao atualizar progresso do plano.");
    }
  };

  const handleGeneratePlan = async () => {
    const uid = getUid();
    if (!selectedNotice || !uid) return;
    
    setGeneratingPlan(true);
    setPlanProgress(10);
    const toastId = toast.loading("Gerando plano de estudos personalizado...");

    try {
      setPlanProgress(30);
      console.log("Iniciando geração de plano para:", selectedNotice.name);
      
      // Use the shared function which is more robust and handles large content better
      const planData = await generateStudyPlanFromNotices(
        [selectedNotice],
        selectedNotice.examDate || "",
        4 // Default to 4 hours per day
      );
      
      console.log("Plano gerado com sucesso:", planData.title);
      setPlanProgress(90);

      const newPlan = {
        ...planData,
        uid: uid,
        notices: [selectedNotice.id]
      };

      console.log("Salvando plano no Firestore...");
      await addDoc(collection(db, "plans"), newPlan);
      setPlanProgress(100);
      
      toast.success("Plano de estudos gerado e salvo!", { id: toastId });
      setNoticeViewMode('vertical');
    } catch (error) {
      console.error("Erro detalhado ao gerar plano de estudos:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido ao gerar plano.";
      toast.error(`Erro ao gerar plano: ${errorMessage}`, { id: toastId });
    } finally {
      setGeneratingPlan(false);
      setPlanProgress(0);
    }
  };

  const handleReanalyze = async () => {
    if (!selectedNotice || !user) return;

    setIsReanalyzing(true);
    const toastId = toast.loading("Re-analisando edital para extrair tópicos detalhados...");

    try {
      const subjects = await extractSubjectsFromNotice(selectedNotice.content);
      const updatedData = {
        subjects: subjects.map((s: any) => {
          const existing = selectedNotice.subjects.find(es => es.name === s.name);
          return { ...s, progress: existing?.progress || 0 };
        }),
        hasPlanoVertical: true,
        hasCalendario: true
      };

      await updateDoc(doc(db, "notices", selectedNotice.id), updatedData);
      
      // Update local state for immediate feedback
      setSelectedNotice({ ...selectedNotice, ...updatedData });
      toast.success("Edital atualizado com sucesso!", { id: toastId });
    } catch (error) {
      toast.error("Erro ao re-analisar edital.", { id: toastId });
    } finally {
      setIsReanalyzing(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setImporting(true);
    setImportProgress(10);
    const toastId = toast.loading("Processando PDF...");

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      setImportProgress(30);
      const base64Data = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
      });

      const base64String = base64Data.split(',')[1];
      setImportProgress(50);

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            {
              inlineData: {
                data: base64String,
                mimeType: "application/pdf"
              }
            },
            {
              text: `Extraia as seguintes informações sobre o concurso do PDF:
              1. Nome do Concurso
              2. Previsão (ex: Sem Previsão, Edital Publicado)
              3. Número de Vagas
              4. Banca Organizadora
              5. Salário
              6. Conteúdo Programático detalhado

              Retorne os dados formatados como:
              Nome: [Nome]
              Previsão: [Previsão]
              Vagas: [Vagas]
              Banca: [Banca]
              Salário: [Salário]

              Conteúdo Programático:
              [Texto do conteúdo programático]`
            }
          ]
        }
      });
      setImportProgress(80);

      if (!response.text) throw new Error("Não foi possível extrair o conteúdo.");

      const extractedContent = response.text;
      
      const nameMatch = extractedContent.match(/Nome: (.*)/);
      if (nameMatch) setName(nameMatch[1]);
      else setName("Edital Importado - " + file.name);

      setContent(extractedContent);
      setImportProgress(100);
      toast.success("Conteúdo extraído! Agora salve o edital.", { id: toastId });
    } catch (error) {
      toast.error("Erro ao processar PDF.", { id: toastId });
    } finally {
      setImporting(false);
      setImportProgress(0);
    }
  };

  const handleImport = async () => {
    if (!url) return;
    setImporting(true);
    setImportProgress(10);
    const toastId = toast.loading("Importando edital...");

    try {
      setImportProgress(30);
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Acesse o link: ${url}.
        Extraia as informações do concurso. LEIA A PÁGINA INTEIRA E TODOS OS LINKS RELACIONADOS SE NECESSÁRIO PARA OBTER O CONTEÚDO PROGRAMÁTICO COMPLETO.
        
        1. Nome do Concurso
        2. Previsão
        3. Número de Vagas
        4. Banca Organizadora
        5. Salário
        6. Conteúdo Programático DETALHADO (Liste todas as matérias e tópicos)

        Retorne os dados formatados como:
        Nome: [Nome]
        Previsão: [Previsão]
        Vagas: [Vagas]
        Banca: [Banca]
        Salário: [Salário]

        Conteúdo Programático:
        [Texto completo do conteúdo programático]`,
        config: {
          tools: [{ urlContext: {} }]
        }
      });
      setImportProgress(70);

      if (!response.text || response.text.length < 100) throw new Error("Conteúdo muito curto ou não encontrado. Tente novamente ou use o PDF.");

      const extractedContent = response.text;
      setImportProgress(90);
      
      const nameMatch = extractedContent.match(/Nome: (.*)/);
      if (nameMatch) setName(nameMatch[1]);
      else setName("Edital Importado - " + new Date().toLocaleDateString());

      setContent(extractedContent);
      setImportProgress(100);
      toast.success("Conteúdo importado! Verifique os dados e clique em 'Analisar e Salvar'.", { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error("Erro ao importar edital: " + (error instanceof Error ? error.message : "Erro desconhecido"), { id: toastId });
    } finally {
      setImporting(false);
      setImportProgress(0);
    }
  };

  const handleManualImport = async () => {
    if (!manualText) return;
    setImporting(true);
    setImportProgress(10);
    const toastId = toast.loading("Analisando texto...");

    try {
      setImportProgress(40);
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analise o seguinte conteúdo que contém informações de um edital ou curso (pode ser texto puro ou código HTML de uma página de curso como Hotmart):
        
        ${manualText}
        
        Extraia as informações do concurso/curso:
        1. Nome do Concurso/Curso (Se não encontrar, use "Carreira Policial - Kverna")
        2. Previsão (se houver)
        3. Número de Vagas (se houver)
        4. Banca Organizadora/Plataforma
        5. Salário/Preço (se houver)
        6. Conteúdo Programático DETALHADO (Liste todas as matérias/módulos e tópicos/aulas)

        REGRAS CRÍTICAS:
        - Mantenha INTEGRALMENTE a estrutura de aulas (ex: "Aula 01 - Parte 01 - Princípios").
        - Se houver tempos (ex: 33:57), INCLUA-OS no final do título da aula entre parênteses. Exemplo: "Aula 01 - Parte 01 - Lei de drogas (33:57)".
        - SE O CONTEÚDO FOR HTML, extraia os links (href) das aulas e coloque-os ao lado do título da aula entre colchetes. Exemplo: "Aula 01 - Parte 01 - Princípios (30:00) [https://hotmart.com/...]".
        - Organize por Matéria/Módulo.

        Retorne os dados formatados como:
        Nome: [Nome]
        Previsão: [Previsão]
        Vagas: [Vagas]
        Banca: [Banca]
        Salário: [Salário]

        Conteúdo Programático:
        [Texto completo do conteúdo programático]`
      });
      setImportProgress(80);

      if (!response.text) throw new Error("Não foi possível analisar o texto.");

      const extractedContent = response.text;
      
      const nameMatch = extractedContent.match(/Nome: (.*)/);
      if (nameMatch && nameMatch[1].trim() !== "" && nameMatch[1] !== "[Nome]") {
        setName(nameMatch[1]);
      } else {
        setName("Carreira Policial - Kverna");
      }

      setContent(extractedContent);
      setImportProgress(100);
      toast.success("Texto analisado! Agora salve o edital.", { id: toastId });
    } catch (error) {
      toast.error("Erro ao analisar texto.", { id: toastId });
    } finally {
      setImporting(false);
      setImportProgress(0);
    }
  };

  const deleteNotice = async (id: string) => {
    try {
      await deleteDoc(doc(db, "notices", id));
      setSelectedNotice(null);
      toast.success("Edital removido.");
    } catch (error) {
      toast.error("Erro ao remover edital.");
    }
  };

  if (!authReady) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-5xl tracking-wide text-red-600" style={{ fontFamily: "'Deutsch Gothic', serif" }}>Meus Editais</h1>
          <p className="text-zinc-900 dark:text-white font-bold mt-2 text-2xl" style={{ fontFamily: "'Deutsch Gothic', serif" }}>Gerencie os editais para cruzamento de matérias e criação de planos.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-2 text-zinc-500 hover:text-red-600"
            onClick={handleLogout}
          >
            <LogOutIcon className="w-4 h-4" />
            Sair
          </Button>
          {!isAdding && !selectedNotice && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Button onClick={() => setIsAdding(true)} className="gap-2 bg-indigo-600">
                    <Plus className="w-4 h-4" /> Novo Edital
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-zinc-900 text-white border-zinc-800 max-w-xs">
                  <p>Cadastre editais (ex: PRF, PF, PC, PM) para que a IA cruze os dados, determine as matérias comuns da carreira policial e ajude na criação de um planejamento mais efetivo para sua aprovação.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {(isAdding || selectedNotice) && (
            <Button onClick={() => { setIsAdding(false); setSelectedNotice(null); }} variant="ghost" className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Voltar
            </Button>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {isAdding ? (
          <motion.div
            key="add-form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="max-w-3xl mx-auto space-y-6">
              <Card className="border-red-200 bg-white dark:bg-white shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-600">
                    <Sparkles className="w-5 h-5" />
                    Importar Edital via Link
                  </CardTitle>
                  <CardDescription className="text-red-500/80">
                    Cole o link do edital (ex: QConcursos) ou envie um arquivo PDF e clique em "Importar". O sistema extrairá o conteúdo automaticamente para você.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input 
                      placeholder="https://app.qconcursos.com/..." 
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="bg-white text-zinc-900 border-red-200 placeholder:text-red-300"
                    />
                    <Button 
                      onClick={handleImport} 
                      disabled={importing || !url}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      {importing ? "Importando..." : "Importar Link"}
                    </Button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-red-200" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-2 text-red-600">Ou</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="file" 
                      accept=".pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                      className="bg-white text-zinc-900 border-red-200 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100"
                    />
                  </div>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-red-200" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-2 text-red-600">Ou</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-red-600">Colar conteúdo do Edital/Curso</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] text-zinc-400 hover:text-red-600">
                              Como extrair da Hotmart?
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-zinc-900 text-white border-zinc-800 max-w-sm p-4">
                            <div className="space-y-2 text-xs">
                              <p className="font-bold text-red-500">Passo a passo para "Scraping" manual:</p>
                              <ol className="list-decimal ml-4 space-y-1">
                                <li>Abra seu curso na Hotmart.</li>
                                <li>Clique com o botão direito sobre a lista de aulas à direita.</li>
                                <li>Selecione <strong>Inspecionar</strong> (ou aperte F12).</li>
                                <li>No painel que abriu, procure a <code>&lt;div&gt;</code> ou <code>&lt;aside&gt;</code> que contém a lista.</li>
                                <li>Clique com o botão direito nela, vá em <strong>Copy</strong> &gt; <strong>Copy outerHTML</strong>.</li>
                                <li>Cole o código aqui e clique em Importar.</li>
                              </ol>
                              <p className="italic text-zinc-500 mt-2">Dica: Se preferir, apenas selecione todo o texto da lista com o mouse, copie e cole aqui.</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Textarea 
                      placeholder="Cole aqui o texto ou o HTML da lista de aulas..."
                      value={manualText}
                      onChange={(e) => setManualText(e.target.value)}
                      className="min-h-[150px] bg-white text-zinc-900 border-red-200 placeholder:text-red-300"
                    />
                    <Button 
                      onClick={handleManualImport} 
                      disabled={importing || !manualText}
                      className="w-full bg-red-600 hover:bg-red-700 text-white"
                    >
                      {importing ? "Analisando Texto..." : "Importar Texto"}
                    </Button>
                  </div>
                  {importing && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-red-600">
                        <span>Progresso</span>
                        <span>{importProgress}%</span>
                      </div>
                      <Progress value={importProgress} className="h-2" />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-zinc-500" />
                    Adicionar Manualmente
                  </CardTitle>
                  <CardDescription>Caso prefira, a opção de colar o texto diretamente continua disponível abaixo.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Nome do Concurso / Instituição</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: PRF 2026 - Agente Administrativo" />
                </div>
                <div className="space-y-2">
                  <Label>Data da Prova (Opcional)</Label>
                  <Input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Conteúdo Programático (Texto do Edital)</Label>
                  <Textarea 
                    value={content} 
                    onChange={(e) => setContent(e.target.value)} 
                    placeholder="Cole aqui a parte do edital que contém as matérias e conteúdos..."
                    className="h-64"
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1 gap-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                    onClick={() => {
                      setName("PMRJ Soldado 2024 (Último Edital)");
                      setContent(`LÍNGUA PORTUGUESA:
1. Leitura e interpretação de textos.
2. Ortografia oficial.
3. Acentuação gráfica.
4. Flexão nominal e verbal.
5. Pronomes: emprego, formas de tratamento e colocação.
6. Emprego de tempos e modos verbais.
7. Vozes do verbo.
8. Concordância nominal e verbal.
9. Regência nominal e verbal.
10. Ocorrência de crase.
11. Pontuação.
12. Redação (confronto de frases corretas e incorretas).
13. Intelecção de texto.

MATEMÁTICA BÁSICA:
1. Números inteiros: operações e propriedades.
2. Números racionais, representação fracionária e decimal: operações e propriedades.
3. Mínimo múltiplo comum.
4. Razão e proporção.
5. Porcentagem.
6. Regra de três simples e composta.
7. Média aritmética simples e ponderada.
8. Sistema de equações do 1º grau.
9. Relação entre grandezas: tabelas e gráficos.
10. Sistemas de medidas usuais.
11. Noções de geometria: forma, perímetro, área, volume, teorema de Pitágoras.
12. Raciocínio lógico.

NOÇÕES DE DIREITOS HUMANOS:
1. Declaração Universal dos Direitos Humanos.
2. Convenção Americana sobre Direitos Humanos (Pacto de São José da Costa Rica).
3. Constituição Federal de 1988: Título II (Direitos e Garantias Fundamentais).

NOÇÕES DE DIREITO ADMINISTRATIVO:
1. Estado, Governo e Administração Pública: conceitos, elementos, poderes e organização.
2. Atos administrativos: conceito, requisitos, atributos, classificação e espécies.
3. Agentes públicos: espécies e classificação; poderes, deveres e prerrogativas; cargo, emprego e função públicos.
4. Poderes administrativos: poder hierárquico; poder disciplinar; poder regulamentar; poder de polícia; uso e abuso do poder.

NOÇÕES DE DIREITO PENAL:
1. Infração penal: elementos, espécies.
2. Sujeito ativo e sujeito passivo da infração penal.
3. Tipicidade, ilicitude, culpabilidade, punibilidade.
4. Erro de tipo e erro de proibição.
5. Imputabilidade penal.
6. Concurso de pessoas.
7. Crimes contra a pessoa.
8. Crimes contra o patrimônio.

NOÇÕES DE DIREITO PROCESSUAL PENAL:
1. Inquérito Policial.
2. Prisão em flagrante.
3. Prisão preventiva.
4. Liberdade provisória.

LEGISLAÇÃO APLICADA À PMERJ:
1. Estatuto dos Policiais Militares (Lei Estadual nº 443/1981).
2. Regulamento Disciplinar da Polícia Militar (Decreto Estadual nº 6.579/1983).

NOÇÕES DE ÉTICA E CIDADANIA:
1. Ética e moral.
2. Ética no setor público.
3. Cidadania e direitos fundamentais.`);
                    }}
                  >
                    <Sparkles className="w-4 h-4" /> Usar Edital PMRJ Soldado
                  </Button>
                </div>
                <Button className="w-full bg-indigo-600" onClick={handleAddNotice} disabled={loading}>
                  {loading ? "Analisando com IA..." : "Analisar e Salvar Edital"}
                </Button>
              </CardContent>
            </Card>
            </div>
          </motion.div>
        ) : selectedNotice ? (
          <motion.div
            key="notice-detail"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between bg-zinc-50 p-6 rounded-2xl border border-zinc-100">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-100 rounded-xl">
                  <FileText className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-zinc-900">{selectedNotice.name}</h2>
                  <div className="flex gap-4 mt-1">
                    <span className="text-sm text-zinc-500 flex items-center gap-1">
                      <Calendar className="w-4 h-4" /> {selectedNotice.examDate ? new Date(selectedNotice.examDate).toLocaleDateString() : "Data não definida"}
                    </span>
                    <span className="text-sm text-zinc-500 flex items-center gap-1">
                      <Layers className="w-4 h-4" /> {selectedNotice.subjects.length} matérias identificadas
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex flex-col gap-2">
                  <Button 
                    onClick={handleGeneratePlan}
                    disabled={generatingPlan}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                  >
                    <CalendarDays className="w-4 h-4" />
                    {generatingPlan ? "Gerando..." : "Gerar Plano de Estudos"}
                  </Button>
                  {generatingPlan && (
                    <div className="w-full space-y-1">
                      <div className="flex justify-between text-xs text-emerald-600">
                        <span>Progresso</span>
                        <span>{planProgress}%</span>
                      </div>
                      <Progress value={planProgress} className="h-1.5" />
                    </div>
                  )}
                </div>
                <Button 
                  onClick={handleReanalyze} 
                  variant="outline" 
                  disabled={isReanalyzing}
                  className="gap-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                >
                  <Sparkles className={`w-4 h-4 ${isReanalyzing ? 'animate-spin' : ''}`} />
                  {isReanalyzing ? "Analisando..." : "Atualizar Tópicos"}
                </Button>
                <Button onClick={() => deleteNotice(selectedNotice.id)} variant="ghost" className="text-red-500 hover:bg-red-50">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
              <div className="w-full md:w-72 space-y-4">
                <Card className="border-zinc-200">
                  <CardHeader className="py-4">
                    <CardTitle className="text-sm font-bold">Menu do Edital</CardTitle>
                  </CardHeader>
                  <CardContent className="p-2 space-y-1">
                    <Button 
                      variant={noticeViewMode === 'subjects' ? 'secondary' : 'ghost'} 
                      className="w-full justify-start gap-3 text-zinc-600 hover:text-indigo-600 hover:bg-indigo-50"
                      onClick={() => setNoticeViewMode('subjects')}
                    >
                      <Layers className="w-4 h-4" />
                      Disciplinas
                    </Button>
                    <Button 
                      variant={noticeViewMode === 'vertical' ? 'secondary' : 'ghost'} 
                      className="w-full justify-start gap-3 text-zinc-600 hover:text-indigo-600 hover:bg-indigo-50"
                      onClick={() => setNoticeViewMode('vertical')}
                    >
                      <LayoutList className="w-4 h-4" />
                      Plano Vertical
                    </Button>
                    <Button 
                      variant={noticeViewMode === 'calendar' ? 'secondary' : 'ghost'} 
                      className="w-full justify-start gap-3 text-zinc-600 hover:text-indigo-600 hover:bg-indigo-50"
                      onClick={() => setNoticeViewMode('calendar')}
                    >
                      <CalendarDays className="w-4 h-4" />
                      Calendário
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start gap-3 text-zinc-600 hover:text-indigo-600 hover:bg-indigo-50"
                    >
                      <BarChart3 className="w-4 h-4" />
                      Desempenho Geral
                    </Button>
                  </CardContent>
                </Card>

                <Card className="bg-indigo-600 text-white border-none">
                  <CardContent className="p-6">
                    <h3 className="font-bold mb-2">Progresso Total</h3>
                    <div className="flex items-end gap-2 mb-4">
                      <span className="text-3xl font-bold">
                        {Math.round(selectedNotice.subjects.reduce((acc, s) => acc + (s.progress || 0), 0) / selectedNotice.subjects.length)}%
                      </span>
                      <span className="text-indigo-200 text-sm mb-1">concluído</span>
                    </div>
                    <Progress 
                      value={selectedNotice.subjects.reduce((acc, s) => acc + (s.progress || 0), 0) / selectedNotice.subjects.length} 
                      className="h-2 bg-indigo-400/30"
                    />
                  </CardContent>
                </Card>

                {currentPlan && (
                  <Card className="border-zinc-200 shadow-sm">
                    <CardHeader className="py-4">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Clock className="w-4 h-4 text-indigo-600" />
                        Estimativa de Conclusão
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs text-zinc-500">Horas de estudo por dia</Label>
                        <div className="flex items-center gap-2">
                          <Input 
                            type="number" 
                            min="1" 
                            max="24" 
                            value={dailyStudyHours} 
                            onChange={(e) => setDailyStudyHours(Number(e.target.value))}
                            className="h-8 text-sm"
                          />
                          <span className="text-xs text-zinc-400">horas</span>
                        </div>
                      </div>

                      {!selectedNotice?.examDate && (
                        <div className="space-y-2">
                          <Label className="text-xs text-zinc-500">Data provável da prova</Label>
                          <Input 
                            type="date" 
                            value={manualExamDate} 
                            onChange={(e) => setManualExamDate(e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                      )}

                      {estimates && (
                        <div className="pt-2 space-y-3 border-t border-zinc-100">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-zinc-500">Tempo restante:</span>
                            <span className="text-sm font-bold text-zinc-900">{Math.round(estimates.remainingMinutes / 60)}h</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-zinc-500">Dias para concluir:</span>
                            <span className="text-sm font-bold text-zinc-900">{estimates.daysToFinish} dias</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-zinc-500">Data de conclusão:</span>
                            <span className="text-sm font-bold text-indigo-600">{estimates.finishDate.toLocaleDateString()}</span>
                          </div>

                          {estimates.status !== 'no-date' && (
                            <div className="space-y-3">
                              <div className={cn(
                                "p-3 rounded-xl text-xs font-medium flex items-start gap-2",
                                estimates.status === 'on-track' ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                              )}>
                                {estimates.status === 'on-track' ? (
                                  <>
                                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                                    <span>Você concluirá o estudo {estimates.daysDiff - estimates.daysToFinish} dias antes da prova!</span>
                                  </>
                                ) : (
                                  <>
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>Atenção: Você concluirá o estudo {estimates.daysToFinish - estimates.daysDiff} dias APÓS a prova. Aumente sua carga horária diária.</span>
                                  </>
                                )}
                              </div>
                              
                              {estimates.requiredDailyHours > 0 && (
                                <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                                  <p className="text-[10px] text-indigo-600 font-bold uppercase mb-1">Carga Horária Recomendada</p>
                                  <p className="text-xs text-indigo-900">
                                    Para concluir exatamente no dia da prova, você precisa estudar <strong>{estimates.requiredDailyHours.toFixed(1)}h</strong> por dia.
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                          {estimates.status === 'no-date' && !manualExamDate && (
                            <div className="p-3 bg-zinc-50 rounded-xl text-[10px] text-zinc-500 italic">
                              Insira a data da prova para verificar se você conseguirá concluir o edital a tempo.
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="flex-1 space-y-4">
                {noticeViewMode === 'subjects' && (
                  <>
                    <h3 className="text-lg font-bold text-zinc-800 flex items-center gap-2">
                      <Layers className="w-5 h-5 text-indigo-500" />
                      Disciplinas do Edital
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                      {selectedNotice.subjects.map((subject, idx) => (
                        <Card 
                          key={idx} 
                          className={`overflow-hidden transition-all duration-300 border-zinc-200 ${expandedSubject === idx ? 'ring-2 ring-indigo-500 border-transparent' : 'hover:border-indigo-200'}`}
                        >
                          <div 
                            className="p-4 cursor-pointer flex items-center justify-between"
                            onClick={() => setExpandedSubject(expandedSubject === idx ? null : idx)}
                          >
                            <div className="flex items-center gap-4 flex-1">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${expandedSubject === idx ? 'bg-indigo-600 text-white' : 'bg-zinc-100 text-zinc-500'}`}>
                                <span className="text-xs font-bold">{idx + 1}</span>
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-bold text-zinc-900">{subject.name}</h4>
                                  <Badge variant={subject.importance === 'high' ? 'destructive' : subject.importance === 'medium' ? 'default' : 'secondary'} className="text-[10px] py-0">
                                    {subject.importance === 'high' ? 'ALTA' : subject.importance === 'medium' ? 'MÉDIA' : 'BAIXA'}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-4 mt-1">
                                  <div className="flex-1 max-w-[200px]">
                                    <Progress value={subject.progress || 0} className="h-1.5" />
                                  </div>
                                  <span className="text-xs font-medium text-zinc-500">{subject.progress || 0}%</span>
                                </div>
                              </div>
                            </div>
                            {expandedSubject === idx ? <ChevronUp className="w-5 h-5 text-zinc-400" /> : <ChevronDown className="w-5 h-5 text-zinc-400" />}
                          </div>

                          <AnimatePresence>
                            {expandedSubject === idx && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="border-t border-zinc-100 bg-zinc-50/30"
                              >
                                <div className="p-6 space-y-4">
                                  <div className="flex items-center justify-between">
                                    <h5 className="text-sm font-bold text-zinc-700 uppercase tracking-wider">Conteúdo Programático</h5>
                                    <span className="text-xs text-zinc-500">{subject.topics?.length || 0} tópicos listados</span>
                                  </div>
                                  <div className="grid grid-cols-1 gap-2">
                                    {subject.topics?.map((topic, tIdx) => (
                                      <div key={tIdx} className="flex items-start gap-3 p-3 bg-white rounded-xl border border-zinc-100 group hover:border-indigo-200 transition-colors">
                                        <div className="mt-0.5">
                                          <CheckCircle2 className="w-4 h-4 text-zinc-200 group-hover:text-indigo-300 transition-colors" />
                                        </div>
                                        <span className="text-sm text-zinc-600 leading-relaxed">{topic}</span>
                                      </div>
                                    ))}
                                    {(!subject.topics || subject.topics.length === 0) && (
                                      <p className="text-sm text-zinc-400 italic py-4 text-center">Nenhum tópico detalhado encontrado para esta disciplina.</p>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </Card>
                      ))}
                    </div>
                  </>
                )}

                {(noticeViewMode === 'vertical' || noticeViewMode === 'calendar') && (
                  <>
                    {currentPlan ? (
                      <PlanViewer 
                        plan={currentPlan} 
                        viewMode={noticeViewMode} 
                        onToggleTopic={toggleTopicCompletion} 
                      />
                    ) : (
                      <Card className="border-dashed border-2 border-zinc-200 bg-zinc-50/50">
                        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                          <CalendarDays className="w-12 h-12 text-zinc-300 mb-4" />
                          <h3 className="text-lg font-bold text-zinc-700 mb-2">Nenhum plano gerado</h3>
                          <p className="text-zinc-500 max-w-md mb-6">
                            Você ainda não gerou um plano de estudos para este edital. Clique no botão "Gerar Plano de Estudos" acima para começar.
                          </p>
                          <Button onClick={handleGeneratePlan} disabled={generatingPlan} className="bg-indigo-600 hover:bg-indigo-700">
                            {generatingPlan ? "Gerando..." : "Gerar Plano Agora"}
                          </Button>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="notice-list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {notices.length === 0 && (
              <div className="col-span-full py-20 text-center border-2 border-dashed border-zinc-200 rounded-3xl">
                <div className="p-4 bg-zinc-50 rounded-full w-fit mx-auto mb-4">
                  <Search className="w-8 h-8 text-zinc-300" />
                </div>
                <h3 className="text-lg font-medium text-zinc-900">Nenhum edital cadastrado</h3>
                <p className="text-zinc-500 max-w-xs mx-auto mt-2">Adicione seu primeiro edital para começar a cruzar matérias e gerar planos inteligentes.</p>
                <Button onClick={() => setIsAdding(true)} variant="outline" className="mt-6 gap-2">
                  <Plus className="w-4 h-4" /> Adicionar Edital
                </Button>
              </div>
            )}
            {notices.map(notice => (
              <Card 
                key={notice.id} 
                className="group cursor-pointer hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-50 transition-all duration-300"
                onClick={() => setSelectedNotice(notice)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="p-2 bg-indigo-50 rounded-lg group-hover:bg-indigo-100 transition-colors">
                      <FileText className="w-5 h-5 text-indigo-600" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-indigo-400 transition-colors" />
                  </div>
                  <CardTitle className="mt-4 text-lg line-clamp-1">{notice.name}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {notice.subjects.length} matérias identificadas.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1">
                    {notice.subjects.slice(0, 3).map((s, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] py-0 px-1.5">
                        {s.name}
                      </Badge>
                    ))}
                    {notice.subjects.length > 3 && (
                      <span className="text-[10px] text-zinc-400 ml-1">+{notice.subjects.length - 3}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
