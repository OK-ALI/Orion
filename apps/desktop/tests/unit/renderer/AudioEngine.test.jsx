import React from "react";
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AudioEngine from "../../../src/renderer/features/music/player/AudioEngine";

const baseController = {
  current: { id: "track-one", title: "First signal", artistName: "Orion" },
  stream: { url: "orion-music://first-grant" },
  playing: false,
  setPlaying: vi.fn(),
  volume: 0.8,
  muted: false,
  setProgress: vi.fn(),
  setBuffered: vi.fn(),
  playbackStatus: "paused",
  setPlaybackStatus: vi.fn(),
  playNext: vi.fn(),
  playPrevious: vi.fn(),
  retryStream: vi.fn(),
  engineRef: { current: null },
  visualBus: { subscribe: vi.fn(() => () => {}) },
  visualPreferences: { adaptPerformance: false, replayGain: false, crossfadeDuration: 0, atmosphere: "off" },
  artwork: { url: "", palette: null },
};

describe("Music audio handoff", () => {
  const originalPause = HTMLMediaElement.prototype.pause;
  const originalLoad = HTMLMediaElement.prototype.load;

  afterEach(() => {
    HTMLMediaElement.prototype.pause = originalPause;
    HTMLMediaElement.prototype.load = originalLoad;
    vi.restoreAllMocks();
  });

  it("detaches the previous protected stream before a replacement can attach", () => {
    const pause = vi.fn();
    const load = vi.fn();
    HTMLMediaElement.prototype.pause = pause;
    HTMLMediaElement.prototype.load = load;
    const controller = { ...baseController, engineRef: { current: null } };
    const view = render(<AudioEngine controller={controller} />);
    const audio = view.container.querySelector("audio");

    expect(audio.getAttribute("src")).toContain("first-grant");

    view.rerender(<AudioEngine controller={{ ...controller, stream: null }} />);
    expect(pause).toHaveBeenCalled();
    expect(load).toHaveBeenCalled();
    expect(audio.hasAttribute("src")).toBe(false);

    view.rerender(<AudioEngine controller={{ ...controller, stream: { url: "orion-music://second-grant" } }} />);
    expect(audio.getAttribute("src")).toContain("second-grant");
  });
});
