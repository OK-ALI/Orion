import { describe, expect, it, vi } from "vitest";
import { buildPlaybackHandoff } from "../../../src/renderer/features/player/services/playbackSession";

describe("playback handoffs", () => {
  it("preserves identity while clamping transferable playback state", () => {
    vi.spyOn(Date, "now").mockReturnValue(42);
    const handoff = buildPlaybackHandoff({ id: "one", mediaIdentity: { mediaType: "movie", mediaId: 7 }, volume: 1 }, { currentTime: 125, duration: 500, volume: 2, muted: true, paused: false }, "mini");
    expect(handoff.mediaIdentity.mediaId).toBe(7);
    expect(handoff.mode).toBe("mini");
    expect(handoff.playbackState).toEqual({ currentTime: 125, duration: 500, volume: 1, muted: true, paused: false });
    expect(handoff.updatedAt).toBe(42);
    vi.restoreAllMocks();
  });
});
