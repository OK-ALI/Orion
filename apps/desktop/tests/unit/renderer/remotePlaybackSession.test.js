import { describe, expect, it, vi } from "vitest";
import { acceptMiniPlaybackOwner, createMiniPlaybackSession, playbackTargetKey, readRemotePlaybackState, controlRemotePlayback } from "../../../src/renderer/features/player/services/remotePlaybackSession";

describe("remote mini-player ownership", () => {
  const embedded = { id: "movie:1:source", sourceId: "source", mode: "embedded", webContentsId: 10,
    playbackState: { currentTime: 42, duration: 200 }, nextAction: () => {}, previousAction: () => {} };

  it("keeps handoff timing but drops the destroyed execution target and page callbacks", async () => {
    const mini = createMiniPlaybackSession(embedded, "mini-1");
    expect(mini).toMatchObject({ remoteOwnerId: "mini-1", mode: "mini", webContentsId: null, handoffPending: true, playbackState: { currentTime: 42 } });
    expect(mini.nextAction).toBeUndefined();
    expect(mini.previousAction).toBeUndefined();
    const electron = { queryVideoProgress: vi.fn(), controlVideo: vi.fn() };
    expect(await readRemotePlaybackState(mini, electron)).toBeNull();
    expect((await controlRemotePlayback(mini, "play", electron)).ok).toBe(false);
    expect(electron.queryVideoProgress).not.toHaveBeenCalled();
    expect(electron.controlVideo).not.toHaveBeenCalled();
  });

  it("binds reads and controls to the accepted replacement", async () => {
    const mini = acceptMiniPlaybackOwner(createMiniPlaybackSession(embedded, "mini-1"),
      { remoteOwnerId: "mini-1", webContentsId: 20, attached: true });
    const electron = { queryVideoProgress: vi.fn(async () => ({ currentTime: 43 })), controlVideo: vi.fn(async () => ({ ok: true })) };
    expect(mini.handoffPending).toBe(false);
    expect(await readRemotePlaybackState(mini, electron)).toEqual({ currentTime: 43 });
    expect((await controlRemotePlayback(mini, "pause", electron)).ok).toBe(true);
    expect(electron.queryVideoProgress).toHaveBeenCalledWith(20);
    expect(electron.controlVideo).toHaveBeenCalledWith(20, "pause");
    expect(playbackTargetKey(mini)).not.toBe(playbackTargetKey(embedded));
  });

  it("rejects late attachments and teardown from an older handoff of the same title", () => {
    const current = createMiniPlaybackSession(embedded, "mini-2");
    expect(acceptMiniPlaybackOwner(current, { remoteOwnerId: "mini-1", webContentsId: 20, attached: true })).toBe(current);
    expect(acceptMiniPlaybackOwner(current, { remoteOwnerId: "mini-1", webContentsId: null })).toBe(current);
    expect(acceptMiniPlaybackOwner(null, { remoteOwnerId: "mini-1", attached: true })).toBeNull();
    expect(acceptMiniPlaybackOwner(embedded, { remoteOwnerId: "mini-1", attached: true })).toBe(embedded);
  });

  it("uses the local media adapter and clears it when its owner detaches", async () => {
    const readPlaybackState = vi.fn(() => ({ currentTime: 12 }));
    const controlPlayback = vi.fn(async () => ({ ok: true }));
    const mini = acceptMiniPlaybackOwner(createMiniPlaybackSession(embedded, "local-1"),
      { remoteOwnerId: "local-1", local: true, attached: true, readPlaybackState, controlPlayback });
    expect(await readRemotePlaybackState(mini, {})).toEqual({ currentTime: 12 });
    expect((await controlRemotePlayback(mini, "pause", {})).ok).toBe(true);
    expect(controlPlayback).toHaveBeenCalledWith("pause");
    const detached = acceptMiniPlaybackOwner(mini, { remoteOwnerId: "local-1", local: true });
    expect(detached.handoffPending).toBe(true);
    expect(await readRemotePlaybackState(detached, {})).toBeNull();
    expect((await controlRemotePlayback(detached, "play", {})).ok).toBe(false);
  });

  it("turns adapter failures into unavailable results", async () => {
    const session = { readPlaybackState: () => { throw new Error("gone"); }, controlPlayback: () => Promise.reject(new Error("gone")) };
    expect(await readRemotePlaybackState(session, {})).toBeNull();
    expect((await controlRemotePlayback(session, "pause", {})).ok).toBe(false);
  });
});
