import { describe, expect, it, vi } from "vitest";
import { measureNetworkStatus, medianLatency, networkLatencyTier } from "../../../src/renderer/services/networkStatus";

describe("network status measurement", () => {
  it("reports rounded HTTP round-trip latency", async () => {
    const now = vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(142.6);
    const cancel = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi.fn().mockResolvedValue({ status: 200, body: { cancel } });
    const result = await measureNetworkStatus({ fetchImpl, now });
    expect(result).toMatchObject({ status: "online", latencyMs: 43, tier: "fast" });
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining("generate_204"), expect.objectContaining({ cache: "no-store", mode: "no-cors" }));
    expect(cancel).toHaveBeenCalled();
  });

  it("reports offline without probing when the browser is disconnected", async () => {
    const fetchImpl = vi.fn();
    expect(await measureNetworkStatus({ fetchImpl, online: false })).toMatchObject({ status: "offline", latencyMs: null });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("distinguishes a reachable but degraded connectivity probe", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ status: 503, ok: false, body: { cancel: vi.fn() } });
    expect(await measureNetworkStatus({ fetchImpl, now: vi.fn().mockReturnValueOnce(10).mockReturnValueOnce(40) })).toMatchObject({ status: "degraded", serviceStatus: 503 });
  });

  it("uses stable latency tiers", () => {
    expect(networkLatencyTier(180)).toBe("fast");
    expect(networkLatencyTier(181)).toBe("fair");
    expect(networkLatencyTier(551)).toBe("slow");
  });

  it("uses a bounded median for the service indicator", () => {
    expect(medianLatency([80, 300, 120, 110, 600, 90])).toBe(120);
    expect(medianLatency([120, Number.NaN, 220])).toBe(170);
    expect(medianLatency([])).toBeNull();
  });
});
