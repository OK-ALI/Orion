import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MiniPlayer from "../../../src/renderer/components/MiniPlayer";

describe("MiniPlayer", () => {
  it("leaves the loading state after dom-ready and ignores late subframe loading", async () => {
    window.matchMedia = vi.fn(() => ({ matches: false }));
    window.electron = {
      setVideoState: vi.fn(async () => ({ ok: true, paused: false, muted: false, volume: 1 })),
      queryVideoProgress: vi.fn(async () => ({ currentTime: 12, duration: 120, paused: false, muted: false, volume: 1 })),
      startAmbientSampling: vi.fn(async () => ({ ok: true })),
      stopAmbientSampling: vi.fn(async () => ({ ok: true })),
      onAmbientPalette: vi.fn(() => null),
    };

    const { container } = render(<MiniPlayer url="https://player.test/embed" title="Test title" initialState={{ paused: false, muted: false, volume: 1 }} onClose={() => {}} onExpand={() => {}} />);
    expect(screen.queryByLabelText("Seek back 10 seconds")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Seek forward 10 seconds")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Volume")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Mute")).not.toBeInTheDocument();
    const webview = container.querySelector("webview");
    webview.getWebContentsId = () => 42;
    webview.insertCSS = vi.fn(async () => "css-key");
    fireEvent(webview, new Event("dom-ready"));

    await waitFor(() => expect(screen.queryByText("Preparing mini-player…")).not.toBeInTheDocument());
    fireEvent(webview, new Event("did-start-loading"));
    expect(screen.queryByText("Preparing mini-player…")).not.toBeInTheDocument();
    await waitFor(() => expect(window.electron.setVideoState).toHaveBeenCalledWith(42, expect.objectContaining({ muted: false, paused: false })));
  });
});
