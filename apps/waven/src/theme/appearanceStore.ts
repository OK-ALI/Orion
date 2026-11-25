import {
  DEFAULT_WAVEN_APPEARANCE,
  decodeWavenAppearance,
  validateWavenAppearance,
  type WavenAppearancePreferences,
} from './appearance';

export const WAVEN_APPEARANCE_STORAGE_ID = 'waven.appearance';
export const WAVEN_APPEARANCE_STORAGE_KEY = 'preferences';

export interface WavenAppearanceStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export type WavenAppearanceStatus =
  'ready' | 'blocked' | 'unavailable' | 'unconfirmed';

export interface WavenAppearanceSnapshot {
  readonly status: WavenAppearanceStatus;
  readonly preferences: WavenAppearancePreferences;
}

export class WavenAppearanceStore {
  private raw: string | null = null;

  private snapshot: WavenAppearanceSnapshot = Object.freeze({
    status: 'ready',
    preferences: DEFAULT_WAVEN_APPEARANCE,
  });

  private readonly listeners = new Set<() => void>();

  constructor(private readonly storage: WavenAppearanceStorage) {
    try {
      this.raw = storage.get(WAVEN_APPEARANCE_STORAGE_KEY);

      if (this.raw !== null) {
        const preferences = decodeWavenAppearance(this.raw);

        this.snapshot = Object.freeze({
          status: preferences ? 'ready' : 'blocked',
          preferences: preferences ?? DEFAULT_WAVEN_APPEARANCE,
        });
      }
    } catch {
      this.snapshot = Object.freeze({
        status: 'unavailable',
        preferences: DEFAULT_WAVEN_APPEARANCE,
      });
    }
  }

  getSnapshot = (): WavenAppearanceSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private publish(
    status: WavenAppearanceStatus,
    preferences: WavenAppearancePreferences,
  ): void {
    this.snapshot = Object.freeze({ status, preferences });

    for (const listener of [...this.listeners]) {
      try {
        listener();
      } catch {
        // Observer failure must not alter durable preference state.
      }
    }
  }

  replace(value: unknown): boolean {
    if (this.snapshot.status !== 'ready') return false;

    const candidate = validateWavenAppearance(value);
    if (!candidate) return false;

    const previous = this.snapshot.preferences;
    const encoded = JSON.stringify(candidate);
    const key = WAVEN_APPEARANCE_STORAGE_KEY;

    try {
      // Do not overwrite an unexpected or externally changed preimage.
      if (this.storage.get(key) !== this.raw) {
        this.publish('blocked', previous);
        return false;
      }

      if (encoded === this.raw) return true;

      this.storage.set(key, encoded);

      // Publish success only after exact storage readback.
      if (this.storage.get(key) !== encoded) {
        this.publish('unconfirmed', previous);
        return false;
      }

      this.raw = encoded;
      this.publish('ready', candidate);
      return true;
    } catch {
      // A write may have been partially applied by the storage layer.
      // Preserve the last confirmed state and block further writes.
      this.publish('unconfirmed', previous);
      return false;
    }
  }
}
