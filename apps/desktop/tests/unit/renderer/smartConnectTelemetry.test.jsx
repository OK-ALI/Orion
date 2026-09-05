import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSmartConnectTelemetry } from "../../../src/renderer/app/hooks/useSmartConnectTelemetry";
import { claimPlayback } from "../../../src/renderer/app/playback/PlaybackCoordinator";

describe("Smart Connect live owner telemetry", () => {
  let status;
  beforeEach(() => {
    vi.useFakeTimers();
    claimPlayback("video");
    window.electron = {
      getSmartConnectInfo: vi.fn(async () => ({ connected: true })),
      onSmartConnectStatus: vi.fn((callback) => { status = callback; return () => {}; }),
      updateSmartConnectTelemetry: vi.fn(async () => ({ ok: true })),
      queryVideoProgress: vi.fn(async () => ({ currentTime: 12, duration: 120, readyState: 4, paused: false })),
    };
  });
  afterEach(() => { vi.useRealTimers(); claimPlayback(null); });
  const flush = async (ms = 0) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
  const last = () => window.electron.updateSmartConnectTelemetry.mock.calls.at(-1)?.[0];

  it("keeps the live mini-player owner while navigating away, including to a Music page", async () => {
    const session = { id: "movie:1", title: "Current title", mode: "mini", remoteOwnerId: "mini-1", webContentsId: 20 };
    const { rerender } = renderHook((props) => useSmartConnectTelemetry(props), { initialProps: { page: "home", playbackSession: session } });
    await flush(500);
    expect(last().context).toMatchObject({ route: "home", surface: "mini-player", playbackOwner: "cinema" });
    expect(last().context.capabilities.canPlay).toBe(true);
    rerender({ page: "music-home", playbackSession: session });
    await flush();
    expect(last().context).toMatchObject({ route: "music-home", surface: "mini-player", playbackOwner: "cinema" });
    expect(window.electron.queryVideoProgress).toHaveBeenCalledWith(20);
  });

  it("reads local media directly and does not treat saved handoff timing as live", async () => {
    const readPlaybackState = vi.fn(() => ({ currentTime: 15, duration: 150, readyState: 4, controlReady: true, paused: true }));
    const session = { id: "local:1", mode: "mini", remoteOwnerId: "mini-local", local: true, readPlaybackState, controlPlayback: vi.fn() };
    const { rerender } = renderHook((props) => useSmartConnectTelemetry(props), { initialProps: { page: "home", playbackSession: session } });
    await flush(500);
    expect(last().telemetry).toMatchObject({ currentTime: 15, state: "paused", playbackKind: "local-video" });
    expect(last().context.capabilities.canPlay).toBe(true);
    rerender({ page: "home", playbackSession: { id: "local:2", mode: "mini", playbackState: { currentTime: 90, duration: 150 } } });
    await flush(500);
    expect(last().telemetry).toMatchObject({ currentTime: null, duration: null, state: "unobservable" });
    expect(last().context.capabilities.canPlay).toBe(false);
  });

  it.each(["replace", "stop"])("discards an old async query after %s", async (change) => {
    let resolve;
    window.electron.queryVideoProgress.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const { rerender } = renderHook((props) => useSmartConnectTelemetry(props), { initialProps: { page: "movie", playbackSession: { id: "old", webContentsId: 10 } } });
    await flush();
    rerender({ page: "home", playbackSession: change === "stop" ? null : { id: "new", webContentsId: 20, mode: "mini" } });
    await act(async () => resolve({ currentTime: 42, duration: 100, readyState: 4 }));
    expect(window.electron.updateSmartConnectTelemetry.mock.calls.some(([payload]) => payload.telemetry?.sessionId === "old")).toBe(false);
    await flush(500);
    if (change === "stop") expect(last()).toMatchObject({ telemetry: null, context: { playbackOwner: "none" } });
    else expect(last().telemetry.sessionId).toBe("new");
  });

  it("recovers from a hung query and stops querying after disconnect", async () => {
    window.electron.queryVideoProgress.mockImplementationOnce(() => new Promise(() => {}));
    renderHook(() => useSmartConnectTelemetry({ page: "home", playbackSession: { id: "active", webContentsId: 20 } }));
    await flush(850);
    expect(last().telemetry.currentTime).toBe(12);
    act(() => status({ connected: false }));
    const count = window.electron.queryVideoProgress.mock.calls.length;
    await flush(2000);
    expect(window.electron.queryVideoProgress).toHaveBeenCalledTimes(count);
  });
});
