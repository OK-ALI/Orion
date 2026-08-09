import type { SmartConnectPlaybackTelemetryV1, SmartConnectLatencySnapshot } from '@orion/shared/types';

export const TELEMETRY_STALE_MS = 1500;

export function interpolateTelemetry(
  telemetry: SmartConnectPlaybackTelemetryV1 | null,
  now = Date.now(),
  scrubbing = false,
) {
  if (!telemetry) return { currentTime: 0, ageMs: Infinity, fresh: false };
  const ageMs = Math.max(0, now - telemetry.observedAt);
  const fresh = ageMs <= TELEMETRY_STALE_MS;
  const advance = fresh && !scrubbing && telemetry.state === 'playing' ? ageMs / 1000 : 0;
  const duration = telemetry.duration ?? 0;
  return {
    currentTime: Math.max(0, duration ? Math.min(duration, (telemetry.currentTime ?? 0) + advance) : (telemetry.currentTime ?? 0)),
    ageMs,
    fresh,
  };
}

export function percentile(values: number[], ratio: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))];
}

export function latencySnapshot(samples: number[], telemetryAgeMs: number | null, reconnectDurationMs: number | null): SmartConnectLatencySnapshot {
  return {
    latestRttMs: samples.at(-1) ?? null,
    medianRttMs: percentile(samples, 0.5),
    p95RttMs: percentile(samples, 0.95),
    telemetryAgeMs,
    reconnectDurationMs,
  };
}
