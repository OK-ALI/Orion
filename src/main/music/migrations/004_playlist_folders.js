module.exports = {
  version: 4,
  name: "playlist_folders_and_artwork",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS music_playlist_folders (
        id TEXT PRIMARY KEY,
        parent_id TEXT REFERENCES music_playlist_folders(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        position INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      ALTER TABLE music_playlists ADD COLUMN folder_id TEXT REFERENCES music_playlist_folders(id) ON DELETE SET NULL;
      ALTER TABLE music_playlists ADD COLUMN artwork_json TEXT;
      CREATE INDEX IF NOT EXISTS idx_music_playlist_folders_parent ON music_playlist_folders(parent_id, position);
      CREATE INDEX IF NOT EXISTS idx_music_playlists_folder ON music_playlists(folder_id, updated_at);
    `);
  },
};
