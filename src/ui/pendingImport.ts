import type { SharePayload } from '../types';

let pending: SharePayload | null = null;

export function setPendingImport(payload: SharePayload): void {
  pending = payload;
}

export function getPendingImport(): SharePayload | null {
  return pending;
}

export function clearPendingImport(): void {
  pending = null;
}
