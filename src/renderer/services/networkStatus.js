import { BUNDLED_TMDB_TOKEN } from "./tmdb";
import { getApiKey } from "./settingsStore";

export const NETWORK_PROBE_INTERVAL = 30_000;
export const NETWORK_PROBE_TIMEOUT = 6_000;
const NETWORK_PROBE_URL = "https://api.themoviedb.org/3/authentication";

export function networkLatencyTier(latencyMs) {
  if (!Number.isFinite(latencyMs)) return "unknown";
  if (latencyMs <= 180) return "fast";
  if (latencyMs <= 550) return "fair";
  return "slow";
}

export async function measureNetworkStatus({
  fetchImpl = globalThis.fetch,
  online = globalThis.navigator?.onLine !== false,
  now = () => globalThis.performance.now(),
  token = getApiKey() || BUNDLED_TMDB_TOKEN,
  timeoutMs = NETWORK_PROBE_TIMEOUT,
} = {}) {
  if (!online || typeof fetchImpl !== "function") {
    return { status: "offline", latencyMs: null, tier: "unknown", checkedAt: Date.now() };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = now();
  try {
    const response = await fetchImpl(NETWORK_PROBE_URL, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const latencyMs = Math.max(0, Math.round(now() - startedAt));
    response.body?.cancel?.().catch?.(() => {});
    return { status: "online", latencyMs, tier: networkLatencyTier(latencyMs), checkedAt: Date.now() };
  } catch {
    return { status: "offline", latencyMs: null, tier: "unknown", checkedAt: Date.now() };
  } finally {
    clearTimeout(timeout);
  }
}
