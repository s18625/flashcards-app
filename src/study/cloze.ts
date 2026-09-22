/** Czysta logika wyszukiwania miejsca na lukę w zdaniu przykładowym (tryb cloze). */

export interface ClozeBlank {
  before: string;
  match: string;
  after: string;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Szuka `targetWord` jako całego słowa/frazy (bez rozbijania wnętrza
 * innego słowa, case-insensitive) wewnątrz `example`. Zwraca `null`, gdy
 * zdanie jest puste albo faktycznie nie zawiera szukanego słowa – wtedy
 * wywołujący powinien dla tej karty użyć innego trybu (np. wpisywania).
 */
export function findClozeBlank(example: string, targetWord: string): ClozeBlank | null {
  const ex = example.trim();
  const word = targetWord.trim();
  if (!ex || !word) return null;

  const re = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i');
  const m = re.exec(ex);
  if (!m) return null;

  return { before: ex.slice(0, m.index), match: m[0], after: ex.slice(m.index + m[0].length) };
}
