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

function safeDiagnostic(candidate, response, stage) {
  const typeKey = Object.keys(response?.headers || {}).find((name) => name.toLowerCase() === "content-type");
  const lengthKey = Object.keys(response?.headers || {}).find((name) => name.toLowerCase() === "content-length");
  const rawType = String(typeKey ? response.headers[typeKey] : "");
  return {
    stage,
    host: new URL(candidate.url).host,
    crossOrigin: false,
    observedInPlayer: true,
    statusCode: response?.statusCode || null,
    contentType: rawType.match(/^[a-z0-9.+_-]+\/[a-z0-9.+_-]+/i)?.[0] || "",
    contentLength: Number(lengthKey ? response.headers[lengthKey] : 0) || null,
    bytesRead: Buffer.from(response?.body || []).length,
    requestHeaderNames: response?.requestDiagnostic?.headerNames || [],
    authorizationPresent: response?.requestDiagnostic?.authorizationPresent || false,
    cookiePresent: response?.requestDiagnostic?.cookiePresent || false,
  };
}

function reportPreflight(candidate, candidateId, result) {
  console.info("[Orion download preflight]", JSON.stringify({
    sourceId: candidate.sourceId,
    candidateId,
    outcome: result.ok ? "ready" : "failed",
    code: result.code || null,
    diagnostic: result.diagnostic || null,
  }));
  return result;
}

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
    const rootDiagnostic = safeDiagnostic(candidate, response, isDirect ? "direct_video" : "root_manifest");
    if (!result.ok) return reportPreflight(candidate, candidateId, {
      ...result, verified: false, diagnostic: rootDiagnostic,
      candidate: listCandidates().find((item) => item.id === candidateId),
    });
    let verifiedDiagnostic = rootDiagnostic;
    if (result.ok && candidate.kind !== "direct") {
      const media = await probeFirstMedia(candidate, response, fetchViaPlayerSession);
      if (!media.ok) return reportPreflight(candidate, candidateId, {
        ...media, verified: false,
        diagnostic: media.diagnostic || { ...rootDiagnostic, stage: "manifest_child" },
        candidate: listCandidates().find((item) => item.id === candidateId),
      });
      verifiedDiagnostic = media.diagnostic || rootDiagnostic;
    }
    return reportPreflight(candidate, candidateId, {
      ...result,
      verified: result.ok === true,
      diagnostic: verifiedDiagnostic,
      candidate: listCandidates().find((item) => item.id === candidateId),
    });
  } catch (error) {
    const code = /timed?\s*out/i.test(error?.message || "") ? "timeout"
      : /redirect/i.test(error?.message || "") ? "redirect_denied" : "network";
    const diagnostic = error?.downloadDiagnostic || {
      stage: candidate.kind === "direct" ? "direct_video" : "root_manifest",
      host: new URL(candidate.url).host,
      crossOrigin: false,
      observedInPlayer: true,
      statusCode: null,
      bytesRead: 0,
    };
    return reportPreflight(candidate, candidateId, {
      ok: false, code, verified: false, diagnostic,
      error: code === "redirect_denied"
        ? "This source redirected media outside Orion's verified request path. Try another source."
        : "Orion could not verify media bytes from this source. Try another source.",
    });
  }
}

module.exports = { preflightCandidate };
