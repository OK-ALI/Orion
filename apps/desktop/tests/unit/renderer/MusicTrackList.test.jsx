import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

vi.mock("../../../src/renderer/features/music/context/MusicProvider", () => ({
  useMusic: () => ({
    current: null,
    playing: false,
    playTrack: vi.fn(),
    playNextTrack: vi.fn(),
    addToQueue: vi.fn(),
    startRadio: vi.fn(),
  }),
}));

vi.mock("../../../src/renderer/features/music/components/AddToPlaylistDialog", () => ({
  default: () => null,
}));

import MusicTrackList from "../../../src/renderer/features/music/components/MusicTrackList";

const tracks = [{
  id: "track-1",
  provider: "test",
  title: "Tum Se Hi",
  artistName: "Mohit Chauhan",
  albumTitle: "Jab We Met",
  durationMs: 321000,
}];

test("compact Music track rows expose one action rail and an icon-based overflow control", async () => {
  const user = userEvent.setup();
  const { container } = render(<MusicTrackList tracks={tracks} compact />);

  expect(container.querySelector(".music-track-list")).toHaveClass("is-compact");
  expect(container.querySelectorAll(".music-track-actions")).toHaveLength(1);

  const more = screen.getByRole("button", { name: "More actions for Tum Se Hi" });
  expect(more.querySelector(".music-track-more-icon")).not.toBeNull();
  expect(more.textContent).toBe("");
  expect(more).toHaveAttribute("aria-expanded", "false");

  await user.click(more);
  expect(more).toHaveAttribute("aria-expanded", "true");
  const menu = screen.getByRole("menu");
  expect(menu).toBeInTheDocument();
  expect(menu).toHaveClass("music-track-menu-portal");
  expect(menu.parentElement).toBe(document.body);
});
