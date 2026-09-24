// Select one real media request without exposing manifest URLs to the renderer.
const { inspectHlsProbe, inspectMediaProbe } = require("./candidateValidation");
const { hasObservedRequestContext } = require("./streamCandidates");
const MANIFEST_PROBE_BYTES = 1024 * 1024;
const MEDIA_PROBE_BYTES = 4096;
function resolveChild(parent, raw) {
  try {
    const url = new URL(raw, parent);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function firstHlsChild(parent, body) {
  const lines = String(body || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const master = lines.some((line) => line.startsWith("#EXT-X-STREAM-INF:"));
  if (master) {
    const index = lines.findIndex((line) => line.startsWith("#EXT-X-STREAM-INF:"));
    const next = lines.slice(index + 1).find((line) => !line.startsWith("#"));
    const url = next && resolveChild(parent, next);
    return url ? { kind: "playlist", url } : null;
  }
  const initialization = lines.find((line) => line.startsWith("#EXT-X-MAP:"))?.match(/URI="([^"]+)"/i)?.[1];
  const segment = initialization || lines.find((line) => !line.startsWith("#"));
  const url = segment && resolveChild(parent, segment);
  return url ? { kind: "media", url } : null;
}

function firstDashChild(parent, body) {
  const manifest = String(body || "");
  const base = manifest.match(/<BaseURL[^>]*>([^<]+)<\/BaseURL>/i)?.[1]?.trim();
  const baseUrl = base ? resolveChild(parent, base) : parent;
  if (!baseUrl) return null;
  const initialization = manifest.match(/<Initialization\b[^>]*\bsourceURL="([^"]+)"/i)?.[1];
  const segment = manifest.match(/<SegmentURL\b[^>]*\bmedia="([^"]+)"/i)?.[1];
  const representation = manifest.match(/<Representation\b[^>]*\bid="([^"]+)"/i)?.[1] || "";
  const templateTag = manifest.match(/<SegmentTemplate\b[^>]*>/i)?.[0] || "";
  const template = templateTag.match(/\binitialization="([^"]+)"/i)?.[1]
    || templateTag.match(/\bmedia="([^"]+)"/i)?.[1];
  const raw = initialization || segment || template;
  if (!raw) return null;
  const resolved = raw.replace(/\$RepresentationID\$/g, representation)
    .replace(/\$Number(?:%0\dd)?\$/g, "1")
    .replace(/\$Time\$/g, "0");
  if (/\$[^$]+\$/.test(resolved)) return null;
  const url = resolveChild(baseUrl, resolved);
  return url ? { kind: "media", url } : null;
}

function probeDiagnostic(candidate, child, response) {
  const destination = new URL(child.url);
  const root = new URL(candidate.url);
  const headers = response?.headers || {};
  const value = (name) => {
    const key = Object.keys(headers).find((entry) => entry.toLowerCase() === name);
    return key ? String(headers[key] || "") : "";
  };
  return {
    stage: child.kind === "playlist" ? "media_playlist" : "first_media",
    host: destination.host,
    crossOrigin: destination.origin !== root.origin,
    observedInPlayer: hasObservedRequestContext(candidate, child.url),
    statusCode: response?.statusCode || null,
    contentType: value("content-type").split(";")[0],
    contentLength: Number(value("content-length")) || null,
    bytesRead: Buffer.from(response?.body || []).length,
    requestHeaderNames: response?.requestDiagnostic?.headerNames || [],
    authorizationPresent: response?.requestDiagnostic?.authorizationPresent || false,
    cookiePresent: response?.requestDiagnostic?.cookiePresent || false,
  };
}

async function probeFirstMedia(candidate, response, fetcher) {
  let parent = candidate.url;
  let manifest = Buffer.from(response.body || []).toString("utf8");
  for (let depth = 0; depth < 3; depth += 1) {
    const child = candidate.kind === "hls"
      ? firstHlsChild(parent, manifest)
      : firstDashChild(parent, manifest);
    if (!child) return { ok: false, code: "media_child_missing", error: "This source did not expose a downloadable media request." };
    let media;
    try {
      media = await fetcher(child.url, candidate, {
        referer: parent,
        range: child.kind === "media" ? `bytes=0-${MEDIA_PROBE_BYTES - 1}` : undefined,
        maxBytes: child.kind === "media" ? MEDIA_PROBE_BYTES : MANIFEST_PROBE_BYTES,
      });
    } catch (error) {
      error.downloadDiagnostic = probeDiagnostic(candidate, child);
      throw error;
    }
    const diagnostic = probeDiagnostic(candidate, child, media);
    if (child.kind === "media") return { ...inspectMediaProbe(media), diagnostic };
    const checked = inspectHlsProbe(media);
    if (!checked.ok) return { ...checked, diagnostic };
    parent = child.url;
    manifest = Buffer.from(media.body || []).toString("utf8");
  }
  return { ok: false, code: "media_child_missing", error: "The media playlist chain was too deep to verify." };
}

module.exports = { firstHlsChild, firstDashChild, probeFirstMedia, resolveChild };
