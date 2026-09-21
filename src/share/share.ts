import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import type { Card, Deck, PartOfSpeech, ShareCardPayload, SharePayload } from '../types';

export class ShareValidationError extends Error {}

export const SHARE_FORMAT_VERSION = 1 as const;
export const SHARE_HASH_PREFIX = 'share=';

/** Twarde limity ochronne przy imporcie danych z niezaufanego źródła. */
const MAX_CARDS = 2000;
const MAX_FIELD_LENGTH = 500;
const MAX_DECK_NAME_LENGTH = 120;
const MAX_COMPRESSED_LENGTH = 200_000;
const MAX_JSON_LENGTH = 5_000_000;

/** Próg długości skompresowanego ciągu, poniżej którego proponujemy kod QR. */
export const QR_SAFE_LENGTH = 1200;

const VALID_PARTS_OF_SPEECH: ReadonlySet<string> = new Set([
  'noun',
  'verb',
  'adjective',
  'adverb',
  'phrase',
  'other',
  ''
]);

function sanitizeText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  // Usuwamy znaki, które mogłyby posłużyć do wstrzyknięcia znaczników HTML,
  // mimo że render odbywa się zawsze przez textContent (obrona w głąb).
  const stripped = value.replace(/[<>]/g, '').split('\u0000').join('');
  return stripped.trim().slice(0, maxLength);
}

export function serializeDeckForSharing(deck: Deck, cards: Card[]): SharePayload {
  return {
    formatVersion: SHARE_FORMAT_VERSION,
    deckName: deck.name,
    deckDescription: deck.description,
    exportedAt: Date.now(),
    cards: cards.map(
      (c): ShareCardPayload => ({
        word: c.word,
        translation: c.translation,
        example: c.example,
        partOfSpeech: c.partOfSpeech,
        note: c.note
      })
    )
  };
}

/**
 * Waliduje i sanityzuje nieznaną, potencjalnie złośliwą strukturę jako
 * SharePayload. Rzuca ShareValidationError z czytelnym komunikatem po
 * polsku, jeśli dane są niepoprawne, za duże lub mają zły format wersji.
 */
export function validateSharePayload(data: unknown): SharePayload {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new ShareValidationError('Nieprawidłowy format danych talii.');
  }
  const obj = data as Record<string, unknown>;

  if (obj.formatVersion !== SHARE_FORMAT_VERSION) {
    throw new ShareValidationError(
      `Nieobsługiwana wersja formatu talii (${String(obj.formatVersion)}). Zaktualizuj aplikację lub poproś nadawcę o nowszy eksport.`
    );
  }

  if (typeof obj.deckName !== 'string' || obj.deckName.trim().length === 0) {
    throw new ShareValidationError('Talia nie ma nazwy.');
  }

  if (!Array.isArray(obj.cards)) {
    throw new ShareValidationError('Talia nie zawiera listy fiszek.');
  }
  if (obj.cards.length > MAX_CARDS) {
    throw new ShareValidationError(`Talia zawiera zbyt dużo fiszek (maksymalnie ${MAX_CARDS}).`);
  }

  const cards: ShareCardPayload[] = [];
  for (const raw of obj.cards) {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const rawCard = raw as Record<string, unknown>;
    const word = sanitizeText(rawCard.word, MAX_FIELD_LENGTH);
    if (!word) continue; // pomijamy wpisy bez słowa – nie ma sensu ich importować
    const partOfSpeechRaw = typeof rawCard.partOfSpeech === 'string' ? rawCard.partOfSpeech : '';
    const partOfSpeech = (VALID_PARTS_OF_SPEECH.has(partOfSpeechRaw) ? partOfSpeechRaw : '') as PartOfSpeech | '';
    cards.push({
      word,
      translation: sanitizeText(rawCard.translation, MAX_FIELD_LENGTH),
      example: sanitizeText(rawCard.example, MAX_FIELD_LENGTH),
      partOfSpeech,
      note: sanitizeText(rawCard.note, MAX_FIELD_LENGTH)
    });
  }

  return {
    formatVersion: SHARE_FORMAT_VERSION,
    deckName: sanitizeText(obj.deckName, MAX_DECK_NAME_LENGTH) || 'Zaimportowana talia',
    deckDescription: sanitizeText(obj.deckDescription, MAX_FIELD_LENGTH),
    exportedAt: typeof obj.exportedAt === 'number' && Number.isFinite(obj.exportedAt) ? obj.exportedAt : Date.now(),
    cards
  };
}

export function encodeSharePayload(payload: SharePayload): string {
  const json = JSON.stringify(payload);
  const compressed = compressToEncodedURIComponent(json);
  if (compressed.length > MAX_COMPRESSED_LENGTH) {
    throw new ShareValidationError('Talia jest zbyt duża, aby zakodować ją w linku. Użyj eksportu do pliku.');
  }
  return compressed;
}

export function buildShareUrl(payload: SharePayload): string {
  const compressed = encodeSharePayload(payload);
  const url = new URL(window.location.href);
  url.hash = `${SHARE_HASH_PREFIX}${compressed}`;
  return url.toString();
}

export function decodePayloadFromCompressed(compressed: string): SharePayload {
  if (!compressed || compressed.length > MAX_COMPRESSED_LENGTH) {
    throw new ShareValidationError('Link udostępniania jest nieprawidłowy lub uszkodzony.');
  }
  let json: string | null;
  try {
    json = decompressFromEncodedURIComponent(compressed);
  } catch {
    throw new ShareValidationError('Nie udało się odczytać danych z linku – dane są uszkodzone.');
  }
  if (!json) {
    throw new ShareValidationError('Nie udało się odczytać danych z linku – dane są uszkodzone.');
  }
  return parseJsonPayload(json);
}

export function extractShareHashFromUrl(url: string): string | null {
  const hashIndex = url.indexOf('#');
  if (hashIndex === -1) return null;
  const hash = url.slice(hashIndex + 1);
  if (!hash.startsWith(SHARE_HASH_PREFIX)) return null;
  return hash.slice(SHARE_HASH_PREFIX.length);
}

export function parseJsonPayload(json: string): SharePayload {
  if (json.length > MAX_JSON_LENGTH) {
    throw new ShareValidationError('Plik talii jest zbyt duży.');
  }
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new ShareValidationError('Plik nie zawiera poprawnego JSON-a.');
  }
  return validateSharePayload(data);
}

export function buildShareFileName(deckName: string): string {
  const slug = deckName
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `talia-${slug || 'fiszki'}.json`;
}

export function buildShareFile(payload: SharePayload): { filename: string; blob: Blob } {
  const json = JSON.stringify(payload, null, 2);
  return {
    filename: buildShareFileName(payload.deckName),
    blob: new Blob([json], { type: 'application/json' })
  };
}

/**
 * Zwraca fiszki z payloadu, które nie duplikują (po znormalizowanym słowie)
 * żadnej z istniejących fiszek w docelowej talii – używane przy scalaniu.
 */
export function dedupeAgainstExisting(cards: ShareCardPayload[], existingWords: Iterable<string>): ShareCardPayload[] {
  const existing = new Set(Array.from(existingWords, (w) => w.trim().toLowerCase()));
  const seen = new Set<string>();
  const result: ShareCardPayload[] = [];
  for (const card of cards) {
    const key = card.word.trim().toLowerCase();
    if (existing.has(key) || seen.has(key)) continue;
    seen.add(key);
    result.push(card);
  }
  return result;
}
