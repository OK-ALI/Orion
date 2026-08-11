import { mmkvStorageAdapter } from "./storageAdapter";
import { updateCinemaSourceHealth } from "@orion/shared/sources";

export type MobileSourceState = "unknown" | "ready" | "slow" | "failed";
export type CinemaSourceFailureCode =
  | "startup-timeout"
  | "provider-rejection"
  | "http-failure"
  | "blocked-dependency"
  | "manifest-failure"
  | "subtitle-failure"
  | "renderer-termination"
  | "unexpected-navigation"
  | "offline"
  | "user-cancelled"
  | "unknown";

export interface MobileSourceHealthRecord {
  sourceId: string;
  mediaType: "movie" | "tv";
  state: MobileSourceState;
  startupMs: number | null;
  failureCount: number;
  blockedRequests: number;
  allowedDependencies: number;
  lastError: string | null;
  cooldownUntil: number;
  updatedAt: number;
}

/**
 * V2 is deliberately separate from the V1 key. A downgrade can still read
 * V1, while current builds project V2 back into the shared runtime scorer.
 */
export interface CinemaSourceHealthV2 {
  schemaVersion: 2;
  sourceId: string;
  mediaType: "movie" | "tv";
  state: MobileSourceState | "limited";
  startupMs: number | null;
  attemptCount: number;
  successCount: number;
  successRatio: number;
  failureCount: number;
  lastFailure: CinemaSourceFailureCode | null;
  telemetrySupport: "observable" | "unobservable" | "unknown";
  subtitleSupport: "available" | "limited" | "unknown";
  blockedRequests: number;
  allowedDependencies: number;
  shieldFailures: number;
  cooldownUntil: number;
  updatedAt: number;
}

const V1_STORAGE_KEY = "mobileCinemaSourceHealthV1";
const V2_STORAGE_KEY = "mobileCinemaSourceHealthV2";
const MAX_RECORDS = 80;

function parseRecords<T>(key: string): T[] {
  try {
    const parsed = JSON.parse(mmkvStorageAdapter.get(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readV1(): MobileSourceHealthRecord[] {
  return parseRecords<MobileSourceHealthRecord>(V1_STORAGE_KEY);
}

function toV2(record: MobileSourceHealthRecord): CinemaSourceHealthV2 {
  const attempts = Math.max(0, record.failureCount) + (record.state === "ready" || record.state === "slow" ? 1 : 0);
  const successes = record.state === "ready" || record.state === "slow" ? 1 : 0;
  return {
    schemaVersion: 2,
    sourceId: record.sourceId,
    mediaType: record.mediaType,
    state: record.state,
    startupMs: record.startupMs,
    attemptCount: attempts,
    successCount: successes,
    successRatio: attempts ? successes / attempts : 0,
    failureCount: Math.max(0, record.failureCount),
    lastFailure: record.lastError ? "unknown" : null,
    telemetrySupport: "unknown",
    subtitleSupport: "unknown",
    blockedRequests: Math.max(0, record.blockedRequests),
    allowedDependencies: Math.max(0, record.allowedDependencies),
    shieldFailures: 0,
    cooldownUntil: Math.max(0, record.cooldownUntil),
    updatedAt: record.updatedAt,
  };
}

function readV2(): CinemaSourceHealthV2[] {
  const v2 = parseRecords<CinemaSourceHealthV2>(V2_STORAGE_KEY)
    .filter((record) => record?.schemaVersion === 2 && record.sourceId && (record.mediaType === "movie" || record.mediaType === "tv"));
  return v2.length ? v2 : readV1().map(toV2);
}

function toLegacy(record: CinemaSourceHealthV2): MobileSourceHealthRecord {
  return {
    sourceId: record.sourceId,
    mediaType: record.mediaType,
    state: record.state === "limited" ? "slow" : record.state,
    startupMs: record.startupMs,
    failureCount: record.failureCount,
    blockedRequests: record.blockedRequests,
    allowedDependencies: record.allowedDependencies,
    lastError: record.lastFailure,
    cooldownUntil: record.cooldownUntil,
    updatedAt: record.updatedAt,
  };
}

function syncSharedRuntime(records: CinemaSourceHealthV2[]) {
  updateCinemaSourceHealth(records.map((record) => ({
    sourceId: record.sourceId,
    mediaType: record.mediaType,
    state: record.state,
    startupMs: record.startupMs ?? undefined,
    cooldownUntil: record.cooldownUntil,
    updatedAt: record.updatedAt,
  })));
}

function persistV2(records: CinemaSourceHealthV2[]) {
  const bounded = records.slice(-MAX_RECORDS);
  mmkvStorageAdapter.set(V2_STORAGE_KEY, JSON.stringify(bounded));
  syncSharedRuntime(bounded);
  return bounded;
}

export function listMobileSourceHealthV2(): CinemaSourceHealthV2[] {
  return readV2();
}

export function listMobileSourceHealth(): MobileSourceHealthRecord[] {
  return readV2().map(toLegacy);
}

export function hydrateMobileSourceHealth(): MobileSourceHealthRecord[] {
  const records = readV2();
  syncSharedRuntime(records);
  return records.map(toLegacy);
}

export function getMobileSourceHealthV2(sourceId: string, mediaType: "movie" | "tv") {
  return readV2().find((record) => record.sourceId === sourceId && record.mediaType === mediaType) || null;
}

export function getMobileSourceHealth(sourceId: string, mediaType: "movie" | "tv") {
  const record = getMobileSourceHealthV2(sourceId, mediaType);
  return record ? toLegacy(record) : null;
}

export function updateMobileSourceHealthV2(
  sourceId: string,
  mediaType: "movie" | "tv",
  patch: Partial<CinemaSourceHealthV2>,
) {
  const records = readV2();
  const index = records.findIndex((record) => record.sourceId === sourceId && record.mediaType === mediaType);
  const previous = index >= 0 ? records[index] : toV2({
    sourceId,
    mediaType,
    state: "unknown",
    startupMs: null,
    failureCount: 0,
    blockedRequests: 0,
    allowedDependencies: 0,
    lastError: null,
    cooldownUntil: 0,
    updatedAt: 0,
  });
  const attemptCount = Math.max(0, patch.attemptCount ?? previous.attemptCount);
  const successCount = Math.min(attemptCount, Math.max(0, patch.successCount ?? previous.successCount));
  const next: CinemaSourceHealthV2 = {
    ...previous,
    ...patch,
    schemaVersion: 2,
    sourceId,
    mediaType,
    attemptCount,
    successCount,
    successRatio: attemptCount ? successCount / attemptCount : 0,
    updatedAt: Date.now(),
  };
  if (index >= 0) records[index] = next;
  else records.push(next);
  persistV2(records);
  return next;
}

export function updateMobileSourceHealth(
  sourceId: string,
  mediaType: "movie" | "tv",
  patch: Partial<MobileSourceHealthRecord>,
) {
  const existing = getMobileSourceHealthV2(sourceId, mediaType);
  return toLegacy(updateMobileSourceHealthV2(sourceId, mediaType, {
    state: patch.state,
    startupMs: patch.startupMs,
    failureCount: patch.failureCount,
    blockedRequests: patch.blockedRequests,
    allowedDependencies: patch.allowedDependencies,
    cooldownUntil: patch.cooldownUntil,
    // Legacy callers can refresh evidence without every telemetry frame being
    // interpreted as another startup attempt. New playback code records one
    // explicit success or failure per source session through the helpers below.
    attemptCount: existing?.attemptCount || 0,
    successCount: existing?.successCount || 0,
    lastFailure: patch.lastError ? "unknown" : existing?.lastFailure,
  }));
}

export function markMobileSourceSuccess(
  sourceId: string,
  mediaType: "movie" | "tv",
  input: {
    startupMs: number;
    telemetrySupport: CinemaSourceHealthV2["telemetrySupport"];
    subtitleSupport?: CinemaSourceHealthV2["subtitleSupport"];
    blockedRequests?: number;
    allowedDependencies?: number;
    limited?: boolean;
  },
) {
  const existing = getMobileSourceHealthV2(sourceId, mediaType);
  const attemptCount = (existing?.attemptCount || 0) + 1;
  const successCount = (existing?.successCount || 0) + 1;
  return updateMobileSourceHealthV2(sourceId, mediaType, {
    state: input.limited ? "limited" : input.startupMs > 12_000 ? "slow" : "ready",
    startupMs: input.startupMs,
    telemetrySupport: input.telemetrySupport,
    subtitleSupport: input.subtitleSupport ?? existing?.subtitleSupport ?? "unknown",
    blockedRequests: input.blockedRequests ?? existing?.blockedRequests ?? 0,
    allowedDependencies: input.allowedDependencies ?? existing?.allowedDependencies ?? 0,
    failureCount: 0,
    lastFailure: null,
    cooldownUntil: 0,
    attemptCount,
    successCount,
  });
}

export function markMobileSourceFailure(
  sourceId: string,
  mediaType: "movie" | "tv",
  error: string,
  failure: CinemaSourceFailureCode = "unknown",
) {
  const existing = getMobileSourceHealthV2(sourceId, mediaType);
  const failureCount = (existing?.failureCount || 0) + 1;
  const cooldownMs = Math.min(30 * 60_000, 30_000 * Math.pow(2, Math.min(failureCount - 1, 5)));
  return toLegacy(updateMobileSourceHealthV2(sourceId, mediaType, {
    state: "failed",
    failureCount,
    lastFailure: failure,
    cooldownUntil: Date.now() + cooldownMs,
    attemptCount: (existing?.attemptCount || 0) + 1,
    shieldFailures: failure === "blocked-dependency" || failure === "manifest-failure"
      ? (existing?.shieldFailures || 0) + 1
      : existing?.shieldFailures || 0,
  }));
}
