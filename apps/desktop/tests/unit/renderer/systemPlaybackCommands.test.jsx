import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSystemPlaybackCommands } from "../../../src/renderer/app/hooks/useSystemPlaybackCommands";
import { claimPlayback } from "../../../src/renderer/app/playback/PlaybackCoordinator";

function setup(session) {
  claimPlayback("video");
  window.electron = { controlVideo: vi.fn(async () => ({ ok: true })), queryVideoProgress: vi.fn(async () => ({ currentTime: 20 })) };
  const playbackSessionRef = { current: session };
  const setPlaybackSession = vi.fn((value) => { playbackSessionRef.current = value; });
  const setMiniPlayer = vi.fn();
  const { result } = renderHook(() => useSystemPlaybackCommands({ playbackSessionRef, setPlaybackSession, setMiniPlayer }));
  return { send: (...args) => result.current(...args), playbackSessionRef, setPlaybackSession, setMiniPlayer };
}

afterEach(() => { claimPlayback(null); });

describe("system and remote commands on the current mini-player", () => {
  it("routes pause through the mini adapter instead of the inherited guest target", async () => {
    const controlPlayback = vi.fn(async () => ({ ok: true, state: { paused: true } }));
    const { send } = setup({ id: "title", sourceId: "source", mode: "mini", remoteOwnerId: "mini-1", webContentsId: 20, controlPlayback });
    const result = await send("pause", { sessionId: "title", sourceId: "source" });
    expect(result.commandResult).toMatchObject({ applied: true, appliedState: "paused" });
    expect(controlPlayback).toHaveBeenCalledWith("pause", expect.objectContaining({ id: expect.any(String), signal: expect.any(AbortSignal) }));
    expect(window.electron.controlVideo).not.toHaveBeenCalled();
  });

  it("clears the active local mini-player on confirmed stop", async () => {
    const controlPlayback = vi.fn(async () => ({ ok: true }));
    const { send, setPlaybackSession, setMiniPlayer } = setup({ id: "local", local: true, mode: "mini", remoteOwnerId: "mini-1", controlPlayback });
    expect((await send("stop")).ok).toBe(true);
    expect(controlPlayback).toHaveBeenCalledWith("pause", expect.objectContaining({ id: expect.any(String), signal: expect.any(AbortSignal) }));
    expect(setPlaybackSession).toHaveBeenCalledWith(null);
    expect(setMiniPlayer).toHaveBeenCalledWith(null);
  });

  it("does not clear or claim success when the player rejects stop", async () => {
    const { send, setPlaybackSession } = setup({ id: "local", local: true, mode: "mini", controlPlayback: vi.fn(async () => ({ ok: false, error: "unavailable" })) });
    expect((await send("stop")).commandResult.applied).toBe(false);
    expect(setPlaybackSession).not.toHaveBeenCalled();
  });

  it("cannot restart an old player after its async state query returns", async () => {
    let finish;
    const controlPlayback = vi.fn();
    const { send, playbackSessionRef } = setup({ id: "title", mode: "mini", remoteOwnerId: "mini-1",
      readPlaybackState: () => new Promise((resolve) => { finish = resolve; }), controlPlayback });
    const result = send("previous");
    await act(async () => { await Promise.resolve(); });
    playbackSessionRef.current = { id: "title", mode: "mini", remoteOwnerId: "mini-2" };
    finish({ currentTime: 40 });
    expect((await result).commandResult).toMatchObject({ applied: false, failureCode: "stale-control-target" });
    expect(controlPlayback).not.toHaveBeenCalled();
  });

  it("rejects an explicit stale source before contacting the player", async () => {
    const controlPlayback = vi.fn();
    const { send } = setup({ id: "title", sourceId: "new", mode: "mini", controlPlayback });
    expect((await send("play", { sessionId: "title", sourceId: "old" })).commandResult.applied).toBe(false);
    expect(controlPlayback).not.toHaveBeenCalled();
  });
});
