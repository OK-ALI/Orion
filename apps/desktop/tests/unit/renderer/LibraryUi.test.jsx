import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LibraryPage from "../../../src/renderer/features/library/LibraryPage";

vi.mock("../../../src/renderer/shared/utils/useRatings", () => ({
  useRatings: () => ({ ratingsMap: {}, ageLimitSetting: null }),
  getRatingForItem: () => ({ cert: null, minAge: null }),
}));

function renderLibrary(overrides = {}) {
  return render(<LibraryPage history={[]} inProgress={[]} saved={[]} progress={{}} watched={{}} downloads={[]} onSelect={() => {}} {...overrides} />);
}

describe("Library UI metadata and sorting", () => {
  it("shows a legacy saved year instead of N/A", () => {
    renderLibrary({ saved: [{ id: 1, media_type: "movie", title: "Legacy Film", year: "1998", poster_path: null }] });
    expect(screen.getByText("1998 · Movie")).toBeInTheDocument();
    expect(screen.queryByText(/N\/A/)).not.toBeInTheDocument();
  });

  it("broadcasts inline My List sorting to the app state", () => {
    const listener = vi.fn();
    window.addEventListener("orion:library-sort-changed", listener);
    renderLibrary({ saved: [{ id: 1, media_type: "movie", title: "Film", year: "1998" }] });
    fireEvent.change(screen.getByRole("combobox", { name: "Sort My List" }), { target: { value: "year" } });
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ detail: "year" }));
    window.removeEventListener("orion:library-sort-changed", listener);
  });


  it("filters My List by media type and watched state with live counts", () => {
    const saved = [
      { id: 1, media_type: "movie", title: "Watched Movie", year: "2024" },
      { id: 2, media_type: "movie", title: "Fresh Movie", year: "2023" },
      { id: 3, media_type: "tv", title: "Watched Series", year: "2022", seasons: [{ season_number: 1, episode_count: 1 }] },
      { id: 4, media_type: "tv", title: "Fresh Series", year: "2021", seasons: [{ season_number: 1, episode_count: 1 }] },
    ];

    renderLibrary({
      saved,
      watched: {
        movie_1: true,
        tv_3_s1e1: true,
      },
    });

    fireEvent.click(screen.getByRole("tab", { name: /My List/ }));

    expect(screen.getByRole("button", { name: "Movies, 2 titles" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "TV & Anime, 2 titles" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "All, 4 titles" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Unwatched, 2 titles" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Watched, 2 titles" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Movies, 2 titles" }));
    expect(screen.getByRole("button", { name: "All, 2 titles" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unwatched, 1 titles" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Watched, 1 titles" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Watched, 1 titles" }));
    expect(screen.getByText("Watched Movie")).toBeInTheDocument();
    expect(screen.queryByText("Fresh Movie")).not.toBeInTheDocument();
    expect(screen.queryByText("Watched Series")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Movies, 2 titles" }));
    expect(screen.getByRole("button", { name: "Watched, 2 titles" })).toBeInTheDocument();
    expect(screen.getByText("Watched Movie")).toBeInTheDocument();
    expect(screen.getByText("Watched Series")).toBeInTheDocument();
  });

  it("keeps a partially watched series in the Unwatched title filter", () => {
    renderLibrary({
      saved: [{
        id: 7,
        media_type: "tv",
        title: "Partial Series",
        year: "2024",
        seasons: [{ season_number: 1, episode_count: 2 }],
      }],
      watched: {
        tv_7_s1e1: true,
      },
    });

    fireEvent.click(screen.getByRole("tab", { name: /My List/ }));

    expect(screen.getByRole("button", { name: "Unwatched, 1 titles" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Watched, 0 titles" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Watched, 0 titles" }));
    expect(screen.getByText("No watched titles match these filters")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Unwatched, 1 titles" }));
    expect(screen.getByText("Partial Series")).toBeInTheDocument();
  });

  it("composes library search with My List filters and counts", () => {
    renderLibrary({
      saved: [
        { id: 11, media_type: "movie", title: "Alpha Movie", year: "2024" },
        { id: 12, media_type: "tv", title: "Alpha Series", year: "2024", seasons: [{ season_number: 1, episode_count: 1 }] },
        { id: 13, media_type: "movie", title: "Beta Movie", year: "2024" },
      ],
      watched: {
        tv_12_s1e1: true,
      },
    });

    fireEvent.click(screen.getByRole("tab", { name: /My List/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "Search your library" }), {
      target: { value: "Alpha" },
    });

    expect(screen.getByRole("button", { name: "Movies, 1 titles" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "TV & Anime, 1 titles" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All, 2 titles" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "TV & Anime, 1 titles" }));
    expect(screen.getByRole("button", { name: "Watched, 1 titles" })).toBeInTheDocument();
    expect(screen.getByText("Alpha Series")).toBeInTheDocument();
    expect(screen.queryByText("Alpha Movie")).not.toBeInTheDocument();
    expect(screen.queryByText("Beta Movie")).not.toBeInTheDocument();
  });

});
