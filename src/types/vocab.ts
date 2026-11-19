export type PracticeMode = 'listen' | 'speak' | 'write' | 'quiz';

export type MobileView = PracticeMode | 'words';

export type ArticleGender = 'der' | 'die' | 'das' | 'plural' | null;

export interface VocabWord {
  id: string;
  de: string;
  sp: string;
  ex: string;
  en: string;
  bn: string;
  kap: string;
  sec: string;
  gender: ArticleGender;
  targets: string[];
}

export interface VocabLevel {
  level: number;
  title: string;
  words: VocabWord[];
}

export type VocabMap = Record<number, VocabLevel>;

export interface CustomVocabInput {
  de: string;
  en?: string;
  bn?: string;
  level?: number;
}
