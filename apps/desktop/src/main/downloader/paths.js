const path = require("path");

function safeFileName(name) {
  return String(name || "Orion Download")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160) || "Orion Download";
}

function safeSourceLabel(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return String(url || "").split("?")[0];
  }
}

function publicDownload(entry) {
  if (!entry) return entry;
  const {
    m3u8Context,
    cookiePath,
    m3u8Url,
    subtitles,
    ...safe
  } = entry;
  return { ...safe, sourceHost: safe.sourceHost || (() => {
    try { return new URL(m3u8Url).host; } catch { return ""; }
  })() };
}

function qualityFormat(preset = "best") {
  if (preset === "1080") return "bv*[height<=1080]+ba/b[height<=1080]/b";
  if (preset === "720") return "bv*[height<=720]+ba/b[height<=720]/b";
  if (preset === "480") return "bv*[height<=480]+ba/b[height<=480]/b";
  return "bv*+ba/b";
}

function buildTargetDirectory(root, mediaType, name, season) {
  const title = safeFileName(
    mediaType === "tv" ? name.replace(/\s+S\d+\s*E\d+.*$/i, "") : name,
  );
  return mediaType === "tv"
    ? path.join(root, "Series", title, `Season ${String(season || 1).padStart(2, "0")}`)
    : path.join(root, "Movies", title);
}
module.exports = { safeFileName, safeSourceLabel, publicDownload, qualityFormat, buildTargetDirectory };
