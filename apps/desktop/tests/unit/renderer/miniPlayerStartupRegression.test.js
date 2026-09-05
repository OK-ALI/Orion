import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const desktopRoot = path.resolve(import.meta.dirname, "../../..");
const appPath = path.join(desktopRoot, "src/renderer/app/App.jsx");
const routesPath = path.join(desktopRoot, "src/renderer/app/AppRoutes.jsx");

const appSource = fs.readFileSync(appPath, "utf8");
const routesSource = fs.readFileSync(routesPath, "utf8");

function readHandleOpenMiniPlayer() {
  const start = appSource.indexOf(
    "const handleOpenMiniPlayer = useCallback((payload) => {",
  );
  const end = appSource.indexOf(
    "const createMiniHandoff = useCallback",
    start,
  );

  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  return appSource.slice(start, end);
}

describe("embedded playback must not manufacture a mini-player", () => {
  it("keeps ordinary Movie and TV Play wired to a null mini-player clear request", () => {
    const clearRequests =
      routesSource.match(/onPlay=\{\(\) => setMiniPlayer\(null\)\}/g) || [];

    expect(clearRequests).toHaveLength(2);
  });

  it("treats a null mini-player request as clear-only before handoff state is armed", () => {
    const block = readHandleOpenMiniPlayer();

    const nullGuard = block.indexOf("if (!payload) {");
    const clearMini = block.indexOf("setMiniPlayer(null);", nullGuard);
    const clearPlayback = block.indexOf("setPlaybackSession(null);", nullGuard);
    const earlyReturn = block.indexOf("return;", nullGuard);
    const manualArm = block.indexOf("manualMiniRequestRef.current = true;");
    const transition = block.indexOf("beginMiniTransition(payload);");

    expect(nullGuard).toBeGreaterThanOrEqual(0);
    expect(clearMini).toBeGreaterThan(nullGuard);
    expect(clearPlayback).toBeGreaterThan(clearMini);
    expect(earlyReturn).toBeGreaterThan(clearPlayback);

    // The null path must exit before any manual-mini state,
    // transition, or delayed activation can be scheduled.
    expect(earlyReturn).toBeLessThan(manualArm);
    expect(earlyReturn).toBeLessThan(transition);
  });

  it("never activates a missing mini-player session", () => {
    const block = readHandleOpenMiniPlayer();

    const createSession = block.indexOf(
      "const next = createMiniPlaybackSession(payload, crypto.randomUUID());",
    );
    const nullSessionGuard = block.indexOf("if (!next) return;");
    const activate = block.indexOf("setMiniPlayer(next);");

    expect(createSession).toBeGreaterThanOrEqual(0);
    expect(nullSessionGuard).toBeGreaterThan(createSession);
    expect(activate).toBeGreaterThan(nullSessionGuard);
  });
});
