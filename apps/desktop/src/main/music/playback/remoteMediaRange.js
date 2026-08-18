const GOOGLEVIDEO_HOST = /(^|\.)googlevideo\.com$/i;
const REMOTE_RANGE_CHUNK_BYTES = 1024 * 1024;

function isGoogleVideoUrl(value) {
  try {
    return GOOGLEVIDEO_HOST.test(new URL(String(value || "")).hostname);
  } catch {
    return false;
  }
}

function boundedRemoteRange(url, requestedRange, chunkBytes = REMOTE_RANGE_CHUNK_BYTES) {
  const range = String(requestedRange || "").trim();
  if (!range || !isGoogleVideoUrl(url)) return range;

  const match = /^bytes=(\d+)-$/i.exec(range);
  if (!match) return range;

  const start = Number(match[1]);
  const size = Number(chunkBytes);
  if (!Number.isSafeInteger(start) || start < 0 || !Number.isSafeInteger(size) || size <= 0) return range;

  const end = Math.min(Number.MAX_SAFE_INTEGER, start + size - 1);
  return `bytes=${start}-${end}`;
}

module.exports = {
  REMOTE_RANGE_CHUNK_BYTES,
  boundedRemoteRange,
  isGoogleVideoUrl,
};
