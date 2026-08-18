const { isObviousMediaSegmentUrl } = require("./mediaSegments");

function getHeader(headers, name) {
  const wanted = String(name || "").toLowerCase();
  for (const [key, value] of Object.entries(headers || {})) {
    if (String(key).toLowerCase() !== wanted) continue;
    return Array.isArray(value) ? value.join(", ") : String(value || "");
  }
  return "";
}

function httpFailure(statusCode) {
  if (statusCode === 401 || statusCode === 403) {
    return {
      ok: false,
      code: `http_${statusCode}`,
      error: `The source rejected the browser session (${statusCode}).`,
    };
  }
  if (statusCode >= 400) {
    return {
      ok: false,
      code: `http_${statusCode}`,
      error: `The stream returned HTTP ${statusCode}.`,
    };
  }
  return null;
}

function inspectHlsProbe(response) {
  const failed = httpFailure(response.statusCode || 0);
  if (failed) return failed;
  const manifest = Buffer.from(response.body || []).toString("utf8");
  if (!manifest.includes("#EXTM3U")) {
    return { ok: false, code: "not_hls", error: "The captured response is not a valid HLS playlist." };
  }
  if (/METHOD=(?:SAMPLE-AES|SAMPLE-AES-CTR)/i.test(manifest) || /KEYFORMAT="(?!identity)/i.test(manifest)) {
    return { ok: false, code: "drm", error: "This HLS stream uses unsupported DRM encryption." };
  }
  const variants = [...manifest.matchAll(/#EXT-X-STREAM-INF:([^\r\n]+)/g)].map((match) => ({
    resolution: match[1].match(/RESOLUTION=(\d+x\d+)/i)?.[1] || "",
    bandwidth: Number(match[1].match(/BANDWIDTH=(\d+)/i)?.[1] || 0),
  }));
  return {
    ok: true,
    kind: "hls",
    strategy: "hls-proxy",
    encrypted: /#EXT-X-KEY:.*METHOD=AES-128/i.test(manifest),
    variants,
    isMaster: variants.length > 0,
  };
}

function inspectDashProbe(response) {
  const failed = httpFailure(response.statusCode || 0);
  if (failed) return failed;
  const manifest = Buffer.from(response.body || []).toString("utf8");
  const contentType = getHeader(response.headers, "content-type").toLowerCase();
  if (!/<MPD(?:\s|>)/i.test(manifest) && !contentType.includes("dash+xml")) {
    return { ok: false, code: "not_dash", error: "The captured response is not a valid DASH manifest." };
  }
  if (/urn:uuid:(?:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed|9a04f079-9840-4286-ab92-e65be0885f95)/i.test(manifest)) {
    return { ok: false, code: "drm", error: "This DASH stream uses unsupported DRM encryption." };
  }
  return { ok: true, kind: "dash", strategy: "direct", variants: [], isMaster: true };
}

function isKnownVideoMagic(body) {
  const data = Buffer.from(body || []);
  if (data.length >= 8) {
    const box = data.subarray(4, 8).toString("ascii");
    if (["ftyp", "styp", "moov", "moof"].includes(box)) return true;
  }
  return data.length >= 4 && data[0] === 0x1a && data[1] === 0x45 && data[2] === 0xdf && data[3] === 0xa3;
}

function looksLikeTextPayload(body) {
  const sample = Buffer.from(body || []).subarray(0, 512).toString("utf8").trim().toLowerCase();
  return sample.startsWith("<!doctype html") || sample.startsWith("<html") ||
    sample.startsWith("{") || sample.startsWith("[") || sample.startsWith("<?xml");
}

function inspectDirectProbe(response, candidate = {}) {
  if (isObviousMediaSegmentUrl(candidate.url)) {
    return {
      ok: false,
      code: "media_segment",
      error: "The captured DIRECT response is a media segment, not the full movie or episode. Choose an HLS/DASH manifest or a complete direct-video source.",
    };
  }
  const failed = httpFailure(response.statusCode || 0);
  if (failed) return failed;
  const contentType = getHeader(response.headers, "content-type").toLowerCase();
  if (/text\/html|application\/(?:json|xml)|text\/plain/.test(contentType) || looksLikeTextPayload(response.body)) {
    return { ok: false, code: "not_video", error: "The captured DIRECT response is a document/API response, not playable video media." };
  }
  const capturedType = String(candidate.contentType || "").toLowerCase();
  const videoTyped = contentType.startsWith("video/") || capturedType.startsWith("video/");
  const binaryTyped = contentType.includes("octet-stream") || capturedType.includes("octet-stream");
  if (!videoTyped && !binaryTyped && !isKnownVideoMagic(response.body)) {
    return { ok: false, code: "not_video", error: "The captured DIRECT response could not be identified as video media." };
  }
  return {
    ok: true,
    kind: "direct",
    strategy: "direct",
    contentType: contentType || capturedType || "application/octet-stream",
    ranged: response.statusCode === 206 || Boolean(getHeader(response.headers, "content-range")),
  };
}

module.exports = {
  getHeader,
  inspectDashProbe,
  inspectDirectProbe,
  inspectHlsProbe,
  isKnownVideoMagic,
  looksLikeTextPayload,
};
