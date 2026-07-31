import { describe, expect, it } from "vitest";
import { chooseMusicOverlayPlacement, constrainMusicPlayerGeometry, snapMusicPlayerGeometry } from "../../../src/renderer/features/music/utils/playerGeometry";

describe("floating Music player geometry", () => {
  it("keeps the player clear of a pinned sidebar", () => {
    const geometry = constrainMusicPlayerGeometry({ x: 40, y: 70, width: 480, height: 92 }, {
      viewportWidth: 1440, viewportHeight: 900, sidebarRight: 280,
    });
    expect(geometry.x).toBe(296);
    expect(geometry.width).toBe(720);
  });

  it("clamps oversized geometry to a narrow window", () => {
    const geometry = constrainMusicPlayerGeometry({ x: 1200, y: 900, width: 1200, height: 500 }, {
      viewportWidth: 900, viewportHeight: 640, sidebarRight: 224,
    });
    expect(geometry.width).toBe(640);
    expect(geometry.height).toBe(500);
    expect(geometry.x).toBe(248);
    expect(geometry.y).toBe(128);
  });

  it("enforces a usable minimum player size", () => {
    const geometry = constrainMusicPlayerGeometry({ x: 0, y: 0, width: 1, height: 1 }, {
      viewportWidth: 1600, viewportHeight: 900, sidebarRight: 0,
    });
    expect(geometry.width).toBe(720);
    expect(geometry.height).toBe(128);
    expect(geometry.x).toBe(16);
    expect(geometry.y).toBe(58);
  });

  it("snaps a floating player to safe edges without entering the sidebar", () => {
    const geometry = snapMusicPlayerGeometry({ x: 302, y: 812, width: 720, height: 128 }, {
      viewportWidth: 1440, viewportHeight: 900, sidebarRight: 280,
    });
    expect(geometry.x).toBe(296);
    expect(geometry.y).toBe(760);
  });

  it("retains a free position when it is outside the snap threshold", () => {
    const geometry = snapMusicPlayerGeometry({ x: 600, y: 360, width: 720, height: 128 }, {
      viewportWidth: 1440, viewportHeight: 900, sidebarRight: 280,
    });
    expect(geometry.x).toBe(600);
    expect(geometry.y).toBe(360);
  });

  it("places a player overlay where it cannot cover the floating dock", () => {
    expect(chooseMusicOverlayPlacement({ top: 600, bottom: 690, left: 900, right: 1380 }, {
      viewportWidth: 1440, viewportHeight: 900,
    })).toBe("above");
    expect(chooseMusicOverlayPlacement({ top: 70, bottom: 160, left: 300, right: 780 }, {
      viewportWidth: 1440, viewportHeight: 900,
    })).toBe("below");
    expect(chooseMusicOverlayPlacement({ top: 250, bottom: 340, left: 300, right: 780 }, {
      viewportWidth: 1440, viewportHeight: 600,
    })).toBe("right");
  });
});
