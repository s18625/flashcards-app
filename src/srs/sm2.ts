import type { ReviewGrade, SrsState } from '../types';

/** Minimalna wartość współczynnika łatwości (E-Factor) w algorytmie SM-2. */
export const MIN_EASE_FACTOR = 1.3;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Karta oceniona jako "Nie pamiętam" wraca w tej samej sesji, nie dopiero za dzień. */
const AGAIN_RELEARN_MS = 10 * 60 * 1000;

/**
 * Mapowanie ocen UI (4 przyciski) na skalę jakości SM-2 (0-5).
 * "again" < 3 wymusza reset serii powtórek zgodnie z oryginalnym algorytmem.
 */
export function gradeToQuality(grade: ReviewGrade): number {
  switch (grade) {
    case 'again':
      return 0;
    case 'hard':
      return 3;
    case 'good':
      return 4;
    case 'easy':
      return 5;
    default:
      throw new Error(`Nieznana ocena: ${grade as string}`);
  }
}

/**
 * Oblicza kolejny stan SRS (SuperMemo-2) na podstawie oceny użytkownika.
 * Czysta funkcja: nie mutuje wejścia, ułatwia testowanie.
 */
export function nextSrsState(current: SrsState, grade: ReviewGrade, now: number = Date.now()): SrsState {
  const quality = gradeToQuality(grade);
  const { repetitions, easeFactor, intervalDays } = current;

  const rawEaseFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  const newEaseFactor = Math.max(MIN_EASE_FACTOR, roundTo(rawEaseFactor, 2));

  let newRepetitions: number;
  let newIntervalDays: number;

  if (quality < 3) {
    newRepetitions = 0;
    newIntervalDays = 0;
  } else {
    newRepetitions = repetitions + 1;
    if (newRepetitions === 1) {
      newIntervalDays = 1;
    } else if (newRepetitions === 2) {
      newIntervalDays = 6;
    } else {
      newIntervalDays = Math.max(1, Math.round(intervalDays * newEaseFactor));
    }
  }

  const dueDate = quality < 3 ? now + AGAIN_RELEARN_MS : now + newIntervalDays * MS_PER_DAY;

  return {
    repetitions: newRepetitions,
    easeFactor: newEaseFactor,
    intervalDays: newIntervalDays,
    dueDate,
    lastReviewedAt: now
  };
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function isDue(state: SrsState, now: number = Date.now()): boolean {
  return state.dueDate <= now;
}

export function isNewCard(state: SrsState): boolean {
  return state.repetitions === 0 && state.lastReviewedAt === null;
}
