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
    .replace(/^[-–—•*=|~<>{}„"'.\d)\s]+/, '') // wypunktowanie/numeracja/śmieci OCR na początku linii
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Nagłówki sekcji w tym słowniczku ("Interests / Zainteresowania", "Personal
 * data / Dane osobowe"...) są zawsze zapisane Wielkimi Literami po obu
 * stronach ukośnika, w przeciwieństwie do prawdziwych tłumaczeń, które w tym
 * podręczniku są zawsze pisane małą literą. Gdy taki nagłówek "wklei się" do
 * końca tłumaczenia (OCR pomieszał wiersze), obcinamy tłumaczenie tuż przed nim.
 */
const HEADER_BLEED_PATTERN = /\s[A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*)*\s*\/\s*[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]*/;

function cleanTranslation(raw: string): string {
  let text = raw.replace(/\s+/g, ' ').trim();
  const headerBleed = text.match(HEADER_BLEED_PATTERN);
  if (headerBleed && headerBleed.index !== undefined) {
    text = text.slice(0, headerBleed.index);
  }
  return text
    .trim()
    .replace(/;+$/, '') // pojedynczy średnik na końcu to zawsze śmieć OCR (separator z innej części linii), nigdy sensowne zakończenie tłumaczenia
    .trim();
}

/**
 * Gdy termin i tłumaczenie zaczynają się od tego samego "słowa", to prawie
 * na pewno zbłąkany token OCR doklejony identycznie po obu stronach (np.
 * "g talkative" / "g rozmowny" zamiast "talkative" / "rozmowny") - angielski
 * termin i polskie tłumaczenie z definicji nie zaczynają się tym samym słowem.
 */
function stripSharedLeadingNoise(term: string, translation: string): { term: string; translation: string } {
  const termFirstSpace = term.indexOf(' ');
  const translationFirstSpace = translation.indexOf(' ');
  if (termFirstSpace === -1 || translationFirstSpace === -1) return { term, translation };

  const termFirstWord = term.slice(0, termFirstSpace);
  const translationFirstWord = translation.slice(0, translationFirstSpace);
  if (termFirstWord.length === 0 || termFirstWord.toLowerCase() !== translationFirstWord.toLowerCase()) {
    return { term, translation };
  }
  return {
    term: term.slice(termFirstSpace + 1).trim(),
    translation: translation.slice(translationFirstSpace + 1).trim()
  };
}

/**
 * Zdjęcia gęsto zadrukowanych stron wielokolumnowych (np. słowniczek obok
 * innej sekcji) potrafią sprawić, że Tesseract "posklei" w jedną linię OCR
 * fragmenty z sąsiedniej kolumny - wtedy w tekście zostaje resztka kolejnej
 * transkrypcji fonetycznej (kolejna para ukośników). Traktujemy to jako
 * sygnał skażonych danych, bo nie da się już wiarygodnie odtworzyć, co
 * należy do którego wpisu.
 */
function countSlashes(text: string): number {
  return (text.match(/\//g) ?? []).length;
}

/**
 * Prawdziwe wyrażenia angielskie w tym słowniczku zapisują alternatywy z
 * odstępami po obu stronach ukośnika ("family name / last name / surname",
 * "similar to sb / sth"). Ukośnik "przyklejony" do liter po którejś stronie
 * (np. "'s3:neim/ nazwisko" - resztka rozjechanej transkrypcji fonetycznej)
 * nigdy nie występuje w prawdziwym terminie - to zawsze sygnał skażenia.
 */
function hasBareSlash(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '/') continue;
    const before = text[i - 1];
    const after = text[i + 1];
    const spacedBefore = before === undefined || before === ' ';
    const spacedAfter = after === undefined || after === ' ';
    if (!spacedBefore || !spacedAfter) return true;
  }
  return false;
}

/** Angielski termin nie powinien zawierać polskich znaków diakrytycznych - jeśli je ma, to nie jest angielski termin. */
const POLISH_DIACRITICS = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

/** Próbuje sparsować pojedynczą linię jako wpis słowniczka. */
export function parseGlossaryLine(line: string): GlossaryEntry | null {
  const span = findPronunciationSpan(line);
  if (!span) return null;

  let term = cleanTerm(line.slice(0, span.start));
  let translation = cleanTranslation(line.slice(span.end + 1));
  // Zupełny brak treści po transkrypcji (np. "word // ") to nie jest
  // sensowny wpis słowniczka - odrzucamy go od razu, zanim ewentualne
  // czyszczenie skażenia (niżej) zdąży zamienić go w pusty, ale "ważny" wpis.
  if (translation.length === 0) return null;

  ({ term, translation } = stripSharedLeadingNoise(term, translation));

  if (term.length < MIN_TERM_LENGTH) return null;
  // Termin powinien wyglądać jak angielski wyraz/wyrażenie (litery/spacje/apostrofy),
  // nie sama numeracja czy śmieci OCR.
  if (!/[A-Za-z]/.test(term)) return null;
  // Angielski termin z polskimi znakami diakrytycznymi to dowód, że OCR
  // wymieszał ze sobą fragmenty z dwóch różnych miejsc strony.
  if (POLISH_DIACRITICS.test(term)) return null;
  // Jeśli sam termin nadal zawiera resztkę cudzej transkrypcji fonetycznej
  // (ukośnik "przyklejony" do liter, nie czysta alternatywa " / "), cały
  // wpis jest zbyt skażony, żeby mu ufać.
  if (hasBareSlash(term)) return null;

  // Tłumaczenie z resztką sąsiedniej transkrypcji fonetycznej ("... /gao on
  // 3 'dait/ ...") jest niewiarygodne - czyścimy je do pustego, żeby dało
  // się je potem dociągnąć zwykłym tłumaczeniem zamiast pokazać śmieci.
  // W tłumaczeniu (po polsku) dopuszczamy natomiast ciasne "kogoś/czegoś"
  // (naturalna polska alternatywa), sprawdzamy więc tylko pełną parę
  // ukośników wskazującą na całą "wklejoną" transkrypcję.
  if (countSlashes(translation) >= 2) {
    translation = '';
  }

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
