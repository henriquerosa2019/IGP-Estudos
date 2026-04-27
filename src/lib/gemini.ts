import { auth } from "./firebase";
import { GoogleGenAI } from "@google/genai";

// VERSION: 3.0.0 - Frontend Gemini Migration
(window as any).IGP_GEMINI_VERSION = "3.0.0";

// Platform provided API key
const ai_client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
export const GEMINI_MODEL = "gemini-3-flash-preview";

/**
 * Função de limpeza de JSON enviada pela IA
 */
const cleanJson = (text: string) => {
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  return match ? match[0] : text;
};

/**
 * Incrementa uso no servidor de forma assíncrona
 */
const incrementUsage = async () => {
  try {
    const user = auth.currentUser;
    if (!user) return;
    const token = await user.getIdToken();
    await fetch("/api/usage/increment", {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` }
    });
  } catch (e) {
    console.warn("Failed to increment usage:", e);
  }
};

/**
 * Chamada direta ao Gemini no frontend (Padrão AI Studio)
 */
export const generateWithFallback = async (params: any) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Usuário não autenticado.");

  const { contents, config } = params;
  
  try {
    const response = await ai_client.models.generateContent({
      model: GEMINI_MODEL,
      contents: typeof contents === 'string' ? contents : contents,
      config: config
    });

    const text = response.text;
    if (!text) throw new Error("A IA retornou uma resposta vazia.");

    // Registro de uso (não bloqueante)
    incrementUsage();

    return { text };
  } catch (error: any) {
    console.error("Gemini frontend error:", error);
    throw new Error(error.message || "Erro na geração com a IA.");
  }
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

  let data;
  try {
    const text = await response.text();
    if (!text) {
      throw new Error(`Resposta do servidor vazia (Status: ${response.status})`);
    }
    data = JSON.parse(text);
  } catch (parseError) {
    throw new Error(`Erro ao ler resposta do servidor (Status: ${response.status}).`);
  }

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
      systemInstruction: `Você é um especialista em concursos e memorização. Sua tarefa é gerar uma lista de flashcards baseada no material fornecido.

REGRAS CRÍTICAS:
1. Retorne APENAS um JSON válido.
2. O formato DEVE ser: { "flashcards": [ { "question": "...", "answer": "...", "subject": "..." } ] }
3. Gere entre 15 e 20 flashcards.
4. "question" (pergunta) e "answer" (resposta) são campos obrigatórios.
5. Não use formatação markdown no JSON (como blocos de código), apenas texto puro ou markdown simples dentro das strings.`,
      responseMimeType: "application/json"
    }
  });

  if (!response.text) throw new Error("A IA não retornou conteúdo.");
  
  try {
    const cleaned = cleanJson(response.text);
    const parsed = JSON.parse(cleaned);
    
    // Normalização para garantir que os campos existam mesmo que a IA mude a capitalização
    const rawCards = Array.isArray(parsed) ? parsed : (parsed.flashcards || parsed.cards || []);
    
    if (!Array.isArray(rawCards)) {
      throw new Error("Formato de flashcards inválido.");
    }

    return rawCards.map((card: any) => ({
      question: card.question || card.Question || card.pergunta || card.Pergunta || "Questão não definida",
      answer: card.answer || card.Answer || card.resposta || card.Resposta || "Resposta não definida",
      subject: card.subject || card.Subject || card.materia || card.Materia || contentName
    }));
  } catch (err) {
    console.error("Erro ao processar flashcards:", err);
    throw new Error("Erro ao interpretar os flashcards gerados pela IA.");
  }
};

/**
 * Gera um banco de questões a partir de um material de estudo no frontend
 */
export const generateQuestions = async (content: string, count: number = 10, bancaContext?: { banca?: string, characteristics?: string }) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Usuário não autenticado.");

  const systemInstruction = `Você é um especialista em concursos e exames da OAB e Carreiras Policiais. Sua tarefa é analisar o material fornecido e gerar uma lista de questões de múltipla escolha rigorosas e de alto nível. 
  ${bancaContext?.banca ? `A banca examinadora alvo é: ${bancaContext.banca}.` : ''}
  ${bancaContext?.characteristics ? `IMPORTANTE - Siga estas características da banca para as questões: ${bancaContext.characteristics}` : ''}
  Retorne APENAS o JSON no formato: { "questions": [ { "question": "...", "options": ["...", "...", "...", "...", "..."], "correctIndex": 0, "explanation": "..." } ] }`;

  const prompt = `Gere ${count} questões de múltipla escolha (estilo ${bancaContext?.banca || 'FCC/VUNESP/CESPE'}) baseadas exclusivamente no seguinte conteúdo:
  
  --- MATERIAL PARA ANÁLISE ---
  ${content.substring(0, 50000)}
  --- FIM DO MATERIAL ---
  
  REGRAS:
  1. Use 5 alternativas (A, B, C, D, E).
  2. Mantenha o foco em pegadinhas e detalhes técnicos típicos da banca.
  3. A explicação deve ser clara e explicar por que as outras estão erradas.`;

  try {
    const response = await ai_client.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json"
      }
    });

    const textValue = response.text;
    if (!textValue) throw new Error("IA retornou resposta vazia.");
    
    incrementUsage();

    const result = JSON.parse(cleanJson(textValue));
    if (!result.questions || !Array.isArray(result.questions)) {
      throw new Error("Formato de questões inválido na resposta da IA.");
    }
    return result.questions;
  } catch (error: any) {
    console.error("Generate questions error:", error);
    throw new Error(error.message || "Falha ao gerar questões.");
  }
};
