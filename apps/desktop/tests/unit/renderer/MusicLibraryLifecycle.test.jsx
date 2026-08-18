import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

vi.mock("../../../src/renderer/features/music/components/MusicTrackList", () => ({
  default: ({ tracks = [], empty }) => (
    <div data-testid="library-track-list">
      {tracks.length ? tracks.map((track) => <span key={track.id}>{track.title}</span>) : empty}
    </div>
  ),
}));
vi.mock("../../../src/renderer/features/music/components/PlanetGrid", () => ({
  default: () => <div data-testid="album-grid" />,
}));
vi.mock("../../../src/renderer/features/music/components/StarGrid", () => ({
  default: () => <div data-testid="artist-grid" />,
}));

import MusicLibrary from "../../../src/renderer/features/music/pages/MusicLibrary";

let scanListener;

beforeEach(() => {
  scanListener = null;
  Object.defineProperty(window, "electron", {
    configurable: true,
    value: {
      musicListTracks: vi.fn(async () => Array.from({ length: 10 }, (_, index) => ({
        id: `local-${index}`,
        title: `Track ${index}`,
        artistName: `Artist ${index}`,
        albumTitle: `Album ${index}`,
        addedAt: index,
      }))),
      musicListFolders: vi.fn(async () => [{ id: "folder", name: "Music" }]),
      musicListPlaylists: vi.fn(async () => []),
      musicListHistory: vi.fn(async () => Array.from({ length: 9 }, (_, index) => ({
        track: { id: `recent-${index}`, provider: "test", title: `Recent ${index}` },
      }))),
      onMusicScanProgress: vi.fn((listener) => {
        scanListener = listener;
        return () => { scanListener = null; };
      }),
      musicScan: vi.fn(async () => ({ ok: true })),
      musicAddFolder: vi.fn(async () => ({ ok: true })),
      musicCancelScan: vi.fn(async () => ({ ok: true })),
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
});

test("Library Overview labels bounded previews and opens the full newest-first local collection", async () => {
  render(<MusicLibrary />);

  const localView = await screen.findByRole("button", { name: "View all 10 local tracks" });
  expect(screen.getByText("Track 9")).toBeInTheDocument();
  expect(screen.queryByText("Track 0")).not.toBeInTheDocument();

  fireEvent.click(localView);
  expect(screen.getByRole("button", { name: "Local files" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("combobox", { name: "Sort" })).toHaveValue("newest");

  await waitFor(() => {
    expect(screen.getByText("Track 0")).toBeInTheDocument();
  });
});

test("scan completion is transient and the next scan automatically reveals status again", async () => {
  vi.useFakeTimers();
  render(<MusicLibrary />);

  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(scanListener).toBeTypeOf("function");

  act(() => {
    scanListener({ phase: "complete", current: 10, total: 10, imported: 10, unchanged: 0, failed: 0 });
  });
  expect(screen.getByText("Library scan complete")).toBeInTheDocument();

  act(() => {
    vi.advanceTimersByTime(4500);
  });
  expect(screen.queryByText("Library scan complete")).not.toBeInTheDocument();

  act(() => {
    scanListener({ phase: "discovering", current: 1, total: 10, imported: 0, unchanged: 0, failed: 0 });
  });
  expect(screen.getByText("Finding audio files")).toBeInTheDocument();
});
