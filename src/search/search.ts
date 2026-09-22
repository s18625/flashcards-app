import type { Card } from '../types';

/** Czy fiszka pasuje do zapytania (słowo, tłumaczenie, przykład albo notatka, case-insensitive substring). */
export function cardMatchesQuery(card: Card, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  return (
    card.word.toLowerCase().includes(q) ||
    card.translation.toLowerCase().includes(q) ||
    card.example.toLowerCase().includes(q) ||
    card.note.toLowerCase().includes(q)
  );
}

/** Filtruje fiszki po wszystkich taliach naraz. Pusty/samo-białoznakowy zapytanie zwraca brak wyników. */
export function searchCards(cards: Card[], query: string): Card[] {
  if (!query.trim()) return [];
  return cards.filter((c) => cardMatchesQuery(c, query));
}
