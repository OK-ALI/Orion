const { fetchViaPlayerSession } = require("./hlsProxy");
const { listCandidates, resolveCandidate } = require("./streamCandidates");
const { isObviousMediaSegmentUrl } = require("./mediaSegments");
const {
  inspectDashProbe,
  inspectDirectProbe,
  inspectHlsProbe,
} = require("./candidateValidation");

const MANIFEST_PROBE_BYTES = 1024 * 1024;
const DIRECT_PROBE_BYTES = 64 * 1024;

async function preflightCandidate(candidateId) {
  const candidate = resolveCandidate(candidateId);
  if (!candidate) {
    return {
      ok: false,
      code: "expired",
      error: "This stream expired. Resume playback to capture it again.",
    };
  }
  if (isObviousMediaSegmentUrl(candidate.url)) {
    return {
      ok: false,
      code: "media_segment",
      error: "This captured item is only a streaming media segment, not the full movie or episode. Choose a manifest or another complete source.",
      candidate: listCandidates().find((item) => item.id === candidateId),
    };
  }
  try {
    const isDirect = candidate.kind === "direct";
    let response = await fetchViaPlayerSession(candidate.url, candidate, {
      range: isDirect ? `bytes=0-${DIRECT_PROBE_BYTES - 1}` : undefined,
      maxBytes: isDirect ? DIRECT_PROBE_BYTES : MANIFEST_PROBE_BYTES,
    });
    if (isDirect && response.statusCode === 416) {
      response = await fetchViaPlayerSession(candidate.url, candidate, { maxBytes: DIRECT_PROBE_BYTES });
    }
    const result = candidate.kind === "hls"
      ? inspectHlsProbe(response)
      : candidate.kind === "dash"
        ? inspectDashProbe(response)
        : inspectDirectProbe(response, candidate);
    return {
      ...result,
      candidate: listCandidates().find((item) => item.id === candidateId),
    };
  } catch (error) {
    const message = error.message || "The stream could not be reached.";
    if (/net::ERR_|ERR_FAILED|ERR_ABORTED/i.test(message)) {
      return {
        ok: true,
        code: "electron_net_fallback",
        strategy: "direct",
        kind: candidate.kind,
        verified: false,
        warning: `Electron preflight was unavailable (${message}); Orion will use the captured browser context and verify the downloaded artifact before completion.`,
        candidate: listCandidates().find((item) => item.id === candidateId),
        variants: [],
        isMaster: false,
      };
    }
    return { ok: false, code: "network", error: message };
  }
}

module.exports = { preflightCandidate };
