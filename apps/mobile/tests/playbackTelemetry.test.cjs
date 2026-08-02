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
const {
  canPersistVerifiedPlayback,
} = require("../src/features/playback/playbackEvidence.ts");
const {
  HANDOFF_CONFIRMATION_TIMEOUT_MS,
  confirmPlaybackHandoff,
  createPlaybackHandoff,
  getFreshVerifiedPosition,
  handoffCanCarryPosition,
  handoffContinueRequiresCleanRestart,
  handoffTargetMissedPosition,
  updateHandoffStatus,
} = require("../src/features/playback/handoffPolicy.ts");
const {
  createVerifiedResumeScript,
} = require("../src/features/playback/mobileAdBlocker.ts");
const {
  applyMobileResumePlaybackPolicy,
  formatPlaybackTime,
  resolveResumeChoiceTime,
} = require("../src/features/playback/resumeChoice.ts");

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

test("only verified telemetry evidence may reach progress and history", () => {
  assert.equal(canPersistVerifiedPlayback("native-video-event", "session-1"), true);
  assert.equal(canPersistVerifiedPlayback("provider-video-event", "session-1"), true);
  assert.equal(canPersistVerifiedPlayback("provider-message", "session-1"), true);
  assert.equal(canPersistVerifiedPlayback("opened-only", "session-1"), false);
  assert.equal(canPersistVerifiedPlayback("manual-watched", "session-1"), false);
  assert.equal(canPersistVerifiedPlayback("provider-message", ""), false);
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
  assert.equal(parseEmbeddedTelemetryMessage({ ...raw, currentTime: -1 }, context), null);
  assert.equal(parseEmbeddedTelemetryMessage({ ...raw, evidence: "opened-only" }, context), null);
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

test("handoff accepts only fresh finite verified snapshots", () => {
  const now = 20_000;
  const fresh = {
    sessionId: "source-session",
    sourceId: "videasy",
    currentTime: 61.25,
    duration: 120,
    evidence: "provider-video-event",
    observedAt: now - 4_999,
  };
  assert.equal(getFreshVerifiedPosition(fresh, now), 61.25);
  assert.equal(getFreshVerifiedPosition({ ...fresh, observedAt: now - 5_001 }, now), null);
  assert.equal(getFreshVerifiedPosition({ ...fresh, currentTime: Number.NaN }, now), null);
});

test("handoff confirms only matching target telemetry within tolerance", () => {
  const handoff = createPlaybackHandoff({
    reason: "manual",
    fromSessionId: "old-session",
    fromSourceId: "videasy",
    targetSourceId: "vidking",
    requestedTime: 60,
    strategy: "url-param",
    now: 10_000,
  });
  const target = {
    sessionId: "new-session",
    sourceId: "vidking",
    currentTime: 64.9,
    duration: 120,
    evidence: "provider-message",
    observedAt: 10_500,
  };
  assert.equal(confirmPlaybackHandoff(handoff, target, 10_600)?.status, "confirmed");
  assert.equal(confirmPlaybackHandoff(handoff, { ...target, sourceId: "vixsrc" }), null);
  assert.equal(confirmPlaybackHandoff(handoff, { ...target, currentTime: 65.1 }), null);
  assert.equal(confirmPlaybackHandoff(handoff, { ...target, observedAt: 9_999 }), null);
});

test("handoff identifies an advancing target that missed the carried position after settling", () => {
  const handoff = createPlaybackHandoff({
    reason: "manual",
    fromSessionId: "old-session",
    fromSourceId: "vidsrc",
    targetSourceId: "vidking",
    requestedTime: 120,
    strategy: "url-param",
    now: 10_000,
  });
  const target = {
    sessionId: "new-session",
    sourceId: "vidking",
    currentTime: 4,
    duration: 3600,
    evidence: "provider-message",
    observedAt: 14_100,
  };
  assert.equal(handoffTargetMissedPosition(handoff, target, 13_900), false);
  assert.equal(handoffTargetMissedPosition(handoff, target, 14_100), true);
  assert.equal(handoffTargetMissedPosition(handoff, { ...target, currentTime: 117 }, 14_100), false);
  assert.equal(handoffTargetMissedPosition(handoff, { ...target, sourceId: "vixsrc" }, 14_100), false);
});

test("an unconfirmed URL resume can restart the selected target without the resume parameter", () => {
  const handoff = updateHandoffStatus(createPlaybackHandoff({
    reason: "manual",
    fromSessionId: "old-session",
    fromSourceId: "vidsrc",
    targetSourceId: "vidking",
    requestedTime: 120,
    strategy: "url-param",
    now: 10_000,
  }), "unconfirmed", "TARGET_NOT_CONFIRMED", 22_000);
  assert.equal(handoffContinueRequiresCleanRestart(handoff, "vidking"), true);
  assert.equal(handoffContinueRequiresCleanRestart(handoff, "vidsrc"), false);
  assert.equal(handoffContinueRequiresCleanRestart({ ...handoff, status: "confirmed" }, "vidking"), false);
  assert.equal(handoffContinueRequiresCleanRestart({ ...handoff, strategy: "verified-seek" }, "vidking"), false);
});

test("handoff capability and timeout states remain explicit", () => {
  assert.equal(handoffCanCarryPosition("url-param", 30), true);
  assert.equal(handoffCanCarryPosition("verified-seek", 30), true);
  assert.equal(handoffCanCarryPosition("none", 30), false);
  assert.equal(handoffCanCarryPosition("native", null), false);
  assert.equal(HANDOFF_CONFIRMATION_TIMEOUT_MS, 12_000);
  const handoff = createPlaybackHandoff({
    reason: "automatic",
    fromSessionId: "old-session",
    fromSourceId: "videasy",
    targetSourceId: "vidking",
    requestedTime: 30,
    strategy: "url-param",
    now: 1,
  });
  const failed = updateHandoffStatus(handoff, "failed", "TARGET_NOT_CONFIRMED", 13_000);
  assert.equal(failed.failureCode, "TARGET_NOT_CONFIRMED");
  assert.equal(failed.status, "failed");
});

test("bounded verified seek is idempotent and reports its result", () => {
  const script = createVerifiedResumeScript(42.9, "handoff-1");
  assert.match(script, /__orionResumeHandoffId/);
  assert.match(script, /attempts >= 32/);
  assert.match(script, /ORION_RESUME_RESULT/);
  assert.match(script, /Math\.abs\(Number\(video\.currentTime\) - 42\) <= 5/);
  assert.doesNotMatch(script, /prototype\.|set currentTime/);
});

test("resume prompt choices resolve to explicit playback positions", () => {
  assert.equal(resolveResumeChoiceTime("resume", 125.8), 125.8);
  assert.equal(resolveResumeChoiceTime("replay-30", 125.8), 95.8);
  assert.equal(resolveResumeChoiceTime("replay-30", 12), 0);
  assert.equal(resolveResumeChoiceTime("start-over", 125.8), 0);
  assert.equal(resolveResumeChoiceTime("resume", Number.NaN), 0);
  assert.equal(formatPlaybackTime(125.8), "2:05");
  assert.equal(formatPlaybackTime(3_725), "1:02:05");
  assert.deepEqual(
    applyMobileResumePlaybackPolicy("vidking", 125, { progress: 125 }, true),
    { progress: 125, autoPlay: "false" },
  );
  assert.deepEqual(
    applyMobileResumePlaybackPolicy("vidking", 0, {}, true),
    {},
  );
  assert.deepEqual(
    applyMobileResumePlaybackPolicy("videasy", 125, { progress: 125 }, true),
    { progress: 125 },
  );
});

test("player-event observer is restricted to documented mobile providers and shapes", () => {
  const script = createEmbeddedTelemetryScript({
    sessionId: "session-1",
    sourceId: "vidking",
    strategy: "player-event",
    expectedOrigins: ["https://www.vidking.net"],
  });
  assert.match(script, /vidking: true, vidlink: true, vixsrc: true/);
  assert.match(script, /value\.type === 'PLAYER_EVENT'/);
  assert.match(script, /allowedOrigins\.has\(event\.origin\)/);
  assert.doesNotMatch(script, /data\.currentTime\s*\|\|/);
});
