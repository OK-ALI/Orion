const test = require("node:test");
const assert = require("node:assert/strict");
const { probeFirstMedia, firstDashChild } = require("../../../src/main/downloader/mediaDescendant");
const { inspectDirectProbe } = require("../../../src/main/downloader/candidateValidation");
const {
  addCandidate,
  beginCaptureSession,
  bindWebContents,
  candidateOwnedByTransfer,
  clearCandidates,
  endCaptureSession,
  listCandidates,
  recordObservedRequest,
  resolveCaptureSession,
  requestContextForUrl,
  resolveCandidate,
} = require("../../../src/main/downloader/streamCandidates");

const response = (statusCode, body, contentType = "video/mp2t") => ({
  statusCode,
  headers: { "content-type": contentType },
  body: Buffer.from(body),
});

test("a reachable HLS root is not ready when its first segment rejects the request", async () => {
  const candidate = { kind: "hls", url: "https://cdn.example/root.m3u8" };
  const root = response(200, "#EXTM3U\n#EXTINF:6,\nfirst.ts", "application/vnd.apple.mpegurl");
  const requested = [];
  const result = await probeFirstMedia(candidate, root, async (url, _, options) => {
    requested.push({ url, ...options });
    return response(403, "denied", "text/plain");
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "http_403");
  assert.equal(requested[0].url, "https://cdn.example/first.ts");
  assert.equal(requested[0].range, "bytes=0-4095");
});

test("a master HLS playlist verifies the media child, not merely its variant playlist", async () => {
  const candidate = { kind: "hls", url: "https://cdn.example/root.m3u8" };
  const root = response(200, "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000\nlow.m3u8", "application/vnd.apple.mpegurl");
  const seen = [];
  const result = await probeFirstMedia(candidate, root, async (url) => {
    seen.push(url);
    return url.endsWith(".m3u8")
      ? response(200, "#EXTM3U\n#EXTINF:6,\nfirst.ts", "application/vnd.apple.mpegurl")
      : response(200, Buffer.from([0x47, 0x40, 0x00]));
  });
  assert.equal(result.ok, true);
  assert.deepEqual(seen, ["https://cdn.example/low.m3u8", "https://cdn.example/first.ts"]);
});

test("an empty HLS media child and a document impostor both fail closed", async () => {
  const candidate = { kind: "hls", url: "https://cdn.example/root.m3u8" };
  const root = response(200, "#EXTM3U\n#EXTINF:6,\nfirst.ts", "application/vnd.apple.mpegurl");
  assert.equal((await probeFirstMedia(candidate, root, async () => response(200, ""))).code, "empty_media");
  assert.equal((await probeFirstMedia(candidate, root, async () => response(200, "<html>gate</html>", "text/html"))).code, "not_media");
});

test("DASH initialization and direct ranges require actual media bytes", async () => {
  const manifest = '<MPD><Period><AdaptationSet><Representation id="v1"><SegmentTemplate initialization="init-$RepresentationID$.mp4" media="s-$Number$.m4s" /></Representation></AdaptationSet></Period></MPD>';
  assert.equal(firstDashChild("https://cdn.example/manifest.mpd", manifest).url, "https://cdn.example/init-v1.mp4");
  const result = await probeFirstMedia(
    { kind: "dash", url: "https://cdn.example/manifest.mpd" },
    response(200, manifest, "application/dash+xml"),
    async () => response(200, ""),
  );
  assert.equal(result.code, "empty_media");
  assert.equal(inspectDirectProbe(response(206, "", "video/mp4"), { url: "https://cdn.example/movie.mp4" }).code, "empty_media");
});

test("observed child context stays session-bound and cross-origin credentials are denied", () => {
  clearCandidates();
  const session = beginCaptureSession({ sourceId: "vixsrc", mediaIdentity: { mediaType: "tv", mediaId: 1408, season: 2, episode: 1 } });
  bindWebContents(session.id, 821);
  const captured = addCandidate({
    sessionId: session.id,
    webContentsId: 821,
    url: "https://root.example/master.m3u8",
    requestHeaders: { Authorization: "root-secret", Cookie: "root=cookie", "User-Agent": "OrionTest" },
  });
  const candidate = resolveCandidate(captured.id);
  recordObservedRequest({
    url: "https://cdn.example/first.ts",
    webContentsId: 821,
    requestHeaders: { Authorization: "child-secret", Referer: "https://root.example/watch" },
  });
  assert.equal(requestContextForUrl(candidate, "https://cdn.example/first.ts").requestHeaders.Authorization, "child-secret");
  const unknown = requestContextForUrl(candidate, "https://other.example/first.ts");
  assert.equal(unknown.requestHeaders.Authorization, undefined);
  assert.equal(unknown.requestHeaders.Cookie, undefined);
  assert.equal(unknown.requestHeaders["User-Agent"], "OrionTest");
  endCaptureSession(session.id);
  assert.equal(listCandidates({ sessionId: session.id }).length, 1);
  assert.equal(requestContextForUrl(candidate, "https://cdn.example/first.ts").requestHeaders.Authorization, undefined);
  clearCandidates();
});

test("Dr. House S2E1 cannot adopt another episode or source capture", () => {
  clearCandidates();
  const first = beginCaptureSession({ sourceId: "vixsrc", mediaIdentity: { mediaType: "tv", mediaId: 1408, season: 2, episode: 1 } });
  const captured = addCandidate({ sessionId: first.id, url: "https://cdn.example/house-s2e1.m3u8" });
  const candidate = resolveCandidate(captured.id);
  const session = resolveCaptureSession(first.id);
  const request = { captureSessionId: first.id, mediaId: 1408, mediaType: "tv", season: 2, episode: 1 };
  assert.equal(candidateOwnedByTransfer(candidate, session, request), true);
  assert.equal(candidateOwnedByTransfer(candidate, session, { ...request, episode: 2 }), false);
  assert.equal(candidateOwnedByTransfer(candidate, session, { ...request, mediaId: 999 }), false);
  const switched = beginCaptureSession({ sourceId: "vidlink", mediaIdentity: { mediaType: "tv", mediaId: 1408, season: 2, episode: 1 } });
  assert.equal(candidateOwnedByTransfer(candidate, resolveCaptureSession(switched.id), { ...request, captureSessionId: switched.id }), false);
  endCaptureSession(first.id);
  assert.equal(candidateOwnedByTransfer(candidate, resolveCaptureSession(first.id), request), false);
  clearCandidates();
});
