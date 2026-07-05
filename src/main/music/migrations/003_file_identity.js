module.exports = {
  version: 3,
  name: "stable_local_file_identity",
  up(db) {
    db.exec(`
      ALTER TABLE music_tracks ADD COLUMN file_fingerprint TEXT;
      CREATE INDEX IF NOT EXISTS idx_music_tracks_fingerprint
        ON music_tracks(file_fingerprint) WHERE file_fingerprint IS NOT NULL;
    `);
  },
};
