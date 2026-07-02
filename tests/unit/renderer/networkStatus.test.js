import { describe, expect, it, vi } from "vitest";
import { measureNetworkStatus, networkLatencyTier } from "../../../src/renderer/services/networkStatus";

describe("network status measurement", () => {
  it("reports rounded HTTP round-trip latency", async () => {
    const now = vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(142.6);
    const cancel = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi.fn().mockResolvedValue({ status: 200, body: { cancel } });
    const result = await measureNetworkStatus({ fetchImpl, now, token: "token" });
    expect(result).toMatchObject({ status: "online", latencyMs: 43, tier: "fast" });
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining("/authentication"), expect.objectContaining({ cache: "no-store" }));
    expect(cancel).toHaveBeenCalled();
  });

  it("reports offline without probing when the browser is disconnected", async () => {
    const fetchImpl = vi.fn();
    expect(await measureNetworkStatus({ fetchImpl, online: false })).toMatchObject({ status: "offline", latencyMs: null });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("uses stable latency tiers", () => {
    expect(networkLatencyTier(180)).toBe("fast");
    expect(networkLatencyTier(181)).toBe("fair");
    expect(networkLatencyTier(551)).toBe("slow");
  });
});
