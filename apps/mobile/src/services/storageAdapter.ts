import { Platform } from 'react-native';
import { IStorageAdapter, MemoryStorageAdapter } from '@orion/shared/api';

export type MobileStorageHealth =
  | { state: 'ready'; backend: 'mmkv' | 'localStorage' }
  | { state: 'unavailable'; backend: 'mmkv'; errorCode: string }
  | { state: 'memory'; backend: 'memory'; testOnly: true };

let adapter: IStorageAdapter;
let storageHealth: MobileStorageHealth;

const createUnavailableAdapter = (): IStorageAdapter => ({
  get: () => null,
  set: () => {
    throw new Error('MOBILE_STORAGE_UNAVAILABLE');
  },
  remove: () => {
    throw new Error('MOBILE_STORAGE_UNAVAILABLE');
  },
});

const memoryStorageIsAllowed =
  process.env.NODE_ENV === 'test'
  || (typeof __DEV__ !== 'undefined'
    && __DEV__
    && process.env.EXPO_PUBLIC_ALLOW_MEMORY_STORAGE === 'true');

if (Platform.OS !== 'web') {
  try {
    const { MMKV } = require('react-native-mmkv');
    const mmkv = new MMKV();
    adapter = {
      get: (key: string) => mmkv.getString(key) || null,
      set: (key: string, value: string) => mmkv.set(key, value),
      remove: (key: string) => mmkv.delete(key),
    };
    storageHealth = { state: 'ready', backend: 'mmkv' };
  } catch {
    if (memoryStorageIsAllowed) {
      adapter = new MemoryStorageAdapter();
      storageHealth = { state: 'memory', backend: 'memory', testOnly: true };
    } else {
      adapter = createUnavailableAdapter();
      storageHealth = {
        state: 'unavailable',
        backend: 'mmkv',
        errorCode: 'MMKV_INIT_FAILED',
      };
    }
  }
} else {
  if (typeof window !== 'undefined' && window.localStorage) {
    adapter = {
        get: (key: string) => window.localStorage.getItem(key),
        set: (key: string, value: string) => window.localStorage.setItem(key, value),
        remove: (key: string) => window.localStorage.removeItem(key),
    };
    storageHealth = { state: 'ready', backend: 'localStorage' };
  } else {
    adapter = new MemoryStorageAdapter();
    storageHealth = { state: 'memory', backend: 'memory', testOnly: true };
  }
}

export const mmkvStorageAdapter = adapter;

export function getMobileStorageHealth(): MobileStorageHealth {
  return storageHealth;
}
