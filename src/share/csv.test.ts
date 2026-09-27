import { describe, expect, it } from 'vitest';
import { cardsToCsv, cardsToCsvWithDeck, parseCsvToCards } from './csv';
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

describe('cardsToCsvWithDeck', () => {
  it('prefixes each row with a deck column and can be parsed back by the plain card parser', () => {
    const rows = [
      { deckName: 'Kuchnia', card: { word: 'spoon', translation: 'łyżka', example: '', partOfSpeech: 'noun' as const, note: '' } },
      { deckName: 'Podróże', card: { word: 'airport', translation: 'lotnisko', example: '', partOfSpeech: 'noun' as const, note: '' } }
    ];
    const csv = cardsToCsvWithDeck(rows);
    expect(csv.split('\r\n')[0]).toBe('deck,word,translation,example,partOfSpeech,note');

    // parseCsvToCards ignores the unrecognized leading "deck" column but still recovers every card correctly.
    const parsed = parseCsvToCards(csv);
    expect(parsed).toEqual(rows.map((r) => r.card));
  });

  it('escapes deck names containing commas or quotes just like any other field', () => {
    const rows = [{ deckName: 'Praca, "ważne"', card: { word: 'cat', translation: 'kot', example: '', partOfSpeech: '' as const, note: '' } }];
    const csv = cardsToCsvWithDeck(rows);
    expect(csv.split('\r\n')[1]).toBe('"Praca, ""ważne""",cat,kot,,,');
  });

  it('produces just the header row for an empty list', () => {
    expect(cardsToCsvWithDeck([])).toBe('deck,word,translation,example,partOfSpeech,note');
  });
});
