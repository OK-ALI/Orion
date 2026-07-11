import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import MusicHeader from "../../../src/renderer/features/music/components/MusicHeader";

describe("Music shell header", () => {
  it("routes search and settings from the uncluttered Music header", () => {
    const onNavigate = vi.fn();
    render(<MusicHeader onNavigate={onNavigate} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search Music Planet" }), { target: { value: "A living album" } });
    fireEvent.submit(screen.getByRole("search"));
    expect(onNavigate).toHaveBeenCalledWith("music-search", { query: "A living album" });
    expect(screen.queryByRole("button", { name: "Lyrics" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open Music settings" }));
    expect(onNavigate).toHaveBeenCalledWith("music-settings");
  });
});
