import { describe, expect, it, vi } from "vitest";
import { getReadyWebContentsId } from "../../../src/renderer/features/player/services/webviewLifecycle";

describe("webview lifecycle guard", () => {
  it("returns null instead of throwing before dom-ready", () => {
    const getWebContentsId = vi.fn(() => {
      throw new Error("The WebView must be attached to the DOM and the dom-ready event emitted before this method can be called.");
    });
    expect(getReadyWebContentsId({ isConnected: true, getWebContentsId })).toBeNull();
    expect(getWebContentsId).toHaveBeenCalledOnce();
  });

  it("returns a valid id after the webview is ready", () => {
    expect(getReadyWebContentsId({ isConnected: true, getWebContentsId: () => 42 })).toBe(42);
  });
});
