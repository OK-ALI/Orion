const test = require("node:test");
const assert = require("node:assert/strict");
const {
  REMOTE_RANGE_CHUNK_BYTES,
  boundedRemoteRange,
  isGoogleVideoUrl,
} = require("../../../src/main/music/playback/remoteMediaRange");

test("recognizes Googlevideo playback hosts without broadening to unrelated Google hosts", () => {
  assert.equal(isGoogleVideoUrl("https://rr5---sn-2uja-aixr.googlevideo.com/videoplayback"), true);
  assert.equal(isGoogleVideoUrl("https://googlevideo.com/videoplayback"), true);
  assert.equal(isGoogleVideoUrl("https://youtube.com/watch?v=test"), false);
  assert.equal(isGoogleVideoUrl("https://google.com/"), false);
});

test("bounds Googlevideo open-ended media ranges into finite chunks", () => {
  assert.equal(
    boundedRemoteRange("https://rr5---sn-2uja-aixr.googlevideo.com/videoplayback", "bytes=0-"),
    `bytes=0-${REMOTE_RANGE_CHUNK_BYTES - 1}`,
  );
  assert.equal(
    boundedRemoteRange("https://rr5---sn-2uja-aixr.googlevideo.com/videoplayback", "bytes=1048576-"),
    `bytes=1048576-${(2 * REMOTE_RANGE_CHUNK_BYTES) - 1}`,
  );
});

test("preserves finite, suffix and non-Googlevideo ranges", () => {
  const googleVideo = "https://rr5---sn-2uja-aixr.googlevideo.com/videoplayback";
  assert.equal(boundedRemoteRange(googleVideo, "bytes=0-1"), "bytes=0-1");
  assert.equal(boundedRemoteRange(googleVideo, "bytes=-512"), "bytes=-512");
  assert.equal(boundedRemoteRange("https://example.com/audio.mp4", "bytes=0-"), "bytes=0-");
  assert.equal(boundedRemoteRange(googleVideo, ""), "");
});
