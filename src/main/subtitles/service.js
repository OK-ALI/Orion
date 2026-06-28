const { app } = require("electron");
const path = require("path");
const fs = require("fs");
const { SUBTITLE_EXTS, extractFirstSubtitleFromZip } = require("./archive");

function fetchWithTimeout(url, options = {}, ms = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}

const cachedLocalProviderKeys = new Map();

function getLocalProviderKey(name, minimumLength = 8) {
  if (cachedLocalProviderKeys.has(name)) return cachedLocalProviderKeys.get(name);

  let key = String(process.env[name] || "").trim();
  if (!key && !app.isPackaged) {
    try {
      const envPath = path.join(app.getAppPath(), ".env");
      const envText = fs.readFileSync(envPath, "utf8");
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = envText.match(new RegExp(`^${escapedName}\\s*=\\s*(.+)$`, "m"));
      key = String(match?.[1] || "")
        .trim()
        .replace(/^(["'])(.*)\1$/, "$2");
    } catch {
      // Local provider keys are optional; renderer-supplied keys still work.
    }
  }

  const safeKey = key.length >= minimumLength && !/[\r\n]/.test(key) ? key : "";
  cachedLocalProviderKeys.set(name, safeKey);
  return safeKey;
}

function extractSubtitleLang(url) {
  try {
    const u = new URL(url);
    for (const param of ["lang", "language", "locale", "sub", "l"]) {
      const v = u.searchParams.get(param);
      if (v && v.length >= 2 && v.length <= 20) return v.toLowerCase();
    }
    const pathname = u.pathname;
    const filename = pathname.split("/").filter(Boolean).pop() || "";
    const fileMatch = filename.match(/[._-]([a-z]{2,3})[._-]?(vtt|srt|ass)?$/i);
    if (fileMatch) return fileMatch[1].toLowerCase();
    const segments = pathname.split("/").filter(Boolean);
    for (const seg of segments.slice(0, -1)) {
      if (/^[a-z]{2,3}(-[A-Z]{2})?$/.test(seg)) return seg.toLowerCase();
    }
  } catch {}
  return "unknown";
}

async function resolveSubtitleAsset(sub = {}) {
  if (String(sub.file_id || "").startsWith("subdl_")) {
    const parts = String(sub.file_id).split("_");
    const subdlPath = decodeURIComponent(parts.slice(2).join("_"));
    const response = await fetchWithTimeout(
      `https://dl.subdl.com${subdlPath}`,
      { headers: { "User-Agent": "Orion" } },
      30000,
    );
    if (!response.ok) throw new Error(`SubDL download error ${response.status}`);
    const extracted = extractFirstSubtitleFromZip(Buffer.from(await response.arrayBuffer()));
    if (!extracted) throw new Error("No subtitle file found in SubDL archive");
    const ext = path.extname(extracted.name).slice(1).toLowerCase();
    return { data: extracted.data, ext: SUBTITLE_EXTS.has(ext) ? ext : "srt" };
  }

  const url =
    sub.url ||
    sub.direct_url ||
    (String(sub.file_id || "").startsWith("wyzie_")
      ? decodeURIComponent(String(sub.file_id).split("_").slice(2).join("_"))
      : null);
  if (!url) throw new Error("Subtitle has no downloadable URL");
  if (url.startsWith("file://")) {
    const filePath = decodeURIComponent(new URL(url).pathname).replace(/^\/(?:([A-Za-z]:))/i, "$1");
    const ext = path.extname(filePath).slice(1).toLowerCase();
    return { data: fs.readFileSync(filePath), ext: SUBTITLE_EXTS.has(ext) ? ext : "srt" };
  }
  let referer;
  try { referer = new URL(url).origin; } catch {}
  const response = await fetchWithTimeout(
    url,
    { headers: { "User-Agent": "Orion", ...(referer ? { Referer: referer } : {}) } },
    30000,
  );
  if (!response.ok) throw new Error(`Subtitle download error ${response.status}`);
  const cleanUrl = url.split("?")[0].split("#")[0];
  const ext = path.extname(cleanUrl).slice(1).toLowerCase();
  return {
    data: Buffer.from(await response.arrayBuffer()),
    ext: SUBTITLE_EXTS.has(ext) ? ext : "srt",
  };
}

module.exports = { extractSubtitleLang, fetchWithTimeout, getLocalProviderKey, resolveSubtitleAsset };
