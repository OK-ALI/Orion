import { afterEach, describe, expect, it, vi } from "vitest";
import { setupAmbientGlow } from "../../../src/renderer/shared/utils/playerAmbient";

describe("online player ambient sampling", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("samples the ready webview guest instead of the parent renderer", async () => {
    const webview = document.createElement("div");
    const player = document.createElement("div");
    webview.getWebContentsId = () => 42;
    player.appendChild(webview);
    document.body.appendChild(player);

    const startAmbientSampling = vi.fn().mockResolvedValue({ ok: true });
    const stopAmbientSampling = vi.fn().mockResolvedValue({ ok: true });
    let enterFullscreen;
    let leaveFullscreen;
    window.electron = {
      startAmbientSampling,
      stopAmbientSampling,
      onAmbientPalette: vi.fn(() => null),
      onWebviewEnterFullscreen: vi.fn((callback) => { enterFullscreen = callback; return callback; }),
      offWebviewEnterFullscreen: vi.fn(),
      onWebviewLeaveFullscreen: vi.fn((callback) => { leaveFullscreen = callback; return callback; }),
      offWebviewLeaveFullscreen: vi.fn(),
    };

    const onColor = vi.fn();
    const cleanup = setupAmbientGlow(webview, onColor, { captureElement: player });
    await vi.waitFor(() => expect(startAmbientSampling).toHaveBeenCalledOnce());

    expect(startAmbientSampling).toHaveBeenCalledWith(expect.objectContaining({
      captureWebContentsId: 42,
      playbackWebContentsId: 42,
    }));
    expect(startAmbientSampling.mock.calls[0][0].cropRect).toBeUndefined();
    expect(player.dataset.ambientActive).toBe("true");

    enterFullscreen();
    expect(onColor).toHaveBeenLastCalledWith("", expect.any(Array));
    expect(player.dataset.ambientActive).toBeUndefined();
    expect(document.documentElement).toHaveAttribute("data-player-fullscreen", "1");

    leaveFullscreen();
    await vi.waitFor(() => expect(startAmbientSampling).toHaveBeenCalledTimes(2));
    expect(player.dataset.ambientActive).toBe("true");
    expect(document.documentElement).not.toHaveAttribute("data-player-fullscreen");

    cleanup();
    expect(stopAmbientSampling).toHaveBeenCalled();
    expect(player.dataset.ambientActive).toBeUndefined();
  });
});
