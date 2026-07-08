const fs = require("fs");
const crypto = require("crypto");
const { dialog, ipcMain } = require("electron");
const { MUSIC_IPC } = require("../../shared/musicConstants.cjs");
const database = require("./database");
const registry = require("./providers/registry");
const broker = require("./providers/requestBroker");
const scanner = require("./library/scanner");
const watcher = require("./library/watcher");
const resolver = require("./playback/streamResolver");
const tokens = require("./playback/tokenRegistry");
const { artworkUrlFor, cacheArtworkBuffer, cacheRemoteArtwork, cacheStatus,
  clearArtworkCache, pruneArtworkCache } = require("./library/artworkCache");
const { secureStoreSet } = require("../ipc/storageIpc");
const plugins = require("./plugins/manager");
const { parseJsonPlaylist, parseM3uPlaylist, serializeJsonPlaylist, serializeM3uPlaylist } = require("./library/playlistFiles");

const SUBSONIC_CONFIG_KEY = "subsonic_config";

const WEIGHTS = { "orion-local-metadata": 1.2, "musicbrainz-metadata": 1.05, "saavn-metadata": 1.1 };

function text(item) { return `${item.name || item.title || ""} ${item.artistName || ""}`.trim().toLowerCase(); }
function score(item, query, providerId) {
  const candidate = text(item); const term = String(query || "").trim().toLowerCase();
  let relevance = candidate === term ? 4 : candidate.startsWith(term) ? 3 : candidate.includes(term) ? 2 : 1;
  if (String(item.title || item.name || "").toLowerCase() === term) relevance += 2;
  return relevance * (WEIGHTS[providerId] || .9) + Math.min(1, Number(item.popularity || item.listenCount || 0) / 1_000_000);
}

function mergeKind(results, kind, query) {
  const merged = new Map();
  for (const result of results) {
    const items = result.value?.[kind] || [];
    for (const item of items) {
      const key = `${String(item.name || item.title || "").toLowerCase()}\0${String(item.artistName || "").toLowerCase()}`;
      const reference = item.source || { provider: result.providerId, id: item.id };
      const current = merged.get(key);
      const scored = {
        ...item,
        artworkUrl: item.artworkUrl || current?.artworkUrl || null,
        profileImageUrl: item.profileImageUrl || current?.profileImageUrl || null,
        providerRefs: [...(current?.providerRefs || []), ...(item.providerRefs || []), reference]
          .filter((ref, index, all) => ref && all.findIndex((entry) => entry.provider === ref.provider && entry.id === ref.id) === index),
        matchScore: Math.max(current?.matchScore || 0, score(item, query, result.providerId))
      };
      merged.set(key, current && current.matchScore > scored.matchScore ? {
        ...current,
        artworkUrl: current.artworkUrl || scored.artworkUrl,
        profileImageUrl: current.profileImageUrl || scored.profileImageUrl,
        providerRefs: scored.providerRefs
      } : scored);
    }
  }
  return [...merged.values()].sort((a, b) => b.matchScore - a.matchScore);
}

function aggregateSearch(results, query) {
  return {
    providerId: "orion-omnisource",
    providerName: "OmniSource",
    value: {
      artists: mergeKind(results, "artists", query),
      albums: mergeKind(results, "albums", query),
      tracks: mergeKind(results, "tracks", query),
      playlists: mergeKind(results, "playlists", query)
    }
  };
}

let registered = false;

function folderId(folderPath) {
  return crypto.createHash("sha256").update(folderPath.toLowerCase()).digest("hex").slice(0, 20);
}

function safeSend(sender, channel, payload) {
  try { if (!sender.isDestroyed()) sender.send(channel, payload); } catch {}
}

function register() {
  if (registered) return;
  registered = true;
  ipcMain.handle(MUSIC_IPC.STATUS, () => ({ ok: true, schemaVersion: require("../../shared/musicConstants.cjs").MUSIC_SCHEMA_VERSION,
    trackCount: database.openDatabase().prepare("SELECT COUNT(*) count FROM music_tracks WHERE missing=0").get().count }));
  ipcMain.handle(MUSIC_IPC.FOLDERS_LIST, () => database.listFolders().map((item) => ({
    id: folderId(item.path), name: item.path.split(/[\\/]/).filter(Boolean).pop(),
    addedAt: item.added_at, lastScanAt: item.last_scan_at,
  })));
  ipcMain.handle(MUSIC_IPC.FOLDERS_ADD, async (event) => {
    const result = await dialog.showOpenDialog({ title: "Add a music folder", properties: ["openDirectory"] });
    const folderPath = result.canceled ? null : result.filePaths[0];
    if (!folderPath || !fs.existsSync(folderPath)) return { ok: false, cancelled: true };
    database.addFolder(folderPath);
    await watcher.startWatcher(database.listFolders().map((item) => item.path));
    const scan = await scanner.scanFolder(folderPath, (progress) => safeSend(event.sender, MUSIC_IPC.SCAN_PROGRESS, progress));
    return { ok: true, ...scan };
  });
  ipcMain.handle(MUSIC_IPC.FOLDERS_REMOVE, (_, id) => {
    const folder = database.listFolders().find((item) => folderId(item.path) === id);
    if (!folder) return { ok: false, error: "Music folder was not found." };
    database.removeFolder(folder.path);
    watcher.startWatcher(database.listFolders().map((item) => item.path));
    return { ok: true };
  });
  ipcMain.handle(MUSIC_IPC.SCAN_START, async (event) => {
    const folders = database.listFolders();
    const results = [];
    for (const folder of folders) {
      const result = await scanner.scanFolder(folder.path, (progress) => safeSend(event.sender, MUSIC_IPC.SCAN_PROGRESS,
        { ...progress, folder: folder.path.split(/[\\/]/).filter(Boolean).pop() }));
      results.push(result);
      if (result.cancelled) break;
    }
    return { ok: true, results };
  });
  ipcMain.handle(MUSIC_IPC.SCAN_CANCEL, () => ({ ok: scanner.cancelScan() }));
  ipcMain.handle(MUSIC_IPC.TRACKS_LIST, (_, options) => database.listTracks(options || {}));
  ipcMain.handle(MUSIC_IPC.TRACK_GET_STREAM, async (_, track, providerId) => {
    try { return { ok: true, ...(await resolver.resolveTrack(track, providerId)) }; }
    catch (error) { return { ok: false, error: error?.message || "This track could not be resolved." }; }
  });
  ipcMain.handle(MUSIC_IPC.TRACK_CANDIDATES, async (_, track, providerId) => {
    try { return { ok: true, candidates: await resolver.listCandidateSummaries(track || {}, providerId) }; }
    catch (error) { return { ok: false, error: error?.message || "Music sources could not be loaded.", candidates: [] }; }
  });
  ipcMain.handle(MUSIC_IPC.TRACK_RESOLVE_CANDIDATE, async (_, id) => {
    try { return { ok: true, ...(await resolver.resolveCandidateGrant(id)) }; }
    catch (error) { return { ok: false, error: error?.message || "That music source could not be played." }; }
  });
  ipcMain.handle(MUSIC_IPC.ARTWORK_GET, async (_, track = {}) => {
    const privateTrack = track.id ? database.getPrivateTrack(track.id) : null;
    if (privateTrack?.artwork_path && fs.existsSync(privateTrack.artwork_path)) {
      return { ok: true, ...tokens.createGrant({ kind: "artwork", filePath: privateTrack.artwork_path, mimeType: "image/png" }) };
    }
    const artworkUrl = artworkUrlFor(track);
    if (artworkUrl) {
      try {
        const filePath = await cacheRemoteArtwork(artworkUrl);
        return { ok: true, ...tokens.createGrant({ kind: "artwork", filePath, mimeType: "image/png" }) };
      } catch {}
    }
    const providerId = track.artworkProviderId || track.source?.provider;
    const artworkProvider = registry.get(providerId, "metadata");
    if (artworkProvider?.getArtwork && track.artworkId) {
      try {
        const result = await artworkProvider.getArtwork(track);
        const filePath = await cacheArtworkBuffer(result.cacheKey || `${providerId}:${track.artworkId}`, result.data);
        return { ok: true, ...tokens.createGrant({ kind: "artwork", filePath, mimeType: "image/png" }) };
      } catch {}
    }
    return { ok: false, error: "Artwork is unavailable." };
  });
  ipcMain.handle(MUSIC_IPC.LYRICS_GET, async (_, track) => {
    const providers = [registry.getActive("lyrics"), ...registry.list("lyrics")]
      .filter((provider, index, list) => provider && list.findIndex((item) => item.id === provider.id) === index);
    for (const provider of providers) {
      if (typeof provider.getLyrics !== "function") continue;
      try {
        const lyrics = await provider.getLyrics(track || {});
        if (lyrics) return { ok: true, lyrics, providerId: provider.id };
      } catch {}
    }
    return { ok: false, error: "No lyrics are available for this track." };
  });
  ipcMain.handle(MUSIC_IPC.PROVIDERS_LIST, () => registry.list().map((provider) => ({
    ...registry.publicDescriptor(provider), active: registry.getActive(provider.kind)?.id === provider.id,
  })));
  ipcMain.handle(MUSIC_IPC.PROVIDER_CONFIGURE, (_, kind, providerId) => {
    registry.setActive(kind, providerId);
    return { ok: true };
  });
  ipcMain.handle(MUSIC_IPC.PROVIDER_SAVE_CONFIG, async () => {
    return { ok: false, error: "This provider configuration is deprecated." };
  });
  ipcMain.handle(MUSIC_IPC.SEARCH, async (_, query) => {
    const providers = registry.list("metadata").filter((provider) => typeof provider.search === "function");
    const safeQuery = String(query || "").slice(0, 200);
    const response = await broker.queryProviders(providers, "search", [safeQuery], { timeout: 10_000 });
    return { ...response, results: response.results.length ? [aggregateSearch(response.results, safeQuery)] : [] };
  });
  ipcMain.handle(MUSIC_IPC.DASHBOARD_GET, async () => {
    const available = registry.list("dashboard").filter((provider) => typeof provider.getDashboard === "function" && (!provider.requiresConfiguration || provider.isConfigured?.()));
    const result = await broker.queryProviders(available, "getDashboard", [], { timeout: 12_000 });
    return { sections: result.results.flatMap((entry) => (entry.value?.sections || []).map((section) => ({ ...section, providerId: entry.providerId }))), errors: result.errors };
  });
  ipcMain.handle(MUSIC_IPC.DETAILS_GET, async (_, kind, item = {}) => {
    const operation = kind === "artist" ? "getArtist" : kind === "album" ? "getAlbum" : null;
    if (!operation) return { ok: false, error: "Unsupported Music detail type." };
    const preferred = registry.get(item.source?.provider, "metadata");
    const candidates = [preferred, ...registry.list("metadata")].filter((provider, index, all) => provider && typeof provider[operation] === "function" && all.findIndex((entry) => entry?.id === provider.id) === index);
    for (const provider of candidates) {
      try { return { ok: true, providerId: provider.id, value: await provider[operation](item) }; } catch {}
    }
    return { ok: false, error: `${kind === "artist" ? "Artist" : "Album"} details are unavailable from the enabled providers.` };
  });
  ipcMain.handle(MUSIC_IPC.PLUGINS_LIST, () => plugins.listPlugins());
  ipcMain.handle(MUSIC_IPC.PLUGIN_INSTALL, (_, id) => {
    try { return { ok: true, plugin: plugins.install(id) }; } catch (error) { return { ok: false, error: error.message }; }
  });
  ipcMain.handle(MUSIC_IPC.PLUGIN_SET_ENABLED, (_, id, enabled) => {
    try { return { ok: true, plugin: plugins.setEnabled(id, enabled) }; } catch (error) { return { ok: false, error: error.message }; }
  });
  ipcMain.handle(MUSIC_IPC.PLUGIN_REMOVE, (_, id) => {
    try { return { ok: plugins.remove(id) }; } catch (error) { return { ok: false, error: error.message }; }
  });
  ipcMain.handle(MUSIC_IPC.PLAYLISTS_LIST, () => database.listPlaylists());
  ipcMain.handle(MUSIC_IPC.PLAYLISTS_REMOTE_LIST, async () => {
    const providers = registry.list("playlists").filter((provider) => typeof provider.listPlaylists === "function"
      && (!provider.requiresConfiguration || provider.isConfigured?.()));
    const response = await broker.queryProviders(providers, "listPlaylists", [], { timeout: 10_000 });
    return { sources: response.results.map((entry) => ({ providerId: entry.providerId,
      providerName: entry.providerName, playlists: entry.value || [] })), errors: response.errors };
  });
  ipcMain.handle(MUSIC_IPC.PLAYLISTS_SAVE, (_, playlist) => database.savePlaylist(playlist || {}));
  ipcMain.handle(MUSIC_IPC.PLAYLISTS_DELETE, (_, id) => ({ ok: database.deletePlaylist(id) }));
  ipcMain.handle(MUSIC_IPC.PLAYLISTS_IMPORT, async (_, providerId, value) => {
    const provider = registry.get(providerId, "playlists");
    if (!provider?.importPlaylist) return { ok: false, error: "Install and enable a playlist-import plugin first." };
    try { return { ok: true, playlist: database.savePlaylist(await provider.importPlaylist(value)) }; }
    catch (error) { return { ok: false, error: error.message || "Playlist import failed." }; }
  });
  ipcMain.handle(MUSIC_IPC.PLAYLISTS_IMPORT_FILE, async () => {
    const selection = await dialog.showOpenDialog({ title: "Import a Music playlist", properties: ["openFile"],
      filters: [{ name: "Music playlists", extensions: ["json", "m3u", "m3u8"] }] });
    if (selection.canceled || !selection.filePaths[0]) return { ok: false, cancelled: true };
    const filePath = selection.filePaths[0];
    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile() || stat.size > 20 * 1024 * 1024) return { ok: false, error: "Playlist files must be smaller than 20 MB." };
    try {
      const text = await fs.promises.readFile(filePath, "utf8");
      const fallbackName = require("path").parse(filePath).name;
      const playlist = /\.json$/i.test(filePath) ? parseJsonPlaylist(text, fallbackName)
        : parseM3uPlaylist(text, { baseDirectory: require("path").dirname(filePath), fallbackName,
          localTrackForPath: (value) => database.publicTrack(database.getPrivateTrackByPath(value)) });
      if (!playlist.items.length) throw new Error("The playlist did not contain any usable tracks.");
      return { ok: true, playlist: database.saveImportedPlaylist(playlist) };
    } catch (error) { return { ok: false, error: error.message || "Playlist import failed." }; }
  });
  ipcMain.handle(MUSIC_IPC.PLAYLISTS_EXPORT_FILE, async (_, playlistId, format = "json") => {
    const playlist = database.listPlaylists().find((item) => item.id === playlistId);
    if (!playlist) return { ok: false, error: "Playlist was not found." };
    const extension = format === "m3u" ? "m3u8" : "json";
    const safeName = playlist.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 100) || "Orion playlist";
    const selection = await dialog.showSaveDialog({ title: "Export Music playlist", defaultPath: `${safeName}.${extension}`,
      filters: [{ name: format === "m3u" ? "Extended M3U" : "Orion JSON playlist", extensions: [extension] }] });
    if (selection.canceled || !selection.filePath) return { ok: false, cancelled: true };
    const content = format === "m3u" ? serializeM3uPlaylist(playlist, database.getPrivateTrack)
      : serializeJsonPlaylist(playlist);
    await fs.promises.writeFile(selection.filePath, content, { encoding: "utf8", flag: "w" });
    return { ok: true };
  });
  ipcMain.handle(MUSIC_IPC.FAVORITES_LIST, () => database.listFavorites());
  ipcMain.handle(MUSIC_IPC.FAVORITES_TOGGLE, (_, kind, identity, payload) => database.toggleFavorite(kind, identity, payload));
  ipcMain.handle(MUSIC_IPC.QUEUE_LOAD, () => database.getState("queue", { items: [], index: -1, repeat: "off", shuffle: false }));
  ipcMain.handle(MUSIC_IPC.QUEUE_SAVE, (_, queue) => { database.setState("queue", queue || {}); return { ok: true }; });
  ipcMain.handle(MUSIC_IPC.HISTORY_ADD, (_, track, positionMs) => { database.addHistory(track || {}, positionMs); return { ok: true }; });
  ipcMain.handle(MUSIC_IPC.HISTORY_LIST, (_, limit) => database.listHistory(limit));
  ipcMain.handle(MUSIC_IPC.BACKUP_EXPORT, () => ({ ok: true, state: database.exportPortableState() }));
  ipcMain.handle(MUSIC_IPC.BACKUP_IMPORT, (_, state) => {
    try { return { ok: true, imported: database.importPortableState(state) }; }
    catch (error) { return { ok: false, error: error.message || "Music backup could not be restored." }; }
  });
  ipcMain.handle(MUSIC_IPC.CACHE_STATUS, () => cacheStatus());
  ipcMain.handle(MUSIC_IPC.CACHE_SET_LIMIT, async (_, value) => {
    const limitMb = Math.min(2048, Math.max(64, Number(value) || 256));
    database.setState("artwork_cache_limit_mb", limitMb);
    return { ok: true, ...(await pruneArtworkCache(limitMb)) };
  });
  ipcMain.handle(MUSIC_IPC.CACHE_CLEAR, async () => {
    const result = await clearArtworkCache();
    database.openDatabase().prepare("UPDATE music_tracks SET artwork_path=NULL,artwork_checked=0 WHERE provider='local'").run();
    return { ok: true, ...result };
  });
}

async function start() {
  database.openDatabase();
  await watcher.startWatcher(database.listFolders().map((item) => item.path));
}

function stop() {
  scanner.cancelScan();
  const watcherStop = watcher.stopWatcher();
  database.closeDatabase();
  return watcherStop;
}

module.exports = { register, start, stop };
