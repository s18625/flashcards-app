import { describe, expect, it } from 'vitest';
import { selectDifficultCards } from './difficult';
import type { Card, ReviewGrade, ReviewLog } from '../types';

function makeCard(id: string): Card {
  return {
    id,
    deckId: 'd1',
    word: id,
    translation: id,
    example: '',
    partOfSpeech: '',
    note: '',
    createdAt: 1,
    updatedAt: 1,
    srs: { repetitions: 0, easeFactor: 2.5, intervalDays: 0, dueDate: 1, lastReviewedAt: null }
  };
}

let logCounter = 0;
function makeLog(cardId: string, grade: ReviewGrade): ReviewLog {
  logCounter += 1;
  return { id: `log${logCounter}`, cardId, deckId: 'd1', reviewedAt: logCounter, grade, direction: 'en-pl', correct: grade !== 'again' };
}

describe('selectDifficultCards', () => {
  it('excludes cards with no review history at all', () => {
    const cards = [makeCard('c1')];
    expect(selectDifficultCards(cards, [])).toEqual([]);
  });

  it('excludes a card below the minimum review count even with an "again" grade', () => {
    const cards = [makeCard('c1')];
    const logs = [makeLog('c1', 'again')];
    expect(selectDifficultCards(cards, logs)).toEqual([]);
  });

  it('includes a card with 1 again out of 2 reviews (score 0.5 >= default 0.34)', () => {
    const cards = [makeCard('c1')];
    const logs = [makeLog('c1', 'again'), makeLog('c1', 'good')];
    expect(selectDifficultCards(cards, logs).map((c) => c.id)).toEqual(['c1']);
  });

  it('excludes a card whose reviews are all "good"/"easy" (score 0)', () => {
    const cards = [makeCard('c1')];
    const logs = [makeLog('c1', 'good'), makeLog('c1', 'easy'), makeLog('c1', 'good')];
    expect(selectDifficultCards(cards, logs)).toEqual([]);
  });

  it('weighs "hard" at half of "again" and excludes a card that stays below the threshold', () => {
    const cards = [makeCard('c1')];
    // score = (0.5 + 0.5) / 4 = 0.25, below default minScore 0.34
    const logs = [makeLog('c1', 'hard'), makeLog('c1', 'hard'), makeLog('c1', 'good'), makeLog('c1', 'easy')];
    expect(selectDifficultCards(cards, logs)).toEqual([]);
  });

  it('includes a card that crosses the threshold purely from "hard" grades', () => {
    const cards = [makeCard('c1')];
    // score = (0.5 + 0.5) / 2 = 0.5, above default minScore 0.34
    const logs = [makeLog('c1', 'hard'), makeLog('c1', 'hard')];
    expect(selectDifficultCards(cards, logs).map((c) => c.id)).toEqual(['c1']);
  });

  it('sorts results from most to least difficult', () => {
    const cards = [makeCard('easy-ish'), makeCard('hardest'), makeCard('medium')];
    const logs = [
      ...['easy-ish'].flatMap((id) => [makeLog(id, 'again'), makeLog(id, 'good'), makeLog(id, 'good')]), // score 1/3
      ...['hardest'].flatMap((id) => [makeLog(id, 'again'), makeLog(id, 'again')]), // score 2/2 = 1
      ...['medium'].flatMap((id) => [makeLog(id, 'again'), makeLog(id, 'good')]) // score 1/2
    ];
    const result = selectDifficultCards(cards, logs, { minScore: 0.3 });
    expect(result.map((c) => c.id)).toEqual(['hardest', 'medium', 'easy-ish']);
  });

  it('respects a custom limit', () => {
    const cards = [makeCard('c1'), makeCard('c2'), makeCard('c3')];
    const logs = cards.flatMap((c) => [makeLog(c.id, 'again'), makeLog(c.id, 'again')]);
    const result = selectDifficultCards(cards, logs, { limit: 2 });
    expect(result).toHaveLength(2);
  });

  it('respects custom minReviews and minScore overrides', () => {
    const cards = [makeCard('c1')];
    const logs = [makeLog('c1', 'again')];
    expect(selectDifficultCards(cards, logs, { minReviews: 1 })).toHaveLength(1);
    expect(selectDifficultCards(cards, logs, { minReviews: 1, minScore: 1.1 })).toEqual([]);
  });
});
