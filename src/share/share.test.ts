import { describe, expect, it } from 'vitest';
import {
  buildShareFile,
  buildShareUrl,
  dedupeAgainstExisting,
  decodePayloadFromCompressed,
  encodeSharePayload,
  extractShareHashFromUrl,
  parseJsonPayload,
  QR_SAFE_LENGTH,
  SHARE_FORMAT_VERSION,
  serializeDeckForSharing,
  ShareValidationError,
  validateSharePayload
} from './share';
import type { Card, Deck, SharePayload } from '../types';

function makeDeck(overrides: Partial<Deck> = {}): Deck {
  return { id: 'd1', name: 'Kuchnia', description: 'Słówka kuchenne', createdAt: 1, updatedAt: 1, ...overrides };
}

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

describe('serializeDeckForSharing', () => {
  it('never includes progress/srs fields, only card content', () => {
    const payload = serializeDeckForSharing(makeDeck(), [makeCard()]);
    expect(payload.formatVersion).toBe(SHARE_FORMAT_VERSION);
    expect(payload.cards[0]).toEqual({
      word: 'spoon',
      translation: 'łyżka',
      example: 'Pass me the spoon.',
      partOfSpeech: 'noun',
      note: ''
    });
    expect(JSON.stringify(payload)).not.toContain('easeFactor');
    expect(JSON.stringify(payload)).not.toContain('repetitions');
  });
});

describe('encode/decode round-trip', () => {
  it('round-trips a payload through compression and URL hash', () => {
    const payload = serializeDeckForSharing(makeDeck(), [makeCard(), makeCard({ id: 'c2', word: 'fork', translation: 'widelec' })]);
    const url = buildShareUrl(payload);
    const hash = extractShareHashFromUrl(url);
    expect(hash).not.toBeNull();
    const decoded = decodePayloadFromCompressed(hash!);
    expect(decoded.deckName).toBe('Kuchnia');
    expect(decoded.cards).toHaveLength(2);
    expect(decoded.cards.map((c) => c.word)).toEqual(['spoon', 'fork']);
  });

  it('round-trips through JSON file serialization', () => {
    const payload = serializeDeckForSharing(makeDeck(), [makeCard()]);
    const { filename, blob } = buildShareFile(payload);
    expect(filename).toBe('talia-kuchnia.json');
    expect(blob.type).toBe('application/json');
  });

  it('extractShareHashFromUrl returns null for URLs without the share prefix', () => {
    expect(extractShareHashFromUrl('https://example.com/app#other=xyz')).toBeNull();
    expect(extractShareHashFromUrl('https://example.com/app')).toBeNull();
  });
});

describe('validateSharePayload - malformed and malicious input', () => {
  it('rejects null, arrays, and primitives', () => {
    expect(() => validateSharePayload(null)).toThrow(ShareValidationError);
    expect(() => validateSharePayload([1, 2, 3])).toThrow(ShareValidationError);
    expect(() => validateSharePayload('hello')).toThrow(ShareValidationError);
    expect(() => validateSharePayload(42)).toThrow(ShareValidationError);
  });

  it('rejects an unsupported format version', () => {
    expect(() => validateSharePayload({ formatVersion: 2, deckName: 'x', cards: [] })).toThrow(ShareValidationError);
    expect(() => validateSharePayload({ deckName: 'x', cards: [] })).toThrow(ShareValidationError);
  });

  it('rejects a payload without a deck name', () => {
    expect(() => validateSharePayload({ formatVersion: 1, deckName: '', cards: [] })).toThrow(ShareValidationError);
    expect(() => validateSharePayload({ formatVersion: 1, cards: [] })).toThrow(ShareValidationError);
  });

  it('rejects a payload where cards is not an array', () => {
    expect(() => validateSharePayload({ formatVersion: 1, deckName: 'x', cards: 'not-an-array' })).toThrow(ShareValidationError);
    expect(() => validateSharePayload({ formatVersion: 1, deckName: 'x', cards: { word: 'x' } })).toThrow(ShareValidationError);
  });

  it('rejects decks with an excessive number of cards', () => {
    const cards = Array.from({ length: 2001 }, (_, i) => ({ word: `word${i}`, translation: 't' }));
    expect(() => validateSharePayload({ formatVersion: 1, deckName: 'x', cards })).toThrow(ShareValidationError);
  });

  it('strips angle brackets from text fields to prevent HTML injection', () => {
    const payload = validateSharePayload({
      formatVersion: 1,
      deckName: '<script>alert(1)</script>Talia',
      cards: [
        {
          word: '<img src=x onerror=alert(1)>cat',
          translation: '<b>kot</b>',
          example: '<svg onload=alert(1)>',
          note: '<a href="javascript:alert(1)">link</a>'
        }
      ]
    });
    expect(payload.deckName).not.toContain('<');
    expect(payload.deckName).not.toContain('>');
    expect(payload.cards[0].word).not.toMatch(/[<>]/);
    expect(payload.cards[0].translation).not.toMatch(/[<>]/);
    expect(payload.cards[0].example).not.toMatch(/[<>]/);
    expect(payload.cards[0].note).not.toMatch(/[<>]/);
  });

  it('drops cards without a word instead of throwing', () => {
    const payload = validateSharePayload({
      formatVersion: 1,
      deckName: 'x',
      cards: [{ word: '', translation: 'pusty' }, { word: 'ok', translation: 'dobrze' }]
    });
    expect(payload.cards).toHaveLength(1);
    expect(payload.cards[0].word).toBe('ok');
  });

  it('ignores malformed card entries (null, arrays, primitives) inside the cards array', () => {
    const payload = validateSharePayload({
      formatVersion: 1,
      deckName: 'x',
      cards: [null, 42, 'string', ['a'], { word: 'valid', translation: 'ok' }]
    });
    expect(payload.cards).toHaveLength(1);
    expect(payload.cards[0].word).toBe('valid');
  });

  it('discards prototype-polluting keys and never crashes on __proto__ payloads', () => {
    const malicious = JSON.parse(
      '{"formatVersion":1,"deckName":"x","cards":[],"__proto__":{"polluted":true}}'
    );
    const payload = validateSharePayload(malicious);
    expect(payload.cards).toEqual([]);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('falls back to an invalid part of speech being cleared rather than accepted verbatim', () => {
    const payload = validateSharePayload({
      formatVersion: 1,
      deckName: 'x',
      cards: [{ word: 'cat', translation: 'kot', partOfSpeech: 'DROP TABLE cards;' }]
    });
    expect(payload.cards[0].partOfSpeech).toBe('');
  });

  it('truncates excessively long field values instead of throwing', () => {
    const longWord = 'a'.repeat(10_000);
    const payload = validateSharePayload({ formatVersion: 1, deckName: 'x', cards: [{ word: longWord, translation: 't' }] });
    expect(payload.cards[0].word.length).toBeLessThanOrEqual(500);
  });
});

describe('parseJsonPayload - malformed input', () => {
  it('rejects invalid JSON text', () => {
    expect(() => parseJsonPayload('{not valid json')).toThrow(ShareValidationError);
  });

  it('rejects an oversized JSON string', () => {
    const huge = `{"formatVersion":1,"deckName":"x","cards":[],"pad":"${'a'.repeat(6_000_000)}"}`;
    expect(() => parseJsonPayload(huge)).toThrow(ShareValidationError);
  });
});

describe('decodePayloadFromCompressed - corrupted link data', () => {
  it('rejects garbage that is not valid lz-string data', () => {
    expect(() => decodePayloadFromCompressed('not-a-real-compressed-string!!! %%%')).toThrow(ShareValidationError);
  });

  it('rejects an empty string', () => {
    expect(() => decodePayloadFromCompressed('')).toThrow(ShareValidationError);
  });

  it('rejects data that decompresses to invalid JSON', () => {
    const compressed = encodeSharePayload({ formatVersion: 1, deckName: 'x', deckDescription: '', cards: [], exportedAt: 1 });
    // Prepend garbage to corrupt the compressed stream while keeping it non-empty.
    const corrupted = compressed.slice(0, -5) + 'ZZZZZ';
    expect(() => decodePayloadFromCompressed(corrupted)).toThrow(ShareValidationError);
  });
});

describe('QR size threshold', () => {
  it('exposes a QR-safe length under which QR codes stay scannable', () => {
    expect(QR_SAFE_LENGTH).toBeGreaterThan(0);
    const smallPayload: SharePayload = { formatVersion: 1, deckName: 'x', deckDescription: '', cards: [makeCard()].map((c) => ({
      word: c.word,
      translation: c.translation,
      example: c.example,
      partOfSpeech: c.partOfSpeech,
      note: c.note
    })), exportedAt: 1 };
    const compressed = encodeSharePayload(smallPayload);
    expect(compressed.length).toBeLessThan(QR_SAFE_LENGTH);
  });
});

describe('dedupeAgainstExisting', () => {
  it('skips cards whose word already exists (case-insensitive)', () => {
    const cards = [
      { word: 'Cat', translation: 'kot', example: '', partOfSpeech: '' as const, note: '' },
      { word: 'dog', translation: 'pies', example: '', partOfSpeech: '' as const, note: '' }
    ];
    const result = dedupeAgainstExisting(cards, ['cat', 'bird']);
    expect(result.map((c) => c.word)).toEqual(['dog']);
  });

  it('also deduplicates duplicates within the imported set itself', () => {
    const cards = [
      { word: 'dog', translation: 'pies', example: '', partOfSpeech: '' as const, note: '' },
      { word: 'Dog', translation: 'pies2', example: '', partOfSpeech: '' as const, note: '' }
    ];
    const result = dedupeAgainstExisting(cards, []);
    expect(result).toHaveLength(1);
  });
});
