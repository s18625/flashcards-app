import { getDb, newId } from './db';
import type { Deck } from '../types';

/** Talie z wersji bazy sprzed folderów nie mają pola folderId - traktujemy brak jak `null`. */
function normalizeDeck(deck: Deck): Deck {
  return deck.folderId === undefined ? { ...deck, folderId: null } : deck;
}

export async function listDecks(): Promise<Deck[]> {
  const db = await getDb();
  const decks = await db.getAll('decks');
  return decks.map(normalizeDeck).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getDeck(id: string): Promise<Deck | undefined> {
  const db = await getDb();
  const deck = await db.get('decks', id);
  return deck ? normalizeDeck(deck) : undefined;
}

export async function createDeck(name: string, description = '', folderId: string | null = null): Promise<Deck> {
  const db = await getDb();
  const now = Date.now();
  const deck: Deck = {
    id: newId(),
    name: name.trim(),
    description: description.trim(),
    folderId,
    createdAt: now,
    updatedAt: now
  };
  await db.put('decks', deck);
  return deck;
}

export async function updateDeck(
  id: string,
  patch: Partial<Pick<Deck, 'name' | 'description' | 'folderId'>>
): Promise<Deck | undefined> {
  const db = await getDb();
  const deck = await db.get('decks', id);
  if (!deck) return undefined;
  const updated: Deck = {
    ...normalizeDeck(deck),
    ...patch,
    name: patch.name !== undefined ? patch.name.trim() : deck.name,
    updatedAt: Date.now()
  };
  await db.put('decks', updated);
  return updated;
}

export async function deleteDeck(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['decks', 'cards', 'reviewLogs'], 'readwrite');
  await tx.objectStore('decks').delete(id);
  const cardStore = tx.objectStore('cards');
  const cardIndex = cardStore.index('by-deckId');
  let cursor = await cardIndex.openCursor(IDBKeyRange.only(id));
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  const logStore = tx.objectStore('reviewLogs');
  const logIndex = logStore.index('by-deckId');
  let logCursor = await logIndex.openCursor(IDBKeyRange.only(id));
  while (logCursor) {
    await logCursor.delete();
    logCursor = await logCursor.continue();
  }
  await tx.done;
}
