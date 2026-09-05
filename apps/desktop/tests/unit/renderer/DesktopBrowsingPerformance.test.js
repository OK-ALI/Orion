import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getHeroReadyIndexes, normalizePerformanceTier } from "../../../src/renderer/shared/utils/performanceBudget";

describe("Desktop browsing performance budgets", () => {
  it("keeps profile normalization conservative", () => {
    expect(normalizePerformanceTier("efficiency")).toBe("efficiency");
    expect(normalizePerformanceTier("quality")).toBe("quality");
    expect(normalizePerformanceTier("unknown")).toBe("balanced");
  });

  it("keeps the same Hero identities while varying only backdrop readiness", () => {
    expect([...getHeroReadyIndexes(0, 7, "efficiency")].sort((a, b) => a - b)).toEqual([0, 1, 6]);
    expect([...getHeroReadyIndexes(0, 7, "balanced")].sort((a, b) => a - b)).toEqual([0, 1, 2, 5, 6]);
    expect([...getHeroReadyIndexes(0, 7, "quality")].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("wires Hero readiness to the active Desktop performance tier", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "src/renderer/components/media/HeroBanner.jsx"),
      "utf8",
    );
    expect(source).toContain("usePerformanceTier()");
    expect(source).toContain("getHeroReadyIndexes(active, count, performanceTier)");
    expect(source).toContain("readyIndexes.has(idx)");
  });

  it("uses Chromium off-screen containment only for Efficiency browsing surfaces", () => {
    const cssPath = path.resolve(process.cwd(), "src/renderer/styles/global.css");
    const css = fs.readFileSync(cssPath, "utf8");
    expect(css).toContain('html[data-performance-tier="efficiency"] .library-card-grid > .watchlist-drag-card');
    expect(css).toContain('html[data-performance-tier="efficiency"] .discover-results-grid > .media-card');
    expect(css).toContain('html[data-performance-tier="efficiency"] .search-results-grid > .search-media-result');
    expect(css).toContain("content-visibility: auto");
    expect(css).not.toContain('html[data-performance-tier="quality"] .library-card-grid > .watchlist-drag-card');
  });
});
