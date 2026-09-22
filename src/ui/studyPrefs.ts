import type { StudyDirection } from '../types';

export type StudyMode = 'flip' | 'type' | 'quiz' | 'dictation' | 'cloze';

export interface StudyPrefs {
  direction: StudyDirection;
  mode: StudyMode;
}

/** Konfiguracja bieżącej sesji nauki – ustawiana na ekranie wyboru, ważna w pamięci na czas działania aplikacji. */
export const studyPrefs: StudyPrefs = {
  direction: 'en-pl',
  mode: 'flip'
};
