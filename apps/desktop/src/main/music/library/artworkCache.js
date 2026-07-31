const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { app, nativeImage } = require("electron");
const ARTWORK_HOSTS = ["coverartarchive.org", "archive.org", "discogs.com", "dzcdn.net", "listenbrainz.org", "bcbits.com", "sndcdn.com", "ytimg.com",
  "yt3.googleusercontent.com", "lh3.googleusercontent.com"];
const DEFAULT_LIMIT_MB = 256;

function isAllowedArtworkUrl(value) {
  try {
    const url = value instanceof URL ? value : new URL(value);
    return url.protocol === "https:" && ARTWORK_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch { return false; }
}

function artworkUrlFor(item = {}) {
  const candidates = [item.artworkUrl, item.profileImageUrl, item.coverArtUrl, item.imageUrl, item.thumbnail,
    item.images?.[0]?.url, item.thumbnails?.at?.(-1)?.url];
  return candidates.find((value) => value && isAllowedArtworkUrl(value)) || null;
}

function directory() {
  const value = path.join(app.getPath("userData"), "music-artwork");
  fs.mkdirSync(value, { recursive: true });
  return value;
}

function keyFor(id) {
  return crypto.createHash("sha256").update(String(id)).digest("hex").slice(0, 32);
}

function configuredLimitMb() {
  try {
    const value = require("../database").getState("artwork_cache_limit_mb", DEFAULT_LIMIT_MB);
    return Math.min(2048, Math.max(64, Number(value) || DEFAULT_LIMIT_MB));
  } catch { return DEFAULT_LIMIT_MB; }
}

async function cacheFiles() {
  let names = [];
  try { names = await fs.promises.readdir(directory()); } catch { return []; }
  const values = await Promise.all(names.filter((name) => /-(?:128|512)\.png$/i.test(name)).map(async (name) => {
    const filePath = path.join(directory(), name);
    try { const stat = await fs.promises.stat(filePath); return { filePath, size: stat.size, mtimeMs: stat.mtimeMs }; }
    catch { return null; }
  }));
  return values.filter(Boolean);
}

async function cacheStatus() {
  const files = await cacheFiles();
  return { bytes: files.reduce((total, item) => total + item.size, 0), files: files.length, limitMb: configuredLimitMb() };
}

async function pruneArtworkCache(limitMb = configuredLimitMb()) {
  const limitBytes = Math.min(2048, Math.max(64, Number(limitMb) || DEFAULT_LIMIT_MB)) * 1024 * 1024;
  const files = (await cacheFiles()).sort((a, b) => a.mtimeMs - b.mtimeMs);
  let bytes = files.reduce((total, item) => total + item.size, 0);
  let removed = 0;
  for (const item of files) {
    if (bytes <= limitBytes) break;
    try { await fs.promises.unlink(item.filePath); bytes -= item.size; removed += 1; } catch {}
  }
  return { bytes, files: files.length - removed, removed, limitMb: limitBytes / 1024 / 1024 };
}

async function clearArtworkCache() {
  const files = await cacheFiles();
  let removed = 0;
  for (const item of files) {
    try { await fs.promises.unlink(item.filePath); removed += 1; } catch {}
  }
  return { bytes: 0, files: 0, removed, limitMb: configuredLimitMb() };
}

async function cacheEmbeddedArtwork(trackId, picture) {
  if (!picture?.data?.length) return null;
  const key = keyFor(trackId);
  const fullPath = path.join(directory(), `${key}-512.png`);
  const thumbPath = path.join(directory(), `${key}-128.png`);
  try {
    const image = nativeImage.createFromBuffer(Buffer.from(picture.data));
    if (image.isEmpty()) return null;
    await Promise.all([
      fs.promises.writeFile(fullPath, image.resize({ width: 512, height: 512, quality: "best" }).toPNG()),
      fs.promises.writeFile(thumbPath, image.resize({ width: 128, height: 128, quality: "good" }).toPNG()),
    ]);
    void pruneArtworkCache();
    return fullPath;
  } catch {
    return null;
  }
}

async function cacheArtworkBuffer(cacheId, value) {
  const buffer = Buffer.from(value || []);
  if (!buffer.length || buffer.length > 8 * 1024 * 1024) {
    throw new Error("Artwork response is empty or too large.");
  }
  const fullPath = path.join(directory(), `${keyFor(cacheId)}-512.png`);
  if (fs.existsSync(fullPath)) return fullPath;
  const image = nativeImage.createFromBuffer(buffer);
  if (image.isEmpty()) throw new Error("Artwork response is not a supported image.");
  await fs.promises.writeFile(fullPath, image.resize({ width: 512, height: 512, quality: "best" }).toPNG());
  void pruneArtworkCache();
  return fullPath;
}

async function cacheRemoteArtwork(url) {
  const key = keyFor(url);
  const fullPath = path.join(directory(), `${key}-512.png`);
  if (fs.existsSync(fullPath)) return fullPath;
  let current = new URL(url);
  let response;
  for (let redirects = 0; redirects < 4; redirects += 1) {
    if (!isAllowedArtworkUrl(current)) throw new Error("Artwork host is not permitted.");
    response = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(10_000) });
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const location = response.headers.get("location");
    if (!location) throw new Error("Artwork redirect is invalid.");
    current = new URL(location, current);
  }
  if (!response.ok) throw new Error(`Artwork request failed (${response.status}).`);
  const length = Number(response.headers.get("content-length") || 0);
  if (length > 8 * 1024 * 1024) throw new Error("Artwork response is too large.");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > 8 * 1024 * 1024) throw new Error("Artwork response is too large.");
  const image = nativeImage.createFromBuffer(buffer);
  if (image.isEmpty()) throw new Error("Artwork response is not a supported image.");
  await fs.promises.writeFile(fullPath, image.resize({ width: 512, height: 512, quality: "best" }).toPNG());
  void pruneArtworkCache();
  return fullPath;
}

module.exports = { artworkUrlFor, cacheArtworkBuffer, cacheEmbeddedArtwork, cacheRemoteArtwork, cacheStatus,
  clearArtworkCache, configuredLimitMb, isAllowedArtworkUrl, pruneArtworkCache };
