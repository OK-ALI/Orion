import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

vi.mock("../../../src/renderer/features/music/components/MusicTrackList", () => ({
  default: ({ tracks = [], empty }) => (
    <div data-testid="collection-track-list">
      {tracks.length ? tracks.map((track) => <span key={track.id}>{track.title}</span>) : empty}
    </div>
  ),
}));

import LibrarySection from "../../../src/renderer/features/music/planet-sections/LibrarySection";
import {
  favoriteIdentity,
  favoritePayloads,
  favoriteTrackPreview,
  groupFavoritePayloads,
} from "../../../src/renderer/features/music/utils/favorites";

test("favorite records unwrap through one shared payload and identity contract", () => {
  const track = {
    id: "fav-track",
    title: "Kept Signal",
    source: { provider: "ytmusic-streaming" },
  };
  const album = { id: "fav-album", title: "Kept Album", provider: "ytmusic-metadata" };
  const artist = { id: "fav-artist", name: "Kept Artist", provider: "ytmusic-metadata" };
  const records = [
    { kind: "track", identity: "ytmusic-streaming:fav-track", payload: track },
    { kind: "album", identity: "ytmusic-metadata:fav-album", payload: album },
    { kind: "artist", identity: "ytmusic-metadata:fav-artist", payload: artist },
  ];

  expect(favoritePayloads(records)).toEqual([track, album, artist]);
  expect(groupFavoritePayloads(records)).toEqual({
    tracks: [track],
    albums: [album],
    artists: [artist],
  });
  expect(favoriteIdentity(track)).toBe("ytmusic-streaming:fav-track");

  const minimal = { kind: "track", identity: "legacy:minimal", payload: { id: "minimal", title: "Minimal Favorite" } };
  expect(favoriteTrackPreview([minimal], 6)).toEqual([{ id: "minimal", title: "Minimal Favorite" }]);
});

// C5.4.1: Library Galaxy local lane now represents true newest-first Recently Added music.
test("Library Galaxy keeps recent listening primary and recently added local music secondary", () => {
  const recent = {
    id: "recent-track",
    provider: "test",
    title: "Recent Signal",
    artistName: "Orion",
  };
  const local = {
    id: "local-track",
    provider: "orion-local-streaming",
    title: "Local Signal",
    artistName: "Orion",
  };

  const { container } = render(
    <LibrarySection tracks={[local]} history={[{ track: recent }]} onNavigate={vi.fn()} />,
  );

  const galaxy = container.querySelector(".music-library-galaxy");
  expect(galaxy).toHaveClass("is-mixed");
  expect(screen.getByRole("heading", { name: "Recently Heard" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Recently Added" })).toBeInTheDocument();
  expect(screen.getByText("Recent Signal")).toBeInTheDocument();
  expect(screen.getByText("Local Signal")).toBeInTheDocument();
});

test("Library Galaxy exposes continuation instead of silently truncating personal collections", () => {
  const navigate = vi.fn();
  const tracks = Array.from({ length: 7 }, (_, index) => ({
    id: `local-${index}`,
    provider: "orion-local-streaming",
    title: `Local ${index}`,
    addedAt: index,
  }));
  const history = Array.from({ length: 7 }, (_, index) => ({
    track: { id: `recent-${index}`, provider: "test", title: `Recent ${index}` },
  }));

  render(<LibrarySection tracks={tracks} history={history} onNavigate={navigate} />);

  const viewAll = screen.getAllByRole("button", { name: "View all" });
  expect(viewAll).toHaveLength(2);

  fireEvent.click(viewAll[0]);
  expect(navigate).toHaveBeenCalledWith("music-library", { libraryView: "recent" });

  fireEvent.click(viewAll[1]);
  expect(navigate).toHaveBeenCalledWith("music-library", {
    libraryView: "local",
    librarySort: "newest",
  });

  expect(screen.getByText("Local 6")).toBeInTheDocument();
  expect(screen.queryByText("Local 0")).not.toBeInTheDocument();
});

