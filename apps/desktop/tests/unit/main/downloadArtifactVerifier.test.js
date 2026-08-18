const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  assessMediaArtifact,
  findTaskArtifact,
  parseFfmpegInspection,
} = require("../../../src/main/downloader/artifactVerifier");

test("ffmpeg inspection extracts duration and audio/video streams", () => {
  const probe = parseFfmpegInspection(`
Duration: 01:42:31.50, start: 0.000000, bitrate: 3100 kb/s
Stream #0:0: Video: h264, yuv420p, 1920x1080
Stream #0:1: Audio: aac, 48000 Hz, stereo
`);
  assert.equal(probe.durationSeconds, 6151.5);
  assert.equal(probe.hasVideo, true);
  assert.equal(probe.hasAudio, true);
});

test("artifact verification rejects short auxiliary media against expected runtime", () => {
  const result = assessMediaArtifact({
    durationSeconds: 4,
    hasVideo: true,
    hasAudio: true,
    invalidData: false,
  }, { expectedDurationSeconds: 7200, expectedDurationConfidence: "exact" });
  assert.equal(result.ok, false);
  assert.equal(result.code, "duration_mismatch");
});

test("artifact verification requires both playable video and audio", () => {
  const result = assessMediaArtifact({
    durationSeconds: 3600,
    hasVideo: true,
    hasAudio: false,
    invalidData: false,
  }, { expectedDurationSeconds: 3600, expectedDurationConfidence: "exact" });
  assert.equal(result.ok, false);
  assert.equal(result.code, "no_audio");
});

test("approximate TV runtime allows normal episode variance", () => {
  const result = assessMediaArtifact({
    durationSeconds: 1500,
    hasVideo: true,
    hasAudio: true,
    invalidData: false,
  }, { expectedDurationSeconds: 2700, expectedDurationConfidence: "approximate" });
  assert.equal(result.ok, true);
});

test("task artifact discovery cannot adopt an unrelated newer video", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orion-artifact-test-"));
  try {
    const owned = path.join(dir, "Movie [orion-a1b2c3d4].mp4");
    const unrelated = path.join(dir, "Another Movie.mp4");
    fs.writeFileSync(owned, "owned");
    fs.writeFileSync(unrelated, "unrelated");
    const future = new Date(Date.now() + 10000);
    fs.utimesSync(unrelated, future, future);
    const found = findTaskArtifact({
      downloadPath: dir,
      outputStem: "Movie [orion-a1b2c3d4]",
      filePath: null,
    });
    assert.equal(found, owned);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("reported filePath must still belong to the task-owned output stem", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orion-artifact-owned-"));
  try {
    const owned = path.join(dir, "Movie [orion-a1b2c3d4].mp4");
    const unrelated = path.join(dir, "Another Movie.mp4");
    fs.writeFileSync(owned, "owned");
    fs.writeFileSync(unrelated, "unrelated");
    const found = findTaskArtifact({
      downloadPath: dir,
      outputStem: "Movie [orion-a1b2c3d4]",
      filePath: unrelated,
    });
    assert.equal(found, owned);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});


test("task artifact discovery finds an owned m4s segment for explicit rejection", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orion-artifact-segment-"));
  try {
    const segment = path.join(dir, "Movie [orion-a1b2c3d4].m4s");
    fs.writeFileSync(segment, "segment");
    const found = findTaskArtifact({
      downloadPath: dir,
      outputStem: "Movie [orion-a1b2c3d4]",
      filePath: segment,
    });
    assert.equal(found, segment);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
