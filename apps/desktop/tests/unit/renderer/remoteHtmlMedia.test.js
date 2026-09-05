import { describe, expect, it, vi } from "vitest";
import { controlHtmlMedia, readHtmlMedia } from "../../../src/renderer/features/player/services/remoteHtmlMedia";

function mediaTarget(overrides = {}) {
  const media = {
    isConnected: true, currentSrc: "orion-media://fixture", readyState: 4,
    currentTime: 20, duration: 100, volume: 0.5, muted: false, paused: true,
    playbackRate: 1, buffered: { length: 0 },
    ...overrides,
  };
  media.play ??= vi.fn(async () => { media.paused = false; });
  media.pause ??= vi.fn(() => { media.paused = true; });
  return media;
}

describe("local remote media adapter", () => {
  it("does not turn missing metadata into measured zero timing", () => {
    expect(readHtmlMedia(null)).toBeNull();
    expect(readHtmlMedia(mediaTarget({ isConnected: false }))).toBeNull();
    expect(readHtmlMedia(mediaTarget({ readyState: 0, currentTime: 0, duration: NaN })))
      .toMatchObject({ currentTime: null, duration: null, controlReady: false });
    expect(readHtmlMedia(mediaTarget({ duration: Infinity }))).toMatchObject({ duration: null, controlReady: true });
  });

  it("requires actual media readiness and never queues an early play", async () => {
    const media = mediaTarget({ readyState: 1 });
    expect((await controlHtmlMedia(media, "play")).ok).toBe(false);
    media.readyState = 4;
    expect(media.play).not.toHaveBeenCalled();
    expect((await controlHtmlMedia(media, "play")).ok).toBe(true);
    expect(media.play).toHaveBeenCalledOnce();
  });

  it("waits for play confirmation and reports rejection without private error details", async () => {
    let complete;
    const media = mediaTarget({ play: vi.fn(() => new Promise((resolve) => { complete = resolve; })) });
    let settled = false;
    const result = controlHtmlMedia(media, "play").then((value) => { settled = true; return value; });
    await Promise.resolve();
    expect(settled).toBe(false);
    media.paused = false;
    complete();
    expect((await result).ok).toBe(true);
    media.play.mockRejectedValue(new Error("private provider URL"));
    expect(await controlHtmlMedia(media, "play")).toEqual({ ok: false, error: "The media did not accept the requested command." });
  });

  it("does not claim success if play resolves without playing", async () => {
    expect((await controlHtmlMedia(mediaTarget({ play: vi.fn(async () => {}) }), "play")).ok).toBe(false);
  });

  it.each(["detach", "source"])("rejects a stale result after %s during play", async (change) => {
    let complete;
    const media = mediaTarget({ play: vi.fn(() => new Promise((resolve) => { complete = resolve; })) });
    const result = controlHtmlMedia(media, "play");
    if (change === "detach") media.isConnected = false;
    else media.currentSrc = "orion-media://replacement";
    media.paused = false;
    complete();
    expect((await result).ok).toBe(false);
  });

  it("pauses and toggles the supplied element", async () => {
    const media = mediaTarget();
    expect((await controlHtmlMedia(media, "toggle")).state.paused).toBe(false);
    expect((await controlHtmlMedia(media, "playPause")).state.paused).toBe(true);
    expect((await controlHtmlMedia(media, "pause")).ok).toBe(true);
  });

  it("bounds seeks to known duration and rejects unknown or invalid timing", async () => {
    const media = mediaTarget();
    expect((await controlHtmlMedia(media, "seek:1000")).state.currentTime).toBe(100);
    expect((await controlHtmlMedia(media, "restart")).state.currentTime).toBe(0);
    for (const action of ["seek:NaN", "seek:", "seek:Infinity"]) {
      expect((await controlHtmlMedia(media, action)).ok).toBe(false);
    }
    media.duration = Infinity;
    expect((await controlHtmlMedia(media, "seekForward")).ok).toBe(false);
    expect(media.currentTime).toBe(0);
  });

  it("bounds volume and speed and rejects unsupported controls", async () => {
    const media = mediaTarget({ volume: 0.99, muted: true });
    expect((await controlHtmlMedia(media, "volumeUp")).state).toMatchObject({ volume: 1, muted: false });
    expect((await controlHtmlMedia(media, "toggleMute")).state.muted).toBe(true);
    expect((await controlHtmlMedia(media, "speed:1.5")).state.playbackRate).toBe(1.5);
    expect((await controlHtmlMedia(media, "speed:Infinity")).ok).toBe(false);
    expect((await controlHtmlMedia(media, "speed:0")).ok).toBe(false);
    expect((await controlHtmlMedia(media, "provider-click")).ok).toBe(false);
  });
});
