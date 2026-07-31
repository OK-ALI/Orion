const { app } = require("electron");
const fs = require("fs");
const path = require("path");

let cachedPath = null;
const getPath = () => cachedPath || (cachedPath = path.join(app.getPath("userData"), "downloads.json"));

function load() {
  try {
    if (!fs.existsSync(getPath())) return [];
    const parsed = JSON.parse(fs.readFileSync(getPath(), "utf8"));
    return Array.isArray(parsed) ? parsed : parsed.downloads || [];
  } catch {
    return [];
  }
}

function save(downloads) {
  try {
    fs.mkdirSync(path.dirname(getPath()), { recursive: true });
    fs.writeFileSync(getPath(), JSON.stringify(downloads, null, 2));
  } catch {}
}

function normalize(records) {
  const seen = new Map();
  const sorted = [...records].sort(
    (left, right) =>
      (right.completedAt || right.startedAt || 0) -
      (left.completedAt || left.startedAt || 0),
  );
  for (const record of sorted) {
    const key =
      record.tmdbId && record.mediaType
        ? `${record.tmdbId}|${record.mediaType}|${record.season ?? ""}|${record.episode ?? ""}`
        : record.id;
    if (!seen.has(key)) seen.set(key, record);
  }
  return [...seen.values()].map((entry) => {
    const wasActive = [
      "downloading",
      "queued",
      "preflighting",
      "processing",
    ].includes(entry.status);
    return {
      schemaVersion: 3,
      ...entry,
      updatedAt: entry.updatedAt || entry.completedAt || entry.startedAt || Date.now(),
      retryCount: Number(entry.retryCount) || 0,
      downloadedBytes: Number(entry.downloadedBytes) || 0,
      totalBytes: Number(entry.totalBytes) || 0,
      status: wasActive
        ? "paused"
        : entry.status === "interrupted"
          ? "paused"
          : entry.status === "error"
            ? "failed"
            : entry.status,
      lastMessage: wasActive
        ? "Interrupted when Orion closed"
        : entry.lastMessage,
    };
  });
}

function cleanupTempFiles(downloadPath) {
  if (!downloadPath) return;
  try {
    const patterns = [/\.part$/, /\.part\.\d+$/, /\.part\.tmp$/, /\.tmp$/, /\.ytdl$/, /\.part-Frag\d+$/];
    if (!fs.existsSync(downloadPath)) return;
    for (const name of fs.readdirSync(downloadPath)) {
      if (patterns.some((pattern) => pattern.test(name))) {
        try { fs.unlinkSync(path.join(downloadPath, name)); } catch {}
      }
    }
  } catch {}
}

function clear() {
  try { if (fs.existsSync(getPath())) fs.unlinkSync(getPath()); } catch {}
}

module.exports = { clear, cleanupTempFiles, getPath, load, normalize, save };
