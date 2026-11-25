/** V8.5A pure module for testable, runtime-injected validation telemetry. */

/** V8.5A: No URLs, artists, track IDs, tokens, account identifiers or payloads.
 * The native side rejects output outside com.okali.waven.phase8validation.
 * Intended only for short, explicitly captured Android logcat sessions.
 */
export type P8TraceEvent =
  | 'connectivity' | 'provider' | 'probe' | 'recovery'
  | 'queue_wait' | 'remote_work' | 'new_releases'
  | 'category' | 'play' | 'handoff' | 'source';

let traceBridge: {
  traceValidation?: (event: string, detail: string, durationMs: number, count: number) => void;
} | null = null;
/** Installed only by Android app runtime; native side enforces package identity. */
export function configureP8TraceBridge(value: typeof traceBridge): void {
  traceBridge = value;
}

const transportNames = new Set(['wifi', 'cellular', 'ethernet', 'bluetooth', 'vpn', 'none', 'unknown']);
const providerNames: Record<string, string> = {
  'ytmusic-metadata': 'metadata',
  'ytmusic-dashboard': 'dashboard',
  'ytmusic-search-discovery': 'discovery',
  'ytmusic-streaming': 'stream',
  'spotify-charts-dashboard': 'charts',
};
export function traceProviderName(value: string): string {
  if (value === 'discovery:new-releases' || value === 'discovery:categories' || value.startsWith('discovery:category:')) return 'discovery';
  return providerNames[value] ?? 'other';
}
export function traceTransport(value: string): string {
  return transportNames.has(value) ? value : 'other';
}
export function traceFailureKind(value: unknown): string {
  // Never pass error.message or arbitrary provider strings to native logging.
  if (value instanceof Error && value.name === 'WavenProviderTimeoutError') return 'timeout';
  if (value instanceof Error && value.name === 'WavenProviderCancelledError') return 'cancelled';
  if (value instanceof Error && value.name === 'ConnectivityUnavailableError') return 'offline';
  return 'failure';
}
/** All data must be enum-like; native validates its own allowlist again. */
export function traceP8(event: P8TraceEvent, detail: string, durationMs = 0, count = 0): void {
  try {
    if (!traceBridge?.traceValidation) return;
    traceBridge.traceValidation(event, detail,
      Number.isFinite(durationMs) ? Math.max(0, Math.min(120_000, Math.round(durationMs))) : 0,
      Number.isFinite(count) ? Math.max(0, Math.min(999, Math.round(count))) : 0);
  } catch { /* Diagnostics must never affect playback, network, or navigation. */ }
}
