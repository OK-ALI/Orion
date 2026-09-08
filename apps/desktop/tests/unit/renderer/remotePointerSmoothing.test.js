import { describe, expect, it } from "vitest";
import {
  clampRemotePointerRatio,
  createRemotePointerTarget,
  stepRemotePointerVisual,
} from "../../../src/renderer/features/player/services/remotePointerSmoothing";

describe("remote pointer visual smoothing", () => {
  it("clamps normalized pointer coordinates before mapping them to the renderer", () => {
    expect(clampRemotePointerRatio(-2)).toBe(0);
    expect(clampRemotePointerRatio(0.42)).toBe(0.42);
    expect(clampRemotePointerRatio(4)).toBe(1);

    expect(
      createRemotePointerTarget(
        { x: 0.5, y: 0.25 },
        1920,
        1080,
        123,
      ),
    ).toEqual({
      x: 960,
      y: 270,
      xRatio: 0.5,
      yRatio: 0.25,
      receivedAt: 123,
    });
  });

  it("snaps the first rendered position without adding startup latency", () => {
    const result = stepRemotePointerVisual(
      null,
      { x: 640, y: 360 },
      16.67,
    );

    expect(result.position).toEqual({ x: 640, y: 360 });
    expect(result.settled).toBe(true);
    expect(result.snapped).toBe(true);
  });

  it("keeps only the newest target and converges without a historical point queue", () => {
    const first = stepRemotePointerVisual(
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      16.67,
    );
    const newer = stepRemotePointerVisual(
      first.position,
      { x: 300, y: 0 },
      16.67,
    );

    expect(first.position.x).toBeGreaterThan(0);
    expect(first.position.x).toBeLessThan(100);
    expect(newer.position.x).toBeGreaterThan(100);
    expect(newer.position.x).toBeLessThanOrEqual(300);
  });

  it("uses an aggressive latency-biased catch-up for fast movement", () => {
    const result = stepRemotePointerVisual(
      { x: 0, y: 0 },
      { x: 500, y: 0 },
      16.67,
    );

    expect(result.position.x).toBeGreaterThan(470);
    expect(result.position.x).toBeLessThanOrEqual(500);
  });

  it("settles quickly after the authoritative target stops moving", () => {
    const target = { x: 800, y: 450 };
    let position = { x: 0, y: 0 };
    let settled = false;

    for (let frame = 0; frame < 4; frame += 1) {
      const result = stepRemotePointerVisual(position, target, 16.67);
      position = result.position;
      settled = result.settled;
      if (settled) break;
    }

    expect(Math.abs(position.x - target.x)).toBeLessThanOrEqual(0.35);
    expect(Math.abs(position.y - target.y)).toBeLessThanOrEqual(0.35);
    expect(settled).toBe(true);
  });

  it("disables interpolation when reduced motion is requested", () => {
    const result = stepRemotePointerVisual(
      { x: 10, y: 10 },
      { x: 900, y: 700 },
      16.67,
      { reducedMotion: true },
    );

    expect(result.position).toEqual({ x: 900, y: 700 });
    expect(result.settled).toBe(true);
    expect(result.snapped).toBe(true);
  });
});
