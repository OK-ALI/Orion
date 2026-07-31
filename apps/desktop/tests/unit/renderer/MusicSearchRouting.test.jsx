import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/renderer/features/music/components/MusicArtwork", () => ({
  default: ({ label }) => <span aria-label={label} />,
}));
vi.mock("../../../src/renderer/features/music/components/MusicTrackList", () => ({
  default: ({ tracks }) => <div data-testid="music-track-list">{tracks.map((track) => track.title).join(",")}</div>,
}));
vi.mock("../../../src/renderer/features/music/context/MusicProvider", () => ({
  useMusic: () => ({ playTrack: vi.fn() }),
}));

import MusicSearch from "../../../src/renderer/features/music/pages/MusicSearch";

describe("Music Search provider routing", () => {
  beforeEach(() => {
    window.electron = { musicSearch: vi.fn().mockResolvedValue({
      results: [{ value: {
        tracks: [{ id: "track-1", title: "Real Signal", artistName: "Orion Artist" }],
        artists: [{ id: "artist-1", name: "Orion Artist" }], albums: [],
      } }], errors: [],
    }) };
  });

  it("prefills a shell query and searches exclusively through the preload API", async () => {
    render(<MusicSearch selected={{ query: "Real Signal" }} onNavigate={() => {}} />);
    expect(screen.getByRole("textbox", { name: /artists, albums and tracks/i })).toHaveValue("Real Signal");
    await waitFor(() => expect(window.electron.musicSearch).toHaveBeenCalledWith("Real Signal"), { timeout: 1500 });
    expect((await screen.findAllByText("Orion Artist")).length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("music-track-list").some((element) => element.textContent.includes("Real Signal"))).toBe(true);
  });
});
