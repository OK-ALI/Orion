const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const {
  addCandidate, beginCaptureSession, bindWebContents, clearCandidates, recordObservedRequest,
} = require("../../../src/main/downloader/streamCandidates");

function loadPreflight(fetchViaPlayerSession) {
  const original = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === "./hlsProxy" && parent?.filename?.endsWith("preflight.js")) return { fetchViaPlayerSession };
    return original.call(this, request, parent, isMain);
  };
  const path = require.resolve("../../../src/main/downloader/preflight");
  delete require.cache[path];
  try { return require(path).preflightCandidate; } finally { Module._load = original; }
}

function captured(url, kind = "hls") {
  clearCandidates();
  const capture = beginCaptureSession({ sourceId: "vixsrc", mediaIdentity: { mediaType: "movie", mediaId: 1 } });
  bindWebContents(capture.id, 909);
  const candidate = addCandidate({
    sessionId: capture.id, webContentsId: 909, url,
    responseHeaders: { "content-type": kind === "direct" ? "video/mp4" : "application/vnd.apple.mpegurl" },
  });
  return candidate;
}

test("root success and first-media rejection stay unverified with safe stage diagnostics", async () => {
  const candidate = captured("https://root.example/master.m3u8?root-token=private");
  const childUrl = "https://cdn.example/first.ts?child-token=private";
  recordObservedRequest({ url: childUrl, webContentsId: 909,
    requestHeaders: { Authorization: "private-child-value" } });
  const fetch = async (url) => url.includes("master.m3u8")
    ? { statusCode: 200, headers: { "content-type": "application/vnd.apple.mpegurl" },
      body: Buffer.from("#EXTM3U\n#EXTINF:6,\n" + childUrl),
      requestDiagnostic: { headerNames: ["Accept"], authorizationPresent: false, cookiePresent: false } }
    : { statusCode: 403, headers: { "content-type": "text/plain" }, body: Buffer.from("denied"),
      requestDiagnostic: { headerNames: ["Authorization"], authorizationPresent: true, cookiePresent: false } };
  const preflight = loadPreflight(fetch);
  const logs = [];
  const originalInfo = console.info;
  console.info = (...args) => logs.push(args.join(" "));
  let result;
  try { result = await preflight(candidate.id); } finally { console.info = originalInfo; }
  assert.equal(result.ok, false);
  assert.equal(result.verified, false);
  assert.equal(result.code, "http_403");
  assert.equal(result.diagnostic.stage, "first_media");
  assert.equal(result.diagnostic.host, "cdn.example");
  assert.equal(result.diagnostic.observedInPlayer, true);
  assert.equal(result.diagnostic.authorizationPresent, true);
  const serialized = JSON.stringify(result) + logs.join(" ");
  assert.doesNotMatch(serialized, /root-token|child-token|private-child-value/);
});

test("redirect failure names the first failing child without exposing its signed URL", async () => {
  const candidate = captured("https://root.example/master.m3u8?secret=private");
  const preflight = loadPreflight(async (url) => {
    if (url.includes("master.m3u8")) return {
      statusCode: 200, headers: {}, body: Buffer.from("#EXTM3U\n#EXTINF:5,\nhttps://cdn.example/first.ts?secret=private"),
    };
    throw new Error("redirect rejected: https://cdn.example/first.ts?secret=private");
  });
  const originalInfo = console.info;
  console.info = () => {};
  let result;
  try { result = await preflight(candidate.id); } finally { console.info = originalInfo; }
  assert.equal(result.code, "redirect_denied");
  assert.equal(result.diagnostic.stage, "first_media");
  assert.doesNotMatch(JSON.stringify(result), /secret=private/);
});
