import type { Card, ReviewLog } from '../types';

export interface DifficultOptions {
  /** Minimalna liczba powtórek karty, żeby w ogóle brać ją pod uwagę. */
  minReviews?: number;
  /** Minimalny ważony wskaźnik trudności (0–1), żeby karta się zakwalifikowała. */
  minScore?: number;
  /** Maksymalna liczba zwróconych kart. */
  limit?: number;
}

const DEFAULT_MIN_REVIEWS = 2;
const DEFAULT_MIN_SCORE = 0.34;
const DEFAULT_LIMIT = 50;

/**
 * Wybiera karty, które historycznie sprawiały trudność, na podstawie logu
 * powtórek: liczy ważony odsetek ocen „Nie pamiętam” (waga 1) i „Trudne”
 * (waga 0.5) wśród wszystkich powtórek danej karty i zwraca te, które mają
 * odpowiednio dużo powtórek oraz wystarczająco wysoki wskaźnik trudności –
 * posortowane od najtrudniejszej. Nowe, nigdy nie powtarzane karty nigdy się
 * nie kwalifikują (nie ma jeszcze na ich temat żadnego sygnału).
 */
export function selectDifficultCards(cards: Card[], logs: ReviewLog[], options: DifficultOptions = {}): Card[] {
  const minReviews = options.minReviews ?? DEFAULT_MIN_REVIEWS;
  const minScore = options.minScore ?? DEFAULT_MIN_SCORE;
  const limit = options.limit ?? DEFAULT_LIMIT;

  const statsByCard = new Map<string, { total: number; weighted: number }>();
  for (const log of logs) {
    const stats = statsByCard.get(log.cardId) ?? { total: 0, weighted: 0 };
    stats.total += 1;
    if (log.grade === 'again') stats.weighted += 1;
    else if (log.grade === 'hard') stats.weighted += 0.5;
    statsByCard.set(log.cardId, stats);
  }

  const scored: { card: Card; score: number }[] = [];
  for (const card of cards) {
    const stats = statsByCard.get(card.id);
    if (!stats || stats.total < minReviews) continue;
    const score = stats.weighted / stats.total;
    if (score >= minScore) scored.push({ card, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.card);
}
