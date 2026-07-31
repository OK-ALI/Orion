module.exports = {
  version: 1,
  name: "initial_music_library",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS music_folders (
        path TEXT PRIMARY KEY, added_at INTEGER NOT NULL, last_scan_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS music_tracks (
        id TEXT PRIMARY KEY, provider TEXT NOT NULL, provider_track_id TEXT,
        title TEXT NOT NULL, artist_name TEXT NOT NULL, album_title TEXT,
        album_artist TEXT, duration_ms INTEGER, track_number INTEGER, disc_number INTEGER,
        year INTEGER, genres_json TEXT, artwork_path TEXT, file_path TEXT,
        mime_type TEXT, lyrics_text TEXT, replay_gain REAL, file_size INTEGER,
        file_mtime INTEGER, missing INTEGER NOT NULL DEFAULT 0,
        added_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_music_tracks_file ON music_tracks(file_path) WHERE file_path IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_music_tracks_title ON music_tracks(title COLLATE NOCASE);
      CREATE INDEX IF NOT EXISTS idx_music_tracks_artist ON music_tracks(artist_name COLLATE NOCASE);
      CREATE TABLE IF NOT EXISTS music_playlists (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS music_playlist_items (
        playlist_id TEXT NOT NULL REFERENCES music_playlists(id) ON DELETE CASCADE,
        position INTEGER NOT NULL, track_json TEXT NOT NULL,
        PRIMARY KEY (playlist_id, position)
      );
      CREATE TABLE IF NOT EXISTS music_favorites (
        kind TEXT NOT NULL, identity TEXT NOT NULL, payload_json TEXT NOT NULL,
        created_at INTEGER NOT NULL, PRIMARY KEY (kind, identity)
      );
      CREATE TABLE IF NOT EXISTS music_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT, identity TEXT NOT NULL,
        track_json TEXT NOT NULL, played_at INTEGER NOT NULL, position_ms INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS music_state (key TEXT PRIMARY KEY, value_json TEXT NOT NULL);
    `);
  },
};
