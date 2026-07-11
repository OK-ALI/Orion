import { useState, useEffect, useCallback } from 'react';

const listeners = new Set();
let globalProvidersState = { active: {}, all: [], loaded: false };

const notify = () => {
  listeners.forEach(listener => listener({ ...globalProvidersState }));
};

export const providersStore = {
  get state() {
    return globalProvidersState;
  },

  async loadFromDisk() {
    if (!window.electron?.musicListProviders) return;
    try {
      const all = await window.electron.musicListProviders() || [];
      
      // Compute the active map from provider registry configs
      const active = {};
      all.forEach(p => {
        if (p.active) {
          active[p.kind] = p.id;
        }
      });

      globalProvidersState = { active, all, loaded: true };
      notify();
    } catch (e) {
      console.error("Failed to load providers:", e);
    }
  },

  getActive(kind) {
    return globalProvidersState.active[kind];
  },

  async setActive(kind, providerId) {
    if (!window.electron?.musicSetActiveProvider) return;
    try {
      await window.electron.musicSetActiveProvider(kind, providerId);
      await this.loadFromDisk();
    } catch (e) {
      console.error(`Failed to set active provider for ${kind}:`, e);
      throw e;
    }
  },

  async clearActive(kind) {
    if (!window.electron?.musicSetActiveProvider) return;
    try {
      await window.electron.musicSetActiveProvider(kind, null);
      await this.loadFromDisk();
    } catch (e) {
      console.error(`Failed to clear active provider for ${kind}:`, e);
      throw e;
    }
  }
};

// Initialize the store
providersStore.loadFromDisk();

export function useProvidersStore() {
  const [state, setState] = useState(globalProvidersState);

  useEffect(() => {
    listeners.add(setState);
    if (!globalProvidersState.loaded) {
      providersStore.loadFromDisk();
    }
    const refreshAfterBackup = () => providersStore.loadFromDisk();
    window.addEventListener('orion:music-backup-restored', refreshAfterBackup);
    return () => {
      listeners.delete(setState);
      window.removeEventListener('orion:music-backup-restored', refreshAfterBackup);
    };
  }, []);

  return {
    active: state.active,
    providers: state.all,
    loaded: state.loaded,
    getActive: useCallback((kind) => providersStore.getActive(kind), []),
    setActive: useCallback((kind, providerId) => providersStore.setActive(kind, providerId), []),
    clearActive: useCallback((kind) => providersStore.clearActive(kind), []),
    loadFromDisk: useCallback(() => providersStore.loadFromDisk(), [])
  };
}
