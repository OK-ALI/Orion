const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const { DatabaseSync } = require("node:sqlite");

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "orion-collections-"));
  const filename = path.resolve(__dirname, "../../../src/main/music/database.js");
  const localRequire = createRequire(filename);
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), {
    module, exports: module.exports, Date, Map, Set,
    require: (name) => name === "electron" ? { app: { getPath: () => directory } } : localRequire(name),
  }, { filename });
  const db = module.exports;
  // Keep each real SQLite fixture isolated; no installed Orion profile is read.
  t.after(() => db.closeDatabase());
  return db;
}

const track = { id: "track-1", provider: "local", title: "Kept song" };
const backup = () => ({
  version: 2,
  playlistFolders: [{ id: "everyday", name: "Everyday", updatedAt: 100 },
    { id: "child", parentId: "everyday", name: "Child", updatedAt: 100 }],
  playlists: [{ id: "taste", name: "Everyday Taste", folderId: "everyday", items: [track], updatedAt: 100 }],
});

test("repeated cloud/backup restore preserves playlist and folder identities without name suffixes", (t) => {
  const db = fixture(t);
  db.importPortableState(backup());
  db.importPortableState(backup());
  db.importPortableState(db.exportPortableState());
  assert.equal(db.listPlaylists().length, 1);
  assert.equal(db.listPlaylists()[0].id, "taste");
  assert.equal(db.listPlaylists()[0].name, "Everyday Taste");
  assert.equal(db.listPlaylists()[0].folderId, "everyday");
  assert.equal(db.listPlaylistFolders().length, 2);
  assert.equal(db.listPlaylistFolders().find((f) => f.id === "child").parentId, "everyday");
});

test("restore updates a newer revision in place and preserves a newer local edit", (t) => {
  const db = fixture(t);
  db.importPortableState(backup());
  const newer = backup();
  newer.playlists[0] = { ...newer.playlists[0], name: "Updated taste", updatedAt: 200, items: [track, { ...track, id: "track-2" }] };
  db.importPortableState(newer);
  assert.equal(db.listPlaylists()[0].name, "Updated taste");
  assert.equal(db.listPlaylists()[0].items.length, 2);
  db.savePlaylist({ ...db.listPlaylists()[0], name: "Local edit" });
  db.importPortableState(backup());
  assert.equal(db.listPlaylists()[0].name, "Local edit");
  assert.equal(db.listPlaylists().length, 1);
});

test("distinct playlists sharing a name remain separate and explicit file import still creates a copy", (t) => {
  const db = fixture(t);
  const value = backup();
  value.playlists.push({ ...value.playlists[0], id: "different-user-playlist" });
  db.importPortableState(value);
  assert.equal(db.listPlaylists().length, 2);
  db.saveImportedPlaylist(value.playlists[0]);
  assert.equal(db.listPlaylists().length, 3);
  assert.ok(db.listPlaylists().some((p) => p.name.endsWith("(2)")));
});

test("deleted playlists and folders stay deleted after stale restore, including portable round trips", (t) => {
  const db = fixture(t);
  db.importPortableState(backup());
  assert.equal(db.deletePlaylist("taste"), true);
  assert.equal(db.deletePlaylistFolder("everyday"), true);
  const deleted = db.exportPortableState();
  db.importPortableState(backup());
  assert.equal(db.listPlaylists().length, 0);
  assert.equal(db.listPlaylistFolders().some((f) => f.id === "everyday"), false);
  const second = fixture(t);
  second.importPortableState(backup());
  second.importPortableState(deleted);
  second.importPortableState(backup());
  assert.equal(second.listPlaylists().length, 0);
  assert.equal(second.listPlaylistFolders().some((f) => f.id === "everyday"), false);
});

test("folder deletion keeps playlists and tracks, and collection actions leave the stored queue intact", (t) => {
  const db = fixture(t);
  db.importPortableState(backup());
  const queue = { items: [track], index: 0, repeat: "all", shuffle: false };
  db.setState("queue", queue);
  db.deletePlaylistFolder("everyday");
  assert.equal(db.listPlaylists()[0].folderId, null);
  assert.equal(db.listPlaylists()[0].items[0].id, track.id);
  db.deletePlaylist("taste");
  assert.equal(JSON.stringify(db.getState("queue")), JSON.stringify(queue));
});

test("a folder revision preserves its local playlist links and malformed restore rolls back atomically", (t) => {
  const db = fixture(t);
  db.importPortableState(backup());
  const updated = backup();
  updated.playlistFolders[0] = { ...updated.playlistFolders[0], name: "Renamed", updatedAt: 200 };
  db.importPortableState(updated);
  assert.equal(db.listPlaylists()[0].folderId, "everyday");
  assert.equal(db.listPlaylistFolders().find((f) => f.id === "child").parentId, "everyday");
  const invalid = { ...backup(), deletedPlaylistIds: ["taste"], playlists: [null] };
  assert.throws(() => db.importPortableState(invalid));
  assert.equal(db.listPlaylists().length, 1);
  assert.equal(db.exportPortableState().deletedPlaylistIds.length, 0);
});

test("legacy backups lacking IDs are repeatable without merging differently named/content collections", (t) => {
  const db = fixture(t);
  const value = { version: 1, playlists: [{ name: "Legacy", items: [track] }] };
  db.importPortableState(value);
  db.importPortableState(value);
  assert.equal(db.listPlaylists().length, 1);
  db.importPortableState({ version: 1, playlists: [{ name: "Legacy", items: [{ ...track, id: "other" }] }] });
  assert.equal(db.listPlaylists().length, 2);
});

test("migration v5 removes only legacy duplicate empty playlist folders", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "orion-migration-v5-"));
  const filename = path.join(directory, "music-library.sqlite");
  const sqlite = new DatabaseSync(filename);

  t.after(() => {
    try { sqlite.close(); } catch {}
    fs.rmSync(directory, { recursive: true, force: true });
  });

  sqlite.exec(`
    PRAGMA foreign_keys=ON;

    CREATE TABLE music_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    INSERT INTO music_meta(key, value)
    VALUES('schema_version', '4');

    CREATE TABLE music_playlist_folders (
      id TEXT PRIMARY KEY,
      parent_id TEXT REFERENCES music_playlist_folders(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE music_playlists (
      id TEXT PRIMARY KEY,
      folder_id TEXT REFERENCES music_playlist_folders(id) ON DELETE SET NULL
    );

    CREATE TABLE music_state (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL
    );

    INSERT INTO music_playlist_folders(
      id, parent_id, name, position, created_at, updated_at
    ) VALUES
      ('dup-a', NULL, 'Everyday', 0, 10, 10),
      ('dup-b', NULL, ' everyday ', 0, 20, 20),
      ('dup-used', NULL, 'EVERYDAY', 0, 30, 30),
      ('unique-empty', NULL, 'Keep Me', 0, 40, 40);

    INSERT INTO music_playlists(id, folder_id)
    VALUES('taste', 'dup-used');

    INSERT INTO music_state(key, value_json)
    VALUES(
      'deleted_playlist_folders',
      '["already-deleted"]'
    );
  `);

  const { applyMigrations } = require("../../../src/main/music/migrations");

  assert.equal(applyMigrations(sqlite), 5);

  const folders = sqlite.prepare(`
    SELECT id
    FROM music_playlist_folders
    ORDER BY id
  `).all().map((row) => row.id);

  assert.deepEqual(
    folders,
    ["dup-used", "unique-empty"]
  );

  assert.equal(
    sqlite.prepare(`
      SELECT folder_id
      FROM music_playlists
      WHERE id='taste'
    `).get().folder_id,
    "dup-used"
  );

  const tombstones = JSON.parse(
    sqlite.prepare(`
      SELECT value_json
      FROM music_state
      WHERE key='deleted_playlist_folders'
    `).get().value_json
  );

  assert.deepEqual(
    new Set(tombstones),
    new Set(["already-deleted", "dup-a", "dup-b"])
  );

  assert.equal(
    sqlite.prepare(`
      SELECT COUNT(*) AS count
      FROM music_playlist_folders f
      WHERE NOT EXISTS (
        SELECT 1
        FROM music_playlists p
        WHERE p.folder_id=f.id
      )
      AND EXISTS (
        SELECT 1
        FROM music_playlist_folders other
        WHERE other.id<>f.id
          AND lower(trim(other.name))=lower(trim(f.name))
      )
    `).get().count,
    0
  );
});