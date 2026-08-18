import { describe, expect, it } from "vitest";
import {
  PLAYBACK_INTENT,
  createStartPlaybackIntent,
} from "../../../src/renderer/features/player/services/playbackIntent";

describe("start playback intent resolution", () => {
  it("uses fresh semantics for an ordinary zero-time launch", () => {
    expect(createStartPlaybackIntent({ time: 0 })).toEqual({
      type: PLAYBACK_INTENT.FRESH,
      position: 0,
    });
  });

  it("uses resume semantics for a positive saved position", () => {
    expect(createStartPlaybackIntent({ time: 6236 })).toEqual({
      type: PLAYBACK_INTENT.RESUME,
      position: 6236,
    });
  });

  it("preserves an explicit Start Over decision", () => {
    expect(
      createStartPlaybackIntent({
        time: 0,
        intentType: PLAYBACK_INTENT.START_FROM_ZERO,
      }),
    ).toEqual({
      type: PLAYBACK_INTENT.START_FROM_ZERO,
      position: 0,
    });
  });

  it("lets a pending Not Started reset outrank resume or handoff time", () => {
    expect(
      createStartPlaybackIntent({
        time: 6236,
        intentType: PLAYBACK_INTENT.RESUME,
        forceReset: true,
      }),
    ).toEqual({
      type: PLAYBACK_INTENT.START_FROM_ZERO,
      position: 0,
    });
  });
});
