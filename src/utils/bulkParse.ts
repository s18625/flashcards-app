/**
 * Parsowanie wklejonej listy słówek do masowego dodania fiszek: jedna
 * fiszka na linię, w formacie "słowo, tłumaczenie". Rozdzielacz jest
 * elastyczny – jeśli w linii nie ma przecinka, próbujemy tabulatora
 * (wklejanie z arkusza) albo " - " (myślnik otoczony spacjami). Dzielimy
 * tylko po PIERWSZYM wystąpieniu rozdzielacza, więc wielosensowe
 * tłumaczenie z własnymi przecinkami (np. "talkative, gadatliwy,
 * rozmowny") trafia w całości do pola tłumaczenia.
 */

export interface BulkEntry {
  word: string;
  translation: string;
}

const DASH_SEPARATOR = /\s[-–—]\s/;

export function parseBulkLine(rawLine: string): BulkEntry | null {
  const line = rawLine.trim();
  if (!line) return null;

  let word: string;
  let translation: string;

  const commaIdx = line.indexOf(',');
  const tabIdx = line.indexOf('\t');
  const dashMatch = DASH_SEPARATOR.exec(line);

  if (commaIdx !== -1) {
    word = line.slice(0, commaIdx).trim();
    translation = line.slice(commaIdx + 1).trim();
  } else if (tabIdx !== -1) {
    word = line.slice(0, tabIdx).trim();
    translation = line.slice(tabIdx + 1).trim();
  } else if (dashMatch) {
    word = line.slice(0, dashMatch.index).trim();
    translation = line.slice(dashMatch.index + dashMatch[0].length).trim();
  } else {
    word = line;
    translation = '';
  }

  if (!word) return null;
  return { word, translation };
}

export function parseBulkEntries(text: string): BulkEntry[] {
  return text
    .split(/\r?\n/)
    .map(parseBulkLine)
    .filter((entry): entry is BulkEntry => entry !== null);
}
