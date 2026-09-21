import { getDb, newId } from './db';
import type { Folder } from '../types';

export async function listFolders(): Promise<Folder[]> {
  const db = await getDb();
  const folders = await db.getAll('folders');
  return folders.sort((a, b) => a.name.localeCompare(b.name, 'pl'));
}

export async function createFolder(name: string): Promise<Folder> {
  const db = await getDb();
  const now = Date.now();
  const folder: Folder = { id: newId(), name: name.trim(), createdAt: now, updatedAt: now };
  await db.put('folders', folder);
  return folder;
}

export async function renameFolder(id: string, name: string): Promise<Folder | undefined> {
  const db = await getDb();
  const folder = await db.get('folders', id);
  if (!folder) return undefined;
  const updated: Folder = { ...folder, name: name.trim(), updatedAt: Date.now() };
  await db.put('folders', updated);
  return updated;
}

/** Usuwa folder i odpina od niego wszystkie talie (talie same w sobie zostają). */
export async function deleteFolder(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['folders', 'decks'], 'readwrite');
  await tx.objectStore('folders').delete(id);
  const deckStore = tx.objectStore('decks');
  let cursor = await deckStore.openCursor();
  while (cursor) {
    if (cursor.value.folderId === id) {
      await cursor.update({ ...cursor.value, folderId: null });
    }
    cursor = await cursor.continue();
  }
  await tx.done;
}
