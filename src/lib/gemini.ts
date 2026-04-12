import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

export const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

if (!ai) {
  console.warn("GEMINI_API_KEY is not defined. AI features will not work.");
}

const cleanJson = (text: string) => {
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  return match ? match[0] : text;
};

const enforceRevisions = (schedule: any[]) => {
  if (!schedule || !Array.isArray(schedule)) return schedule;
  
  for (let i = 1; i < schedule.length; i++) {
    // Pegar apenas os tópicos de estudo do dia anterior (limitado a 2)
    const previousDayTopics = schedule[i - 1].topics?.filter((t: any) => t.type === 'study') || [];
    
    // Pegar apenas os tópicos de estudo do dia atual (remover revisões geradas pela IA para forçar a ordem)
    const currentDayStudies = schedule[i].topics?.filter((t: any) => t.type === 'study') || [];

    const revisionsToAdd = previousDayTopics.slice(0, 2).map((prevTopic: any) => ({
      title: `Revisão: ${prevTopic.title}`,
      subject: prevTopic.subject,
      duration: 15,
      type: 'revision'
    }));

    // Forçar a estrutura exata: 2 revisões primeiro, depois os 2 estudos do dia
    schedule[i].topics = [...revisionsToAdd, ...currentDayStudies.slice(0, 2)];
  }
  return schedule;
};

export const generateStudyPlanFromNotices = async (
  notices: { name: string; content: string }[],
  examDate: string,
  hoursPerDay: number
) => {
  if (!ai) throw new Error("A chave da API do Gemini não foi configurada.");

  try {
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

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: prompt,
      config: {
        systemInstruction: "Você é um especialista em concursos. Sua prioridade absoluta é a COBERTURA TOTAL (100%) do edital. Você deve gerar um plano extenso, detalhado e sequencial. Nunca resuma o conteúdo. Retorne APENAS o JSON. Se houver links de vídeo no conteúdo, preserve-os no campo videoUrl. Use 'type': 'study' e 'type': 'revision'. O campo 'day' deve incluir o dia da semana e a data (ex: Dia 1 (Segunda, 06/04)).",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Título do plano (ex: Unificado PM RJ + PRF)" },
            schedule: {
              type: Type.ARRAY,
              description: "Lista sequencial de dias de estudo (Dia 1, Dia 2, ..., Dia N) cobrindo todo o edital.",
              items: {
                type: Type.OBJECT,
                properties: {
                  day: { type: Type.STRING, description: "Identificador do dia (ex: 'Dia 1', 'Dia 2')" },
                  topics: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        subject: { type: Type.STRING },
                        duration: { type: Type.NUMBER },
                        type: { type: Type.STRING, enum: ["study", "revision"] },
                        videoUrl: { type: Type.STRING }
                      },
                      required: ["title", "subject", "duration", "type"]
                    }
                  }
                },
                required: ["day", "topics"]
              }
            }
          },
          required: ["title", "schedule"]
        }
      }
    });

    if (!response.text) throw new Error("A IA não retornou conteúdo.");
    const result = JSON.parse(cleanJson(response.text));
    
    if (result.schedule) {
      result.schedule = enforceRevisions(result.schedule);
      // Ensure each topic has an ID and completed status
      result.schedule.forEach((day: any) => {
        day.topics.forEach((topic: any) => {
          topic.id = Math.random().toString(36).substring(2, 11);
          topic.completed = false;
          // Fix relative Hotmart links
          if (topic.videoUrl && topic.videoUrl.startsWith('/')) {
            topic.videoUrl = `https://hotmart.com${topic.videoUrl}`;
          }
        });
      });
    }

    const startDate = new Date();
    const totalDays = result.schedule?.length || 30;
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + totalDays);

    return {
      ...result,
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
  if (!ai) throw new Error("A chave da API do Gemini não foi configurada.");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: `Analise o seguinte conteúdo de um edital de concurso ou cronograma de curso e extraia as matérias principais com seu peso/importância sugerida e a lista de tópicos detalhados de cada matéria.
      
      CONTEÚDO:
      ${content}
      
      INSTRUÇÕES CRÍTICAS:
      1. Identifique cada disciplina ou módulo (ex: Português, Direito Penal, Informática).
      2. Para CADA disciplina, extraia TODOS os tópicos listados. 
      3. IMPORTANTE: Se o conteúdo estiver estruturado como aulas (ex: "Aula 01 - Parte 01 - Tópico"), você DEVE manter exatamente essa nomenclatura no título do tópico.
      4. TEMPOS DE AULA: Se houver tempos de duração (ex: 33:57, 40:06), você DEVE incluí-los no final do título do tópico entre parênteses. Exemplo: "Aula 01 - Parte 01 - Lei de drogas (33:57)".
      5. Capture a hierarquia: Se houver um nome de matéria seguido por várias aulas, agrupe essas aulas dentro dessa matéria.
      6. Não pule nenhum item.
      7. Atribua um peso de 1 a 5 baseado na relevância comum para concursos.`,
      config: {
        systemInstruction: "Você é um especialista em editais e cronogramas de cursos. Sua tarefa é decompor o conteúdo em matérias e tópicos detalhados, PRESERVANDO INTEGRALMENTE a nomenclatura original das aulas e INCLUINDO os tempos de duração se disponíveis. Retorne APENAS o JSON. Seja exaustivo.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subjects: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  weight: { type: Type.NUMBER, description: "Peso de 1 a 5" },
                  importance: { type: Type.STRING, enum: ["low", "medium", "high"] },
                  topics: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Lista exaustiva de tópicos desta matéria"
                  }
                },
                required: ["name", "weight", "importance", "topics"]
              }
            }
          },
          required: ["subjects"]
        }
      }
    });

    if (!response.text) throw new Error("A IA não retornou conteúdo.");
    return JSON.parse(cleanJson(response.text)).subjects;
  } catch (error) {
    console.error("Erro ao extrair matérias:", error);
    throw error;
  }
};
export const generateStudyPlan = async (goal: string, subjects: string[], hoursPerDay: number) => {
  if (!ai) throw new Error("A chave da API do Gemini não foi configurada.");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: `Crie um plano de estudos detalhado para o objetivo: "${goal}". 
      Matérias de foco: ${subjects.join(", ")}. 
      Tempo disponível: ${hoursPerDay} horas por dia. 
      Data de início (hoje): ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}.
      Sua tarefa CRÍTICA:
      1. Mapeie ABSOLUTAMENTE TODOS os tópicos das matérias citadas. Não resuma.
      2. O plano deve ser organizado por dias sequenciais e incluir o dia da semana e a data (ex: Dia 1 (Segunda, 06/04), Dia 2 (Terça, 07/04), etc.).
      3. O plano deve ser EXAUSTIVO o suficiente para cobrir TODO o conteúdo. NÃO se limite a uma semana ou um mês. Gere 30, 60 ou 90 dias se necessário.
      4. OBRIGATÓRIO: Cada dia de estudo deve conter EXATAMENTE 2 tópicos novos (type: 'study'). Divida o conteúdo para caber em 2 tópicos por dia.
      5. OBRIGATÓRIO: O primeiro item de estudo de cada dia (a partir do Dia 2) DEVE SER uma "Revisão" (type: "revision") das 2 matérias estudadas no dia anterior.`,
      config: {
        systemInstruction: "Você é um especialista em concursos. Sua prioridade absoluta é a COBERTURA TOTAL (100%) das matérias. Gere um plano extenso e detalhado. Nunca resuma. Retorne APENAS o JSON. Use 'type': 'study' e 'type': 'revision'. O campo 'day' deve incluir o dia da semana e a data (ex: Dia 1 (Segunda, 06/04)).",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Título do plano de estudos" },
            schedule: {
              type: Type.ARRAY,
              description: "Lista sequencial de dias de estudo (Dia 1, Dia 2, ..., Dia N) cobrindo todo o conteúdo.",
              items: {
                type: Type.OBJECT,
                properties: {
                  day: { type: Type.STRING, description: "Identificador do dia (ex: 'Dia 1', 'Dia 2')" },
                  topics: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING, description: "Título do tópico de estudo" },
                        subject: { type: Type.STRING, description: "Matéria relacionada" },
                        duration: { type: Type.NUMBER, description: "Duração em minutos" },
                        type: { type: Type.STRING, enum: ["study", "revision"] }
                      },
                      required: ["title", "subject", "duration", "type"]
                    }
                  }
                },
                required: ["day", "topics"]
              }
            }
          },
          required: ["title", "schedule"]
        }
      }
    });

    if (!response.text) {
      throw new Error("A IA não retornou nenhum conteúdo.");
    }

    const cleanedText = cleanJson(response.text);
    const result = JSON.parse(cleanedText);
    
    if (result.schedule) {
      result.schedule = enforceRevisions(result.schedule);
      // Ensure each topic has an ID and completed status
      result.schedule.forEach((day: any) => {
        day.topics.forEach((topic: any) => {
          topic.id = Math.random().toString(36).substring(2, 11);
          topic.completed = false;
          // Fix relative Hotmart links
          if (topic.videoUrl && topic.videoUrl.startsWith('/')) {
            topic.videoUrl = `https://hotmart.com${topic.videoUrl}`;
          }
        });
      });
    }

    const startDate = new Date();
    const totalDays = result.schedule?.length || 30;
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + totalDays);

    return {
      ...result,
      id: Date.now().toString(),
      goal: goal,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };
  } catch (error) {
    console.error("Erro ao gerar plano de estudos:", error);
    if (error instanceof Error) {
      throw new Error(`Falha ao gerar plano: ${error.message}`);
    }
    throw new Error("Ocorreu um erro inesperado ao gerar o plano de estudos.");
  }
};

export const generateFlashcardsFromMultimodal = async (
  parts: any[],
  contentName: string
) => {
  if (!ai) throw new Error("A chave da API do Gemini não foi configurada.");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: { parts },
      config: {
        systemInstruction: `Você é um especialista em memorização e concursos. Sua tarefa é analisar o conteúdo fornecido (que pode ser texto, imagens de livros/anotações, PDFs ou referências a vídeos) e gerar exatamente 20 flashcards detalhados e variados.
        
        O nome do conteúdo é: "${contentName}".
        
        Cada flashcard deve ter uma pergunta instigante e uma resposta clara e completa.
        IMPORTANTE: A resposta deve OBRIGATORIAMENTE concluir com um exemplo prático ou uma aplicação real do conceito.
        DESTAQUE: Nos exemplos citados, coloque em negrito (usando markdown **) o termo ou conceito principal que está sendo estudado.
        Retorne APENAS o JSON conforme o esquema solicitado.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            flashcards: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  answer: { type: Type.STRING },
                  subject: { type: Type.STRING }
                },
                required: ["question", "answer", "subject"]
              }
            }
          },
          required: ["flashcards"]
        }
      }
    });

    if (!response.text) throw new Error("A IA não retornou conteúdo.");
    const cleanedJson = cleanJson(response.text);
    try {
      const parsed = JSON.parse(cleanedJson);
      if (!parsed.flashcards || !Array.isArray(parsed.flashcards)) {
        throw new Error("O formato retornado pela IA é inválido.");
      }
      return parsed.flashcards;
    } catch (parseError) {
      console.error("Erro ao fazer parse do JSON:", cleanedJson);
      throw new Error("Erro ao processar a resposta da IA.");
    }
  } catch (error: any) {
    console.error("Erro ao gerar flashcards multimodais:", error);
    throw new Error(error.message || "Erro desconhecido ao gerar flashcards.");
  }
};

export const analyzeContent = async (content: string, type: 'text' | 'pdf' | 'video' | 'link') => {
  if (!ai) throw new Error("A chave da API do Gemini não foi configurada.");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: `Analise o seguinte conteúdo (${type}) e gere um resumo executivo e uma lista dos tópicos principais abordados.
      
      CONTEÚDO:
      ${content.substring(0, 30000)} // Limit content size
      
      Retorne APENAS o JSON.`,
      config: {
        systemInstruction: "Você é um assistente de estudos. Sua tarefa é resumir conteúdos e extrair tópicos principais para facilitar o aprendizado. Retorne APENAS o JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: "Resumo do conteúdo" },
            topics: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Lista de tópicos principais"
            },
            suggestedSubject: { type: Type.STRING, description: "Sugestão de disciplina (ex: Direito Penal, Português)" }
          },
          required: ["summary", "topics", "suggestedSubject"]
        }
      }
    });

    if (!response.text) throw new Error("A IA não retornou conteúdo.");
    return JSON.parse(cleanJson(response.text));
  } catch (error) {
    console.error("Erro ao analisar conteúdo:", error);
    throw error;
  }
};
