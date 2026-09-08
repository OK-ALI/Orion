import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearDetachedRemotePointerTarget,
  registerRemotePointerSurface,
  resetRemotePointerSurfacesForTests,
  resolveRemotePointerTarget,
  setDetachedRemotePointerTarget,
} from "../../../src/renderer/features/player/services/remotePointerSurfaces";

afterEach(() => {
  resetRemotePointerSurfacesForTests();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

function rect(left, top, width, height) {
  return { left, top, width, height, right: left + width, bottom: top + height };
}

describe("remote playback pointer surface registry", () => {
  it("maps main-window coordinates into live webview-local coordinates", () => {
    const webview = document.createElement("webview");
    document.body.appendChild(webview);
    vi.spyOn(webview, "getBoundingClientRect").mockReturnValue(rect(100, 50, 400, 300));
    document.elementFromPoint = vi.fn(() => webview);

    registerRemotePointerSurface({
      id: "movie-provider",
      kind: "webview",
      priority: 100,
      getElement: () => webview,
      getWebContentsId: () => 77,
    });

    expect(resolveRemotePointerTarget(260, 170)).toEqual({
      surfaceId: "movie-provider",
      kind: "webview",
      webContentsId: 77,
      x: 160,
      y: 120,
    });
  });

  it("keeps Orion overlay controls in the renderer instead of tunnelling through to the webview", () => {
    const webview = document.createElement("webview");
    const overlay = document.createElement("button");
    document.body.append(webview, overlay);
    vi.spyOn(webview, "getBoundingClientRect").mockReturnValue(rect(0, 0, 500, 300));
    document.elementFromPoint = vi.fn(() => overlay);

    registerRemotePointerSurface({
      id: "tv-provider",
      kind: "webview",
      priority: 100,
      getElement: () => webview,
      getWebContentsId: () => 88,
    });

    expect(resolveRemotePointerTarget(40, 40)).toEqual({
      surfaceId: "renderer:main",
      kind: "renderer",
      webContentsId: null,
      x: 40,
      y: 40,
    });
  });

  it("does not retain a detached or replaced playback surface", () => {
    const oldWebview = document.createElement("webview");
    document.body.appendChild(oldWebview);
    vi.spyOn(oldWebview, "getBoundingClientRect").mockReturnValue(rect(0, 0, 100, 100));
    document.elementFromPoint = vi.fn(() => oldWebview);

    registerRemotePointerSurface({
      id: "provider",
      kind: "webview",
      getElement: () => oldWebview,
      getWebContentsId: () => 41,
    });
    oldWebview.remove();

    expect(resolveRemotePointerTarget(20, 20).surfaceId).toBe("renderer:main");
  });

  it("does not let an old cleanup delete a replacement registration with the same id", () => {
    const oldWebview = document.createElement("webview");
    const newWebview = document.createElement("webview");
    document.body.append(oldWebview, newWebview);
    vi.spyOn(oldWebview, "getBoundingClientRect").mockReturnValue(rect(0, 0, 100, 100));
    vi.spyOn(newWebview, "getBoundingClientRect").mockReturnValue(rect(0, 0, 100, 100));
    document.elementFromPoint = vi.fn(() => newWebview);

    const cleanupOld = registerRemotePointerSurface({
      id: "provider", kind: "webview", getElement: () => oldWebview, getWebContentsId: () => 41,
    });
    registerRemotePointerSurface({
      id: "provider", kind: "webview", getElement: () => newWebview, getWebContentsId: () => 42,
    });
    cleanupOld();

    expect(resolveRemotePointerTarget(20, 20).webContentsId).toBe(42);
  });



  it("routes the latest normalized pointer directly to the active detached pop-out target", () => {
    setDetachedRemotePointerTarget(91);

    expect(resolveRemotePointerTarget(700, 400, {
      xRatio: 0.75,
      yRatio: 0.25,
    })).toEqual({
      surfaceId: "player:popout",
      kind: "detached",
      webContentsId: 91,
      x: 0,
      y: 0,
      xRatio: 0.75,
      yRatio: 0.25,
    });
  });

  it("does not let stale detached cleanup clear a replacement target", () => {
    setDetachedRemotePointerTarget(91);
    setDetachedRemotePointerTarget(92);
    clearDetachedRemotePointerTarget(91);

    expect(resolveRemotePointerTarget(20, 30, {
      xRatio: 0.1,
      yRatio: 0.2,
    }).webContentsId).toBe(92);
  });

  it("maps native video surfaces back to the main renderer input lane", () => {
    const video = document.createElement("video");
    document.body.appendChild(video);
    vi.spyOn(video, "getBoundingClientRect").mockReturnValue(rect(10, 20, 320, 180));
    document.elementFromPoint = vi.fn(() => video);

    registerRemotePointerSurface({
      id: "local-video",
      kind: "renderer",
      priority: 150,
      getElement: () => video,
    });

    expect(resolveRemotePointerTarget(100, 120)).toEqual({
      surfaceId: "local-video",
      kind: "renderer",
      webContentsId: null,
      x: 100,
      y: 120,
    });
  });
});
