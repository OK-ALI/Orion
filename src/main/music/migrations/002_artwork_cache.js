module.exports = {
  version: 2,
  name: "artwork_cache_state",
  up(db) {
    db.exec("ALTER TABLE music_tracks ADD COLUMN artwork_checked INTEGER NOT NULL DEFAULT 0");
  },
};
