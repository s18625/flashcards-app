import { getDb, newId } from './db';
import type { Card, PartOfSpeech, SrsState } from '../types';

export function freshSrsState(): SrsState {
  return {
    repetitions: 0,
    easeFactor: 2.5,
    intervalDays: 0,
    dueDate: Date.now(),
    lastReviewedAt: null
  };
}

export interface NewCardInput {
  deckId: string;
  word: string;
  translation: string;
  example?: string;
  partOfSpeech?: PartOfSpeech | '';
  note?: string;
}

export async function listCardsByDeck(deckId: string): Promise<Card[]> {
  const db = await getDb();
  const cards = await db.getAllFromIndex('cards', 'by-deckId', deckId);
  return cards.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getCard(id: string): Promise<Card | undefined> {
  const db = await getDb();
  return db.get('cards', id);
}

export async function countCardsByDeck(deckId: string): Promise<number> {
  const db = await getDb();
  return db.countFromIndex('cards', 'by-deckId', deckId);
}

export async function createCard(input: NewCardInput): Promise<Card> {
  const db = await getDb();
  const now = Date.now();
  const card: Card = {
    id: newId(),
    deckId: input.deckId,
    word: input.word.trim(),
    translation: input.translation.trim(),
    example: (input.example ?? '').trim(),
    partOfSpeech: input.partOfSpeech ?? '',
    note: (input.note ?? '').trim(),
    createdAt: now,
    updatedAt: now,
    srs: freshSrsState()
  };
  await db.put('cards', card);
  return card;
}

export async function createCards(inputs: NewCardInput[]): Promise<Card[]> {
  const db = await getDb();
  const now = Date.now();
  const tx = db.transaction('cards', 'readwrite');
  const created: Card[] = [];
  for (const input of inputs) {
    const card: Card = {
      id: newId(),
      deckId: input.deckId,
      word: input.word.trim(),
      translation: input.translation.trim(),
      example: (input.example ?? '').trim(),
      partOfSpeech: input.partOfSpeech ?? '',
      note: (input.note ?? '').trim(),
      createdAt: now,
      updatedAt: now,
      srs: freshSrsState()
    };
    await tx.store.put(card);
    created.push(card);
  }
  await tx.done;
  return created;
}

export async function updateCard(
  id: string,
  patch: Partial<Pick<Card, 'word' | 'translation' | 'example' | 'partOfSpeech' | 'note' | 'deckId'>>
): Promise<Card | undefined> {
  const db = await getDb();
  const card = await db.get('cards', id);
  if (!card) return undefined;
  const updated: Card = {
    ...card,
    ...patch,
    updatedAt: Date.now()
  };
  await db.put('cards', updated);
  return updated;
}

export async function updateCardSrs(id: string, srs: SrsState): Promise<Card | undefined> {
  const db = await getDb();
  const card = await db.get('cards', id);
  if (!card) return undefined;
  const updated: Card = { ...card, srs, updatedAt: Date.now() };
  await db.put('cards', updated);
  return updated;
}

export async function deleteCard(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('cards', id);
}

export async function getDueCards(deckIds: string[] | null, limit: number): Promise<Card[]> {
  const db = await getDb();
  const all = await db.getAll('cards');
  const now = Date.now();
  const filtered = all.filter(
    (c) => (deckIds === null || deckIds.includes(c.deckId)) && c.srs.dueDate <= now
  );
  filtered.sort((a, b) => a.srs.dueDate - b.srs.dueDate);
  return filtered.slice(0, limit);
}

export async function getNewCards(deckIds: string[] | null, limit: number): Promise<Card[]> {
  const db = await getDb();
  const all = await db.getAll('cards');
  const filtered = all.filter(
    (c) => (deckIds === null || deckIds.includes(c.deckId)) && c.srs.repetitions === 0 && c.srs.lastReviewedAt === null
  );
  filtered.sort((a, b) => a.createdAt - b.createdAt);
  return filtered.slice(0, limit);
}

export async function getAllCards(): Promise<Card[]> {
  const db = await getDb();
  return db.getAll('cards');
}

/**
 * Buduje kolejkę sesji nauki: osobne pule dla nowych kart i powtórek
 * (zgodnie z dziennymi limitami), przeplecione tak, by nowe karty nie
 * trafiały wyłącznie na koniec sesji.
 */
export async function getSessionQueue(
  deckIds: string[] | null,
  newRemaining: number,
  reviewRemaining: number
): Promise<Card[]> {
  const db = await getDb();
  const all = await db.getAll('cards');
  const now = Date.now();
  const due = all.filter((c) => (deckIds === null || deckIds.includes(c.deckId)) && c.srs.dueDate <= now);

  const isNew = (c: Card) => c.srs.repetitions === 0 && c.srs.lastReviewedAt === null;
  const newOnes = due
    .filter(isNew)
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, Math.max(0, newRemaining));
  const reviewOnes = due
    .filter((c) => !isNew(c))
    .sort((a, b) => a.srs.dueDate - b.srs.dueDate)
    .slice(0, Math.max(0, reviewRemaining));

  return interleave(reviewOnes, newOnes);
}

function interleave(primary: Card[], secondary: Card[]): Card[] {
  const result: Card[] = [];
  let pi = 0;
  let si = 0;
  let i = 0;
  while (pi < primary.length || si < secondary.length) {
    if (i % 3 === 2 && si < secondary.length) {
      result.push(secondary[si++]);
    } else if (pi < primary.length) {
      result.push(primary[pi++]);
    } else if (si < secondary.length) {
      result.push(secondary[si++]);
    }
    i += 1;
  }
  return result;
}
