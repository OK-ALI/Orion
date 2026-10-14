import { Platform } from 'react-native';
import { GlimpseLikesStore, type GlimpseMetadataStorage } from './GlimpseLikesStore';

export const GLIMPSE_METADATA_NAMESPACE = 'orion.mobile.glimpse.metadata.v1';
/** Separate MMKV instance: existing Orion storage and its Cloud domains stay untouched. */
export function createGlimpseMetadataStorage(): GlimpseMetadataStorage {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') throw new Error('Private Like storage unavailable');
    return { getString: key => window.localStorage.getItem(GLIMPSE_METADATA_NAMESPACE + ':' + key) ?? undefined,
      set: (key, value) => window.localStorage.setItem(GLIMPSE_METADATA_NAMESPACE + ':' + key, value) };
  }
  const { createMMKV } = require('react-native-mmkv') as typeof import('react-native-mmkv');
  const storage = createMMKV({ id: GLIMPSE_METADATA_NAMESPACE });
  return { getString: key => storage.getString(key), set: (key, value) => storage.set(key, value) };
}
let store: GlimpseLikesStore | null = null;
export function getGlimpseLikesStore(): GlimpseLikesStore {
  if (!store) {
    let storage: GlimpseMetadataStorage;
    try { storage = createGlimpseMetadataStorage(); }
    catch { storage = { getString: () => { throw new Error('Private Like storage unavailable'); },
      set: () => { throw new Error('Private Like storage unavailable'); } }; }
    store = new GlimpseLikesStore(storage);
  }
  return store;
}
