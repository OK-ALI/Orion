import { describe, expect, it } from "vitest";
import {
  clampOrbPixels,
  normalizedToPixels,
  pixelsToNormalized,
  resolveQuickSearchPlacement,
  settleOrbPixels,
} from "../../../src/renderer/components/search/searchOrbGeometry";

describe("Search Orb geometry", () => {
  const viewport = { width: 1440, height: 900 };

  it("round-trips normalized positions inside the safe Orion viewport", () => {
    const pixels = normalizedToPixels({ x: 0.72, y: 0.36 }, viewport);
    const normalized = pixelsToNormalized(pixels, viewport);
    expect(normalized.x).toBeCloseTo(0.72, 4);
    expect(normalized.y).toBeCloseTo(0.36, 4);
  });

  it("clamps and softly settles only when close to an edge", () => {
    const clamped = clampOrbPixels({ left: -500, top: 5000 }, viewport);
    expect(clamped.left).toBeGreaterThanOrEqual(68);
    expect(clamped.top).toBeLessThan(900);

    const nearRight = settleOrbPixels({ left: 1335, top: 260 }, viewport);
    expect(nearRight.left).toBeGreaterThan(1300);

    const center = settleOrbPixels({ left: 650, top: 260 }, viewport);
    expect(center.left).toBe(650);
  });

  it("opens Quick Search away from the nearest constrained edge", () => {
    const rightAnchor = { left: 1360, right: 1408, top: 110, bottom: 158 };
    const rightPlacement = resolveQuickSearchPlacement(rightAnchor, viewport);
    expect(rightPlacement.horizontal).toBe("left");
    expect(rightPlacement.vertical).toBe("down");
    expect(rightPlacement.style.left).toBeLessThan(rightAnchor.left);

    const leftBottomAnchor = { left: 70, right: 118, top: 760, bottom: 808 };
    const leftPlacement = resolveQuickSearchPlacement(leftBottomAnchor, viewport);
    expect(leftPlacement.horizontal).toBe("right");
    expect(leftPlacement.vertical).toBe("up");
    expect(leftPlacement.style.left).toBeGreaterThan(leftBottomAnchor.right);
  });
});
