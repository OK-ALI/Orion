/**
 * Storage Adapter Interface
 *
 * Abstracts key-value storage so the same API client code works with:
 * - localStorage (desktop/web)
 * - react-native-mmkv (mobile)
 * - AsyncStorage (mobile fallback)
 * - In-memory Map (tests)
 */

export interface IStorageAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

/**
 * In-memory storage adapter for testing and SSR.
 */
export class MemoryStorageAdapter implements IStorageAdapter {
  private store = new Map<string, string>();

  get(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  set(key: string, value: string): void {
    this.store.set(key, value);
  }

  remove(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}
