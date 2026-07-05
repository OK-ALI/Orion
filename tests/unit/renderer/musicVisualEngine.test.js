import { describe, expect, it } from "vitest";
import { analyzeFrequencyData, createVisualBus, EMPTY_VISUAL_FRAME } from "../../../src/renderer/features/music/visual/musicVisualEngine";
import { deterministicPalette } from "../../../src/renderer/features/music/visual/artworkPalette";
import { replayGainMultiplier } from "../../../src/renderer/features/music/player/AudioEngine";

describe("Music visual engine", () => {
  it("maps frequency energy into bass, mids and treble without retaining image data", () => {
    const bins = new Uint8Array(128);
    bins.fill(220, 0, 15); bins.fill(120, 15, 62); bins.fill(48, 62);
    const frame = analyzeFrequencyData(bins, EMPTY_VISUAL_FRAME, 42);
    expect(frame.bass).toBeGreaterThan(frame.mids);
    expect(frame.mids).toBeGreaterThan(frame.treble);
    expect(frame.timestamp).toBe(42);
    expect(frame).not.toHaveProperty("image");
  });

  it("publishes frames imperatively without React state", () => {
    const bus = createVisualBus();
    let received = null;
    const unsubscribe = bus.subscribe((frame) => { received = frame; });
    const next = { ...EMPTY_VISUAL_FRAME, energy: .8 };
    bus.publish(next);
    expect(received).toBe(next);
    expect(bus.getFrame()).toBe(next);
    unsubscribe();
  });

  it("creates deterministic accessible fallback palettes", () => {
    expect(deterministicPalette("same")).toEqual(deterministicPalette("same"));
    expect(deterministicPalette("same").foreground).toBe("var(--on-media)");
  });

  it("converts ReplayGain decibels into a bounded output multiplier", () => {
    expect(replayGainMultiplier(-6, true)).toBeCloseTo(0.501, 2);
    expect(replayGainMultiplier(6, true)).toBeCloseTo(1.995, 2);
    expect(replayGainMultiplier(40, true)).toBe(2);
    expect(replayGainMultiplier(-40, true)).toBe(0.25);
    expect(replayGainMultiplier(-6, false)).toBe(1);
  });
});
