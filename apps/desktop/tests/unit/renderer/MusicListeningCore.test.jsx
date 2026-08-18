import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/renderer/features/music/components/MusicArtwork", () => ({
  default: ({ label }) => <div aria-label={label}>Artwork</div>,
}));

vi.mock("../../../src/renderer/features/music/components/MusicOrbitalStage", () => ({
  default: ({ children }) => <section>{children}</section>,
}));

vi.mock("../../../src/renderer/features/music/visual/MusicVisualizer", () => ({
  default: () => <div data-testid="timeline-visualizer" />,
}));

import NowPlayingSection from "../../../src/renderer/features/music/planet-sections/NowPlayingSection";

function createMusic() {
  return {
    current: { id: "track-1", title: "Signal", artistName: "Orion", albumTitle: "Planet" },
    progress: { currentTime: 42, duration: 240 },
    buffered: 0.5,
    playbackStatus: "playing",
    playing: true,
    shuffle: false,
    repeat: "off",
    artwork: null,
    lyrics: { value: { lines: [] } },
    favorites: { isTrackFavorite: () => false, addTrack: vi.fn(), removeTrack: vi.fn() },
    setShuffle: vi.fn(),
    playPrevious: vi.fn(),
    togglePlaying: vi.fn(),
    playNext: vi.fn(),
    setRepeat: vi.fn(),
    seekTo: vi.fn(),
    setPanel: vi.fn(),
    loadLyrics: vi.fn(),
  };
}

describe("Music Listening Core", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps transport and secondary views clear without developer placeholder copy", () => {
    const music = createMusic();
    const onNavigate = vi.fn();
    render(<NowPlayingSection music={music} onNavigate={onNavigate} />);

    expect(screen.getByText("0:42")).toBeInTheDocument();
    expect(screen.getByText("-3:18")).toBeInTheDocument();
    expect(screen.queryByText(/waveform will carry lyrics/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Queue" }));
    expect(music.setPanel).toHaveBeenCalledWith("queue");

    fireEvent.click(screen.getByRole("button", { name: "Lyrics" }));
    expect(music.setPanel).toHaveBeenCalledWith("lyrics");
    expect(music.loadLyrics).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Open Observatory" }));
    expect(onNavigate).toHaveBeenCalledWith("music-now-playing", music.current);
  });

  it("shows only a real synchronized lyric when one is active", () => {
    const music = createMusic();
    music.lyrics.value.lines = [{ time: 10, text: "Carry the signal" }];
    render(<NowPlayingSection music={music} onNavigate={vi.fn()} />);
    expect(screen.getByText("Carry the signal")).toBeInTheDocument();
  });
});
