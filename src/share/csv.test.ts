import { describe, expect, it } from 'vitest';
import { cardsToCsv, parseCsvToCards } from './csv';
import { ShareValidationError } from './share';

describe('cardsToCsv / parseCsvToCards round-trip', () => {
  it('round-trips cards including commas, quotes and newlines in fields', () => {
    const cards = [
      { word: 'cat', translation: 'kot', example: 'The cat, a small animal, sleeps.', partOfSpeech: 'noun' as const, note: 'He said "meow"' },
      { word: 'run', translation: 'biec', example: 'Line one\nLine two', partOfSpeech: 'verb' as const, note: '' }
    ];
    const csv = cardsToCsv(cards);
    const parsed = parseCsvToCards(csv);
    expect(parsed).toEqual(cards);
  });
});

describe('parseCsvToCards - malformed input', () => {
  it('throws when the word column is missing', () => {
    expect(() => parseCsvToCards('translation,example\nkot,')).toThrow(ShareValidationError);
  });

  it('throws on an empty file', () => {
    expect(() => parseCsvToCards('')).toThrow(ShareValidationError);
  });

  it('skips rows with an empty word', () => {
    const parsed = parseCsvToCards('word,translation\n,pusty\ncat,kot');
    expect(parsed).toHaveLength(1);
    expect(parsed[0].word).toBe('cat');
  });

  it('falls back to an empty part of speech for unrecognized values', () => {
    const parsed = parseCsvToCards('word,partOfSpeech\ncat,not-a-real-pos');
    expect(parsed[0].partOfSpeech).toBe('');
  });

  it('handles a header-only file gracefully', () => {
    expect(parseCsvToCards('word,translation')).toEqual([]);
  });
});
