const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const vm = require("node:vm");
const { createRequire } = require("node:module");

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
