const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") return { session: {}, net: {} };
  return originalLoad.call(this, request, parent, isMain);
};
const { buildDownloadHeaders, buildSafeTransferHeaders } = require("../../../src/main/downloader/hlsProxy");
Module._load = originalLoad;
const {
  addCandidate, beginCaptureSession, bindWebContents, clearCandidates,
  recordObservedRequest, requestContextForUrl, resolveCandidate,
} = require("../../../src/main/downloader/streamCandidates");

const headers = (context) => Object.fromEntries(buildDownloadHeaders(context, "TestAgent"));

test("same-origin and exact observed cross-origin child use their own authorized context", () => {
  clearCandidates();
  const capture = beginCaptureSession({ sourceId: "vixsrc", mediaIdentity: { mediaType: "movie", mediaId: 1 } });
  bindWebContents(capture.id, 8101);
  const summary = addCandidate({
    sessionId: capture.id, webContentsId: 8101, url: "https://root.example/master.m3u8",
    requestHeaders: { Authorization: "root-fixture", Cookie: "root=fixture", Origin: "https://root.example" },
  });
  const candidate = resolveCandidate(summary.id);
  assert.equal(headers(requestContextForUrl(candidate, "https://root.example/segment.ts")).Authorization, "root-fixture");
  recordObservedRequest({ url: "https://cdn.example/segment.ts", webContentsId: 8101,
    requestHeaders: { Authorization: "child-fixture", Cookie: "child=fixture", Origin: "https://cdn.example" } });
  const observed = headers(requestContextForUrl(candidate, "https://cdn.example/segment.ts"));
  assert.equal(observed.Authorization, "child-fixture");
  assert.equal(observed.Origin, "https://cdn.example");
  assert.equal(observed.Cookie, undefined); // Player-session cookie jar owns destination cookies.
});

test("unobserved cross-origin HLS child and global DASH/direct options cannot receive root credentials", () => {
  const root = { url: "https://root.example/master.m3u8", sessionId: "unknown",
    requestHeaders: { Authorization: "root-fixture", Cookie: "root=fixture", Origin: "https://root.example",
      Referer: "https://root.example/watch?token=fixture", Accept: "video/*" } };
  const unknown = headers(requestContextForUrl(root, "https://other.example/segment.ts", root.url));
  assert.equal(unknown.Authorization, undefined);
  assert.equal(unknown.Cookie, undefined);
  assert.equal(unknown.Referer, "https://root.example/");
  const global = Object.fromEntries(buildSafeTransferHeaders(root, "TestAgent"));
  assert.deepEqual(global, { "User-Agent": "TestAgent", Accept: "video/*" });
  const proxy = fs.readFileSync(path.join(__dirname, "../../../src/main/downloader/hlsProxy.js"), "utf8");
  assert.equal((proxy.match(/redirect: "error"/g) || []).length, 2);
  const ipc = fs.readFileSync(path.join(__dirname, "../../../src/main/downloader/ipc.js"), "utf8");
  assert.equal((ipc.match(/buildSafeTransferHeaders\(/g) || []).length, 2);
});
