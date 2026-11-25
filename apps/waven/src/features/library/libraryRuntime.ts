import { Platform } from 'react-native';
import { useSyncExternalStore } from 'react';
import type { IStorageAdapter } from '@orion/shared/api';
import { createMMKV } from 'react-native-mmkv';
import type { WavenEntrySession } from '../account/wavenEntrySession';
import { LocalLibraryRepository, libraryScope } from './localLibrary';
import { PlaybackHistoryObserver } from './playbackHistory';
import { getPersistedPlaybackRecoveryState, nativePlayback, subscribeNativePlayback } from '../playback/native/WavenPlaybackNative';

let repository: LocalLibraryRepository | null = null;
function storage(): IStorageAdapter {
  try {
    if (Platform.OS === 'web') {
      return { get: key => globalThis.localStorage.getItem(key), set: (key, value) => globalThis.localStorage.setItem(key, value), remove: key => globalThis.localStorage.removeItem(key) };
    }
    const mmkv = createMMKV({ id: 'waven.library' });
    return { get: key => mmkv.getString(key) ?? null, set: (key, value) => mmkv.set(key, value), remove: key => { mmkv.remove(key); } };
  } catch {
    const unavailable = () => { throw new Error('WAVEN_LOCAL_STORAGE_UNAVAILABLE'); };
    return { get: unavailable, set: unavailable, remove: unavailable };
  }
}
export function getLocalLibrary() { return repository ??= new LocalLibraryRepository(storage()); }
export function useLocalLibrary() {
  const owner = getLocalLibrary(); return useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
}
export function startLibraryPlaybackObservation() {
  const owner = getLocalLibrary(), observer = new PlaybackHistoryObserver(owner, getPersistedPlaybackRecoveryState);
  let active = true;
  const observe = (snapshot: Parameters<PlaybackHistoryObserver['observe']>[0]) => { if (active) void observer.observe(snapshot).catch(() => owner.reportHistoryIssue()); };
  let subscription: ReturnType<typeof subscribeNativePlayback> | null = null;
  try { subscription = subscribeNativePlayback(observe); void nativePlayback.getSnapshot().then(observe).catch(() => {}); } catch { /* Expo Go/web has no Android owner. */ }
  return { accountChanged: () => observer.accountChanged(), stop: () => { active = false; observer.dispose(); subscription?.remove(); } };
}
export function bindLibrarySession(session: WavenEntrySession | null) {
  const scope = libraryScope(session?.mode === 'google' ? session.profile?.accountId : null);
  const owner = getLocalLibrary(); if (owner.getSnapshot().state.scope !== scope) owner.switchScope(scope);
}
