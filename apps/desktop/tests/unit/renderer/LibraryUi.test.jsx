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
});
