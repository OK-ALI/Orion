import { useState, useEffect, useCallback } from 'react';

const listeners = new Set();
let globalPlugins = { list: [], loaded: false, isLoading: false };

const notify = () => {
  listeners.forEach(listener => listener({ ...globalPlugins }));
};

export const pluginStore = {
  get state() {
    return globalPlugins;
  },

  async loadFromDisk() {
    if (!window.electron?.musicListPlugins) return;
    globalPlugins.isLoading = true;
    notify();
    try {
      const list = await window.electron.musicListPlugins() || [];
      globalPlugins = { list, loaded: true, isLoading: false };
      notify();
    } catch (e) {
      console.error("Failed to load plugins:", e);
      globalPlugins.isLoading = false;
      notify();
    }
  },

  async installPlugin(id) {
    if (!window.electron?.musicInstallPlugin) return;
    globalPlugins.isLoading = true;
    notify();
    try {
      await window.electron.musicInstallPlugin(id);
      await this.loadFromDisk();
    } catch (e) {
      console.error("Failed to install plugin:", e);
      globalPlugins.isLoading = false;
      notify();
      throw e;
    }
  },

  async enablePlugin(id) {
    if (!window.electron?.musicSetPluginEnabled) return;
    try {
      await window.electron.musicSetPluginEnabled(id, true);
      await this.loadFromDisk();
    } catch (e) {
      console.error(`Failed to enable plugin ${id}:`, e);
      throw e;
    }
  },

  async disablePlugin(id) {
    if (!window.electron?.musicSetPluginEnabled) return;
    try {
      await window.electron.musicSetPluginEnabled(id, false);
      await this.loadFromDisk();
    } catch (e) {
      console.error(`Failed to disable plugin ${id}:`, e);
      throw e;
    }
  },

  async removePlugin(id) {
    if (!window.electron?.musicRemovePlugin) return;
    globalPlugins.isLoading = true;
    notify();
    try {
      await window.electron.musicRemovePlugin(id);
      await this.loadFromDisk();
    } catch (e) {
      console.error(`Failed to remove plugin ${id}:`, e);
      globalPlugins.isLoading = false;
      notify();
      throw e;
    }
  },

  getPlugin(id) {
    return globalPlugins.list.find(p => p.id === id);
  },

  getAllPlugins() {
    return globalPlugins.list;
  }
};

// Initialize the store
pluginStore.loadFromDisk();

export function usePluginStore() {
  const [state, setState] = useState(globalPlugins);

  useEffect(() => {
    listeners.add(setState);
    if (!globalPlugins.loaded) {
      pluginStore.loadFromDisk();
    }
    return () => {
      listeners.delete(setState);
    };
  }, []);

  return {
    plugins: state.list,
    loaded: state.loaded,
    isLoading: state.isLoading,
    installPlugin: useCallback((id) => pluginStore.installPlugin(id), []),
    enablePlugin: useCallback((id) => pluginStore.enablePlugin(id), []),
    disablePlugin: useCallback((id) => pluginStore.disablePlugin(id), []),
    removePlugin: useCallback((id) => pluginStore.removePlugin(id), []),
    getPlugin: useCallback((id) => pluginStore.getPlugin(id), []),
    getAllPlugins: useCallback(() => pluginStore.getAllPlugins(), []),
    loadFromDisk: useCallback(() => pluginStore.loadFromDisk(), [])
  };
}
