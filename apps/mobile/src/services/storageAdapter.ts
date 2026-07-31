import { Platform } from 'react-native';
import { IStorageAdapter, MemoryStorageAdapter } from '@orion/shared/api';

// Create a unified adapter that uses MMKV on native, and falls back to MemoryStorage
// This prevents crashes on Expo Web or when using Expo Go
let adapter: IStorageAdapter;

if (Platform.OS !== 'web') {
  try {
    const { MMKV } = require('react-native-mmkv');
    const mmkv = new MMKV();
    adapter = {
      get: (key: string) => mmkv.getString(key) || null,
      set: (key: string, value: string) => mmkv.set(key, value),
      remove: (key: string) => mmkv.delete(key),
    };
  } catch (e) {
    console.warn('MMKV failed to initialize, falling back to MemoryStorageAdapter');
    adapter = new MemoryStorageAdapter();
  }
} else {
  adapter = typeof window !== 'undefined' && window.localStorage
    ? {
        get: (key: string) => window.localStorage.getItem(key),
        set: (key: string, value: string) => window.localStorage.setItem(key, value),
        remove: (key: string) => window.localStorage.removeItem(key),
      }
    : new MemoryStorageAdapter();
}

export const mmkvStorageAdapter = adapter;
