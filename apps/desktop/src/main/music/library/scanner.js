const fs = require("fs");
const path = require("path");
const { MUSIC_EXTENSIONS } = require("../../../shared/musicConstants.cjs");
const database = require("../database");
const { readTrackMetadata, stableId } = require("./metadataReader");

const extensionSet = new Set(MUSIC_EXTENSIONS);
const METADATA_CONCURRENCY = 3;
let activeScan = null;

async function collectFiles(root, cancelled = () => false) {
  const files = [];
  const pending = [path.resolve(root)];
  while (pending.length && !cancelled()) {
    const directory = pending.pop();
    let entries = [];
    try { entries = await fs.promises.readdir(directory, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) pending.push(fullPath);
      else if (entry.isFile() && extensionSet.has(path.extname(entry.name).toLowerCase())) files.push(fullPath);
    }
  }
  return files;
}

function safeFailure(filePath, error) {
  return { fileName: path.basename(filePath), reason: String(error?.message || "Metadata could not be read.").slice(0, 180) };
}

async function readOne(filePath) {
  const id = stableId(filePath);
  const [stat, existing] = await Promise.all([
    fs.promises.stat(filePath), Promise.resolve(database.getPrivateTrack(id)),
  ]);
  if (existing?.artwork_checked && existing.file_fingerprint && Number(existing.file_size) === stat.size
    && Number(existing.file_mtime) === Math.round(stat.mtimeMs)) {
    return { status: "unchanged", id: existing.id };
  }
  const track = await readTrackMetadata(filePath);
  const moved = database.findTrackByFingerprint(track.fileFingerprint, filePath);
  if (moved?.file_path && !fs.existsSync(moved.file_path)) {
    track.id = moved.id;
    track.addedAt = moved.added_at;
  }
  database.upsertTrack(track);
  return { status: "imported", id: track.id };
}

async function scanFolder(folderPath, onProgress = () => {}) {
  const resolved = path.resolve(folderPath);
  if (activeScan) throw new Error("A music library scan is already running.");
  const scan = { cancelled: false };
  activeScan = scan;
  const state = { imported: 0, failed: 0, unchanged: 0, completed: 0, errors: [] };
  try {
    onProgress({ phase: "discovering", current: 0, total: 0, ...state });
    const files = await collectFiles(resolved, () => scan.cancelled);
    const seenIds = new Set();
    let nextIndex = 0;
    onProgress({ phase: "reading", current: 0, total: files.length, ...state });
    const worker = async () => {
      while (!scan.cancelled) {
        const index = nextIndex;
        nextIndex += 1;
        if (index >= files.length) return;
        try {
          const result = await readOne(files[index]);
          seenIds.add(result.id);
          state[result.status] += 1;
        } catch (error) {
          state.failed += 1;
          if (state.errors.length < 25) state.errors.push(safeFailure(files[index], error));
        }
        state.completed += 1;
        if (state.completed % 5 === 0 || state.completed === files.length) {
          onProgress({ phase: "reading", current: state.completed, total: files.length, ...state });
          await new Promise((resolve) => setImmediate(resolve));
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(METADATA_CONCURRENCY, files.length || 1) }, worker));
    let missing = 0;
    if (!scan.cancelled) {
      onProgress({ phase: "reconciling", current: state.completed, total: files.length, ...state });
      missing = database.reconcileFolder(resolved, seenIds).missing;
      database.touchFolder(resolved);
    }
    const result = { ok: true, cancelled: scan.cancelled, total: files.length,
      imported: state.imported, unchanged: state.unchanged, failed: state.failed, missing, errors: state.errors };
    onProgress({ phase: scan.cancelled ? "cancelled" : "complete", current: state.completed, ...result });
    return result;
  } finally { activeScan = null; }
}

function cancelScan() {
  if (!activeScan) return false;
  activeScan.cancelled = true;
  return true;
}

function isScanning() { return !!activeScan; }

module.exports = { cancelScan, collectFiles, isScanning, readOne, scanFolder };
