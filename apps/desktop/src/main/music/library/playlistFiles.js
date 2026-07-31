const path = require("path");

const MAX_PLAYLIST_ITEMS = 10_000;
const ORION_TAG = "#ORION:";

function safeTrack(value) {
  if (!value || typeof value !== "object" || !value.id || !value.title) return null;
  return {
    id: String(value.id).slice(0, 500), provider: String(value.provider || "unknown").slice(0, 80),
    providerTrackId: value.providerTrackId ? String(value.providerTrackId).slice(0, 500) : undefined,
    title: String(value.title).slice(0, 500), artistName: String(value.artistName || "Unknown artist").slice(0, 500),
    albumTitle: value.albumTitle ? String(value.albumTitle).slice(0, 500) : null,
    durationMs: Number.isFinite(Number(value.durationMs)) ? Math.max(0, Number(value.durationMs)) : null,
    source: value.source?.provider && value.source?.id ? { provider: String(value.source.provider).slice(0, 120), id: String(value.source.id).slice(0, 500) } : undefined,
    artworkId: value.artworkId ? String(value.artworkId).slice(0, 500) : undefined,
    artworkProviderId: value.artworkProviderId ? String(value.artworkProviderId).slice(0, 120) : undefined,
  };
}

function parseJsonPlaylist(text, fallbackName = "Imported playlist") {
  let value;
  try { value = JSON.parse(text); } catch { throw new Error("This JSON playlist is not valid JSON."); }
  if (!value || typeof value !== "object" || !Array.isArray(value.items)) throw new Error("This is not an Orion JSON playlist.");
  const items = value.items.slice(0, MAX_PLAYLIST_ITEMS).map(safeTrack).filter(Boolean);
  return { name: String(value.name || fallbackName).slice(0, 160), description: String(value.description || "Imported from JSON").slice(0, 1000), items };
}

function serializeJsonPlaylist(playlist) {
  return `${JSON.stringify({ format: "orion-music-playlist", version: 1, name: playlist.name,
    description: playlist.description || "", items: (playlist.items || []).slice(0, MAX_PLAYLIST_ITEMS).map(safeTrack).filter(Boolean) }, null, 2)}\n`;
}

function encodeTrack(track) {
  return Buffer.from(JSON.stringify(safeTrack(track)), "utf8").toString("base64url");
}

function decodeTrack(value) {
  try { return safeTrack(JSON.parse(Buffer.from(value, "base64url").toString("utf8"))); } catch { return null; }
}

function serializeM3uPlaylist(playlist, privateTrackFor = () => null) {
  const lines = ["#EXTM3U", `#PLAYLIST:${String(playlist.name || "Orion playlist").replace(/[\r\n]/g, " ")}`];
  for (const track of (playlist.items || []).slice(0, MAX_PLAYLIST_ITEMS)) {
    const clean = safeTrack(track);
    if (!clean) continue;
    lines.push(`#EXTINF:${clean.durationMs ? Math.round(clean.durationMs / 1000) : -1},${clean.artistName} - ${clean.title}`);
    lines.push(`${ORION_TAG}${encodeTrack(clean)}`);
    const privateTrack = clean.provider === "local" ? privateTrackFor(clean.id) : null;
    lines.push(privateTrack?.file_path || `orion-track:${encodeURIComponent(clean.provider)}:${encodeURIComponent(clean.id)}`);
  }
  return `${lines.join("\n")}\n`;
}

function parseM3uPlaylist(text, { baseDirectory = "", localTrackForPath = () => null, fallbackName = "Imported playlist" } = {}) {
  const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length || lines[0].toUpperCase() !== "#EXTM3U") throw new Error("This is not a valid extended M3U playlist.");
  let name = fallbackName; let pending = null; const items = [];
  for (const line of lines.slice(1)) {
    if (line.startsWith("#PLAYLIST:")) { name = line.slice(10).trim() || name; continue; }
    if (line.startsWith(ORION_TAG)) { pending = decodeTrack(line.slice(ORION_TAG.length)); continue; }
    if (line.startsWith("#")) continue;
    if (pending) { items.push(pending); pending = null; }
    else if (!/^([a-z]+):/i.test(line)) {
      const filePath = path.resolve(baseDirectory, line);
      const track = localTrackForPath(filePath);
      if (track) items.push(track);
    }
    if (items.length >= MAX_PLAYLIST_ITEMS) break;
  }
  return { name: String(name).slice(0, 160), description: "Imported from M3U", items };
}

module.exports = { MAX_PLAYLIST_ITEMS, parseJsonPlaylist, parseM3uPlaylist, safeTrack,
  serializeJsonPlaylist, serializeM3uPlaylist };
