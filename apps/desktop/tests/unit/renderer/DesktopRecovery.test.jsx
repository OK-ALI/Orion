import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("../../../src/renderer/services/networkStatus", async (original) => ({
  ...await original(), measureNetworkStatus: vi.fn(),
}));
import { measureNetworkStatus, NETWORK_PROBE_TIMEOUT } from "../../../src/renderer/services/networkStatus";
import useNetworkStatus from "../../../src/renderer/shared/hooks/useNetworkStatus";
import useDesktopNetworkRecovery from "../../../src/renderer/app/hooks/useDesktopNetworkRecovery";

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const online = { status: "online", latencyMs: 25, tier: "fast", checkedAt: 1 };
const connected = (value) => Object.defineProperty(navigator, "onLine", { configurable: true, value });
const flush = () => act(async () => {});
beforeEach(() => { vi.useFakeTimers(); connected(true); measureNetworkStatus.mockReset().mockResolvedValue(online); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it("offline -> reconnecting -> online emits one epoch, coalescing all recheck triggers", async () => {
  connected(false);
  const service = deferred();
  const serviceProbe = vi.fn(() => service.promise);
  const onRecovery = vi.fn();
  const restored = vi.fn();
  window.addEventListener("orion:network-restored", restored);
  const { result, unmount } = renderHook(() => {
    const network = useNetworkStatus({ serviceProbe });
    useDesktopNetworkRecovery(network, onRecovery);
    return network;
  });
  await flush();
  expect(result.current.productState).toBe("offline");
  connected(true);
  await act(async () => {
    window.dispatchEvent(new Event("online"));
    result.current.recheck();
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(result.current.productState).toBe("reconnecting");
  expect(serviceProbe).toHaveBeenCalledTimes(1);
  expect(measureNetworkStatus).toHaveBeenCalledTimes(1);
  await act(async () => service.resolve());
  expect(result.current.productState).toBe("online");
  expect(result.current.recoveryEpoch).toBe(1);
  expect(onRecovery).toHaveBeenCalledTimes(1);
  expect(restored).toHaveBeenCalledTimes(1);
  await act(async () => result.current.recheck());
  expect(result.current.recoveryEpoch).toBe(1);
  expect(onRecovery).toHaveBeenCalledTimes(1);
  unmount();
  window.removeEventListener("orion:network-restored", restored);
});

it("remembers degraded across checking, then emits exactly one recovery epoch", async () => {
  const serviceProbe = vi.fn().mockRejectedValueOnce(new Error("service")).mockResolvedValue(undefined);
  const { result } = renderHook(() => useNetworkStatus({ serviceProbe }));
  await flush();
  expect(result.current.productState).toBe("degraded");
  const pending = deferred();
  serviceProbe.mockImplementationOnce(() => pending.promise);
  await act(async () => { result.current.recheck(); });
  expect(result.current.productState).toBe("checking");
  await act(async () => pending.resolve());
  expect(result.current.productState).toBe("online");
  expect(result.current.recoveryEpoch).toBe(1);
  await act(async () => result.current.recheck());
  expect(result.current.recoveryEpoch).toBe(1);
});

it("bounds hung service validation even when it ignores abort", async () => {
  let signal;
  const serviceProbe = vi.fn((options) => { signal = options?.signal; return new Promise(() => {}); });
  const { result } = renderHook(() => useNetworkStatus({ serviceProbe }));
  await flush();
  await act(async () => { await vi.advanceTimersByTimeAsync(NETWORK_PROBE_TIMEOUT + 1); });
  expect(result.current.productState).toBe("degraded");
  expect(signal.aborted).toBe(true);
});

it.each(["transport", "service"])("fences a stale %s completion after a newer offline event", async (stage) => {
  const stale = deferred();
  if (stage === "transport") measureNetworkStatus.mockReturnValueOnce(stale.promise);
  const serviceProbe = vi.fn(stage === "service" ? () => stale.promise : () => Promise.resolve());
  const { result } = renderHook(() => useNetworkStatus({ serviceProbe }));
  await flush();
  connected(false);
  act(() => window.dispatchEvent(new Event("offline")));
  await act(async () => stale.resolve(online));
  expect(result.current.productState).toBe("offline");
  expect(result.current.recoveryEpoch).toBe(0);
  connected(true);
  serviceProbe.mockResolvedValue(undefined);
  await act(async () => result.current.recheck());
  expect(result.current.productState).toBe("online");
  expect(result.current.recoveryEpoch).toBe(1);
});

it("cancels an obsolete service owner when the token/probe changes", async () => {
  const stale = deferred();
  const oldProbe = vi.fn(() => stale.promise);
  const newProbe = vi.fn().mockRejectedValue(new Error("new token unavailable"));
  const { result, rerender } = renderHook(({ serviceProbe }) => useNetworkStatus({ serviceProbe }), { initialProps: { serviceProbe: oldProbe } });
  await flush();
  rerender({ serviceProbe: newProbe });
  await flush();
  expect(result.current.productState).toBe("degraded");
  await act(async () => stale.resolve());
  expect(result.current.productState).toBe("degraded");
  expect(result.current.recoveryEpoch).toBe(0);
});

it("keeps a validated online capability during routine background validation", async () => {
  const serviceProbe = vi.fn().mockResolvedValue(undefined);
  const { result } = renderHook(() => useNetworkStatus({ serviceProbe }));
  await flush();
  const pending = deferred();
  serviceProbe.mockReturnValueOnce(pending.promise);
  await act(async () => { result.current.recheck(); });
  expect(result.current.productState).toBe("online");
  await act(async () => pending.resolve());
  expect(result.current.recoveryEpoch).toBe(0);
});

it("requires fresh validation when the service owner/token changes while online", async () => {
  const first = vi.fn().mockResolvedValue(undefined);
  const pending = deferred();
  const next = vi.fn(() => pending.promise);
  const view = renderHook(({ serviceProbe }) => useNetworkStatus({ serviceProbe }), { initialProps: { serviceProbe: first } });
  await flush();
  expect(view.result.current.productState).toBe("online");
  view.rerender({ serviceProbe: next });
  await flush();
  expect(view.result.current.productState).toBe("checking");
  await act(async () => pending.resolve());
  expect(view.result.current.productState).toBe("online");
  expect(view.result.current.recoveryEpoch).toBe(0);
});
