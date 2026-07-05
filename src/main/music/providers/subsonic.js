const crypto = require("crypto");

const CONFIG_KEY = "music.subsonic";
const CLIENT_NAME = "Orion";
const API_VERSION = "1.16.1";
const MAX_ARTWORK_BYTES = 8 * 1024 * 1024;

function getConfig() {
  try {
    const { secureStoreGet } = require("../../ipc/storageIpc");
    const config = JSON.parse(secureStoreGet(CONFIG_KEY) || "null");
    if (!config?.url || !config?.username || !config?.password) return null;
    const url = new URL(config.url);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return { ...config, url: url.toString().replace(/\/$/, "") };
  } catch { return null; }
}

function auth(config) {
  const salt = crypto.randomBytes(8).toString("hex");
  const token = crypto.createHash("md5").update(`${config.password}${salt}`).digest("hex");
  return new URLSearchParams({ u: config.username, t: token, s: salt, v: API_VERSION, c: CLIENT_NAME, f: "json" });
}

function friendlyError(status, message = "") {
  if ([401, 403].includes(status) || /credential|password|unauthor/i.test(message)) {
    return new Error("Subsonic rejected the saved credentials. Reconnect this source in Music settings.");
  }
  if (status === 429) return new Error("Subsonic rate limited Orion. Wait briefly and try again.");
  if (status >= 500) return new Error("The Subsonic server is temporarily unavailable.");
  if (status) return new Error(`Subsonic returned ${status}.`);
  return new Error(message || "Subsonic request failed.");
}

function createClient({ getConfiguration = getConfig, fetchImpl = globalThis.fetch } = {}) {
  async function request(method, params = {}, { signal, binary = false } = {}) {
    const config = getConfiguration();
    if (!config) throw new Error("Configure Subsonic or Navidrome in Music Sources first.");
    const query = auth(config);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
    }
    const response = await fetchImpl(`${config.url}/rest/${method}.view?${query}`, {
      signal, redirect: "error", headers: { Accept: binary ? "image/*" : "application/json" },
    });
    if (!response.ok) throw friendlyError(response.status);
    if (binary) {
      const length = Number(response.headers.get("content-length") || 0);
      if (length > MAX_ARTWORK_BYTES) throw new Error("Subsonic artwork is too large.");
      const data = Buffer.from(await response.arrayBuffer());
      if (!data.length || data.length > MAX_ARTWORK_BYTES) throw new Error("Subsonic artwork is empty or too large.");
      return { data, mimeType: response.headers.get("content-type") || "image/jpeg" };
    }
    let body;
    try { body = await response.json(); } catch { throw new Error("Subsonic returned an invalid response."); }
    const result = body["subsonic-response"];
    if (result?.status !== "ok") throw friendlyError(0, result?.error?.message);
    return result;
  }
  return { request };
}

const defaultClient = createClient();

function source(id) { return { provider: "subsonic-metadata", id: String(id) }; }

function normalizeArtist(item = {}) {
  return {
    id: `subsonic:${item.id}`, name: item.name || "Unknown artist",
    albumCount: Number(item.albumCount) || null, artworkId: item.coverArt || null,
    artworkProviderId: "subsonic-metadata", source: source(item.id),
  };
}

function normalizeAlbum(item = {}) {
  return {
    id: `subsonic:${item.id}`, providerAlbumId: String(item.id), title: item.name || item.album || "Unknown album",
    artistName: item.artist || "Unknown artist", artistId: item.artistId ? `subsonic:${item.artistId}` : null,
    durationMs: item.duration ? Number(item.duration) * 1000 : null, songCount: Number(item.songCount) || null,
    year: Number(item.year) || null, genres: item.genre ? [item.genre] : [], artworkId: item.coverArt || null,
    artworkProviderId: "subsonic-metadata", source: source(item.id),
  };
}

function normalizeTrack(item = {}) {
  return {
    id: `subsonic:${item.id}`, providerTrackId: String(item.id), provider: "subsonic",
    title: item.title || "Unknown track", artistName: item.artist || "Unknown artist",
    albumTitle: item.album || null, albumArtist: item.albumArtist || item.artist || null,
    durationMs: item.duration ? Number(item.duration) * 1000 : null, year: Number(item.year) || null,
    trackNumber: Number(item.track) || null, discNumber: Number(item.discNumber) || null,
    genres: item.genre ? [item.genre] : [], mimeType: item.contentType || null,
    artworkId: item.coverArt || null, artworkProviderId: "subsonic-metadata", source: source(item.id),
    providerRefs: [source(item.id)],
  };
}

function normalizePlaylist(item = {}) {
  return {
    id: String(item.id), name: item.name || "Untitled server playlist",
    description: item.comment || "Imported from Subsonic", trackCount: Number(item.songCount) || 0,
    durationMs: item.duration ? Number(item.duration) * 1000 : null,
    artworkId: item.coverArt || null, artworkProviderId: "subsonic-metadata",
  };
}

async function getDashboard(signal) {
  const [albums, songs, playlists] = await Promise.all([
    defaultClient.request("getAlbumList2", { type: "newest", size: 24 }, { signal }),
    defaultClient.request("getRandomSongs", { size: 30 }, { signal }),
    defaultClient.request("getPlaylists", {}, { signal }),
  ]);
  return { sections: [
    { id: "subsonic-newest", title: "New on Your Server", type: "albums", attribution: "Subsonic", items: (albums.albumList2?.album || []).map(normalizeAlbum) },
    { id: "subsonic-mix", title: "From Your Music Server", type: "tracks", attribution: "Subsonic", items: (songs.randomSongs?.song || []).map(normalizeTrack) },
    { id: "subsonic-playlists", title: "Server Playlists", type: "playlists", attribution: "Subsonic", items: (playlists.playlists?.playlist || []).map(normalizePlaylist) },
  ].filter((section) => section.items.length) };
}

function createSubsonicProviders() {
  const configured = () => !!getConfig();
  const metadata = {
    id: "subsonic-metadata", kind: "metadata", name: "Subsonic / Navidrome", requiresConfiguration: true,
    isConfigured: configured, capabilities: ["unified", "artists", "albums", "tracks", "details", "artwork"],
    pairedStreamingProviderId: "subsonic-streaming",
    async search(query, { signal } = {}) {
      const result = await defaultClient.request("search3", { query, artistCount: 12, albumCount: 12, songCount: 30 }, { signal });
      const values = result.searchResult3 || {};
      return { artists: (values.artist || []).map(normalizeArtist), albums: (values.album || []).map(normalizeAlbum),
        tracks: (values.song || []).map(normalizeTrack), playlists: [] };
    },
    async getArtist(item, { signal } = {}) {
      const id = String(item.source?.id || item.providerArtistId || item.id || "").replace(/^subsonic:/, "");
      const result = await defaultClient.request("getArtist", { id }, { signal });
      return { artist: normalizeArtist(result.artist), albums: (result.artist?.album || []).map(normalizeAlbum) };
    },
    async getAlbum(item, { signal } = {}) {
      const id = String(item.source?.id || item.providerAlbumId || item.id || "").replace(/^subsonic:/, "");
      const result = await defaultClient.request("getAlbum", { id }, { signal });
      return { album: normalizeAlbum(result.album), tracks: (result.album?.song || []).map(normalizeTrack) };
    },
    async getArtwork(item, { signal } = {}) {
      const id = String(item.artworkId || "");
      if (!id) throw new Error("This Subsonic item has no artwork.");
      const value = await defaultClient.request("getCoverArt", { id, size: 512 }, { signal, binary: true });
      return { ...value, cacheKey: `subsonic:${id}` };
    },
  };
  const streaming = {
    id: "subsonic-streaming", kind: "streaming", name: "Subsonic / Navidrome", requiresConfiguration: true,
    isConfigured: configured, capabilities: ["candidateSearch", "justInTimeResolution", "range", "refresh"],
    async searchForTrack(item) {
      const id = item.providerTrackId || (item.source?.provider === "subsonic-metadata" ? item.source.id : null);
      return id ? [{ id: String(id), providerId: "subsonic-streaming", title: item.title, artistName: item.artistName,
        durationMs: item.durationMs, artworkId: item.artworkId }] : [];
    },
    async resolveCandidate(candidate) {
      const config = getConfig();
      if (!config) throw new Error("Configure Subsonic or Navidrome in Music Sources first.");
      const query = auth(config); query.set("id", String(candidate.id));
      return { kind: "remote", url: `${config.url}/rest/stream.view?${query}`, headers: {}, expiresAt: Date.now() + 30 * 60_000 };
    },
  };
  const dashboard = { id: "subsonic-dashboard", kind: "dashboard", name: "Subsonic / Navidrome",
    requiresConfiguration: true, isConfigured: configured, capabilities: ["newReleases", "randomMix", "serverPlaylists"],
    getDashboard: ({ signal } = {}) => getDashboard(signal) };
  const playlists = { id: "subsonic-playlists", kind: "playlists", name: "Subsonic / Navidrome",
    requiresConfiguration: true, isConfigured: configured, capabilities: ["browse", "import"],
    async listPlaylists({ signal } = {}) {
      const result = await defaultClient.request("getPlaylists", {}, { signal });
      return (result.playlists?.playlist || []).map(normalizePlaylist);
    },
    async importPlaylist(value, { signal } = {}) {
      const id = String(value?.id || value || "").trim();
      if (!id || id.length > 200) throw new Error("Choose a valid Subsonic playlist.");
      const result = await defaultClient.request("getPlaylist", { id }, { signal });
      return { name: result.playlist?.name || "Imported Subsonic playlist",
        description: result.playlist?.comment || "Imported from Subsonic", items: (result.playlist?.entry || []).map(normalizeTrack) };
    },
  };
  return [metadata, streaming, dashboard, playlists];
}

async function testConnection() { await defaultClient.request("ping"); return true; }

module.exports = { CONFIG_KEY, auth, createClient, createSubsonicProviders, friendlyError, getConfig,
  normalizeAlbum, normalizeArtist, normalizePlaylist, normalizeTrack, testConnection };
