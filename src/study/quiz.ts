/** Czysta logika budowania opcji dla trybu quizu wielokrotnego wyboru. */

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Buduje przetasowaną listę opcji quizu: poprawną odpowiedź plus do
 * `maxOptions - 1` unikalnych (case-insensitive) dystraktorów wybranych
 * losowo z `candidatePool`. Zwraca pustą tablicę, gdy brak poprawnej
 * odpowiedzi albo gdy pula nie dała ani jednego sensownego dystraktora –
 * sygnał dla wywołującego, by dla tej karty użyć innego trybu (np. wpisywania).
 */
export function buildQuizOptions(
  correct: string,
  candidatePool: string[],
  maxOptions = 4,
  rng: () => number = Math.random
): string[] {
  const trimmedCorrect = correct.trim();
  if (!trimmedCorrect) return [];

  const seen = new Set([trimmedCorrect.toLowerCase()]);
  const distractors: string[] = [];
  for (const raw of shuffle(candidatePool, rng)) {
    const text = raw.trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    distractors.push(text);
    if (distractors.length >= maxOptions - 1) break;
  }

  if (distractors.length === 0) return [];
  return shuffle([trimmedCorrect, ...distractors], rng);
}
