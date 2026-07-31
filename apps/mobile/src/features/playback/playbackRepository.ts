import type { MediaIdentity, MobilePlayerSurface } from '@orion/shared/types';
import { mmkvStorageAdapter } from '../../services/storageAdapter';

export const RECENT_OPENS_STORAGE_KEY = 'recentOpensV1';
const MAX_RECENT_OPENS = 100;

export interface RecentOpenRecord {
  schemaVersion: 1;
  sessionId: string;
  media: MediaIdentity;
  sourceId: string;
  surface: MobilePlayerSurface;
  openedAt: number;
  reason: 'telemetry-unavailable';
}

export function listRecentOpens(): RecentOpenRecord[] {
  try {
    const parsed = JSON.parse(mmkvStorageAdapter.get(RECENT_OPENS_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordRecentOpen(record: RecentOpenRecord): void {
  const next = [
    record,
    ...listRecentOpens().filter((entry) => entry.sessionId !== record.sessionId),
  ].slice(0, MAX_RECENT_OPENS);
  mmkvStorageAdapter.set(RECENT_OPENS_STORAGE_KEY, JSON.stringify(next));
}

export function removeRecentOpen(sessionId: string): void {
  const current = listRecentOpens();
  const next = current.filter((entry) => entry.sessionId !== sessionId);
  if (next.length !== current.length) {
    mmkvStorageAdapter.set(RECENT_OPENS_STORAGE_KEY, JSON.stringify(next));
  }
}
