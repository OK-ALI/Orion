function parseByteRange(header, size) {
  if (!header) return { start: 0, end: size - 1, status: 200 };
  const match = String(header).match(/^bytes=(\d*)-(\d*)$/i);
  if (!match || (!match[1] && !match[2])) return null;
  let start;
  let end;
  if (!match[1]) {
    const suffix = Math.max(1, Number(match[2]) || 0);
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > end || start >= size) return null;
  return { start, end, status: 206 };
}

module.exports = { parseByteRange };
