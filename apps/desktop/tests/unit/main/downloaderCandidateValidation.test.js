const test = require("node:test");
const assert = require("node:assert/strict");
const {
  inspectDashProbe,
  inspectDirectProbe,
  inspectHlsProbe,
} = require("../../../src/main/downloader/candidateValidation");

test("HLS preflight validates manifests and rejects SAMPLE-AES DRM", () => {
  const ok = inspectHlsProbe({
    statusCode: 200,
    headers: { "content-type": "application/vnd.apple.mpegurl" },
    body: Buffer.from("#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=1280x720\nvideo.m3u8"),
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.strategy, "hls-proxy");
  assert.equal(ok.variants[0].resolution, "1280x720");

  const drm = inspectHlsProbe({
    statusCode: 200,
    headers: {},
    body: Buffer.from("#EXTM3U\n#EXT-X-KEY:METHOD=SAMPLE-AES,URI=\"key\""),
  });
  assert.equal(drm.ok, false);
  assert.equal(drm.code, "drm");
});

test("DASH preflight recognizes MPD and rejects known Widevine protection", () => {
  const ok = inspectDashProbe({
    statusCode: 200,
    headers: { "content-type": "application/dash+xml" },
    body: Buffer.from("<?xml version=\"1.0\"?><MPD><Period /></MPD>"),
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.strategy, "direct");

  const drm = inspectDashProbe({
    statusCode: 200,
    headers: {},
    body: Buffer.from("<MPD><ContentProtection schemeIdUri=\"urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed\" /></MPD>"),
  });
  assert.equal(drm.ok, false);
  assert.equal(drm.code, "drm");
});

test("DIRECT preflight accepts video probes and rejects HTML/API impostors", () => {
  const mp4 = Buffer.alloc(32);
  mp4.writeUInt32BE(24, 0);
  mp4.write("ftyp", 4, "ascii");
  const ok = inspectDirectProbe({
    statusCode: 206,
    headers: { "content-type": "video/mp4", "content-range": "bytes 0-31/1000" },
    body: mp4,
  }, { contentType: "video/mp4" });
  assert.equal(ok.ok, true);
  assert.equal(ok.ranged, true);

  const bad = inspectDirectProbe({
    statusCode: 200,
    headers: { "content-type": "text/html" },
    body: Buffer.from("<!doctype html><html><body>ad gate</body></html>"),
  }, { contentType: "video/mp4" });
  assert.equal(bad.ok, false);
  assert.equal(bad.code, "not_video");
});


test("DIRECT preflight rejects a captured media segment even when it looks like MP4", () => {
  const mp4 = Buffer.alloc(32);
  mp4.writeUInt32BE(24, 0);
  mp4.write("styp", 4, "ascii");
  const result = inspectDirectProbe({
    statusCode: 206,
    headers: { "content-type": "video/mp4" },
    body: mp4,
  }, {
    url: "https://steelatom.top/vd/token/seg-509-s1080p-v1-a1.m4s",
    contentType: "video/mp4",
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "media_segment");
});
