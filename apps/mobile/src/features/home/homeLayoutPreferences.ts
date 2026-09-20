import { useSyncExternalStore } from 'react';
import { mmkvStorageAdapter } from '../../services/storageAdapter';

export const HOME_LAYOUT_STORAGE_KEY_V1 = 'orion.mobile.home.layout.v1';

export const HOME_RAIL_IDS = [
  'continue-watching',
  'trending-movies',
  'trending-tv',
  'new-releases',
  'upcoming',
  'k-dramas',
  'top-rated',
] as const;

export type HomeRailId = (typeof HOME_RAIL_IDS)[number];

export interface HomeLayoutPreferencesV1 {
  schemaVersion: 1;
  order: HomeRailId[];
  hidden: HomeRailId[];
}

export const HOME_RAIL_LABELS: Record<HomeRailId, string> = {
  'continue-watching': 'Continue Watching',
  'trending-movies': 'Trending Movies',
  'trending-tv': 'Trending TV Shows',
  'new-releases': 'New Releases',
  upcoming: 'Coming Soon',
  'k-dramas': 'K-Dramas Spotlight',
  'top-rated': 'Top Rated Masterpieces',
};

const DEFAULT_PREFERENCES: HomeLayoutPreferencesV1 = {
  schemaVersion: 1,
  order: [...HOME_RAIL_IDS],
  hidden: [],
};

function isRailId(value: unknown): value is HomeRailId {
  return typeof value === 'string' && (HOME_RAIL_IDS as readonly string[]).includes(value);
}

export function normalizeHomeLayoutPreferences(input: unknown): HomeLayoutPreferencesV1 {
  const value = input && typeof input === 'object' ? input as Partial<HomeLayoutPreferencesV1> : {};
  const requestedOrder = Array.isArray(value.order) ? value.order.filter(isRailId) : [];
  const seen = new Set<HomeRailId>();
  const order = requestedOrder.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  for (const id of HOME_RAIL_IDS) {
    if (!seen.has(id)) order.push(id);
  }
  const hidden = Array.isArray(value.hidden)
    ? [...new Set(value.hidden.filter(isRailId))]
    : [];
  return { schemaVersion: 1, order, hidden };
}

function readPreferences(): HomeLayoutPreferencesV1 {
  try {
    const raw = mmkvStorageAdapter.get(HOME_LAYOUT_STORAGE_KEY_V1);
    return raw ? normalizeHomeLayoutPreferences(JSON.parse(raw)) : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

let snapshot = readPreferences();
const listeners = new Set<() => void>();

function publish(next: HomeLayoutPreferencesV1) {
  snapshot = normalizeHomeLayoutPreferences(next);
  mmkvStorageAdapter.set(HOME_LAYOUT_STORAGE_KEY_V1, JSON.stringify(snapshot));
  for (const listener of listeners) listener();
}

export function getHomeLayoutPreferences(): HomeLayoutPreferencesV1 {
  return snapshot;
}

export function subscribeHomeLayoutPreferences(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useHomeLayoutPreferences(): HomeLayoutPreferencesV1 {
  return useSyncExternalStore(
    subscribeHomeLayoutPreferences,
    getHomeLayoutPreferences,
    getHomeLayoutPreferences,
  );
}

export function setHomeRailEnabled(id: HomeRailId, enabled: boolean) {
  const hidden = enabled
    ? snapshot.hidden.filter((value) => value !== id)
    : [...new Set([...snapshot.hidden, id])];
  publish({ ...snapshot, hidden });
}

export function moveHomeRail(id: HomeRailId, targetIndex: number) {
  const order = snapshot.order.filter((value) => value !== id);
  const clamped = Math.max(0, Math.min(order.length, targetIndex));
  order.splice(clamped, 0, id);
  publish({ ...snapshot, order });
}

export function resetHomeLayoutPreferences() {
  publish(DEFAULT_PREFERENCES);
}
