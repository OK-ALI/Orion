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
    window.electron = {
      startAmbientSampling,
      stopAmbientSampling,
      onAmbientPalette: vi.fn(() => null),
    };

    const cleanup = setupAmbientGlow(webview, vi.fn(), { captureElement: player });
    await vi.waitFor(() => expect(startAmbientSampling).toHaveBeenCalledOnce());

    expect(startAmbientSampling).toHaveBeenCalledWith(expect.objectContaining({
      captureWebContentsId: 42,
      playbackWebContentsId: 42,
    }));
    expect(startAmbientSampling.mock.calls[0][0].cropRect).toBeUndefined();
    expect(player.dataset.ambientActive).toBe("true");

    cleanup();
    expect(stopAmbientSampling).toHaveBeenCalled();
    expect(player.dataset.ambientActive).toBeUndefined();
  });
});
