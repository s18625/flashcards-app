// Współdzielone typy domenowe aplikacji.

export interface Deck {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
}

export type PartOfSpeech =
  | 'noun'
  | 'verb'
  | 'adjective'
  | 'adverb'
  | 'phrase'
  | 'other';

export interface SrsState {
  /** Liczba kolejnych poprawnych powtórek (SM-2 "n"). */
  repetitions: number;
  /** Współczynnik łatwości SM-2 (E-Factor), min. 1.3. */
  easeFactor: number;
  /** Bieżący odstęp w dniach do następnej powtórki. */
  intervalDays: number;
  /** Znacznik czasu (ms) kiedy karta ma być powtórzona. */
  dueDate: number;
  /** Znacznik czasu (ms) ostatniej powtórki, jeśli była. */
  lastReviewedAt: number | null;
}

export interface Card {
  id: string;
  deckId: string;
  word: string;
  translation: string;
  example: string;
  partOfSpeech: PartOfSpeech | '';
  note: string;
  createdAt: number;
  updatedAt: number;
  srs: SrsState;
}

/** Ocena użytkownika podczas powtórki, mapowana na jakość SM-2. */
export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy';

export type StudyDirection = 'en-pl' | 'pl-en';

export interface ReviewLog {
  id: string;
  cardId: string;
  deckId: string;
  reviewedAt: number;
  grade: ReviewGrade;
  direction: StudyDirection;
  correct: boolean;
}

export type OcrMethod = 'tesseract' | 'vision-api';

export interface AppSettings {
  id: 'settings';
  theme: 'light' | 'dark' | 'system';
  ocrMethod: OcrMethod;
  visionApiKey: string;
  visionApiEndpoint: string;
  visionApiModel: string;
  dailyNewCardsLimit: number;
  dailyReviewLimit: number;
  ttsVoiceLang: 'en-US' | 'en-GB';
  ttsEnabled: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'settings',
  theme: 'system',
  ocrMethod: 'tesseract',
  visionApiKey: '',
  visionApiEndpoint: 'https://api.anthropic.com/v1/messages',
  visionApiModel: 'claude-haiku-4-5',
  dailyNewCardsLimit: 20,
  dailyReviewLimit: 100,
  ttsVoiceLang: 'en-US',
  ttsEnabled: true
};

/** Format wymiany talii (udostępnianie bez backendu). */
export interface ShareCardPayload {
  word: string;
  translation: string;
  example: string;
  partOfSpeech: PartOfSpeech | '';
  note: string;
}

export interface SharePayload {
  formatVersion: 1;
  deckName: string;
  deckDescription: string;
  cards: ShareCardPayload[];
  exportedAt: number;
}
