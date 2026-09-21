import type { PartOfSpeech, ShareCardPayload } from '../types';
import { ShareValidationError } from './share';

const CSV_HEADER = ['word', 'translation', 'example', 'partOfSpeech', 'note'] as const;

const VALID_PARTS_OF_SPEECH: ReadonlySet<string> = new Set(['noun', 'verb', 'adjective', 'adverb', 'phrase', 'other', '']);

function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function cardsToCsv(cards: ShareCardPayload[]): string {
  const lines = [CSV_HEADER.join(',')];
  for (const c of cards) {
    lines.push(CSV_HEADER.map((key) => csvEscape(c[key] ?? '')).join(','));
  }
  return lines.join('\r\n');
}

/** Parsuje surowy tekst CSV na wiersze pól, obsługując cudzysłowy i przecinki/nowe linie wewnątrz pól. */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\r') {
      // pomijamy, obsłużone przez \n
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

export function parseCsvToCards(text: string): ShareCardPayload[] {
  const rows = parseCsvRows(text);
  if (rows.length === 0) {
    throw new ShareValidationError('Plik CSV jest pusty.');
  }
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const wordIdx = header.indexOf('word');
  if (wordIdx === -1) {
    throw new ShareValidationError('Plik CSV musi zawierać kolumnę "word".');
  }
  const translationIdx = header.indexOf('translation');
  const exampleIdx = header.indexOf('example');
  const posIdx = header.indexOf('partofspeech');
  const noteIdx = header.indexOf('note');

  const cards: ShareCardPayload[] = [];
  for (const row of rows.slice(1)) {
    const word = (row[wordIdx] ?? '').trim();
    if (!word) continue;
    const posRaw = posIdx >= 0 ? (row[posIdx] ?? '').trim() : '';
    cards.push({
      word,
      translation: translationIdx >= 0 ? (row[translationIdx] ?? '').trim() : '',
      example: exampleIdx >= 0 ? (row[exampleIdx] ?? '').trim() : '',
      partOfSpeech: (VALID_PARTS_OF_SPEECH.has(posRaw) ? posRaw : '') as PartOfSpeech | '',
      note: noteIdx >= 0 ? (row[noteIdx] ?? '').trim() : ''
    });
  }
  return cards;
}
