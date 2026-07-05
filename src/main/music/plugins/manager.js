const database = require("../database");
const providers = require("../providers/registry");
const { catalog, getPlugin } = require("./catalog");

let factories = {};

function savedState() { return database.getState("music_plugins", { installed: {} }); }
function writeState(value) { database.setState("music_plugins", value); }

function normalizeState() {
  const state = savedState();
  for (const plugin of catalog) {
    if (plugin.defaultInstalled && !state.installed[plugin.id]) {
      state.installed[plugin.id] = { enabled: true, installedAt: Date.now(), version: plugin.version };
    }
  }
  writeState(state);
  return state;
}

function reloadProviders() {
  const state = normalizeState();
  providers.clear();
  for (const plugin of catalog) {
    const installed = state.installed[plugin.id];
    if (!installed?.enabled || !factories[plugin.id]) continue;
    for (const provider of factories[plugin.id]() || []) providers.register({ ...provider, pluginId: plugin.id });
  }
}

function initialize(providerFactories) { factories = { ...providerFactories }; reloadProviders(); }

function listPlugins() {
  const state = normalizeState();
  return catalog.map((plugin) => {
    const installed = state.installed[plugin.id];
    const ownedProviders = providers.list().filter((provider) => provider.pluginId === plugin.id);
    return { ...plugin, installed: !!installed, enabled: !!installed?.enabled,
      installedAt: installed?.installedAt || null, providerCount: ownedProviders.length,
      providerIds: ownedProviders.map((provider) => provider.id),
      available: !!factories[plugin.id], updateAvailable: false };
  });
}

function install(id) {
  const plugin = getPlugin(id);
  if (!plugin) throw new Error("Plugin was not found in Orion's curated registry.");
  if (!factories[id]) throw new Error("This provider adapter is listed for a later Music Planet checkpoint.");
  const state = normalizeState();
  state.installed[id] = { enabled: true, installedAt: Date.now(), version: plugin.version };
  writeState(state); reloadProviders(); return listPlugins().find((item) => item.id === id);
}

function setEnabled(id, enabled) {
  const plugin = getPlugin(id); const state = normalizeState();
  if (!plugin || !state.installed[id]) throw new Error("Plugin is not installed.");
  if (plugin.locked && !enabled) throw new Error("Orion Music Core cannot be disabled.");
  state.installed[id] = { ...state.installed[id], enabled: !!enabled };
  writeState(state); reloadProviders(); return listPlugins().find((item) => item.id === id);
}

function remove(id) {
  const plugin = getPlugin(id); const state = normalizeState();
  if (!plugin || !state.installed[id]) return false;
  if (plugin.locked) throw new Error("Orion Music Core cannot be removed.");
  delete state.installed[id]; writeState(state); reloadProviders(); return true;
}

module.exports = { initialize, install, listPlugins, reloadProviders, remove, setEnabled };
