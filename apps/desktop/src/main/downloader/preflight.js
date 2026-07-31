const { fetchViaPlayerSession } = require("./hlsProxy");
const { listCandidates, resolveCandidate } = require("./streamCandidates");

async function preflightCandidate(candidateId) {
  const candidate = resolveCandidate(candidateId);
  if (!candidate) return { ok: false, code: "expired", error: "This stream expired. Resume playback to capture it again." };
  try {
    const response = await fetchViaPlayerSession(candidate.url, candidate);
    if (response.statusCode === 401 || response.statusCode === 403) return { ok: false, code: `http_${response.statusCode}`, error: `The source rejected the browser session (${response.statusCode}).` };
    if (response.statusCode >= 400) return { ok: false, code: `http_${response.statusCode}`, error: `The stream returned HTTP ${response.statusCode}.` };
    const manifest = response.body.toString("utf8");
    if (!manifest.includes("#EXTM3U")) return { ok: false, code: "not_hls", error: "The captured response is not a valid HLS playlist." };
    if (/METHOD=(?:SAMPLE-AES|SAMPLE-AES-CTR)/i.test(manifest) || /KEYFORMAT="(?!identity)/i.test(manifest)) return { ok: false, code: "drm", error: "This stream uses unsupported DRM encryption." };
    const variants = [...manifest.matchAll(/#EXT-X-STREAM-INF:([^\r\n]+)/g)].map((match) => ({
      resolution: match[1].match(/RESOLUTION=(\d+x\d+)/i)?.[1] || "",
      bandwidth: Number(match[1].match(/BANDWIDTH=(\d+)/i)?.[1] || 0),
    }));
    return { ok: true, candidate: listCandidates().find((item) => item.id === candidateId), encrypted: /#EXT-X-KEY:.*METHOD=AES-128/i.test(manifest), variants, isMaster: variants.length > 0 };
  } catch (error) {
    const message = error.message || "The stream could not be reached.";
    if (/net::ERR_|ERR_FAILED|ERR_ABORTED/i.test(message)) {
      return { ok: true, code: "electron_net_fallback", strategy: "direct", warning: `Electron preflight was unavailable (${message}); Orion will use direct yt-dlp with the captured browser headers.`, candidate: listCandidates().find((item) => item.id === candidateId), variants: [], isMaster: false };
    }
    return { ok: false, code: "network", error: message };
  }
}

module.exports = { preflightCandidate };
