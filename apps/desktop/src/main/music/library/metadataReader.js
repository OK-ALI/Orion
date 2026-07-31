const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { readSidecarLyrics } = require("./lyrics");
const { cacheEmbeddedArtwork } = require("./artworkCache");

let metadataModule;
async function getMetadataModule() {
  metadataModule ||= import("music-metadata");
  return metadataModule;
}

function stableId(filePath) {
  return `local:${crypto.createHash("sha256").update(path.resolve(filePath).toLowerCase()).digest("hex").slice(0, 32)}`;
}

async function fileFingerprint(filePath, knownStat) {
  const stat = knownStat || await fs.promises.stat(filePath);
  const sampleSize = Math.min(64 * 1024, stat.size);
  const first = Buffer.alloc(sampleSize);
  const last = stat.size > sampleSize ? Buffer.alloc(sampleSize) : null;
  const handle = await fs.promises.open(filePath, "r");
  try {
    if (sampleSize) await handle.read(first, 0, sampleSize, 0);
    if (last) await handle.read(last, 0, sampleSize, Math.max(0, stat.size - sampleSize));
  } finally { await handle.close(); }
  const hash = crypto.createHash("sha256").update(String(stat.size)).update(first);
  if (last) hash.update(last);
  return hash.digest("hex");
}

function firstNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

async function readTrackMetadata(filePath) {
  const [{ parseFile }, stat, sidecarLyrics] = await Promise.all([
    getMetadataModule(), fs.promises.stat(filePath), readSidecarLyrics(filePath),
  ]);
  const [result, fingerprint] = await Promise.all([
    parseFile(filePath, { duration: true, skipCovers: false }), fileFingerprint(filePath, stat),
  ]);
  const common = result.common || {};
  const format = result.format || {};
  const now = Date.now();
  const id = stableId(filePath);
  const artworkPath = await cacheEmbeddedArtwork(id, common.picture?.[0]);
  return {
    id, provider: "local", title: common.title || path.parse(filePath).name,
    artistName: common.artist || common.albumartist || "Unknown artist",
    albumArtist: common.albumartist || common.artist || null,
    albumTitle: common.album || "Unknown album",
    durationMs: firstNumber(format.duration) ? Math.round(format.duration * 1000) : null,
    trackNumber: firstNumber(common.track?.no), discNumber: firstNumber(common.disk?.no),
    year: firstNumber(common.year), genres: Array.isArray(common.genre) ? common.genre : [],
    mimeType: format.container || null,
    lyricsText: sidecarLyrics || (typeof common.lyrics?.[0] === "string" ? common.lyrics[0] : common.lyrics?.[0]?.text) || null,
    replayGain: common.replaygain_track_gain?.dB ?? null,
    artworkPath,
    artworkChecked: true,
    filePath: path.resolve(filePath), fileSize: stat.size, fileFingerprint: fingerprint,
    fileMtime: Math.round(stat.mtimeMs), addedAt: now, updatedAt: now,
  };
}

module.exports = { fileFingerprint, readTrackMetadata, stableId };
