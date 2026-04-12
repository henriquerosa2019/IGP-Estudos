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
}

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  subject: string;
  lastReviewed?: string;
  nextReview?: string;
  difficulty: 'easy' | 'medium' | 'hard';
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
  type: 'pdf' | 'text' | 'video' | 'link';
  content: string; // fileUrl for pdf, rich text for text, youtube link for video
  subject: string;
  subCategory?: string; // e.g., Professor name, sub-topic
  createdAt: string;
  summary?: string;
  topics?: string[];
}
