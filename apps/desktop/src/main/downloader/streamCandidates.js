const crypto = require("crypto");
const { isObviousMediaSegmentUrl } = require("./mediaSegments");

const MAX_CANDIDATES = 60;
const MAX_AGE_MS = 15 * 60 * 1000;
const SESSION_AGE_MS = 30 * 60 * 1000;
const candidates = new Map();
const captureSessions = new Map();
const webContentsSessions = new Map();
const observedRequests = new Map();
let activeSessionId = null;

function headerValue(headers, name) {
  const wanted = String(name).toLowerCase();
  for (const [key, value] of Object.entries(headers || {})) {
    if (key.toLowerCase() === wanted) {
      return Array.isArray(value) ? value.join(", ") : String(value || "");
    }
  }
  return "";
}

function classifyStream(url, responseHeaders = {}, resourceType = "") {
  const value = String(url || "").toLowerCase();
  const contentType = headerValue(responseHeaders, "content-type").toLowerCase();
  const disposition = headerValue(responseHeaders, "content-disposition").toLowerCase();
  if (isObviousMediaSegmentUrl(url)) return null;
  const hlsUrl = /(?:\.m3u8|\/m3u8)(?:$|[/?#&])/.test(value) ||
    /[?&](?:format|type|ext)=m3u8(?:&|$)/.test(value);
  const dashUrl = /(?:\.mpd|\/mpd)(?:$|[/?#&])/.test(value) ||
    /[?&](?:format|type|ext)=mpd(?:&|$)/.test(value);
  const manifestEndpoint = /\/(?:master|manifest|playlist|playback)(?:[/?#]|$)/.test(value);
  if (hlsUrl || contentType.includes("mpegurl") || disposition.includes(".m3u8") ||
      (manifestEndpoint && contentType.includes("application/octet-stream"))) return "hls";
  if (dashUrl || contentType.includes("dash+xml") || disposition.includes(".mpd")) return "dash";
  if (
    /\.(?:mp4|m4v|webm|mov)(?:$|[/?#&])/.test(value) ||
    disposition.match(/\.(?:mp4|m4v|webm|mov)(?:["';]|$)/) ||
    (contentType.startsWith("video/") && !contentType.includes("vtt"))
  ) return "direct";
  return null;
}

function isHls(url, responseHeaders = {}) {
  return classifyStream(url, responseHeaders) === "hls";
}

function scoreCandidate(candidate) {
  const value = `${candidate.url} ${candidate.contentType}`.toLowerCase();
  let score = candidate.kind === "hls" ? 60 : candidate.kind === "dash" ? 50 : 45;
  const reasons = [];
  if (/master|playlist|index\.m3u8/.test(value)) {
    score += 30;
    reasons.push("Likely master playlist");
  }
  if (/\.m3u8(?:$|[?#])/.test(value)) score += 10;
  if (/ad[sx]?[/_.-]|preroll|tracking/.test(value)) {
    score -= 60;
    reasons.push("Possible ad stream");
  }
  if (candidate.resourceType === "media" || candidate.resourceType === "xhr") score += 5;
  return {
    score,
    rankReason: reasons[0] ||
      (candidate.kind === "dash" ? "DASH playback manifest" :
        candidate.kind === "direct" ? "Direct video response" : "Recent playback stream"),
  };
}

function displayUrl(raw) {
  try {
    const parsed = new URL(raw);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return String(raw || "").split("?")[0];
  }
}

function prune() {
  const cutoff = Date.now() - MAX_AGE_MS;
  for (const [id, item] of candidates) {
    if (item.capturedAt < cutoff) candidates.delete(id);
  }
  const sessionCutoff = Date.now() - SESSION_AGE_MS;
  for (const [id, session] of captureSessions) {
    if (session.updatedAt < sessionCutoff) {
      captureSessions.delete(id);
      for (const [wcId, sessionId] of webContentsSessions) {
        if (sessionId === id) webContentsSessions.delete(wcId);
      }
    }
  }
  const ordered = [...candidates.values()].sort((a, b) => b.capturedAt - a.capturedAt);
  for (const item of ordered.slice(MAX_CANDIDATES)) candidates.delete(item.id);
}

function beginCaptureSession(details = {}) {
  prune();
  const id = crypto.randomUUID();
  const now = Date.now();
  const session = {
    id,
    mediaIdentity: details.mediaIdentity || null,
    sourceId: details.sourceId || null,
    startedAt: now,
    updatedAt: now,
    status: "detecting",
    contextRevision: 0,
  };
  captureSessions.set(id, session);
  activeSessionId = id;
  if (Number.isInteger(details.webContentsId)) bindWebContents(id, details.webContentsId);
  return { ...session };
}

function bindWebContents(sessionId, webContentsId) {
  const session = captureSessions.get(sessionId || activeSessionId);
  if (!session || !Number.isInteger(webContentsId)) return false;
  webContentsSessions.set(webContentsId, session.id);
  session.updatedAt = Date.now();
  return true;
}

function bindWebContentsToActive(webContentsId) {
  return bindWebContents(activeSessionId, webContentsId);
}

function captureSessionIdForWebContents(webContentsId) {
  return webContentsSessions.get(webContentsId) || null;
}

function endCaptureSession(sessionId) {
  const session = captureSessions.get(sessionId);
  if (!session) return false;
  session.status = "ended";
  session.updatedAt = Date.now();
  for (const [webContentsId, boundSessionId] of webContentsSessions) {
    if (boundSessionId === sessionId) webContentsSessions.delete(webContentsId);
  }
  if (activeSessionId === sessionId) activeSessionId = null;
  observedRequests.delete(sessionId);
  return true;
}

function recordObservedRequest({ url, webContentsId, requestHeaders, referrer } = {}) {
  const sessionId = webContentsSessions.get(webContentsId);
  if (!sessionId || !captureSessions.has(sessionId) || !url) return;
  const requests = observedRequests.get(sessionId) || new Map();
  requests.delete(url);
  requests.set(url, { requestHeaders: { ...(requestHeaders || {}) }, referrer: referrer || "" });
  while (requests.size > 256) requests.delete(requests.keys().next().value);
  observedRequests.set(sessionId, requests);
  const capture = captureSessions.get(sessionId);
  capture.contextRevision += 1;
}

function requestContextForUrl(candidate, url, parentUrl = candidate?.url) {
  const observed = candidate?._observedRequestSnapshot?.get(url)
    || observedRequests.get(candidate?.sessionId)?.get(url);
  if (observed) return observed;
  try {
    if (new URL(url).origin === new URL(candidate.url).origin) return candidate;
    const original = candidate.requestHeaders || {};
    const safe = {};
    for (const [name, value] of Object.entries(original)) {
      if (["user-agent", "accept", "accept-language"].includes(name.toLowerCase())) safe[name] = value;
    }
    safe.Referer = new URL(parentUrl).origin + "/";
    return { requestHeaders: safe, referrer: safe.Referer };
  } catch {
    return { requestHeaders: {}, referrer: "" };
  }
}

function snapshotCandidateRequestContext(candidate) {
  const snapshot = { ...candidate };
  const observed = observedRequests.get(candidate?.sessionId) || new Map();
  Object.defineProperty(snapshot, "_observedRequestSnapshot", {
    value: new Map([...observed].map(([url, context]) => [url, {
      requestHeaders: { ...context.requestHeaders }, referrer: context.referrer,
    }])),
  });
  return snapshot;
}

function hasObservedRequestContext(candidate, url) {
  return Boolean(observedRequests.get(candidate?.sessionId)?.has(url));
}

function addCandidate(details = {}) {
  const kind = classifyStream(details.url, details.responseHeaders, details.resourceType);
  if (!kind) return null;
  prune();
  const sessionId =
    details.sessionId || webContentsSessions.get(details.webContentsId) || activeSessionId || null;
  const existing = [...candidates.values()].find(
    (item) => item.url === details.url && item.sessionId === sessionId,
  );
  const id = existing?.id || crypto.randomUUID();
  const contentType = headerValue(details.responseHeaders, "content-type");
  const next = {
    ...(existing || {}),
    id,
    sessionId,
    sourceId: sessionId ? captureSessions.get(sessionId)?.sourceId || null : null,
    kind,
    status: "ready",
    url: details.url,
    requestHeaders: details.requestHeaders || existing?.requestHeaders || {},
    responseHeaders: details.responseHeaders || existing?.responseHeaders || {},
    referrer: details.referrer || headerValue(details.requestHeaders, "referer") || existing?.referrer || "",
    resourceType: details.resourceType || existing?.resourceType || "",
    webContentsId: details.webContentsId || existing?.webContentsId || null,
    frameId: details.frameId ?? existing?.frameId ?? null,
    contentType: contentType || existing?.contentType ||
      (kind === "hls" ? "application/vnd.apple.mpegurl" : kind === "dash" ? "application/dash+xml" : "video/mp4"),
    capturedAt: Date.now(),
  };
  Object.assign(next, scoreCandidate(next));
  candidates.set(id, next);
  const session = sessionId ? captureSessions.get(sessionId) : null;
  if (session) {
    session.status = "ready";
    session.updatedAt = Date.now();
  }
  return summary(next);
}

function summary(item) {
  if (!item) return null;
  let host = "";
  try { host = new URL(item.url).host; } catch {}
  return {
    id: item.id,
    candidateId: item.id,
    sessionId: item.sessionId,
    sourceId: item.sourceId,
    kind: item.kind,
    status: item.status,
    contextRevision: captureSessions.get(item.sessionId)?.contextRevision || 0,
    host,
    contentType: item.contentType,
    capturedAt: item.capturedAt,
    score: item.score,
    rankReason: item.rankReason,
    displayUrl: displayUrl(item.url),
  };
}

function listCandidates({ sessionId, webContentsIds } = {}) {
  prune();
  const allowed = Array.isArray(webContentsIds) && webContentsIds.length ? new Set(webContentsIds) : null;
  return [...candidates.values()]
    .filter((candidate) => !sessionId || candidate.sessionId === sessionId)
    .filter((item) => !allowed || allowed.has(item.webContentsId))
    .sort((a, b) => b.score - a.score || b.capturedAt - a.capturedAt)
    .map(summary);
}

function resolveCandidate(id) {
  prune();
  return candidates.get(id) || null;
}

function resolveCaptureSession(id) {
  prune();
  return captureSessions.get(id) || null;
}

function candidateOwnedByTransfer(candidate, capture, { captureSessionId, mediaId, mediaType, season, episode } = {}) {
  const identity = capture?.mediaIdentity;
  return Boolean(candidate && capture && capture.status !== "ended" &&
    candidate.sessionId === captureSessionId && candidate.sourceId === capture.sourceId &&
    String(identity?.mediaType) === String(mediaType) && String(identity?.mediaId) === String(mediaId) &&
    (mediaType !== "tv" || (Number(identity?.season) === Number(season) && Number(identity?.episode) === Number(episode))));
}

function clearCandidates({ sessionId } = {}) {
  if (!sessionId) {
    candidates.clear();
    return;
  }
  for (const [id, item] of candidates) {
    if (item.sessionId === sessionId) candidates.delete(id);
  }
}

module.exports = {
  addCandidate,
  beginCaptureSession,
  bindWebContents,
  bindWebContentsToActive,
  captureSessionIdForWebContents,
  candidateOwnedByTransfer,
  classifyStream,
  clearCandidates,
  endCaptureSession,
  isHls,
  hasObservedRequestContext,
  listCandidates,
  recordObservedRequest,
  requestContextForUrl,
  resolveCaptureSession,
  resolveCandidate,
  snapshotCandidateRequestContext,
};
