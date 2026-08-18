import { describe, expect, it, vi } from "vitest";
import {
  getReadyWebContentsId,
  isExpectedWebviewNavigationAbort,
  shouldHandleWebviewLoadFailure,
} from "../../../src/renderer/features/player/services/webviewLifecycle";

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

  it("classifies superseded ERR_ABORTED navigation as expected", () => {
    expect(isExpectedWebviewNavigationAbort({ errorCode: -3 })).toBe(true);
    expect(isExpectedWebviewNavigationAbort({ code: "ERR_ABORTED" })).toBe(true);
    expect(
      isExpectedWebviewNavigationAbort({
        message: "Error: ERR_ABORTED (-3) loading 'https://provider.example'",
      }),
    ).toBe(true);
  });

  it("reports only real main-frame load failures", () => {
    expect(shouldHandleWebviewLoadFailure({ isMainFrame: true, errorCode: -3 })).toBe(false);
    expect(shouldHandleWebviewLoadFailure({ isMainFrame: false, errorCode: -105 })).toBe(false);
    expect(
      shouldHandleWebviewLoadFailure({
        isMainFrame: true,
        errorCode: -105,
        errorDescription: "NAME_NOT_RESOLVED",
      }),
    ).toBe(true);
  });

});
