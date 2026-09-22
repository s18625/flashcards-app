import { describe, expect, it } from 'vitest';
import { cardMatchesQuery, searchCards } from './search';
import type { Card } from '../types';

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'c1',
    deckId: 'd1',
    word: 'spoon',
    translation: 'łyżka',
    example: 'Pass me the spoon.',
    partOfSpeech: 'noun',
    note: '',
    createdAt: 1,
    updatedAt: 1,
    srs: { repetitions: 0, easeFactor: 2.5, intervalDays: 0, dueDate: 1, lastReviewedAt: null },
    ...overrides
  };
}

describe('cardMatchesQuery', () => {
  it('matches by word', () => {
    expect(cardMatchesQuery(makeCard({ word: 'ambitious' }), 'ambit')).toBe(true);
  });

  it('matches by translation', () => {
    expect(cardMatchesQuery(makeCard({ translation: 'ambitny' }), 'bitny')).toBe(true);
  });

  it('matches by example sentence', () => {
    expect(cardMatchesQuery(makeCard({ example: 'She is very ambitious.' }), 'very ambitious')).toBe(true);
  });

  it('matches by note', () => {
    expect(cardMatchesQuery(makeCard({ note: 'mylę z ambient' }), 'ambient')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(cardMatchesQuery(makeCard({ word: 'Spoon' }), 'SPOON')).toBe(true);
    expect(cardMatchesQuery(makeCard({ word: 'spoon' }), 'Spoon')).toBe(true);
  });

  it('does not match unrelated text', () => {
    expect(cardMatchesQuery(makeCard({ word: 'spoon', translation: 'łyżka', example: '', note: '' }), 'widelec')).toBe(false);
  });

  it('returns false for an empty or whitespace-only query', () => {
    expect(cardMatchesQuery(makeCard(), '')).toBe(false);
    expect(cardMatchesQuery(makeCard(), '   ')).toBe(false);
  });
});

describe('searchCards', () => {
  const cards = [
    makeCard({ id: 'c1', word: 'spoon', translation: 'łyżka' }),
    makeCard({ id: 'c2', word: 'fork', translation: 'widelec', example: 'Pass me the fork.' }),
    makeCard({ id: 'c3', word: 'spoonful', translation: 'łyżeczka', example: '' })
  ];

  it('returns all cards matching the query across word/translation/example/note', () => {
    const results = searchCards(cards, 'spoon');
    expect(results.map((c) => c.id).sort()).toEqual(['c1', 'c3']);
  });

  it('returns an empty array for an empty query instead of every card', () => {
    expect(searchCards(cards, '')).toEqual([]);
    expect(searchCards(cards, '   ')).toEqual([]);
  });

  it('returns an empty array when nothing matches', () => {
    expect(searchCards(cards, 'nieistniejące słowo xyz')).toEqual([]);
  });
});
