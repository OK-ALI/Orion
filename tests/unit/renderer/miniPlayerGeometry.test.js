import { describe, expect, it } from "vitest";
import {
  getMiniPlayerBounds,
  MINI_PLAYER_CHROME_HEIGHT,
  MINI_PLAYER_DEFAULT_WIDTH,
} from "../../../src/renderer/shared/utils/miniPlayerGeometry";

describe("mini-player geometry", () => {
  it("keeps the video surface at 16:9 below the title bar", () => {
    const bounds = getMiniPlayerBounds({ innerWidth: 1280, innerHeight: 720 });
    expect(bounds.width).toBe(MINI_PLAYER_DEFAULT_WIDTH);
    expect(bounds.height - MINI_PLAYER_CHROME_HEIGHT).toBe(
      Math.round(bounds.width * (9 / 16)),
    );
    expect(bounds.x).toBe(1280 - bounds.width - 24);
    expect(bounds.y).toBe(720 - bounds.height - 24);
  });
});
