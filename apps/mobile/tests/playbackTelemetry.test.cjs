"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createPlaybackTelemetryState,
  playbackPercent,
  reducePlaybackTelemetry,
} = require("../src/features/playback/telemetryReducer.ts");
const {
  createEmbeddedTelemetryScript,
  parseEmbeddedTelemetryMessage,
} = require("../src/features/playback/embeddedTelemetry.ts");
const {
  verifiedResumeSeconds,
} = require("../src/features/playback/playbackResume.ts");

const session = (overrides = {}) => ({
  schemaVersion: 2,
  id: "session-1",
  media: { id: 10, mediaType: "movie", title: "Truth" },
  sourceId: "videasy",
  surface: "embed",
  state: "loading",
  verified: false,
  lastVerifiedTime: null,
  startedAt: 1000,
  updatedAt: 1000,
  ...overrides,
});

const event = (sequence, currentTime, overrides = {}) => ({
  schemaVersion: 1,
  sessionId: "session-1",
  sourceId: "videasy",
  sequence,
  evidence: "provider-video-event",
  state: "playing",
  currentTime,
  duration: 100,
  bufferedPosition: currentTime + 5,
  observedAt: 1000 + sequence * 1000,
  ...overrides,
});

test("playback becomes verified only after timing advances", () => {
  const initial = createPlaybackTelemetryState(session());
  const first = reducePlaybackTelemetry(initial, event(1, 12));
  assert.equal(first.accepted, true);
  assert.equal(first.state.session.verified, false);
  const second = reducePlaybackTelemetry(first.state, event(2, 13));
  assert.equal(second.accepted, true);
  assert.equal(second.state.session.verified, true);
  assert.equal(second.shouldPersist, true);
});

test("opened-only evidence never verifies playback", () => {
  let state = createPlaybackTelemetryState(session());
  state = reducePlaybackTelemetry(state, event(1, 1, { evidence: "opened-only" })).state;
  const result = reducePlaybackTelemetry(state, event(2, 2, { evidence: "opened-only" }));
  assert.equal(result.accepted, true);
  assert.equal(result.state.session.verified, false);
  assert.equal(result.shouldPersist, false);
});

test("stale, mismatched, invalid and unexplained telemetry is rejected", () => {
  let state = createPlaybackTelemetryState(session());
  state = reducePlaybackTelemetry(state, event(1, 20)).state;
  assert.equal(reducePlaybackTelemetry(state, event(1, 21)).reason, "stale-sequence");
  assert.equal(reducePlaybackTelemetry(state, event(2, 21, { sourceId: "other" })).reason, "source-mismatch");
  assert.equal(reducePlaybackTelemetry(state, event(2, -1)).reason, "invalid-current-time");
  assert.equal(reducePlaybackTelemetry(state, event(2, 10)).reason, "unexplained-regression");
});

test("a verified seek may move backward and unknown duration has no percentage", () => {
  let state = createPlaybackTelemetryState(session());
  state = reducePlaybackTelemetry(state, event(1, 50)).state;
  state = reducePlaybackTelemetry(state, event(2, 51)).state;
  const seeking = reducePlaybackTelemetry(state, event(3, 20, { state: "seeking" }));
  assert.equal(seeking.accepted, true);
  assert.equal(seeking.state.session.lastVerifiedTime, 20);
  assert.equal(playbackPercent(20, null), null);
  assert.equal(playbackPercent(90, 100), 90);
});

test("time beyond a known duration is rejected", () => {
  const state = createPlaybackTelemetryState(session());
  const result = reducePlaybackTelemetry(state, event(1, 120, { duration: 100 }));
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "position-after-duration");
});

test("stale observations and impossible duration changes are rejected", () => {
  let state = createPlaybackTelemetryState(session());
  state = reducePlaybackTelemetry(state, event(1, 10)).state;
  assert.equal(
    reducePlaybackTelemetry(state, event(2, 11, { observedAt: 1000 })).reason,
    "stale-observation-time",
  );
  assert.equal(
    reducePlaybackTelemetry(state, event(2, 11, { duration: 180 })).reason,
    "impossible-duration-change",
  );
});

test("source handoff carries only a verified finite position", () => {
  assert.equal(verifiedResumeSeconds(null), 0);
  assert.equal(verifiedResumeSeconds({
    currentTime: Number.NaN,
    duration: 100,
    evidence: "provider-video-event",
    observedAt: Date.now(),
  }), 0);
  assert.equal(verifiedResumeSeconds({
    currentTime: 42.5,
    duration: 100,
    evidence: "provider-video-event",
    observedAt: Date.now(),
  }), 42.5);
});

test("embedded telemetry requires the active session, source, origin and sequence", () => {
  const now = Date.now();
  const raw = {
    type: "ORION_PLAYBACK_TELEMETRY",
    sessionId: "session-1",
    sourceId: "videasy",
    sequence: 2,
    origin: "https://player.videasy.to",
    evidence: "provider-video-event",
    state: "playing",
    currentTime: 15,
    duration: 120,
    bufferedPosition: 30,
    observedAt: now,
  };
  const context = {
    sessionId: "session-1",
    sourceId: "videasy",
    expectedOrigins: ["https://player.videasy.to"],
    lastSequence: 1,
  };
  assert.equal(parseEmbeddedTelemetryMessage(raw, context).input.currentTime, 15);
  assert.equal(parseEmbeddedTelemetryMessage({ ...raw, sequence: 1 }, context), null);
  assert.equal(parseEmbeddedTelemetryMessage({ ...raw, origin: "https://evil.invalid" }, context), null);
  assert.equal(parseEmbeddedTelemetryMessage({ ...raw, sessionId: "old" }, context), null);
});

test("embedded observer is read-only and does not monkey-patch playback", () => {
  const script = createEmbeddedTelemetryScript({
    sessionId: "session-1",
    sourceId: "videasy",
    strategy: "frame-video",
    expectedOrigins: ["https://player.videasy.to"],
  });
  assert.match(script, /querySelectorAll\('video'\)/);
  assert.match(script, /ORION_PLAYBACK_TELEMETRY/);
  assert.doesNotMatch(script, /prototype\.play|prototype\.pause|HTMLMediaElement\.prototype/);
});
