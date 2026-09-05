import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const visualRoot = resolve(process.cwd(), "src/renderer/features/music/visual");
const shellPath = resolve(visualRoot, "MusicPlanetSceneEngine.jsx");
const qualityPath = resolve(visualRoot, "MusicPlanetThreeScene.jsx");

describe("Music Planet bundle boundary", () => {
  it("keeps Three.js and React Three Fiber out of the lower-tier scene shell", () => {
    const shell = readFileSync(shellPath, "utf8");

    expect(shell).toContain('lazy(() => import("./MusicPlanetThreeScene"))');
    expect(shell).not.toMatch(/from\s+["']three["']/);
    expect(shell).not.toMatch(/from\s+["']@react-three\/fiber["']/);
    expect(shell).not.toMatch(/from\s+["']@react-three\/drei["']/);
  });

  it("isolates the Quality-only WebGL implementation behind that lazy boundary", () => {
    const quality = readFileSync(qualityPath, "utf8");

    expect(quality).toMatch(/from\s+["']three["']/);
    expect(quality).toMatch(/from\s+["']@react-three\/fiber["']/);
    expect(quality).toContain("<Canvas");
    expect(quality).toContain("<CoreMesh");
  });

  it("renders the lazy Quality scene only for the full performance mode", () => {
    const shell = readFileSync(shellPath, "utf8");

    expect(shell).toContain('renderMode === "full"');
    expect(shell).toContain("<QualityThreeScene");
    expect(shell).toContain('renderMode === "orb"');
    expect(shell).toContain("<LightweightMusicOrb");
  });
});
