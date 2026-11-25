import { Platform } from 'react-native';
import { useSyncExternalStore } from 'react';
import { createMMKV } from 'react-native-mmkv';
import {
  WavenAppearanceStore,
  WAVEN_APPEARANCE_STORAGE_ID,
  type WavenAppearanceStorage,
} from './appearanceStore';

let owner: WavenAppearanceStore | null = null;

function createAppearanceStorage(): WavenAppearanceStorage {
  try {
    if (Platform.OS === 'web') {
      const prefix = `${WAVEN_APPEARANCE_STORAGE_ID}.`;

      return {
        get: key => globalThis.localStorage.getItem(prefix + key),
        set: (key, value) =>
          globalThis.localStorage.setItem(prefix + key, value),
      };
    }

    const mmkv = createMMKV({
      id: WAVEN_APPEARANCE_STORAGE_ID,
    });

    return {
      get: key => mmkv.getString(key) ?? null,
      set: (key, value) => mmkv.set(key, value),
    };
  } catch {
    const unavailable = (): never => {
      throw new Error('WAVEN_APPEARANCE_STORAGE_UNAVAILABLE');
    };

    return {
      get: unavailable,
      set: unavailable,
    };
  }
}

export function getWavenAppearanceStore(): WavenAppearanceStore {
  return owner ??= new WavenAppearanceStore(
    createAppearanceStorage(),
  );
}

export function useWavenAppearancePreferences() {
  const store = getWavenAppearanceStore();

  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
}
