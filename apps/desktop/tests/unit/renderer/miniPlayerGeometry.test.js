import { afterEach, describe, expect, it } from "vitest";
import {
  getMiniPlayerBounds,
  MINI_PLAYER_CHROME_HEIGHT,
  MINI_PLAYER_DEFAULT_WIDTH,
} from "../../../src/renderer/shared/utils/miniPlayerGeometry";

describe("mini-player geometry", () => {
  afterEach(() => localStorage.removeItem("orion-mini-player-settings"));

  it("keeps the complete mini-player window at 16:9", () => {
    const bounds = getMiniPlayerBounds({ innerWidth: 1280, innerHeight: 720 });
    expect(bounds.width).toBe(MINI_PLAYER_DEFAULT_WIDTH);
    expect(MINI_PLAYER_CHROME_HEIGHT).toBe(0);
    expect(bounds.height).toBe(Math.round(bounds.width * (9 / 16)));
    expect(bounds.x).toBe(1280 - bounds.width - 24);
    expect(bounds.y).toBe(720 - bounds.height - 24);
  });

  it("ignores legacy saved heights and clamps width", () => {
    localStorage.setItem("orion-mini-player-settings", JSON.stringify({ width: 900, height: 900, x: 20, y: 20 }));
    const bounds = getMiniPlayerBounds({ innerWidth: 1280, innerHeight: 800 });
    expect(bounds.width).toBe(640);
    expect(bounds.height).toBe(360);
    expect(JSON.parse(localStorage.getItem("orion-mini-player-settings"))).toEqual({ x: 20, y: 20, width: 640 });
  });

  it.each([320, 400, 640])("preserves 16:9 at %dpx wide", (width) => {
    localStorage.setItem("orion-mini-player-settings", JSON.stringify({ width }));
    const bounds = getMiniPlayerBounds({ innerWidth: 1440, innerHeight: 900 });
    expect(bounds).toMatchObject({ width, height: Math.round(width * (9 / 16)) });
  });
});
