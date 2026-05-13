export interface User {
  id: string;
  name: string;
  surname: string;
  cpf?: string;
  whatsapp?: string;
  email: string;
  avatar?: string;
  enrolledContest?: string;
  paymentMethod?: string;
  role?: 'user' | 'admin';
}

export interface StudyPlan {
  id: string;
  title: string;
  goal: string;
  startDate: string;
  endDate: string;
  schedule: DaySchedule[];
  examDate?: string;
  notices?: string[]; // Content of the notices analyzed
}

export interface DaySchedule {
  day: string;
  topics: Topic[];
}

export interface Topic {
  id: string;
  title: string;
  subject: string;
  duration: number; // planned duration in minutes
  completed: boolean;
  startTime?: string;
  endTime?: string;
  actualDuration?: number; // in minutes
  completedAt?: string; // ISO date string when it was marked as completed
  type: 'study' | 'revision';
  videoUrl?: string;
  theoryCompleted?: boolean;
  revisions?: boolean[]; // [1st, 2nd, 3rd, 4th, 5th, 6th]
  performance?: number; // 0 to 100
}

export interface Flashcard {
  id: string | number;
  question?: string;
  answer?: string;
  frente?: string; // Support for alternate naming
  verso?: string;  // Support for alternate naming
  subject?: string;
  disciplina?: string; // Support for alternate naming
  assunto?: string;    // Support for alternate naming
  lastReviewed?: string;
  nextReview?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  nivel?: Nivel;       // Support for alternate naming
  tags?: string[];
  // SRS fields
  interval?: number; // in days
  easeFactor?: number;
  repetitions?: number;
}

export interface ProgressData {
  date: string;
  completedTopics: number;
  accuracy: number;
}

export interface ExamNotice {
  id: string;
  name: string;
  content: string;
  subjects: Subject[];
  examDate?: string;
  hasPlanoVertical?: boolean;
  hasCalendario?: boolean;
}

export interface Subject {
  name: string;
  weight: number; // 1 to 5
  importance: 'low' | 'medium' | 'high';
  topics?: string[]; // The full content of the discipline (topics list)
  progress?: number; // 0 to 100
}

export interface ContentItem {
  id: string;
  uid: string;
  title: string;
  type: 'pdf' | 'text' | 'video' | 'link' | 'questionBank' | 'flashcardDeck';
  content: string; // fileUrl for pdf, rich text for text, youtube link for video, or JSON string for questionBank
  subject: string;
  subCategory?: string; // e.g., Professor name, sub-topic
  createdAt: string;
  summary?: string;
  topics?: string[];
  banca?: string;
  bancaCharacteristics?: string;
  contest?: string;
}

export interface MindMapData {
  id: string;
  label: string;
  description?: string;
  children?: MindMapData[];
  icon?: string;
}

export interface SavedMindMap {
  id: string;
  uid: string;
  title: string;
  data: MindMapData;
  createdAt: string;
}

export type TipoQuestao = "multipla_escolha" | "certo_errado";
export type Nivel = "facil" | "medio" | "dificil";

export interface Alternativa {
  letra: string;
  texto: string;
  correta: boolean;
  analise: string;
}

export interface Questao {
  id: number;
  disciplina: string;
  assunto: string;
  concurso: string;
  banca: string;
  ano: number;
  nivel: Nivel;
  tipo: TipoQuestao;
  enunciado: string;
  alternativas: Alternativa[];
  gabarito: string;
  comentario: string;
  tags: string[];
}

export interface SavedQuestionBank {
  id: string;
  uid: string;
  title: string;
  subject: string;
  questions: Questao[];
  createdAt: string;
}
