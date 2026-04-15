import { GoogleGenerativeAI } from "@google/generative-ai";

// VERSION: 1.0.4 - Forced update to verify deployment
(window as any).IGP_GEMINI_VERSION = "1.0.4";

// Função robusta para capturar a chave da API em diferentes ambientes (Vite, Vercel, Local)
const getApiKey = () => {
  // 1. Tenta do process.env (Injetado pelo vite.config.ts ou ambiente Node)
  const processKey = typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : undefined;
  if (processKey && processKey.length > 10 && processKey !== "undefined" && processKey !== "null") {
    return processKey;
  }

  // 2. Tenta do import.meta.env (Padrão do Vite para variáveis com prefixo VITE_)
  const viteKey = (import.meta as any).env.VITE_GEMINI_API_KEY;
  if (viteKey && viteKey.length > 10 && viteKey !== "undefined" && viteKey !== "null") {
    return viteKey;
  }

  return null;
};

const apiKey = getApiKey();

if (apiKey) {
  console.log("Gemini: Chave detectada com sucesso (Inicia com: " + apiKey.substring(0, 4) + "...)");
} else {
  console.error("Gemini: ERRO - Chave não encontrada. No Vercel, adicione VITE_GEMINI_API_KEY nas Environment Variables e faça um REDEPLOY.");
}

// Inicializa o SDK padrão do Google Generative AI
export const ai = apiKey ? new GoogleGenerativeAI(apiKey) : null;
export const GEMINI_MODEL = "gemini-1.5-flash";

if (ai) {
  console.log(`Gemini: SDK inicializado com o modelo ${GEMINI_MODEL}`);
}

if (!ai) {
  console.warn("GoogleGenerativeAI instance (ai) is null. AI features will not work.");
}

const cleanJson = (text: string) => {
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  return match ? match[0] : text;
};

const enforceRevisions = (schedule: any[]) => {
  if (!schedule || !Array.isArray(schedule)) return schedule;
  
  for (let i = 1; i < schedule.length; i++) {
    const previousDayTopics = schedule[i - 1].topics?.filter((t: any) => t.type === 'study') || [];
    const currentDayStudies = schedule[i].topics?.filter((t: any) => t.type === 'study') || [];

    const revisionsToAdd = previousDayTopics.slice(0, 2).map((prevTopic: any) => ({
      title: `Revisão: ${prevTopic.title}`,
      subject: prevTopic.subject,
      duration: 15,
      type: 'revision'
    }));

    schedule[i].topics = [...revisionsToAdd, ...currentDayStudies.slice(0, 2)];
  }
  return schedule;
};

export const generateStudyPlanFromNotices = async (
  notices: { name: string; content: string }[],
  examDate: string,
  hoursPerDay: number
) => {
  if (!ai) {
    throw new Error("A inteligência artificial não está configurada. Verifique se a chave VITE_GEMINI_API_KEY foi adicionada no Vercel e se você fez um Redeploy.");
  }

  try {
    const model = ai.getGenerativeModel({ 
      model: GEMINI_MODEL,
      systemInstruction: "Você é um especialista em concursos. Sua prioridade absoluta é a COBERTURA TOTAL (100%) do edital. Você deve gerar um plano extenso, detalhado e sequencial. Nunca resuma o conteúdo. Retorne APENAS o JSON. Se houver links de vídeo no conteúdo, preserve-os no campo videoUrl. Use 'type': 'study' and 'type': 'revision'. O campo 'day' deve incluir o dia da semana e a data (ex: Dia 1 (Segunda, 06/04)).",
    });

    const prompt = `Analise EXAUSTIVAMENTE os seguintes editais/cronogramas:
    ${notices.map(n => `Edital: ${n.name}\nConteúdo: ${n.content}`).join("\n\n")}
    
    Data prevista do concurso: ${examDate || 'Não definida'}.
    Tempo disponível: ${hoursPerDay} horas por dia.
    Data de início (hoje): ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}.
    
    Sua tarefa CRÍTICA:
    1. Mapeie ABSOLUTAMENTE TODOS os tópicos listados no conteúdo programático acima. Se o conteúdo for uma lista de aulas (ex: "Aula 01 - Parte 01..."), inclua CADA AULA como um tópico individual.
    2. SE O CONTEÚDO FOR HTML (outerHTML da Hotmart), extraia os links das aulas (href) e inclua no campo 'videoUrl' de cada tópico correspondente.
    3. NÃO RESUMA, NÃO PULE TÓPICOS e NÃO AGRUPE de forma que se perca o detalhamento. Se houver 100 aulas, o plano deve ter 100 tópicos de estudo distribuídos nos dias.
    3. Crie um plano de estudos sequencial (Dia 1, Dia 2, Dia 3...) que cubra 100% do conteúdo.
    4. OBRIGATÓRIO: Cada dia de estudo deve conter EXATAMENTE 2 tópicos novos (type: 'study'). 
    5. OBRIGATÓRIO: O primeiro item de estudo de cada dia (a partir do Dia 2) DEVE SER uma "Revisão" (type: "revision") das 2 matérias estudadas no dia anterior.
    6. O campo 'day' deve conter o número do dia, o dia da semana e a data (ex: 'Dia 1 (Segunda, 06/04)').
    7. Se o conteúdo for muito grande, gere quantos dias forem necessários (60, 90, 120 dias...).`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    if (!text) throw new Error("A IA não retornou conteúdo.");
    const resultJson = JSON.parse(cleanJson(text));
    
    if (resultJson.schedule) {
      resultJson.schedule = enforceRevisions(resultJson.schedule);
      resultJson.schedule.forEach((day: any) => {
        day.topics.forEach((topic: any) => {
          topic.id = Math.random().toString(36).substring(2, 11);
          topic.completed = false;
          if (topic.videoUrl && topic.videoUrl.startsWith('/')) {
            topic.videoUrl = `https://hotmart.com${topic.videoUrl}`;
          }
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
  } catch (error) {
    console.error("Erro ao cruzar editais:", error);
    throw error;
  }
};

export const extractSubjectsFromNotice = async (content: string) => {
  if (!ai) {
    throw new Error("A inteligência artificial não está configurada. Verifique se a chave VITE_GEMINI_API_KEY foi adicionada no Vercel e se você fez um Redeploy.");
  }

  try {
    const model = ai.getGenerativeModel({ 
      model: GEMINI_MODEL,
      systemInstruction: "Você é um especialista em editais e cronogramas de cursos. Sua tarefa é decompor o conteúdo em matérias e tópicos detalhados, PRESERVANDO INTEGRALMENTE a nomenclatura original das aulas e INCLUINDO os tempos de duração se disponíveis. Retorne APENAS o JSON. Seja exaustivo.",
    });

    const prompt = `Analise o seguinte conteúdo de um edital de concurso ou cronograma de curso e extraia as matérias principais com seu peso/importância sugerida e a lista de tópicos detalhados de cada matéria.
      
      CONTEÚDO:
      ${content}
      
      INSTRUÇÕES CRÍTICAS:
      1. Identifique cada disciplina ou módulo (ex: Português, Direito Penal, Informática).
      2. Para CADA disciplina, extraia TODOS os tópicos listados. 
      3. IMPORTANTE: Se o conteúdo estiver estruturado como aulas (ex: "Aula 01 - Parte 01 - Tópico"), você DEVE manter exatamente essa nomenclatura no título do tópico.
      4. TEMPOS DE AULA: Se houver tempos de duração (ex: 33:57, 40:06), você DEVE incluí-los no final do título do tópico entre parênteses. Exemplo: "Aula 01 - Parte 01 - Lei de drogas (33:57)".
      5. Capture a hierarquia: Se houver um nome de matéria seguido por várias aulas, agrupe essas aulas dentro dessa matéria.
      6. Não pule nenhum item.
      7. Atribua um peso de 1 a 5 baseado na relevância comum para concursos.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    if (!text) throw new Error("A IA não retornou conteúdo.");
    return JSON.parse(cleanJson(text)).subjects;
  } catch (error) {
    console.error("Erro ao extrair matérias:", error);
    throw error;
  }
};

export const generateStudyPlan = async (goal: string, subjects: string[], hoursPerDay: number) => {
  if (!ai) {
    throw new Error("A inteligência artificial não está configurada. Verifique se a chave VITE_GEMINI_API_KEY foi adicionada no Vercel e se você fez um Redeploy.");
  }

  try {
    const model = ai.getGenerativeModel({ 
      model: GEMINI_MODEL,
      systemInstruction: "Você é um especialista em concursos. Sua prioridade absoluta é a COBERTURA TOTAL (100%) das matérias. Gere um plano extenso e detalhado. Nunca resuma. Retorne APENAS o JSON. Use 'type': 'study' and 'type': 'revision'. O campo 'day' deve incluir o dia da semana e a data (ex: Dia 1 (Segunda, 06/04)).",
    });

    const prompt = `Crie um plano de estudos detalhado para o objetivo: "${goal}". 
      Matérias de foco: ${subjects.join(", ")}. 
      Tempo disponível: ${hoursPerDay} horas por dia. 
      Data de início (hoje): ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}.
      Sua tarefa CRÍTICA:
      1. Mapeie ABSOLUTAMENTE TODOS os tópicos das matérias citadas. Não resuma.
      2. O plano deve ser organizado por dias sequenciais e incluir o dia da semana e a data (ex: Dia 1 (Segunda, 06/04), Dia 2 (Terça, 07/04), etc.).
      3. O plano deve ser EXAUSTIVO o suficiente para cobrir TODO o conteúdo. NÃO se limite a uma semana ou um mês. Gere 30, 60 ou 90 dias se necessário.
      4. OBRIGATÓRIO: Cada dia de estudo deve conter EXATAMENTE 2 tópicos novos (type: 'study'). Divida o conteúdo para caber em 2 tópicos por dia.
      5. OBRIGATÓRIO: O primeiro item de estudo de cada dia (a partir do Dia 2) DEVE SER uma "Revisão" (type: "revision") das 2 matérias estudadas no dia anterior.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    if (!text) throw new Error("A IA não retornou nenhum conteúdo.");

    const cleanedText = cleanJson(text);
    const resultJson = JSON.parse(cleanedText);
    
    if (resultJson.schedule) {
      resultJson.schedule = enforceRevisions(resultJson.schedule);
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
      goal: goal,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };
  } catch (error) {
    console.error("Erro ao gerar plano de estudos:", error);
    throw error;
  }
};

export const generateFlashcardsFromMultimodal = async (
  parts: any[],
  contentName: string
) => {
  if (!ai) {
    console.error("Gemini: Tentativa de gerar flashcards sem chave configurada.");
    throw new Error("A inteligência artificial não está configurada. Verifique se a chave VITE_GEMINI_API_KEY foi adicionada no Vercel e se você fez um Redeploy.");
  }

  try {
    console.log(`Gemini: Iniciando geração de flashcards para "${contentName}" com o modelo ${GEMINI_MODEL}`);
    const model = ai.getGenerativeModel({ 
      model: GEMINI_MODEL,
      systemInstruction: `Você é um especialista em memorização e concursos. Sua tarefa é analisar o conteúdo fornecido e gerar exatamente 20 flashcards detalhados e variados.
      
      O nome do conteúdo é: "${contentName}".
      
      Cada flashcard deve ter uma pergunta instigante e uma resposta clara e completa.
      IMPORTANTE: A resposta deve OBRIGATORIAMENTE concluir com um exemplo prático ou uma aplicação real do conceito.
      DESTAQUE: Nos exemplos citados, coloque em negrito (usando markdown **) o termo ou conceito principal que está sendo estudado.
      ATENÇÃO: NÃO inclua classificações de dificuldade (como "fácil", "médio", "difícil"). O campo 'subject' deve conter apenas o nome da disciplina (ex: Direito Penal).
      
      Retorne os dados estritamente no formato JSON:
      {
        "flashcards": [
          { "question": "...", "answer": "...", "subject": "..." }
        ]
      }`,
    });

    const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
    const response = await result.response;
    const text = response.text();

    if (!text) throw new Error("A IA não retornou conteúdo.");
    
    let cleanedText = cleanJson(text);
    
    try {
      const parsed = JSON.parse(cleanedText);
      if (parsed.flashcards && Array.isArray(parsed.flashcards)) {
        return parsed.flashcards;
      }
      if (Array.isArray(parsed)) {
        return parsed;
      }
      throw new Error("Formato de resposta inesperado.");
    } catch (parseError) {
      console.warn("Falha no parse inicial, tentando extração manual...", cleanedText);
      const flashcardsMatch = cleanedText.match(/"flashcards"\s*:\s*(\[[\s\S]*?\])/);
      if (flashcardsMatch) {
        try {
          return JSON.parse(flashcardsMatch[1]);
        } catch (e) {
          throw new Error("Não foi possível extrair os flashcards da resposta.");
        }
      }
      throw new Error("Erro ao processar a resposta da IA.");
    }
  } catch (error: any) {
    console.error("Erro ao gerar flashcards multimodais:", error);
    
    // Tratamento específico para erro 403 do Google
    if (error.message?.includes("403") || error.message?.includes("PERMISSION_DENIED") || error.message?.includes("denied access")) {
      throw new Error("O Google negou o acesso (Erro 403). Isso geralmente significa que sua Chave de API expirou ou o projeto no Google Cloud foi restrito. Por favor, gere uma NOVA chave no Google AI Studio (aistudio.google.com), atualize na Vercel e faça um REDEPLOY.");
    }
    
    throw new Error(error.message || "Erro desconhecido ao gerar flashcards.");
  }
};

export const analyzeContent = async (content: string, type: 'text' | 'pdf' | 'video' | 'link') => {
  if (!ai) {
    throw new Error("A inteligência artificial não está configurada. Verifique se a chave VITE_GEMINI_API_KEY foi adicionada no Vercel e se você fez um Redeploy.");
  }

  try {
    const model = ai.getGenerativeModel({ 
      model: GEMINI_MODEL,
      systemInstruction: "Você é um assistente de estudos. Sua tarefa é resumir conteúdos e extrair tópicos principais para facilitar o aprendizado. Retorne APENAS o JSON.",
    });

    const result = await model.generateContent(content.substring(0, 30000));
    const response = await result.response;
    const text = response.text();

    if (!text) throw new Error("A IA não retornou conteúdo.");
    return JSON.parse(cleanJson(text));
  } catch (error) {
    console.error("Erro ao analisar conteúdo:", error);
    throw error;
  }
};
