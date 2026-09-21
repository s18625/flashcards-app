/**
 * Wiele podręcznikowych słowniczków (np. matura/repetytoria) drukuje
 * słownictwo w formacie jednej linii na wyrażenie:
 *
 *   take after sb /teɪk ˈɑːftə ˈsʌmbədi/ być podobnym do kogoś
 *
 * Zwykła tokenizacja słowo-po-słowie (`extractCandidates`) rozjeżdża taki
 * wpis na bezsensowne fragmenty ("take", "after", "sb"...). Ten moduł
 * rozpoznaje ten format i wyciąga całe wyrażenie razem z gotowym
 * tłumaczeniem z podręcznika (dużo trafniejszym niż automatyczne API).
 */
import { extractCandidates } from './textProcessing';

export interface GlossaryEntry {
  term: string;
  translation: string;
}

const MIN_TERM_LENGTH = 2;
const MIN_TRANSLATION_LENGTH = 1;

/**
 * Znajduje w linii parę "/.../ " ograniczającą transkrypcję fonetyczną.
 * Prawdziwy otwierający ukośnik ma spację PRZED sobą (po wyrazie) i BRAK
 * spacji PO sobie (transkrypcja zaczyna się od razu). Zamykający ukośnik
 * to odwrotnie: brak spacji przed (koniec transkrypcji) i spacja po (przed
 * tłumaczeniem). Odróżnia to prawdziwe ograniczniki wymowy od ukośników
 * używanych jako "lub" wewnątrz wyrażenia ("sb / sth") czy tłumaczenia
 * ("kogoś/czegoś"), które nie spełniają obu warunków jednocześnie.
 */
function findPronunciationSpan(line: string): { start: number; end: number } | null {
  const slashIndexes: number[] = [];
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '/') slashIndexes.push(i);
  }
  if (slashIndexes.length < 2) return null;

  const isSpaceOrEdge = (idx: number): boolean => idx < 0 || idx >= line.length || /\s/.test(line[idx]);

  let openIdx = -1;
  for (const idx of slashIndexes) {
    const precededBySpace = isSpaceOrEdge(idx - 1);
    const followedBySpace = isSpaceOrEdge(idx + 1);
    if (precededBySpace && !followedBySpace) {
      openIdx = idx;
      break;
    }
  }
  if (openIdx === -1) return null;

  for (const idx of slashIndexes) {
    if (idx <= openIdx) continue;
    const precededBySpace = isSpaceOrEdge(idx - 1);
    const followedBySpace = isSpaceOrEdge(idx + 1);
    if (!precededBySpace && followedBySpace) {
      return { start: openIdx, end: idx };
    }
  }
  return null;
}

function cleanTerm(raw: string): string {
  return raw
    .replace(/^[-–—•*\d.)\s]+/, '') // wypunktowanie/numeracja z OCR na początku linii
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanTranslation(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

/** Próbuje sparsować pojedynczą linię jako wpis słowniczka. */
export function parseGlossaryLine(line: string): GlossaryEntry | null {
  const span = findPronunciationSpan(line);
  if (!span) return null;

  const term = cleanTerm(line.slice(0, span.start));
  const translation = cleanTranslation(line.slice(span.end + 1));

  if (term.length < MIN_TERM_LENGTH || translation.length < MIN_TRANSLATION_LENGTH) return null;
  // Termin powinien wyglądać jak angielski wyraz/wyrażenie (litery/spacje/apostrofy),
  // nie sama numeracja czy śmieci OCR.
  if (!/[A-Za-z]/.test(term)) return null;

  return { term, translation };
}

export interface ExtractGlossaryOptions {
  /** Minimalna liczba dopasowanych linii, żeby uznać tekst za słowniczek. */
  minMatches?: number;
  /** Minimalny udział dopasowanych linii wśród niepustych linii. */
  minRatio?: number;
}

/**
 * Próbuje rozpoznać cały tekst jako listę słownictwa w formacie
 * "wyrażenie /wymowa/ tłumaczenie" i zwrócić wyciągnięte wpisy. Zwraca
 * `null`, jeśli tekst nie wygląda na słowniczek (za mało dopasowanych
 * linii) – wtedy wywołujący powinien użyć zwykłej ekstrakcji słów.
 */
export function extractGlossaryEntries(text: string, options: ExtractGlossaryOptions = {}): GlossaryEntry[] | null {
  const { minMatches = 3, minRatio = 0.35 } = options;
  const lines = text.split(/\r?\n/);
  const nonEmptyLines = lines.filter((l) => l.trim().length > 0);
  if (nonEmptyLines.length === 0) return null;

  const entries: GlossaryEntry[] = [];
  const seen = new Set<string>();
  for (const line of nonEmptyLines) {
    const entry = parseGlossaryLine(line);
    if (!entry) continue;
    const key = entry.term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push(entry);
  }

  const ratio = entries.length / nonEmptyLines.length;
  if (entries.length >= minMatches && ratio >= minRatio) {
    return entries;
  }
  return null;
}

export interface VocabularyCandidate {
  /** Słowo lub całe wyrażenie (np. "take after sb") do zapisania na fiszce. */
  word: string;
  /** Tłumaczenie z podręcznika, jeśli rozpoznane jako wpis słowniczka; inaczej puste. */
  translation: string;
  count: number;
  /** 'glossary' = wyciągnięte z linii "wyrażenie /wymowa/ tłumaczenie"; 'lemma' = zwykła tokenizacja + lematyzacja. */
  source: 'glossary' | 'lemma';
}

/**
 * Wysokopoziomowa ekstrakcja kandydatów do nauki z rozpoznanego tekstu:
 * najpierw próbuje rozpoznać format słowniczka (pełne wyrażenia + gotowe
 * tłumaczenia), a jeśli tekst na to nie wygląda, wraca do zwykłej
 * tokenizacji słowo-po-słowie z lematyzacją.
 */
export function extractVocabularyCandidates(text: string, options: { limit?: number } = {}): VocabularyCandidate[] {
  const glossary = extractGlossaryEntries(text);
  if (glossary) {
    const list: VocabularyCandidate[] = glossary.map((e) => ({
      word: e.term,
      translation: e.translation,
      count: 1,
      source: 'glossary'
    }));
    return options.limit ? list.slice(0, options.limit) : list;
  }

  const words = extractCandidates(text, { limit: options.limit });
  return words.map((w): VocabularyCandidate => ({ word: w.lemma, translation: '', count: w.count, source: 'lemma' }));
}
