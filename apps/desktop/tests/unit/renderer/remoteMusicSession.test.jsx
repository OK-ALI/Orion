import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getRemoteMusicSession, updateRemoteMusicController } from "../../../src/renderer/features/music/services/remoteMusicSession";
import { useSystemPlaybackCommands } from "../../../src/renderer/app/hooks/useSystemPlaybackCommands";
import { claimPlayback } from "../../../src/renderer/app/playback/PlaybackCoordinator";

function setup(overrides = {}) {
  const queue = [{ id: "a", provider: "local", title: "A" }, { id: "b", provider: "local", title: "B" }];
  const state = { paused: true, readyState: 4, controlReady: true, currentTime: 10, duration: 100, volume: 0.5, muted: false };
  const engine = { readRemoteState: vi.fn(() => state), controlRemote: vi.fn(async () => ({ ok: true, state })) };
  const music = { current: queue[0], queue, index: 0, stream: { url: "file:///track-a" }, playbackStatus: "paused",
    engineRef: { current: engine }, setPlaying: vi.fn(), setVolume: vi.fn(), setMuted: vi.fn(), stop: vi.fn(() => true),
    remoteQueueTarget: vi.fn(() => 1), playNext: vi.fn(), playPrevious: vi.fn(), ...overrides };
  updateRemoteMusicController(music);
  claimPlayback("music");
  const { result } = renderHook(() => useSystemPlaybackCommands({ playbackSessionRef: { current: null }, setPlaybackSession: vi.fn(), setMiniPlayer: vi.fn() }));
  return { music, state, engine, send: (command, expected = {}) => result.current(command, expected, { signal: new AbortController().signal }) };
}
afterEach(() => { updateRemoteMusicController(null); claimPlayback(null); });

describe("Connect uses the live Music provider", () => {
  it("routes pause to the audio engine and synchronizes provider state", async () => {
    const { send, music, engine } = setup();
    expect((await send("pause")).commandResult.applied).toBe(true);
    expect(engine.controlRemote).toHaveBeenCalledWith("pause", expect.objectContaining({ signal: expect.any(AbortSignal) }), "file:///track-a");
    expect(music.setPlaying).toHaveBeenCalledWith(false);
  });
  it("does not change provider state when the engine rejects a command", async () => {
    const { send, music, engine } = setup();
    engine.controlRemote.mockResolvedValue({ ok: false });
    expect((await send("pause")).ok).toBe(false);
    expect(music.setPlaying).not.toHaveBeenCalled();
  });
  it("rejects stale source revisions before touching the engine", async () => {
    const { send, music, engine } = setup();
    const revision = getRemoteMusicSession().remoteRevision;
    updateRemoteMusicController({ ...music, stream: { url: "file:///replacement" } });
    expect((await send("pause", { ownerRevision: revision })).ok).toBe(false);
    expect(engine.controlRemote).not.toHaveBeenCalled();
  });
  it("stops while the stream is still resolving and clears the remote owner", async () => {
    const { send, music, engine } = setup({ stream: null, playbackStatus: "loading" });
    expect((await send("stop")).commandResult).toMatchObject({ applied: true, readiness: "unavailable" });
    expect(music.stop).toHaveBeenCalledOnce();
    expect(engine.controlRemote).not.toHaveBeenCalled();
    expect(getRemoteMusicSession()).toBeNull();
  });
  it("uses the existing queue and reports a new unresolved track as loading", async () => {
    const { send, music } = setup();
    music.playNext.mockImplementation(() => updateRemoteMusicController({ ...music, index: 1, current: music.queue[1], stream: null,
      engineRef: { current: { readRemoteState: () => null } } }));
    expect((await send("next")).commandResult).toMatchObject({ applied: true, sessionId: "music:local:b", readiness: "loading" });
    expect(music.playNext).toHaveBeenCalledOnce();
  });
  it("does not dispatch next when the queue has no declared target", async () => {
    const { send, music } = setup({ remoteQueueTarget: () => null });
    expect((await send("next")).ok).toBe(false);
    expect(music.playNext).not.toHaveBeenCalled();
  });
  it("invalidates old adapters when a track is replaced", async () => {
    const { music, engine } = setup();
    const old = getRemoteMusicSession();
    updateRemoteMusicController({ ...music, current: music.queue[1] });
    expect(old.readPlaybackState()).toBeNull();
    expect((await old.controlPlayback("pause", {})).ok).toBe(false);
    expect(engine.controlRemote).not.toHaveBeenCalled();
  });
});
