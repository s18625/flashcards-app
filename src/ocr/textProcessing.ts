import lemmatizer from 'wink-lemmatizer';
import { isStopword } from './stopwords';

export interface WordCandidate {
  /** Forma podstawowa (lemat) – używana do deduplikacji i jako sugerowane słowo. */
  lemma: string;
  /** Oryginalna forma znaleziona w tekście (do wyświetlenia użytkownikowi). */
  original: string;
  /** Liczba wystąpień w rozpoznanym tekście. */
  count: number;
}

const WORD_TOKEN_RE = /[A-Za-z][A-Za-z'-]*/g;
const MIN_WORD_LENGTH = 2;

/** Rozbija rozpoznany tekst na tokeny słów (bez cyfr i znaków specjalnych). */
export function tokenize(text: string): string[] {
  const matches = text.match(WORD_TOKEN_RE);
  if (!matches) return [];
  return matches
    .map((token) => token.replace(/^[-']+|[-']+$/g, ''))
    .filter((token) => token.length >= MIN_WORD_LENGTH);
}

/**
 * Sprowadza słowo do formy podstawowej. wink-lemmatizer nie zgaduje części
 * mowy, więc próbujemy po kolei: rzeczownik, czasownik, przymiotnik – i
 * bierzemy pierwszy wynik krótszy od oryginału (czyli taki, który faktycznie
 * coś odmienił). Gdy żadna reguła nie pasuje, zwracamy oryginał.
 */
export function lemmatize(word: string): string {
  const lower = word.toLowerCase();
  const candidates = [lemmatizer.noun(lower), lemmatizer.verb(lower), lemmatizer.adjective(lower)];
  const shortened = candidates.find((c) => c && c.length > 0 && c !== lower);
  return shortened ?? lower;
}

export interface ExtractCandidatesOptions {
  /** Pomiń listę stopwords (przydatne w testach). */
  skipStopwords?: boolean;
  /** Maksymalna liczba zwracanych kandydatów. */
  limit?: number;
}

/**
 * Wyodrębnia unikalne kandydatury słówek angielskich z rozpoznanego tekstu
 * OCR: tokenizacja, odfiltrowanie liczb/znaków specjalnych i bardzo
 * popularnych słów, lematyzacja i deduplikacja.
 */
export function extractCandidates(text: string, options: ExtractCandidatesOptions = {}): WordCandidate[] {
  const { skipStopwords = false, limit } = options;
  const tokens = tokenize(text);
  const byLemma = new Map<string, WordCandidate>();

  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (!skipStopwords && isStopword(lower)) continue;
    if (/^[a-z]$/.test(lower)) continue; // pojedyncze litery (np. inicjały)

    const lemma = lemmatize(lower);
    if (!skipStopwords && isStopword(lemma)) continue;

    const existing = byLemma.get(lemma);
    if (existing) {
      existing.count += 1;
    } else {
      byLemma.set(lemma, { lemma, original: lower, count: 1 });
    }
  }

  const result = Array.from(byLemma.values()).sort((a, b) => b.count - a.count || a.lemma.localeCompare(b.lemma));
  return limit ? result.slice(0, limit) : result;
}
