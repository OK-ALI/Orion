const test = require("node:test");
const assert = require("node:assert/strict");
const {
  addCandidate,
  clearCandidates,
  isHls,
  listCandidates,
  resolveCandidate,
  classifyStream,
  beginCaptureSession,
} = require("../../../src/main/downloader/streamCandidates");

test.beforeEach(() => clearCandidates());

test("detects URL and MIME based HLS manifests", () => {
  assert.equal(isHls("https://video.test/master.m3u8?token=secret"), true);
  assert.equal(isHls("https://video.test/playback", { "content-type": ["application/vnd.apple.mpegurl"] }), true);
  assert.equal(isHls("https://video.test/movie.mp4", { "content-type": ["video/mp4"] }), false);
});

test("classifies DASH, direct video, and extensionless manifests", () => {
  assert.equal(classifyStream("https://video.test/manifest.mpd", {}), "dash");
  assert.equal(classifyStream("https://video.test/play", { "content-type": ["application/dash+xml"] }), "dash");
  assert.equal(classifyStream("https://video.test/file.mp4", {}), "direct");
  assert.equal(classifyStream("https://video.test/master/manifest.m3u8/chunk", {}), "hls");
  assert.equal(classifyStream("https://video.test/playback?type=m3u8&id=7", {}), "hls");
  assert.equal(classifyStream("https://video.test/media/42", { "content-type": ["video/mp4"] }, "other"), "direct");
  assert.equal(classifyStream("https://video.test/manifest", { "content-type": ["application/octet-stream"] }, "xhr"), "hls");
});

test("keeps a late modal connected to a compatible restarted capture session", () => {
  const identity = { mediaType: "tv", mediaId: 7, season: 1, episode: 2 };
  const first = beginCaptureSession({ mediaIdentity: identity, sourceId: "source-a" });
  addCandidate({ url: "https://cdn.test/master.m3u8", sessionId: first.id });
  const restarted = beginCaptureSession({ mediaIdentity: identity, sourceId: "source-a" });
  assert.equal(listCandidates({ sessionId: restarted.id }).length, 1);
});

test("scopes candidates to capture sessions", () => {
  const first = beginCaptureSession({ mediaIdentity: { mediaType: "movie", mediaId: 1 } });
  const second = beginCaptureSession({ mediaIdentity: { mediaType: "movie", mediaId: 2 } });
  addCandidate({ url: "https://cdn.test/one.m3u8", sessionId: first.id });
  addCandidate({ url: "https://cdn.test/two.m3u8", sessionId: second.id });
  assert.equal(listCandidates({ sessionId: first.id }).length, 1);
  assert.equal(listCandidates({ sessionId: first.id })[0].sessionId, first.id);
});

test("ranks master playlists and redacts query tokens from summaries", () => {
  const variant = addCandidate({ url: "https://cdn.test/720.m3u8?token=private", requestHeaders: { Authorization: "secret" } });
  const master = addCandidate({ url: "https://cdn.test/master.m3u8?token=private", requestHeaders: { Authorization: "secret" } });
  const listed = listCandidates();
  assert.equal(listed[0].id, master.id);
  assert.equal(listed[0].displayUrl, "https://cdn.test/master.m3u8");
  assert.equal("requestHeaders" in listed[0], false);
  assert.equal(resolveCandidate(variant.id).requestHeaders.Authorization, "secret");
});

test("deduplicates repeated captures without losing the opaque id", () => {
  const first = addCandidate({ url: "https://cdn.test/index.m3u8" });
  const second = addCandidate({ url: "https://cdn.test/index.m3u8", responseHeaders: { "content-type": ["application/x-mpegURL"] } });
  assert.equal(first.id, second.id);
  assert.equal(listCandidates().length, 1);
});
