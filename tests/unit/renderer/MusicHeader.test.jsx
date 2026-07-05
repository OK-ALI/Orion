import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const music = vi.hoisted(() => ({ current: { id: "one" }, lyrics: { status: "idle" }, loadLyrics: vi.fn() }));
vi.mock("../../../src/renderer/features/music/context/MusicProvider", () => ({ useMusic: () => music }));
import MusicHeader from "../../../src/renderer/features/music/components/MusicHeader";

describe("Music shell header", () => {
  it("routes search and settings and initializes lyrics on first open", () => {
    const onNavigate = vi.fn(); const onTogglePanel = vi.fn();
    render(<MusicHeader onNavigate={onNavigate} onTogglePanel={onTogglePanel} activePanel={null} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search Music Planet" }), { target: { value: "A living album" } });
    fireEvent.submit(screen.getByRole("search"));
    expect(onNavigate).toHaveBeenCalledWith("music-search", { query: "A living album" });
    fireEvent.click(screen.getByRole("button", { name: "Lyrics" }));
    expect(onTogglePanel).toHaveBeenCalledWith("lyrics");
    expect(music.loadLyrics).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Open Music appearance settings" }));
    expect(onNavigate).toHaveBeenCalledWith("settings", { section: "musicAppearance" });
  });
});
