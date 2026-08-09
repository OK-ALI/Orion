"use strict";

const SMART_CONNECT_PROTOCOL_VERSION = 3;

const TELEMETRY_STALE_AFTER_MS = 1500;

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function normalizePlaybackTelemetry(input = {}, previousSequence = 0) {
  const observedAt = Number(input.observedAt) || Date.now();
  const currentTime = finiteOrNull(input.currentTime);
  const duration = finiteOrNull(input.duration);
  return {
    sessionId: String(input.sessionId || ""),
    sequence: Math.max(previousSequence + 1, Number(input.sequence) || 0),
    title: String(input.title || "Nothing playing"),
    mediaId: input.mediaId == null ? null : String(input.mediaId),
    playbackKind: ["cinema", "local-video", "music", "none"].includes(input.playbackKind)
      ? input.playbackKind
      : "none",
    currentTime,
    duration,
    bufferedTime: finiteOrNull(input.bufferedTime),
    state: ["playing", "paused", "buffering", "ended", "unobservable", "idle"].includes(input.state)
      ? input.state
      : "idle",
    volume: Math.max(0, Math.min(1, Number(input.volume) || 0)),
    muted: Boolean(input.muted),
    speed: Number.isFinite(Number(input.speed)) ? Number(input.speed) : 1,
    canSeek: Boolean(input.canSeek && currentTime != null && duration != null && duration > 0),
    evidence: String(input.evidence || "unobservable"),
    observedAt,
  };
}

function telemetryFreshness(telemetry, now = Date.now()) {
  const ageMs = telemetry ? Math.max(0, now - Number(telemetry.observedAt || 0)) : Infinity;
  return { ageMs, fresh: Number.isFinite(ageMs) && ageMs <= TELEMETRY_STALE_AFTER_MS };
}

function clampRatio(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number));
}

function normalizePointer(input) {
  if (!input || typeof input !== "object") return undefined;
  return {
    x: clampRatio(input.x ?? input.xRatio),
    y: clampRatio(input.y ?? input.yRatio),
  };
}

function normalizeSmartConnectCommand(input = {}, createId = () => "") {
  const legacyPointer = input.action === "cursor_move" ? normalizePointer(input.value) : undefined;
  return {
    id: String(input.id || createId()),
    sequence: Math.max(0, Number(input.sequence) || 0),
    action: String(input.action || ""),
    value: input.action === "cursor_move" ? undefined : input.value,
    pointer: normalizePointer(input.pointer) || legacyPointer,
    sentAt: Number(input.sentAt) || Date.now(),
  };
}

module.exports = {
  SMART_CONNECT_PROTOCOL_VERSION,
  clampRatio,
  normalizePointer,
  normalizeSmartConnectCommand,
  normalizePlaybackTelemetry,
  telemetryFreshness,
  TELEMETRY_STALE_AFTER_MS,
};
