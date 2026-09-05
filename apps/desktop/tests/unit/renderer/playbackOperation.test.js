import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPlaybackOperation } from "../../../src/renderer/features/player/services/playbackOperation";
import { playMediaWithin } from "@orion/shared/remote-media-play";
import { beginRemoteVideoOperation, cancelRemoteVideoOperation, remoteVideoScript } from "../../../src/main/player/remoteVideoOperation";

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

function setup(execution = {}) {
  const state = { session: { id: "title", sourceId: "source", mode: "mini", remoteOwnerId: "mini-1" }, owner: "video" };
  const operation = createPlaybackOperation({ command: "play", getSession: () => state.session, getOwner: () => state.owner, execution });
  return { state, operation };
}

describe("bounded playback readiness", () => {
  it("waits for actual media readiness rather than a guest id or timing", async () => {
    const { state, operation } = setup();
    let ready = false;
    const read = vi.fn(async () => ({ currentTime: 0, duration: 100, readyState: ready ? 4 : 1 }));
    const waiting = operation.ready(read);
    await vi.advanceTimersByTimeAsync(3000);
    state.session = { ...state.session, webContentsId: 42 };
    ready = true;
    await vi.advanceTimersByTimeAsync(100);
    expect(await waiting).toBe(true);
    operation.finish();
  });

  it("ends the readiness window at five seconds and cannot revive it later", async () => {
    const { operation } = setup();
    const read = vi.fn(async () => null);
    const waiting = operation.ready(read);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await waiting).toBe(false);
    operation.finish();
    const count = read.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(read).toHaveBeenCalledTimes(count);
  });

  it("bounds hung queries without extending readiness", async () => {
    const { operation } = setup();
    const waiting = operation.ready(() => new Promise(() => {}));
    await vi.advanceTimersByTimeAsync(5000);
    expect(await waiting).toBe(false);
    operation.finish();
  });

  it.each(["source", "stop", "owner"])("cancels pending readiness on %s change", async (change) => {
    const { state, operation } = setup();
    const waiting = operation.ready(async () => null).catch((error) => error.message);
    if (change === "source") state.session = { ...state.session, sourceId: "replacement" };
    if (change === "stop") state.session = null;
    if (change === "owner") state.owner = "music";
    await vi.advanceTimersByTimeAsync(25);
    expect(await waiting).toBe("stale-control-target");
    operation.finish();
  });

  it("honors a legacy peer's shorter Desktop deadline", async () => {
    const { operation } = setup({ deadlineAt: Date.now() + 1800 });
    const waiting = operation.ready(async () => null);
    await vi.advanceTimersByTimeAsync(1700);
    expect(await waiting).toBe(false);
    operation.finish();
  });

  it("cancels promptly on transport cancellation", async () => {
    const controller = new AbortController();
    const { operation } = setup({ signal: controller.signal });
    const waiting = operation.ready(() => new Promise(() => {})).catch((error) => error.message);
    controller.abort();
    expect(await waiting).toBe("command-cancelled");
    operation.finish();
  });
});

function media() {
  return { isConnected: true, currentSrc: "fixture", readyState: 4, paused: true,
    play: vi.fn(() => new Promise(() => {})), pause: vi.fn() };
}

describe("actual media Play cancellation", () => {
  it("pauses a pending play at expiry instead of leaving a late start queued", async () => {
    const target = media();
    const result = playMediaWithin(target, { deadlineAt: Date.now() + 100 }).catch((error) => error.message);
    await vi.advanceTimersByTimeAsync(100);
    expect(await result).toBe("command-cancelled");
    expect(target.pause).toHaveBeenCalledOnce();
    expect(target._orionPendingRemotePlay).toBeUndefined();
  });

  it("never calls play on an expired request", async () => {
    const target = media();
    await expect(playMediaWithin(target, { deadlineAt: Date.now() })).rejects.toThrow();
    expect(target.play).not.toHaveBeenCalled();
  });

  it("reports success only after the element confirms playing", async () => {
    const target = media();
    target.play.mockResolvedValue(undefined);
    await expect(playMediaWithin(target)).rejects.toThrow("play-not-confirmed");
    target.play.mockImplementation(async () => { target.paused = false; });
    await expect(playMediaWithin(target)).resolves.toBeUndefined();
  });

  it("cancels a request while Desktop is still finding the video", () => {
    const operation = beginRemoteVideoOperation(1, { id: "finding", deadlineAt: Date.now() + 1000 });
    cancelRemoteVideoOperation(1, "finding");
    expect(operation.valid()).toBe(false);
    operation.finish();
  });

  it("runs the same cancellation behavior inside the guest script", async () => {
    const target = media();
    const operation = beginRemoteVideoOperation(1, { id: "guest", deadlineAt: Date.now() + 100 });
    const guest = {};
    const run = new Function("v", "globalThis", `return (async () => { ${remoteVideoScript(operation, "play", "await v.play();")} })()`);
    const result = run(target, guest).catch((error) => error.message);
    await vi.advanceTimersByTimeAsync(100);
    expect(await result).toBe("command-cancelled");
    expect(target.pause).toHaveBeenCalledOnce();
    expect(guest.__orionRemoteControls.size).toBe(0);
    operation.finish();
  });
});
