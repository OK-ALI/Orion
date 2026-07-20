import { describe, expect, it } from "vitest";
import {
  isAdvancingPlayback,
  normalizePlayerEventProgress,
} from "../../../src/renderer/features/player/services/playerEventProgress";

describe("Cinema PLAYER_EVENT progress", () => {
  it("normalizes a recent, finite provider event", () => {
    expect(normalizePlayerEventProgress({
      currentTime: 12.5,
      duration: 100,
      paused: false,
      capturedAt: 5_000,
    }, 5_500)).toMatchObject({ currentTime: 12.5, duration: 100, paused: false });
  });

  it("rejects stale or unusable messages", () => {
    expect(normalizePlayerEventProgress({ currentTime: 1, capturedAt: 1 }, 20_000)).toBeNull();
    expect(normalizePlayerEventProgress({ event: "play" })).toBeNull();
  });

  it("only treats audible time advancement as playback evidence", () => {
    expect(isAdvancingPlayback(10, { currentTime: 10.5, paused: false, buffering: false })).toBe(true);
    expect(isAdvancingPlayback(10, { currentTime: 11, paused: true, buffering: false })).toBe(false);
    expect(isAdvancingPlayback(10, { currentTime: 11, paused: false, buffering: true })).toBe(false);
  });
});
