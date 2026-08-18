const path = require("path");

const SEGMENT_EXTS = new Set([".m4s", ".cmfv", ".cmfa"]);

function pathnameFromUrl(rawUrl) {
  try {
    return new URL(String(rawUrl || "")).pathname || "";
  } catch {
    return String(rawUrl || "").split(/[?#]/, 1)[0];
  }
}

function isSegmentExtension(value) {
  const clean = String(value || "").split(/[?#]/, 1)[0];
  return SEGMENT_EXTS.has(path.extname(clean).toLowerCase());
}

function isObviousMediaSegmentUrl(rawUrl) {
  const pathname = pathnameFromUrl(rawUrl).toLowerCase();
  if (isSegmentExtension(pathname)) return true;
  const filename = path.basename(pathname);
  return /(?:^|[-_.])(?:seg(?:ment)?|chunk|frag(?:ment)?|part)[-_.]?\d+(?:[-_.]|$)/i.test(filename) ||
    /(?:^|\/)(?:segments?|chunks?|fragments?)\//i.test(pathname);
}

module.exports = {
  SEGMENT_EXTS,
  isObviousMediaSegmentUrl,
  isSegmentExtension,
};
