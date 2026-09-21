import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AppSettings, Card, Deck, Folder, ReviewLog } from '../types';

interface FlashcardsDB extends DBSchema {
  folders: {
    key: string;
    value: Folder;
    indexes: { 'by-updatedAt': number };
  };
  decks: {
    key: string;
    value: Deck;
    indexes: { 'by-updatedAt': number };
  };
  cards: {
    key: string;
    value: Card;
    indexes: { 'by-deckId': string; 'by-dueDate': number };
  };
  reviewLogs: {
    key: string;
    value: ReviewLog;
    indexes: { 'by-reviewedAt': number; 'by-deckId': string };
  };
  settings: {
    key: string;
    value: AppSettings;
  };
}

const DB_NAME = 'flashcards-db';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<FlashcardsDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<FlashcardsDB>> {
  if (!dbPromise) {
    dbPromise = openDB<FlashcardsDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('decks')) {
          const decks = db.createObjectStore('decks', { keyPath: 'id' });
          decks.createIndex('by-updatedAt', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('cards')) {
          const cards = db.createObjectStore('cards', { keyPath: 'id' });
          cards.createIndex('by-deckId', 'deckId');
          cards.createIndex('by-dueDate', 'srs.dueDate');
        }
        if (!db.objectStoreNames.contains('reviewLogs')) {
          const logs = db.createObjectStore('reviewLogs', { keyPath: 'id' });
          logs.createIndex('by-reviewedAt', 'reviewedAt');
          logs.createIndex('by-deckId', 'deckId');
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }
        // v2: foldery do segregacji talii. Istniejące talie z wersji 1 nie
        // mają pola folderId - traktujemy brak pola jak `null` (patrz
        // decks.ts), więc migracja rekordów nie jest potrzebna.
        if (!db.objectStoreNames.contains('folders')) {
          const folders = db.createObjectStore('folders', { keyPath: 'id' });
          folders.createIndex('by-updatedAt', 'updatedAt');
        }
      }
    });
  }
  return dbPromise;
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export type { FlashcardsDB };
