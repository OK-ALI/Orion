const { fetchViaPlayerSession } = require("./hlsProxy");
const { listCandidates, resolveCandidate } = require("./streamCandidates");
const { isObviousMediaSegmentUrl } = require("./mediaSegments");
const { probeFirstMedia } = require("./mediaDescendant");
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
    if (result.ok && candidate.kind !== "direct") {
      const media = await probeFirstMedia(candidate, response, fetchViaPlayerSession);
      if (!media.ok) return { ...media, candidate: listCandidates().find((item) => item.id === candidateId) };
    }
    return {
      ...result,
      verified: true,
      candidate: listCandidates().find((item) => item.id === candidateId),
    };
  } catch (error) {
    const code = /timed?\s*out/i.test(error?.message || "") ? "timeout" : "network";
    return { ok: false, code, error: "Orion could not verify media bytes from this source. Try another source." };
  }
}

module.exports = { preflightCandidate };
