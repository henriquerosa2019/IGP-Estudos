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
    const prompt = `Analise EXAUSTIVAMENTE os seguintes editais:
    ${notices.map(n => `Edital: ${n.name}\nConteúdo: ${n.content}`).join("\n\n")}
    
    Data prevista do concurso: ${examDate}.
    Tempo disponível: ${hoursPerDay} horas por dia.
    Data de início (hoje): ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}.
    
    Sua tarefa CRÍTICA:
    1. Mapeie ABSOLUTAMENTE TODOS os tópicos listados no conteúdo programático acima. Não resuma, não pule tópicos e não agrupe de forma que se perca o detalhamento.
    2. Crie um plano de estudos de LONGO PRAZO que cubra 100% do edital. Se o edital for grande, gere um plano de 60, 90, 120 ou mais dias.
    3. O plano deve ser sequencial (Dia 1, Dia 2, Dia 3...).
    4. OBRIGATÓRIO: Cada dia de estudo deve conter EXATAMENTE 2 tópicos novos (type: 'study'). Divida o conteúdo para caber em 2 tópicos por dia.
    5. OBRIGATÓRIO: O primeiro item de estudo de cada dia (a partir do Dia 2) DEVE SER uma "Revisão" (type: "revision") das 2 matérias estudadas no dia anterior.
    6. O campo 'day' deve conter o número do dia, o dia da semana e a data (ex: 'Dia 1 (Segunda, 06/04)', 'Dia 2 (Terça, 07/04)'). Calcule as datas corretamente a partir de hoje.
    7. NÃO pare de gerar até que TODO o conteúdo programático tenha sido incluído no cronograma.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "Você é um especialista em concursos. Sua prioridade absoluta é a COBERTURA TOTAL (100%) do edital. Você deve gerar um plano extenso, detalhado e sequencial. Nunca resuma o conteúdo. Retorne APENAS o JSON. Use 'type': 'study' e 'type': 'revision'. O campo 'day' deve incluir o dia da semana e a data (ex: Dia 1 (Segunda, 06/04)).",
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

    if (!response.text) throw new Error("A IA não retornou conteúdo.");
    const result = JSON.parse(cleanJson(response.text));
    
    if (result.schedule) {
      result.schedule = enforceRevisions(result.schedule);
    }

    return {
      ...result,
      id: Date.now().toString(),
      goal: notices.map(n => n.name).join(" + "),
      examDate: examDate
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
      contents: `Analise o seguinte conteúdo de um edital de concurso e extraia as matérias principais com seu peso/importância sugerida e a lista de tópicos detalhados de cada matéria.
      
      CONTEÚDO DO EDITAL:
      ${content}
      
      INSTRUÇÕES:
      1. Identifique a BANCA EXAMINADORA (ex: Cebraspe, FGV, FCC, Vunesp) se estiver mencionada. Se não, use o padrão geral.
      2. Identifique cada disciplina (ex: Português, Matemática, etc).
      3. Para CADA disciplina, extraia TODOS os tópicos listados no conteúdo programático.
      4. Não resuma os tópicos. Se o edital diz "1. Ortografia oficial. 2. Acentuação gráfica.", extraia exatamente esses itens.
      5. Atribua um peso de 1 a 5 baseado na relevância comum para concursos e no histórico de cobrança da banca identificada.`,
      config: {
        systemInstruction: "Você é um especialista em editais de concursos e bancas examinadoras. Sua tarefa é decompor o conteúdo programático em matérias e tópicos detalhados, ajustando a importância (peso) com base no perfil da banca. Retorne APENAS o JSON. Seja exaustivo na extração dos tópicos.",
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
      model: "gemini-3-flash-preview",
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
    }

    return {
      ...result,
      id: Date.now().toString(),
      goal: goal
    };
  } catch (error) {
    console.error("Erro ao gerar plano de estudos:", error);
    if (error instanceof Error) {
      throw new Error(`Falha ao gerar plano: ${error.message}`);
    }
    throw new Error("Ocorreu um erro inesperado ao gerar o plano de estudos.");
  }
};

export const generateFlashcards = async (topic: string) => {
  if (!ai) throw new Error("A chave da API do Gemini não foi configurada.");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Gere exatamente 20 flashcards detalhados e variados sobre o tópico: "${topic}". 
      Cada flashcard deve ter uma pergunta instigante e uma resposta clara e completa.
      IMPORTANTE: A resposta deve OBRIGATORIAMENTE concluir com um exemplo prático ou uma aplicação real do conceito.
      DESTAQUE: Nos exemplos citados, coloque em negrito (usando markdown **) o termo ou conceito principal que está sendo estudado (ex: **há**, **mal**, **mau**).
      Retorne APENAS o JSON.`,
      config: {
        systemInstruction: "Você é um especialista em memorização e concursos. Crie flashcards eficazes (pergunta/resposta) para ajudar no aprendizado de longo prazo. Use linguagem simples e direta. Certifique-se de que toda resposta termine com um exemplo prático e que o termo estudado esteja em negrito dentro do exemplo. Retorne APENAS o JSON conforme o esquema solicitado.",
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
                  subject: { type: Type.STRING },
                  difficulty: { type: Type.STRING, enum: ["easy", "medium", "hard"] }
                },
                required: ["question", "answer", "subject", "difficulty"]
              }
            }
          },
          required: ["flashcards"]
        }
      }
    });

    if (!response.text) throw new Error("A IA não retornou conteúdo.");
    return JSON.parse(cleanJson(response.text)).flashcards;
  } catch (error) {
    console.error("Erro ao gerar flashcards:", error);
    throw error;
  }
};
