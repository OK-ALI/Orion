import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ tmdbFetch: vi.fn(), searchTmdb: vi.fn() }));
vi.mock("../../../src/renderer/services/tmdb", () => ({
  imgUrl: (path) => path ? `https://images.test${path}` : null,
  isAnimeContent: () => false,
  tmdbFetch: mocks.tmdbFetch,
}));
vi.mock("../../../src/renderer/services/search", async (importOriginal) => ({
  ...(await importOriginal()),
  searchTmdb: mocks.searchTmdb,
}));

import SearchResultsPage from "../../../src/renderer/features/discover/SearchResultsPage";
import PersonPage from "../../../src/renderer/features/people/PersonPage";
import SearchModal from "../../../src/renderer/components/modals/SearchModal";
import CreditsSection from "../../../src/renderer/components/media/CreditsSection";

describe("v1.1 people UI", () => {
  beforeEach(() => { mocks.tmdbFetch.mockReset(); mocks.searchTmdb.mockReset(); });

  it("loads a person profile and navigable normalized filmography", async () => {
    mocks.tmdbFetch.mockImplementation((path) => path.includes("combined_credits")
      ? Promise.resolve({ cast: [{ id: 20, media_type: "movie", title: "A Film", release_date: "2025-01-01", character: "Lead" }], crew: [] })
      : Promise.resolve({ id: 10, name: "Jane Example", biography: "A detailed biography.", birthday: "1990-01-01", place_of_birth: "Example City", known_for_department: "Acting" }));
    const onNavigate = vi.fn();
    render(<PersonPage item={{ id: 10, name: "Jane Example", media_type: "person" }} apiKey="token" onNavigate={onNavigate} onBack={() => {}} />);
    expect(await screen.findByRole("heading", { name: "Jane Example" })).toBeInTheDocument();
    expect(screen.getByText("A detailed biography.")).toBeInTheDocument();
    const filmographyButton = screen.getByRole("button", { name: /2025.*A Film.*Lead.*Movie/i });
    fireEvent.click(filmographyButton);
    expect(onNavigate).toHaveBeenCalledWith("movie", expect.objectContaining({ id: 20, roles: ["Lead"] }));
  });

  it("filters people and explicitly appends another search page", async () => {
    mocks.searchTmdb.mockImplementation((_query, page) => Promise.resolve(page === 1 ? {
      page: 1, totalPages: 2,
      results: [{ id: 10, media_type: "person", name: "Jane Example", profile_path: null, known_for: [] }, { id: 20, media_type: "movie", title: "A Film" }],
    } : {
      page: 2, totalPages: 2,
      results: [{ id: 11, media_type: "person", name: "John Example", profile_path: null, known_for: [] }],
    }));
    const onNavigate = vi.fn();
    render(<SearchResultsPage apiKey="token" item="example" onNavigate={onNavigate} isActive />);
    expect(await screen.findByText("Jane Example")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("button", { name: "Open A Film" }), { key: "Enter" });
    expect(onNavigate).toHaveBeenCalledWith("movie", expect.objectContaining({ id: 20 }));
    fireEvent.click(screen.getByRole("tab", { name: /People \(1\)/ }));
    expect(screen.queryByText("A Film")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(screen.getByText("John Example")).toBeInTheDocument());
    expect(mocks.searchTmdb).toHaveBeenLastCalledWith("example", 2, "token");
  });

  it("opens the complete results page from capped quick search", async () => {
    mocks.searchTmdb.mockResolvedValue({
      page: 1,
      totalPages: 2,
      results: [{ id: 10, media_type: "person", name: "Jane Example", known_for: [] }],
    });
    const onViewAll = vi.fn();
    render(<SearchModal isOpen apiKey="token" onSelect={() => {}} onViewAll={onViewAll} onClose={() => {}} offline={false} />);
    fireEvent.change(screen.getByPlaceholderText(/Search movies, series and people/), { target: { value: "example" } });
    fireEvent.click(await screen.findByRole("button", { name: /View all results for/ }));
    expect(onViewAll).toHaveBeenCalledWith("example");
  });

  it("offers retry when both person requests fail", async () => {
    mocks.tmdbFetch.mockRejectedValue(new Error("offline"));
    render(<PersonPage item={{ id: 10, name: "Jane Example", media_type: "person" }} apiKey="token" onNavigate={() => {}} onBack={() => {}} />);
    expect(await screen.findByRole("heading", { name: "Person unavailable" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("opens cast and key-crew people from title pages", () => {
    const onPersonSelect = vi.fn();
    render(<CreditsSection cast={[{ id: 1, media_type: "person", name: "Actor One", character: "Hero" }]} keyCrew={[{ id: 2, media_type: "person", name: "Director Two", job: "Director" }]} onPersonSelect={onPersonSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Actor One" }));
    fireEvent.click(screen.getByRole("button", { name: /Director Two/ }));
    expect(onPersonSelect).toHaveBeenNthCalledWith(1, expect.objectContaining({ id: 1 }));
    expect(onPersonSelect).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: 2 }));
  });
});
