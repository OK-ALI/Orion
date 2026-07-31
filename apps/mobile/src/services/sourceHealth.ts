import { mmkvStorageAdapter } from "./storageAdapter";
import { updateCinemaSourceHealth } from "@orion/shared/sources";

export type MobileSourceState = "unknown" | "ready" | "slow" | "failed";

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

const STORAGE_KEY = "mobileCinemaSourceHealthV1";

function readAll(): MobileSourceHealthRecord[] {
  try {
    const parsed = JSON.parse(mmkvStorageAdapter.get(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function listMobileSourceHealth(): MobileSourceHealthRecord[] {
  return readAll();
}

function syncSharedRuntime(records: MobileSourceHealthRecord[]) {
  updateCinemaSourceHealth(records.map((record) => ({
    sourceId: record.sourceId,
    mediaType: record.mediaType,
    state: record.state,
    startupMs: record.startupMs ?? undefined,
    cooldownUntil: record.cooldownUntil,
    updatedAt: record.updatedAt,
  })));
}

export function hydrateMobileSourceHealth(): MobileSourceHealthRecord[] {
  const records = readAll();
  syncSharedRuntime(records);
  return records;
}

export function getMobileSourceHealth(sourceId: string, mediaType: "movie" | "tv") {
  return readAll().find((record) => record.sourceId === sourceId && record.mediaType === mediaType) || null;
}

export function updateMobileSourceHealth(
  sourceId: string,
  mediaType: "movie" | "tv",
  patch: Partial<MobileSourceHealthRecord>,
) {
  const records = readAll();
  const index = records.findIndex((record) => record.sourceId === sourceId && record.mediaType === mediaType);
  const existing = index >= 0 ? records[index] : {
    sourceId,
    mediaType,
    state: "unknown" as const,
    startupMs: null,
    failureCount: 0,
    blockedRequests: 0,
    allowedDependencies: 0,
    lastError: null,
    cooldownUntil: 0,
    updatedAt: 0,
  };
  const next = { ...existing, ...patch, sourceId, mediaType, updatedAt: Date.now() };
  if (index >= 0) records[index] = next;
  else records.push(next);
  const bounded = records.slice(-80);
  mmkvStorageAdapter.set(STORAGE_KEY, JSON.stringify(bounded));
  syncSharedRuntime(bounded);
  return next;
}

export function markMobileSourceFailure(
  sourceId: string,
  mediaType: "movie" | "tv",
  error: string,
) {
  const existing = getMobileSourceHealth(sourceId, mediaType);
  const failureCount = (existing?.failureCount || 0) + 1;
  const cooldownMs = Math.min(30 * 60_000, 30_000 * Math.pow(2, Math.min(failureCount - 1, 5)));
  return updateMobileSourceHealth(sourceId, mediaType, {
    state: "failed",
    failureCount,
    lastError: String(error || "Source failed").slice(0, 180),
    cooldownUntil: Date.now() + cooldownMs,
  });
}
