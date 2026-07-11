import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/renderer/features/music/components/MusicArtwork", () => ({
  default: ({ label }) => <span aria-label={label} />,
}));
vi.mock("../../../src/renderer/features/music/components/MusicTrackList", () => ({
  default: ({ tracks, empty }) => <div data-testid="detail-tracks">{tracks.length ? tracks.map((track) => track.title).join(", ") : empty}</div>,
}));
vi.mock("../../../src/renderer/features/music/components/PlanetGrid", () => ({
  default: ({ items }) => <div data-testid="detail-albums">{items.map((item) => item.title).join(", ")}</div>,
}));
vi.mock("../../../src/renderer/features/music/context/MusicProvider", () => ({
  useMusic: () => ({ playTrack: vi.fn(), startRadio: vi.fn() }),
}));

import AlbumPage from "../../../src/renderer/features/music/pages/AlbumPage";
import ArtistPage from "../../../src/renderer/features/music/pages/ArtistPage";

describe("Music artist and album details", () => {
  beforeEach(() => {
    window.electron = { musicGetDetails: vi.fn(), musicListFavorites: vi.fn().mockResolvedValue([]), musicToggleFavorite: vi.fn() };
  });

  it("unwraps a populated artist response into its profile, tracks, and releases", async () => {
    window.electron.musicGetDetails.mockResolvedValue({ ok: true, value: {
      artist: { id: "artist-1", provider: "ytmusic-metadata", name: "Resolved Artist" },
      tracks: [{ id: "track-1", title: "Resolved Signal", artistName: "Resolved Artist" }],
      albums: [{ id: "album-1", title: "Resolved Orbit", artistName: "Resolved Artist" }],
    } });
    render(<ArtistPage selected={{ id: "artist-1", provider: "ytmusic-metadata", name: "Search Artist" }} onNavigate={() => {}} />);

    expect(await screen.findByRole("heading", { name: "Resolved Artist" })).toBeInTheDocument();
    expect(screen.getByTestId("detail-tracks")).toHaveTextContent("Resolved Signal");
    expect(screen.getByTestId("detail-albums")).toHaveTextContent("Resolved Orbit");
    expect(window.electron.musicGetDetails).toHaveBeenCalledWith("artist", expect.objectContaining({ id: "artist-1" }));
  });

  it("unwraps an album response and keeps track metadata separate from its header", async () => {
    window.electron.musicGetDetails.mockResolvedValue({ ok: true, value: {
      album: { id: "album-1", provider: "ytmusic-metadata", title: "Resolved Orbit", artistName: "Resolved Artist", year: 2026 },
      tracks: [{ id: "track-1", title: "First Signal", artistName: "Resolved Artist" },
        { id: "track-2", title: "Second Signal", artistName: "Resolved Artist" }],
    } });
    render(<AlbumPage selected={{ id: "album-1", provider: "ytmusic-metadata", title: "Search Album" }} onNavigate={() => {}} />);

    expect(await screen.findByRole("heading", { name: "Resolved Orbit" })).toBeInTheDocument();
    expect(screen.getByText("Resolved Artist")).toBeInTheDocument();
    expect(screen.getByTestId("detail-tracks")).toHaveTextContent("First Signal, Second Signal");
    expect(screen.getByText("2 tracks")).toBeInTheDocument();
  });

  it("keeps the selected profile visible and reports a provider failure", async () => {
    window.electron.musicGetDetails.mockResolvedValue({ ok: false, error: "Catalog signal unavailable." });
    render(<ArtistPage selected={{ id: "artist-1", provider: "ytmusic-metadata", name: "Known Artist" }} onNavigate={() => {}} />);

    expect(screen.getByRole("heading", { name: "Known Artist" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Catalog signal unavailable.")).toBeInTheDocument());
    expect(screen.getByTestId("detail-tracks")).toHaveTextContent("No playable tracks are available from the active sources.");
  });
});
