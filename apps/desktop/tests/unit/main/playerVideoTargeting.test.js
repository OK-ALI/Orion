const test = require("node:test");
const assert = require("node:assert/strict");

const {
  qualifyUserSeek,
  selectPrimaryVideoCandidate,
  videoCandidateScore,
} = require("../../../src/main/player/videoTargeting");

test("primary video targeting prefers long-form visible playback over short auxiliary video", () => {
  const auxiliary = {
    index: 0,
    duration: 30,
    finiteDuration: true,
    currentTime: 12,
    readyState: 4,
    clientWidth: 1280,
    clientHeight: 720,
    videoWidth: 1280,
    videoHeight: 720,
    visible: true,
    ended: false,
  };
  const feature = {
    index: 1,
    duration: 5400,
    finiteDuration: true,
    currentTime: 900,
    readyState: 3,
    clientWidth: 960,
    clientHeight: 540,
    videoWidth: 1920,
    videoHeight: 1080,
    visible: true,
    ended: false,
  };

  const selected = selectPrimaryVideoCandidate([auxiliary, feature]);
  assert.equal(selected.index, 1);
  assert.ok(videoCandidateScore(feature) > videoCandidateScore(auxiliary));
});

test("primary video targeting penalizes ended media", () => {
  const ended = {
    index: 0,
    duration: 3600,
    finiteDuration: true,
    currentTime: 3600,
    readyState: 4,
    clientWidth: 1280,
    clientHeight: 720,
    videoWidth: 1920,
    videoHeight: 1080,
    visible: true,
    ended: true,
  };
  const active = {
    index: 1,
    duration: 3000,
    finiteDuration: true,
    currentTime: 600,
    readyState: 4,
    clientWidth: 1280,
    clientHeight: 720,
    videoWidth: 1920,
    videoHeight: 1080,
    visible: true,
    ended: false,
  };

  assert.equal(selectPrimaryVideoCandidate([ended, active]).index, 1);
});

test("primary video targeting works without provider identifiers", () => {
  const selected = selectPrimaryVideoCandidate([
    {
      index: 0,
      duration: 1500,
      finiteDuration: true,
      currentTime: 0,
      readyState: 2,
      clientWidth: 640,
      clientHeight: 360,
      videoWidth: 1280,
      videoHeight: 720,
      visible: true,
      ended: false,
    },
  ]);

  assert.equal(selected.index, 0);
  assert.equal(Object.prototype.hasOwnProperty.call(selected, "provider"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(selected, "sourceId"), false);
});

test("primary video targeting compares candidates across provider child frames", async () => {
  const { findPrimaryVideo } = require("../../../src/main/player/videoTargeting");
  const shortFrame = {
    executeJavaScript: async () => [{
      index: 0,
      duration: 45,
      finiteDuration: true,
      currentTime: 8,
      readyState: 4,
      clientWidth: 1280,
      clientHeight: 720,
      videoWidth: 1280,
      videoHeight: 720,
      visible: true,
      ended: false,
    }],
  };
  const contentFrame = {
    executeJavaScript: async () => [{
      index: 0,
      duration: 2700,
      finiteDuration: true,
      currentTime: 420,
      readyState: 3,
      clientWidth: 854,
      clientHeight: 480,
      videoWidth: 1920,
      videoHeight: 1080,
      visible: true,
      ended: false,
    }],
  };

  const selected = await findPrimaryVideo([shortFrame, contentFrame]);
  assert.equal(selected.frame, contentFrame);
  assert.equal(selected.duration, 2700);
});


test("playback intent enforcement distinguishes interactive seeks from provider restores", () => {
  const now = 50_000;
  const interactive = qualifyUserSeek({
    lastInteractiveSeekAt: now - 250,
    lastInteractiveSeekTo: 5460,
    lastExternalSeekAt: 0,
    lastPlaybackGestureAt: 0,
  }, now);
  assert.equal(interactive.recentUserSeek, true);
  assert.equal(interactive.lastUserSeekTo, 5460);

  const providerRestore = qualifyUserSeek({
    lastExternalSeekAt: now - 250,
    lastExternalSeekTo: 2770,
    lastPlaybackGestureAt: 0,
  }, now);
  assert.equal(providerRestore.recentUserSeek, false);
  assert.equal(providerRestore.lastUserSeekTo, null);
});

test("cross-frame user gesture can qualify an external seek as user-driven", () => {
  const now = 75_000;
  const result = qualifyUserSeek({
    lastExternalSeekAt: now - 300,
    lastExternalSeekTo: 1200,
    lastPlaybackGestureAt: now - 450,
  }, now);
  assert.equal(result.recentUserSeek, true);
  assert.equal(result.lastUserSeekTo, 1200);
});

test("primary video targeting carries the newest playback gesture across provider frames", async () => {
  const { findPrimaryVideo } = require("../../../src/main/player/videoTargeting");
  const controlsFrame = {
    executeJavaScript: async () => ({
      gestureAt: 91_000,
      videos: [],
    }),
  };
  const contentFrame = {
    executeJavaScript: async () => ({
      gestureAt: 90_000,
      videos: [{
        index: 0,
        duration: 5400,
        finiteDuration: true,
        currentTime: 0,
        readyState: 4,
        clientWidth: 1280,
        clientHeight: 720,
        videoWidth: 1920,
        videoHeight: 1080,
        visible: true,
        ended: false,
      }],
    }),
  };

  const selected = await findPrimaryVideo([controlsFrame, contentFrame]);
  assert.equal(selected.frame, contentFrame);
  assert.equal(selected.lastPlaybackGestureAt, 91_000);
});
