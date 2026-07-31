"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createPlaybackTelemetryState,
  playbackPercent,
  reducePlaybackTelemetry,
} = require("../src/features/playback/telemetryReducer.ts");

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
