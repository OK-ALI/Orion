import { useCallback, useEffect, useState } from 'react';
import { normalizeMobileLibrarySort, type MobileLibrarySort } from '../library/librarySort';
import { createGlimpseMetadataStorage } from './glimpseLikesStorage';
import { normalizeLikedReel } from './glimpseLikesSchema';
import type { GlimpseMetadataStorage } from './GlimpseLikesStore';
import type { GlimpseReel } from './glimpseModel';

export type GlimpseTab = 'discover' | 'liked';
export interface GlimpsePreferences {
  schemaVersion: 1; ambientGlow: boolean; startMuted: boolean; autoAdvance: boolean; rememberPosition: boolean;
  sorts: Record<GlimpseTab, MobileLibrarySort>;
  position: { tab: GlimpseTab; reel: GlimpseReel } | null;
}
export const GLIMPSE_PREFERENCES_KEY = 'preferences.v1';
export const defaultGlimpsePreferences = (): GlimpsePreferences => ({ schemaVersion: 1,
  ambientGlow: true, startMuted: true, autoAdvance: false, rememberPosition: false, sorts: { discover: 'manual', liked: 'manual' }, position: null });
export function normalizeGlimpsePreferences(input: unknown): GlimpsePreferences {
  const value = input as GlimpsePreferences;
  if (!value || value.schemaVersion !== 1 || typeof value.startMuted !== 'boolean' || typeof value.autoAdvance !== 'boolean'
    || (value.ambientGlow !== undefined && typeof value.ambientGlow !== 'boolean')
    || typeof value.rememberPosition !== 'boolean' || !value.sorts
    || (value.position !== null && (!value.position || !['discover', 'liked'].includes(value.position.tab)))) throw new Error('Unsupported Glimpse preferences');
  return { schemaVersion: 1, ambientGlow: value.ambientGlow ?? true, startMuted: value.startMuted, autoAdvance: value.autoAdvance, rememberPosition: value.rememberPosition,
    sorts: { discover: normalizeMobileLibrarySort(value.sorts.discover), liked: normalizeMobileLibrarySort(value.sorts.liked) },
    position: value.rememberPosition && value.position ? { tab: value.position.tab, reel: normalizeLikedReel(value.position.reel) } : null };
}
function immutable<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(immutable); Object.freeze(value); }
  return value;
}
export class GlimpsePreferencesStore {
  private listeners = new Set<() => void>();
  private snapshot: { preferences: GlimpsePreferences; unavailable: boolean };
  constructor(private storage: GlimpseMetadataStorage) {
    try {
      const raw = storage.getString(GLIMPSE_PREFERENCES_KEY);
      this.snapshot = immutable({ preferences: raw === undefined ? defaultGlimpsePreferences() : normalizeGlimpsePreferences(JSON.parse(raw)), unavailable: false });
    } catch { this.snapshot = immutable({ preferences: defaultGlimpsePreferences(), unavailable: true }); }
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  set(patch: Partial<Pick<GlimpsePreferences, 'ambientGlow' | 'startMuted' | 'autoAdvance' | 'rememberPosition' | 'sorts' | 'position'>>) {
    if (this.snapshot.unavailable) throw new Error('Glimpse preferences unavailable');
    const next = normalizeGlimpsePreferences({ ...this.snapshot.preferences, ...patch });
    if (JSON.stringify(next) === JSON.stringify(this.snapshot.preferences)) return;
    this.storage.set(GLIMPSE_PREFERENCES_KEY, JSON.stringify(next));
    this.snapshot = immutable({ preferences: next, unavailable: false });
    this.listeners.forEach(listener => listener());
  }
}
let store: GlimpsePreferencesStore | null = null;
export function getGlimpsePreferencesStore() {
  if (!store) {
    try { store = new GlimpsePreferencesStore(createGlimpseMetadataStorage()); }
    catch { store = new GlimpsePreferencesStore({ getString: () => { throw new Error('Unavailable'); }, set: () => { throw new Error('Unavailable'); } }); }
  }
  return store;
}
export function useGlimpsePreferences() {
  const local = getGlimpsePreferencesStore();
  const [snapshot, setSnapshot] = useState(local.getSnapshot);
  const [saveError, setSaveError] = useState(false);
  useEffect(() => {
    const update = () => setSnapshot(local.getSnapshot());
    const unsubscribe = local.subscribe(update); update(); return unsubscribe;
  }, [local]);
  const update = useCallback((patch: Parameters<GlimpsePreferencesStore['set']>[0]) => {
    try { local.set(patch); setSaveError(false); return true; } catch { setSaveError(true); return false; }
  }, [local]);
  return { ...snapshot, update, saveError };
}