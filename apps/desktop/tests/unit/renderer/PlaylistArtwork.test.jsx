import React from "react";
import { render } from "@testing-library/react";
import { expect, test, vi } from "vitest";

vi.mock("../../../src/renderer/features/music/components/MusicArtwork", () => ({
  default: ({ track }) => <span data-testid="playlist-mosaic-track">{track.title}</span>,
}));

import PlaylistArtwork from "../../../src/renderer/features/music/components/PlaylistArtwork";
import {
  PLAYLIST_ARTWORK_PRESETS,
  playlistArtworkMode,
  playlistArtworkPreset,
} from "../../../src/renderer/features/music/utils/playlistArtwork";

test("playlist artwork defaults to a smart track mosaic and supports Orion presets", () => {
  const playlist = {
    id: "drive",
    name: "Drive",
    items: [{ id: "one", title: "One" }, { id: "two", title: "Two" }],
  };
  const { container, rerender } = render(<PlaylistArtwork playlist={playlist} />);
  expect(container.querySelector(".music-playlist-artwork")).toHaveClass("is-mosaic");
  expect(container.querySelectorAll('[data-testid="playlist-mosaic-track"]')).toHaveLength(2);

  const preset = PLAYLIST_ARTWORK_PRESETS[0];
  rerender(<PlaylistArtwork playlist={{ ...playlist, artwork: { kind: "preset", preset: preset.id } }} />);
  expect(container.querySelector(".music-playlist-artwork")).toHaveClass("is-preset", `is-${preset.id}`);
  expect(playlistArtworkMode({ ...playlist, artwork: { kind: "preset", preset: preset.id } })).toBe("preset");
});

test("empty playlists receive a deterministic Orion cover instead of a blank slab", () => {
  const playlist = { id: "empty", name: "Empty Signals", items: [] };
  expect(playlistArtworkMode(playlist)).toBe("preset");
  expect(PLAYLIST_ARTWORK_PRESETS.map((item) => item.id)).toContain(playlistArtworkPreset(playlist));
});
