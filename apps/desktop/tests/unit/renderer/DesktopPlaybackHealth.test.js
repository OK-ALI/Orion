import { describe, expect, it } from "vitest";
import { samplePlaybackHealth } from "../../../src/renderer/shared/utils/playbackHealth";

describe("Desktop playback health sampling", () => {
  it("reports frame-drop deltas instead of cumulative historical drops", () => {
    const first = samplePlaybackHealth({ paused: false, readyState: 4, bufferedAhead: 8, droppedFrames: 20 }, 18, 12);
    expect(first.report).toMatchObject({
      bufferingEvents: 0,
      droppedFrames: 2,
      bufferedAhead: 8,
      readyState: 4,
      playbackActive: true,
      eventLoopLagMs: 12,
    });
    expect(first.nextDroppedFrames).toBe(20);

    const steady = samplePlaybackHealth({ paused: false, readyState: 4, bufferedAhead: 9, droppedFrames: 20 }, first.nextDroppedFrames, 5);
    expect(steady.report.droppedFrames).toBe(0);
  });

  it("marks only active under-buffered playback as buffering pressure", () => {
    expect(samplePlaybackHealth({ paused: false, readyState: 2, bufferedAhead: 0.2, droppedFrames: 0 }, 0, 0).report.bufferingEvents).toBe(1);
    expect(samplePlaybackHealth({ paused: true, readyState: 2, bufferedAhead: 0.2, droppedFrames: 0 }, 0, 0).report.bufferingEvents).toBe(0);
  });
});
