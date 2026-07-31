const path = require("path");
const database = require("../database");
const { MUSIC_EXTENSIONS } = require("../../../shared/musicConstants.cjs");
const { readTrackMetadata, stableId } = require("./metadataReader");

let watcher = null;

async function startWatcher(folders) {
  await stopWatcher();
  if (!folders?.length) return;
  const { watch } = await import("chokidar");
  watcher = watch(folders, { ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 1200, pollInterval: 150 } });
  const supported = (filePath) => MUSIC_EXTENSIONS.includes(path.extname(filePath).toLowerCase());
  const importFile = async (filePath) => {
    if (!supported(filePath)) return;
    try {
      const track = await readTrackMetadata(filePath);
      const moved = database.findTrackByFingerprint(track.fileFingerprint, filePath);
      if (moved?.file_path && !require("fs").existsSync(moved.file_path)) {
        track.id = moved.id;
        track.addedAt = moved.added_at;
      }
      database.upsertTrack(track);
    } catch {}
  };
  watcher.on("add", importFile).on("change", importFile).on("unlink", (filePath) => {
    try {
      const row = database.getPrivateTrack(stableId(filePath));
      if (row) database.openDatabase().prepare("UPDATE music_tracks SET missing=1,updated_at=? WHERE id=?").run(Date.now(), row.id);
    } catch {}
  });
}

async function stopWatcher() {
  const current = watcher;
  watcher = null;
  try { await current?.close(); } catch {}
}

module.exports = { startWatcher, stopWatcher };
