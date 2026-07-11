import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeFrequencyData, createMusicAnalyser, createVisualBus, EMPTY_VISUAL_FRAME } from "../../../src/renderer/features/music/visual/musicVisualEngine";
import { deterministicPalette, neutralizeMusicHighlight } from "../../../src/renderer/features/music/visual/artworkPalette";
import { replayGainMultiplier } from "../../../src/renderer/features/music/player/AudioEngine";

describe("Music visual engine", () => {
  const originalAudioContext = window.AudioContext;
  const originalRaf = window.requestAnimationFrame;
  const originalCancel = window.cancelAnimationFrame;

  afterEach(() => {
    window.AudioContext = originalAudioContext;
    window.requestAnimationFrame = originalRaf;
    window.cancelAnimationFrame = originalCancel;
    vi.restoreAllMocks();
  });

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

  it("maps physical frequency bands when audio graph metadata is available", () => {
    const bins = new Uint8Array(128);
    // fftSize 256 at 48 kHz gives 187.5 Hz per bin. Bass occupies the first
    // two bins while vocal mids extend through roughly bin 21.
    bins.fill(240, 0, 2);
    bins.fill(120, 2, 22);
    bins.fill(35, 22, 64);
    const frame = analyzeFrequencyData(bins, EMPTY_VISUAL_FRAME, 80, { sampleRate: 48_000, fftSize: 256 });
    expect(frame.bass).toBeGreaterThan(frame.mids);
    expect(frame.mids).toBeGreaterThan(frame.treble);
  });

  it("suppresses false beats during track-change settling", () => {
    const bins = new Uint8Array(128);
    bins.fill(255, 0, 4);
    const frame = analyzeFrequencyData(bins, EMPTY_VISUAL_FRAME, 100, {
      sampleRate: 48_000, fftSize: 256, settling: true,
    });
    expect(frame.beat).toBe(0);
    expect(frame.bass).toBeGreaterThan(0);
  });

  it("keeps silence still after noise-floor suppression", () => {
    const bins = new Uint8Array(128);
    bins.fill(3);
    const frame = analyzeFrequencyData(bins, EMPTY_VISUAL_FRAME, 120, { sampleRate: 48_000, fftSize: 256 });
    expect(frame.energy).toBe(0);
    expect(frame.beat).toBe(0);
  });

  it("creates deterministic accessible fallback palettes", () => {
    expect(deterministicPalette("same")).toEqual(deterministicPalette("same"));
    expect(deterministicPalette("same").foreground).toBe("var(--on-media)");
  });

  it("redirects cyan artwork highlights into the Neutral Eclipse spectrum", () => {
    const corrected = neutralizeMusicHighlight({ r: 20, g: 210, b: 230, score: 1 });
    expect(corrected.r).toBeGreaterThan(120);
    expect(corrected.g).toBeLessThan(corrected.b);
    expect(neutralizeMusicHighlight({ r: 210, g: 70, b: 120 }).r).toBe(210);
  });

  it("converts ReplayGain decibels into a bounded output multiplier", () => {
    expect(replayGainMultiplier(-6, true)).toBeCloseTo(0.501, 2);
    expect(replayGainMultiplier(6, true)).toBeCloseTo(1.995, 2);
    expect(replayGainMultiplier(40, true)).toBe(2);
    expect(replayGainMultiplier(-40, true)).toBe(0.25);
    expect(replayGainMultiplier(-6, false)).toBe(1);
  });

  it("reports synchronization only after consecutive non-zero analyser frames", async () => {
    const frames = [];
    const node = { connect: vi.fn(), disconnect: vi.fn() };
    const analyserNode = { ...node, fftSize: 256, smoothingTimeConstant: 0,
      get frequencyBinCount() { return 128; },
      getByteFrequencyData(data) { data.fill(120); } };
    const gainNode = { ...node, gain: { value: 1, cancelScheduledValues: vi.fn(), setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() } };
    window.AudioContext = class {
      constructor() { this.state = "running"; this.sampleRate = 48_000; this.startedAt = performance.now(); this.destination = {}; }
      get currentTime() { return (performance.now() - this.startedAt) / 1000; }
      createMediaElementSource() { return node; }
      createAnalyser() { return analyserNode; }
      createGain() { return gainNode; }
      resume() { this.state = "running"; return Promise.resolve(); }
      close() { this.state = "closed"; return Promise.resolve(); }
    };
    window.requestAnimationFrame = vi.fn((callback) => { frames.push(callback); return frames.length; });
    window.cancelAnimationFrame = vi.fn();
    const states = [];
    const bus = createVisualBus();
    const runtime = createMusicAnalyser(document.createElement("audio"), bus, () => ({ adaptPerformance: false }),
      (state, diagnostics) => states.push({ state, diagnostics }));
    await runtime.start();
    const base = performance.now();
    for (const offset of [40, 80, 120]) frames.shift()(base + offset);
    expect(states.at(-1).state).toBe("active");
    expect(states.at(-1).diagnostics.nonZeroFrameCount).toBeGreaterThanOrEqual(3);
    expect(bus.getFrame().energy).toBeGreaterThan(0);
    runtime.destroy();
  });
});
