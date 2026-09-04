module.exports = {
  version: 5,
  name: "cleanup_legacy_duplicate_empty_playlist_folders",
  up(db) {
    const stale = db.prepare(`
      SELECT f.id
      FROM music_playlist_folders f
      WHERE NOT EXISTS (
        SELECT 1
        FROM music_playlists p
        WHERE p.folder_id = f.id
      )
      AND EXISTS (
        SELECT 1
        FROM music_playlist_folders other
        WHERE other.id <> f.id
          AND lower(trim(other.name)) = lower(trim(f.name))
      )
      ORDER BY f.id
    `).all().map((row) => String(row.id || "")).filter(Boolean);

    if (!stale.length) return;

    const row = db.prepare(
      "SELECT value_json FROM music_state WHERE key='deleted_playlist_folders'"
    ).get();

    let existing = [];
    try {
      const value = row?.value_json ? JSON.parse(row.value_json) : [];
      existing = Array.isArray(value)
        ? value.filter((id) => typeof id === "string" && id.length > 0)
        : [];
    } catch {
      existing = [];
    }

    const tombstones = [...new Set([...existing, ...stale])];

    db.prepare(`
      INSERT OR REPLACE INTO music_state(key, value_json)
      VALUES('deleted_playlist_folders', ?)
    `).run(JSON.stringify(tombstones));

    const remove = db.prepare(
      "DELETE FROM music_playlist_folders WHERE id=?"
    );

    for (const id of stale) remove.run(id);
  },
};