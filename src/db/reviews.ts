import { getDb, newId } from './db';
import type { ReviewGrade, ReviewLog, StudyDirection } from '../types';

export async function logReview(
  cardId: string,
  deckId: string,
  grade: ReviewGrade,
  direction: StudyDirection
): Promise<ReviewLog> {
  const db = await getDb();
  const log: ReviewLog = {
    id: newId(),
    cardId,
    deckId,
    reviewedAt: Date.now(),
    grade,
    direction,
    correct: grade !== 'again'
  };
  await db.put('reviewLogs', log);
  return log;
}

export async function getReviewsSince(sinceMs: number): Promise<ReviewLog[]> {
  const db = await getDb();
  const range = IDBKeyRange.lowerBound(sinceMs);
  return db.getAllFromIndex('reviewLogs', 'by-reviewedAt', range);
}

export async function getAllReviews(): Promise<ReviewLog[]> {
  const db = await getDb();
  return db.getAll('reviewLogs');
}

export async function countReviewsToday(): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const logs = await getReviewsSince(startOfDay.getTime());
  return logs.length;
}

/** Liczba kart, których pierwsza w historii powtórka miała miejsce dzisiaj. */
export async function countNewCardsStudiedToday(): Promise<number> {
  const all = await getAllReviews();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startMs = startOfDay.getTime();

  const firstReviewByCard = new Map<string, number>();
  for (const log of all) {
    const prev = firstReviewByCard.get(log.cardId);
    if (prev === undefined || log.reviewedAt < prev) {
      firstReviewByCard.set(log.cardId, log.reviewedAt);
    }
  }

  let count = 0;
  for (const firstReviewedAt of firstReviewByCard.values()) {
    if (firstReviewedAt >= startMs) count += 1;
  }
  return count;
}

/** Liczy kolejne dni z co najmniej jedną powtórką (wliczając dziś), wstecz od dziś. */
export async function computeStreak(): Promise<number> {
  const logs = await getAllReviews();
  if (logs.length === 0) return 0;
  const days = new Set(
    logs.map((l) => {
      const d = new Date(l.reviewedAt);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })
  );
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  // Jeśli dzisiaj nie było jeszcze powtórki, streak liczymy od wczoraj wstecz.
  if (!days.has(cursor.getTime())) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(cursor.getTime())) return 0;
  }
  while (days.has(cursor.getTime())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
