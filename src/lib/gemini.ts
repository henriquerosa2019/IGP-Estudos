import { auth } from "./firebase";

// VERSION: 2.0.0 - FullStack Migration
(window as any).IGP_GEMINI_VERSION = "2.0.0";

export const GEMINI_MODEL = "gemini-3-flash-preview";

/**
 * Função de limpeza de JSON enviada pela IA
 */
const cleanJson = (text: string) => {
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  return match ? match[0] : text;
};

/**
 * Proxy para chamadas do Gemini via servidor seguro
 */
export const generateWithFallback = async (params: any) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Usuário não autenticado. Faça login para usar a IA.");
  
  const token = await user.getIdToken();

  const response = await fetch("/api/gemini/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(params)
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || "Erro na geração com a IA.");
  }

  return data; // Retorna { text: "..." }
};

/**
 * Busca estatísticas de uso do usuário
 */
export const getUsageStats = async () => {
  const user = auth.currentUser;
  if (!user) return { count: 0 };
  
  const token = await user.getIdToken();
  const response = await fetch("/api/usage/stats", {
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });

  if (!response.ok) return { count: 0 };
  return await response.json();
};

/**
 * Extração de texto de arquivos via servidor
 */
export const extractTextFromFile = async (file: File) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Usuário não autenticado.");
  
  const token = await user.getIdToken();
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/upload/extract-text", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`
    },
    body: formData
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Erro ao extrair texto do arquivo.");
  }

  return data.text as string;
};

// Funções de alto nível adaptadas para usar o proxy

export const generateStudyPlanFromNotices = async (
  notices: { name: string; content: string }[],
  examDate: string,
  hoursPerDay: number
) => {
  const prompt = `Analise EXAUSTIVAMENTE os seguintes editais/cronogramas:
  ${notices.map(n => `Edital: ${n.name}\nConteúdo: ${n.content}`).join("\n\n")}
  
  Data prevista do concurso: ${examDate || 'Não definida'}.
  Tempo disponível: ${hoursPerDay} horas por dia.
  Data de início (hoje): ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}.
  
  Sua tarefa CRÍTICA:
  1. Mapeie ABSOLUTAMENTE TODOS os tópicos listados no conteúdo programático acima.
  2. Crie um plano de estudos sequencial (Dia 1, Dia 2, Dia 3...) que cubra 100% do conteúdo.
  3. Cada dia de estudo deve conter EXATAMENTE 2 tópicos novos (type: 'study').
  4. O primeiro item de estudo de cada dia (a partir do Dia 2) DEVE SER uma "Revisão" (type: "revision") das 2 matérias estudadas no dia anterior.`;

  const response = await generateWithFallback({
    contents: prompt,
    config: {
      systemInstruction: "Você é um especialista em concursos. Sua prioridade absoluta é a COBERTURA TOTAL (100%) do edital. Retorne APENAS o JSON.",
    }
  });

  if (!response.text) throw new Error("A IA não retornou conteúdo.");
  const resultJson = JSON.parse(cleanJson(response.text));
  
  if (resultJson.schedule) {
    resultJson.schedule.forEach((day: any) => {
      day.topics.forEach((topic: any) => {
        topic.id = Math.random().toString(36).substring(2, 11);
        topic.completed = false;
      });
    });
  }

  const startDate = new Date();
  const totalDays = resultJson.schedule?.length || 30;
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + totalDays);

  return {
    ...resultJson,
    id: Date.now().toString(),
    goal: notices.map(n => n.name).join(" + "),
    examDate: examDate,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  };
};

/**
 * Gera plano de estudos (Manual ou baseada em Editais)
 */
export async function generateStudyPlan(goal: string, subjects: string[], hours: number): Promise<any>;
export async function generateStudyPlan(notices: { name: string; content: string }[], examDate: string, hours: number): Promise<any>;
export async function generateStudyPlan(
  goalOrNotices: string | { name: string; content: string }[],
  subjectsOrDate: string | string[],
  hours: number
): Promise<any> {
  // Caso 1: Manual (Goal + Subjects)
  if (typeof goalOrNotices === 'string') {
    const subjects = Array.isArray(subjectsOrDate) ? subjectsOrDate : [subjectsOrDate];
    const prompt = `Crie um plano de estudos otimizado para o seguinte objetivo: ${goalOrNotices}.
    Disciplinas a estudar: ${subjects.join(', ')}.
    Tempo disponível: ${hours} horas por dia.
    
    Retorne um JSON contendo:
    {
      "title": "...",
      "goal": "${goalOrNotices}",
      "subjects": [ { "name": "...", "importance": "high|medium|low" } ],
      "schedule": [ { "day": 1, "topics": [ { "subject": "...", "name": "...", "type": "study|revision" } ] } ]
    }`;

    const response = await generateWithFallback({
      contents: prompt,
      config: {
        systemInstruction: "Especialista em aprendizagem acelerada. Gere planos de estudo 100% em JSON."
      }
    });

    if (!response.text) throw new Error("IA falhou.");
    const result = JSON.parse(cleanJson(response.text));
    
    // Add IDs and metadata
    if (result.schedule) {
      result.schedule.forEach((day: any) => {
        day.topics.forEach((topic: any) => {
          topic.id = Math.random().toString(36).substring(2, 11);
          topic.completed = false;
        });
      });
    }

    return {
      ...result,
      id: Date.now().toString(),
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + (result.schedule?.length || 30) * 86400000).toISOString()
    };
  } 
  
  // Caso 2: Baseado em Editais
  return generateStudyPlanFromNotices(goalOrNotices as { name: string; content: string }[], subjectsOrDate as string, hours);
};

export const extractSubjectsFromNotice = async (content: string) => {
  const prompt = `Analise o conteúdo de um edital e extraia matérias principais e tópicos.
    CONTEÚDO: ${content}`;

  const response = await generateWithFallback({
    contents: prompt,
    config: {
      systemInstruction: "Especialista em editais. Extraia matérias e tópicos. Retorne APENAS JSON { subjects: [...] }.",
    }
  });

  if (!response.text) throw new Error("A IA não retornou conteúdo.");
  return JSON.parse(cleanJson(response.text)).subjects;
};

export const analyzeContent = async (content: string, type: 'text' | 'pdf' | 'video' | 'link') => {
  const response = await generateWithFallback({
    contents: content.substring(0, 30000),
    config: {
      systemInstruction: "Resuma conteúdos de estudo em JSON { summary, topics }.",
    }
  });

  if (!response.text) throw new Error("A IA não retornou conteúdo.");
  return JSON.parse(cleanJson(response.text));
};

export const generateFlashcardsFromMultimodal = async (
  parts: any[],
  contentName: string
) => {
  const response = await generateWithFallback({
    contents: [{ role: 'user', parts }],
    config: {
      systemInstruction: `Gere 20 flashcards para "${contentName}". Retorne JSON { flashcards: [...] }.`,
    }
  });

  if (!response.text) throw new Error("A IA não retornou conteúdo.");
  const cleaned = cleanJson(response.text);
  const parsed = JSON.parse(cleaned);
  return parsed.flashcards || parsed;
};

/**
 * Gera um banco de questões a partir de um material de estudo
 */
export const generateQuestions = async (content: string, count: number = 10, bancaContext?: { banca?: string, characteristics?: string }) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Usuário não autenticado.");
  
  const token = await user.getIdToken();

  const response = await fetch("/api/gemini/generate-questions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ content, count, bancaContext })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Erro ao gerar questões.");
  }

  const cleaned = cleanJson(data.text);
  return JSON.parse(cleaned).questions;
};
