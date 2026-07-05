const initial = require("./001_initial");
const artworkCache = require("./002_artwork_cache");
const fileIdentity = require("./003_file_identity");
const { MUSIC_SCHEMA_VERSION } = require("../../../shared/musicConstants.cjs");

const migrations = [initial, artworkCache, fileIdentity].sort((a, b) => a.version - b.version);

function currentVersion(db) {
  const row = db.prepare("SELECT value FROM music_meta WHERE key='schema_version'").get();
  return Math.max(0, Number(row?.value) || 0);
}

function applyMigrations(db) {
  db.exec("CREATE TABLE IF NOT EXISTS music_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  let version = currentVersion(db);
  for (const migration of migrations) {
    if (migration.version <= version) continue;
    db.exec("BEGIN IMMEDIATE");
    try {
      migration.up(db);
      db.prepare("INSERT OR REPLACE INTO music_meta(key,value) VALUES('schema_version',?)")
        .run(String(migration.version));
      db.exec("COMMIT");
      version = migration.version;
    } catch (error) {
      try { db.exec("ROLLBACK"); } catch {}
      throw new Error(`Music database migration ${migration.version} (${migration.name}) failed: ${error.message}`);
    }
  }
  if (version !== MUSIC_SCHEMA_VERSION) {
    throw new Error(`Music database schema ${version} does not match runtime schema ${MUSIC_SCHEMA_VERSION}.`);
  }
  return version;
}

module.exports = { applyMigrations, migrations };
