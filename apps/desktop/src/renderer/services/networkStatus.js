export const NETWORK_PROBE_INTERVAL = 15_000;
export const NETWORK_PROBE_TIMEOUT = 6_000;
const NETWORK_PROBE_URL = "https://www.gstatic.com/generate_204";

export function networkLatencyTier(latencyMs) {
  if (!Number.isFinite(latencyMs)) return "unknown";
  if (latencyMs <= 180) return "fast";
  if (latencyMs <= 550) return "fair";
  return "slow";
}

export function medianLatency(samples = []) {
  const values = samples.filter(Number.isFinite).slice(-5).sort((left, right) => left - right);
  if (!values.length) return null;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : Math.round((values[middle - 1] + values[middle]) / 2);
}

export async function measureNetworkStatus({
  fetchImpl = globalThis.fetch,
  online = globalThis.navigator?.onLine !== false,
  now = () => globalThis.performance.now(),
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
      mode: "no-cors",
      signal: controller.signal,
    });
    const latencyMs = Math.max(0, Math.round(now() - startedAt));
    Promise.resolve(response.body?.cancel?.()).catch(() => {});
    const healthy = response.type === "opaque" || response.ok === true || response.status === 204 || (response.ok == null && response.status >= 200 && response.status < 400);
    const status = healthy ? "online" : "degraded";
    return { status, latencyMs, tier: networkLatencyTier(latencyMs), checkedAt: Date.now(), serviceStatus: response.status };
  } catch {
    return { status: "offline", latencyMs: null, tier: "unknown", checkedAt: Date.now() };
  } finally {
    clearTimeout(timeout);
  }
}
