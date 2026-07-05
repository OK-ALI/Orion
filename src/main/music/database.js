const path = require("path");
const { app } = require("electron");
const { applyMigrations } = require("./migrations");

let database = null;

function json(value, fallback = null) {
  try { return JSON.stringify(value ?? fallback); } catch { return JSON.stringify(fallback); }
}

function parse(value, fallback = null) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

function openDatabase() {
  if (database) return database;
  const { DatabaseSync } = require("node:sqlite");
  database = new DatabaseSync(path.join(app.getPath("userData"), "music-library.sqlite"));
  database.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
  applyMigrations(database);
  return database;
}

function publicTrack(row) {
  if (!row) return null;
  return {
    id: row.id, provider: row.provider, providerTrackId: row.provider_track_id,
    title: row.title, artistName: row.artist_name, albumTitle: row.album_title,
    albumArtist: row.album_artist, durationMs: row.duration_ms,
    trackNumber: row.track_number, discNumber: row.disc_number, year: row.year,
    genres: parse(row.genres_json, []), hasArtwork: !!row.artwork_path,
    mimeType: row.mime_type, hasLyrics: !!row.lyrics_text,
    replayGain: row.replay_gain, missing: !!row.missing,
    addedAt: row.added_at, updatedAt: row.updated_at,
  };
}

function upsertTrack(track) {
  const db = openDatabase();
  db.prepare(`INSERT INTO music_tracks (
    id, provider, provider_track_id, title, artist_name, album_title, album_artist,
    duration_ms, track_number, disc_number, year, genres_json, artwork_path, file_path,
    mime_type, lyrics_text, replay_gain, file_size, file_mtime, file_fingerprint, artwork_checked, missing, added_at, updated_at
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(id) DO UPDATE SET
    title=excluded.title, artist_name=excluded.artist_name, album_title=excluded.album_title,
    album_artist=excluded.album_artist, duration_ms=excluded.duration_ms,
    track_number=excluded.track_number, disc_number=excluded.disc_number, year=excluded.year,
    genres_json=excluded.genres_json, artwork_path=excluded.artwork_path, file_path=excluded.file_path,
    mime_type=excluded.mime_type, lyrics_text=excluded.lyrics_text,
    replay_gain=excluded.replay_gain, file_size=excluded.file_size,
    file_mtime=excluded.file_mtime, file_fingerprint=excluded.file_fingerprint,
    artwork_checked=excluded.artwork_checked, missing=0, updated_at=excluded.updated_at`).run(
    track.id, track.provider, track.providerTrackId || null, track.title, track.artistName,
    track.albumTitle || null, track.albumArtist || null, track.durationMs || null,
    track.trackNumber || null, track.discNumber || null, track.year || null,
    json(track.genres, []), track.artworkPath || null, track.filePath || null,
    track.mimeType || null, track.lyricsText || null, track.replayGain || null,
    track.fileSize || null, track.fileMtime || null, track.fileFingerprint || null,
    track.artworkChecked ? 1 : 0, 0, track.addedAt, track.updatedAt,
  );
}

function findTrackByFingerprint(fingerprint, exceptPath = "") {
  if (!fingerprint) return null;
  return openDatabase().prepare(`SELECT * FROM music_tracks
    WHERE provider='local' AND file_fingerprint=? AND file_path<>?
    ORDER BY missing DESC, updated_at DESC LIMIT 1`).get(fingerprint, path.resolve(exceptPath || "."));
}

function listTracks({ query = "", limit = 500, offset = 0 } = {}) {
  const db = openDatabase();
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 1000);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const term = `%${String(query).trim()}%`;
  const rows = query
    ? db.prepare(`SELECT * FROM music_tracks WHERE missing=0 AND
        (title LIKE ? COLLATE NOCASE OR artist_name LIKE ? COLLATE NOCASE OR album_title LIKE ? COLLATE NOCASE)
        ORDER BY artist_name COLLATE NOCASE, album_title COLLATE NOCASE, disc_number, track_number LIMIT ? OFFSET ?`)
      .all(term, term, term, safeLimit, safeOffset)
    : db.prepare(`SELECT * FROM music_tracks WHERE missing=0
        ORDER BY artist_name COLLATE NOCASE, album_title COLLATE NOCASE, disc_number, track_number LIMIT ? OFFSET ?`)
      .all(safeLimit, safeOffset);
  return rows.map(publicTrack);
}

function getPrivateTrack(id) {
  return openDatabase().prepare("SELECT * FROM music_tracks WHERE id=?").get(String(id || ""));
}

function getPrivateTrackByPath(filePath) {
  return openDatabase().prepare("SELECT * FROM music_tracks WHERE provider='local' AND file_path=? AND missing=0")
    .get(path.resolve(filePath));
}

function listFolders() {
  return openDatabase().prepare("SELECT path, added_at, last_scan_at FROM music_folders ORDER BY added_at").all();
}

function addFolder(folderPath) {
  openDatabase().prepare("INSERT OR IGNORE INTO music_folders(path, added_at) VALUES(?,?)")
    .run(path.resolve(folderPath), Date.now());
}

function removeFolder(folderPath) {
  const resolved = path.resolve(folderPath);
  const db = openDatabase();
  db.prepare("DELETE FROM music_folders WHERE path=?").run(resolved);
  db.prepare("DELETE FROM music_tracks WHERE file_path=? OR file_path LIKE ?")
    .run(resolved, `${resolved}${path.sep}%`);
}

function touchFolder(folderPath) {
  openDatabase().prepare("UPDATE music_folders SET last_scan_at=? WHERE path=?")
    .run(Date.now(), path.resolve(folderPath));
}

function reconcileFolder(folderPath, seenIds) {
  const resolved = path.resolve(folderPath);
  const prefix = `${resolved}${path.sep}`;
  const db = openDatabase();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec("CREATE TEMP TABLE IF NOT EXISTS music_scan_seen (id TEXT PRIMARY KEY); DELETE FROM music_scan_seen;");
    const insert = db.prepare("INSERT OR IGNORE INTO music_scan_seen(id) VALUES(?)");
    for (const id of seenIds) insert.run(id);
    const missing = db.prepare(`UPDATE music_tracks SET missing=1,updated_at=?
      WHERE provider='local' AND substr(file_path,1,?)=? AND id NOT IN (SELECT id FROM music_scan_seen)`)
      .run(Date.now(), prefix.length, prefix).changes;
    db.prepare("UPDATE music_tracks SET missing=0 WHERE id IN (SELECT id FROM music_scan_seen)").run();
    db.exec("COMMIT");
    return { missing };
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch {}
    throw error;
  }
}

function getState(key, fallback) {
  const row = openDatabase().prepare("SELECT value_json FROM music_state WHERE key=?").get(key);
  return parse(row?.value_json, fallback);
}

function setState(key, value) {
  openDatabase().prepare("INSERT OR REPLACE INTO music_state(key,value_json) VALUES(?,?)")
    .run(key, json(value));
}

function listPlaylists() {
  const db = openDatabase();
  return db.prepare("SELECT id,name,description,created_at,updated_at FROM music_playlists ORDER BY updated_at DESC").all()
    .map((row) => ({ id: row.id, name: row.name, description: row.description || "",
      createdAt: row.created_at, updatedAt: row.updated_at,
      items: db.prepare("SELECT track_json FROM music_playlist_items WHERE playlist_id=? ORDER BY position")
        .all(row.id).map((item) => parse(item.track_json, null)).filter(Boolean) }));
}

function savePlaylist(playlist) {
  const crypto = require("crypto");
  const db = openDatabase();
  const id = playlist.id || crypto.randomUUID();
  const existing = db.prepare("SELECT created_at FROM music_playlists WHERE id=?").get(id);
  const now = Date.now();
  db.prepare(`INSERT OR REPLACE INTO music_playlists(id,name,description,created_at,updated_at)
    VALUES(?,?,?,?,?)`).run(id, String(playlist.name || "Untitled playlist").slice(0, 160),
    String(playlist.description || "").slice(0, 1000), existing?.created_at || now, now);
  db.prepare("DELETE FROM music_playlist_items WHERE playlist_id=?").run(id);
  const insert = db.prepare("INSERT INTO music_playlist_items(playlist_id,position,track_json) VALUES(?,?,?)");
  (playlist.items || []).forEach((item, index) => insert.run(id, index, json(item, {})));
  return listPlaylists().find((item) => item.id === id);
}

function saveImportedPlaylist(playlist) {
  const names = new Set(listPlaylists().map((item) => item.name.toLowerCase()));
  return savePlaylist({ ...playlist, id: undefined, name: uniquePlaylistName(playlist.name, names) });
}

function deletePlaylist(id) {
  return openDatabase().prepare("DELETE FROM music_playlists WHERE id=?").run(String(id || "")).changes > 0;
}

function listFavorites() {
  return openDatabase().prepare("SELECT kind,identity,payload_json,created_at FROM music_favorites ORDER BY created_at DESC").all()
    .map((row) => ({ kind: row.kind, identity: row.identity, payload: parse(row.payload_json, {}), createdAt: row.created_at }));
}

function toggleFavorite(kind, identity, payload) {
  const db = openDatabase();
  const existing = db.prepare("SELECT 1 FROM music_favorites WHERE kind=? AND identity=?").get(kind, identity);
  if (existing) {
    db.prepare("DELETE FROM music_favorites WHERE kind=? AND identity=?").run(kind, identity);
    return { favorite: false };
  }
  db.prepare("INSERT INTO music_favorites(kind,identity,payload_json,created_at) VALUES(?,?,?,?)")
    .run(kind, identity, json(payload, {}), Date.now());
  return { favorite: true };
}

function addHistory(track, positionMs = 0) {
  const identity = `${track.provider || track.source?.provider || "unknown"}:${track.id}`;
  const db = openDatabase();
  db.prepare("INSERT INTO music_history(identity,track_json,played_at,position_ms) VALUES(?,?,?,?)")
    .run(identity, json(track, {}), Date.now(), Math.max(0, Number(positionMs) || 0));
  db.prepare("DELETE FROM music_history WHERE id NOT IN (SELECT id FROM music_history ORDER BY played_at DESC LIMIT 2000)").run();
}

function listHistory(limit = 24) {
  return openDatabase().prepare("SELECT track_json,played_at,position_ms FROM music_history ORDER BY played_at DESC LIMIT ?")
    .all(Math.min(2000, Math.max(1, Number(limit) || 24)))
    .map((row) => ({ track: parse(row.track_json, {}), playedAt: row.played_at, positionMs: row.position_ms }));
}

const PRIVATE_PORTABLE_KEYS = /^(?:file_?path|path|url|artworkUrl|profileImageUrl|coverArtUrl|playbackUrl|streamUrl|headers|cookies?|token|credentials?|password|expiresAt)$/i;

function portableValue(value, depth = 0) {
  if (depth > 8 || value === undefined || typeof value === "function") return undefined;
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value.slice(0, 20_000);
  if (Array.isArray(value)) return value.slice(0, 10_000).map((item) => portableValue(item, depth + 1)).filter((item) => item !== undefined);
  if (typeof value !== "object") return undefined;
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (PRIVATE_PORTABLE_KEYS.test(key)) continue;
    const clean = portableValue(item, depth + 1);
    if (clean !== undefined) output[key] = clean;
  }
  return output;
}

function exportPortableState() {
  return portableValue({
    version: 1,
    playlists: listPlaylists(),
    favorites: listFavorites(),
    history: listHistory(2000),
    providerPreferences: getState("provider_preferences", {}),
    cacheLimitMb: getState("artwork_cache_limit_mb", 256),
  });
}

function uniquePlaylistName(name, existing) {
  const base = String(name || "Imported playlist").trim().slice(0, 140) || "Imported playlist";
  if (!existing.has(base.toLowerCase())) { existing.add(base.toLowerCase()); return base; }
  let index = 2;
  while (existing.has(`${base} (${index})`.toLowerCase())) index += 1;
  const value = `${base} (${index})`.slice(0, 160);
  existing.add(value.toLowerCase());
  return value;
}

function importPortableState(value) {
  if (!value || typeof value !== "object" || Number(value.version) !== 1) throw new Error("Unsupported Music backup format.");
  const clean = portableValue(value);
  const existingNames = new Set(listPlaylists().map((item) => item.name.toLowerCase()));
  let playlists = 0; let favorites = 0; let history = 0;
  for (const playlist of (clean.playlists || []).slice(0, 500)) {
    savePlaylist({ name: uniquePlaylistName(playlist.name, existingNames), description: playlist.description,
      items: Array.isArray(playlist.items) ? playlist.items.slice(0, 10_000) : [] });
    playlists += 1;
  }
  const db = openDatabase();
  for (const favorite of (clean.favorites || []).slice(0, 10_000)) {
    if (!favorite?.kind || !favorite?.identity) continue;
    db.prepare("INSERT OR IGNORE INTO music_favorites(kind,identity,payload_json,created_at) VALUES(?,?,?,?)")
      .run(String(favorite.kind).slice(0, 40), String(favorite.identity).slice(0, 500),
        json(favorite.payload, {}), Number(favorite.createdAt) || Date.now());
    favorites += 1;
  }
  for (const item of (clean.history || []).slice(-2000)) {
    if (!item?.track?.id) continue;
    addHistory(item.track, item.positionMs);
    history += 1;
  }
  if (clean.providerPreferences && typeof clean.providerPreferences === "object") {
    const preferences = {};
    for (const [kind, providerId] of Object.entries(clean.providerPreferences)) {
      if (typeof providerId === "string" && providerId.length <= 120) preferences[kind] = providerId;
    }
    setState("provider_preferences", preferences);
  }
  if (Number.isFinite(Number(clean.cacheLimitMb))) {
    setState("artwork_cache_limit_mb", Math.min(2048, Math.max(64, Number(clean.cacheLimitMb))));
  }
  return { playlists, favorites, history };
}

function closeDatabase() {
  try { database?.close(); } catch {}
  database = null;
}

module.exports = {
  addFolder, addHistory, closeDatabase, deletePlaylist, exportPortableState, findTrackByFingerprint, getPrivateTrack, getState,
  getPrivateTrackByPath, importPortableState,
  listFavorites, listFolders, listHistory, listPlaylists, listTracks, openDatabase, publicTrack,
  portableValue, reconcileFolder, removeFolder, saveImportedPlaylist, savePlaylist, setState, toggleFavorite, touchFolder, upsertTrack,
};
