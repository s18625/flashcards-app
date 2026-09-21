import { getDb } from './db';
import { DEFAULT_SETTINGS, type AppSettings } from '../types';

export async function getSettings(): Promise<AppSettings> {
  const db = await getDb();
  const stored = await db.get('settings', 'settings');
  return stored ? { ...DEFAULT_SETTINGS, ...stored } : DEFAULT_SETTINGS;
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const db = await getDb();
  const current = await getSettings();
  const updated: AppSettings = { ...current, ...patch, id: 'settings' };
  await db.put('settings', updated);
  return updated;
}
