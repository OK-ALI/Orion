import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SearchModal from "../../../src/renderer/components/modals/SearchModal";
import SearchResultsPage from "../../../src/renderer/features/discover/SearchResultsPage";
const mocks = vi.hoisted(() => ({ searchTmdb: vi.fn() }));
vi.mock("../../../src/renderer/services/search", async (original) => ({ ...await original(), searchTmdb: mocks.searchTmdb }));
const response = (title) => ({ page: 1, totalPages: 1, results: title ? [{ id: title, title, media_type: "movie" }] : [] });
const props = (offline = false) => ({ isOpen: true, apiKey: "fixture", offline, onSelect: vi.fn(), onViewAll: vi.fn(), onClose: vi.fn(), onNavigate: vi.fn() });
const type = (value) => fireEvent.change(screen.getByPlaceholderText(/Search movies, series and people/), { target: { value } });
const settle = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(450); }); };
beforeEach(() => { vi.useFakeTimers(); mocks.searchTmdb.mockReset().mockResolvedValue(response()); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe("Slice B Cinema Quick Search", () => {
  it.each(["offline", "error", "debounce", "loading"])("blocks the Enter fallback and visible View All while Cinema is %s", async (state) => {
    if (state === "error") mocks.searchTmdb.mockRejectedValue(new Error("fixture service failure"));
    if (state === "loading") mocks.searchTmdb.mockImplementation(() => new Promise(() => {}));
    const model = props(state === "offline");
    render(<SearchModal {...model} />);
    type("pending cinema query");
    if (state !== "debounce") await settle();
    const notice = state === "offline" || state === "error" ? screen.getByRole("status") : null;
    expect(screen.queryByRole("button", { name: /View all results for/ })).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByPlaceholderText(/Search movies, series and people/), { key: "Enter" });
    expect(model.onViewAll).not.toHaveBeenCalled();
    expect(model.onNavigate).not.toHaveBeenCalled();
    expect(model.onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Cinema quick search" })).toBeInTheDocument();
    if (notice) {
      expect(screen.getByRole("status")).toBe(notice);
      expect(notice).toHaveTextContent(state === "offline" ? /offline/i : /search.*unavailable/i);
    }
  });

  it.each(["Enter", "click"])("preserves View All via %s after a successful empty Cinema response", async (action) => {
    const model = props();
    render(<SearchModal {...model} />); type("resolved empty"); await settle();
    expect(screen.getByText(/No results for/)).toBeInTheDocument();
    const viewAll = screen.getByRole("button", { name: /View all results for/ });
    expect(viewAll).toBeEnabled();
    if (action === "Enter") fireEvent.keyDown(screen.getByPlaceholderText(/Search movies, series and people/), { key: "Enter" });
    else fireEvent.click(viewAll);
    expect(model.onViewAll).toHaveBeenCalledExactlyOnceWith("resolved empty");
    expect(model.onClose).toHaveBeenCalledOnce();
    expect(model.onSelect).not.toHaveBeenCalled();
  });

  it("shows offline search truth with explicit local routes and never remote empty results", async () => {
    const model = props(true);
    render(<SearchModal {...model} />); type("Local Story"); await settle();
    expect(screen.getByRole("status")).toHaveTextContent(/offline/i);
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.queryByText(/No results|No matching/)).not.toBeInTheDocument();
    expect(mocks.searchTmdb).not.toHaveBeenCalled();
    for (const [name, route] of [["Open Downloads", "downloads"], ["Open Library", "library"]]) {
      const button = screen.getByRole("button", { name }); button.focus(); expect(button).toHaveFocus(); fireEvent.click(button);
      expect(model.onNavigate).toHaveBeenCalledWith(route);
    }
    expect(model.onClose).toHaveBeenCalledTimes(2);
  });
  it("separates online service failure from successful empty results without claiming global offline", async () => {
    mocks.searchTmdb.mockRejectedValue(new Error("provider failure"));
    render(<SearchModal {...props()} />); type("film"); await settle();
    expect(screen.getByRole("status")).toHaveTextContent(/search.*unavailable/i);
    expect(screen.getByRole("status")).not.toHaveTextContent(/offline|No internet/i);
    expect(screen.queryByText(/No results/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Downloads" })).toBeEnabled();
  });
  it("shows no empty results during debounce, then shows a legitimate successful zero response", async () => {
    render(<SearchModal {...props()} />); type("empty");
    expect(screen.queryByText(/No results/)).not.toBeInTheDocument();
    await settle(); expect(screen.getByText(/No results for/)).toHaveTextContent("empty");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
  it("treats missing metadata credentials as unavailable, not a successful search", async () => {
    render(<SearchModal {...props()} apiKey={null} />); type("film"); await settle();
    expect(screen.getByRole("status")).toHaveTextContent(/unavailable/i);
    expect(screen.queryByText(/No results/)).not.toBeInTheDocument();
    expect(mocks.searchTmdb).not.toHaveBeenCalled();
  });
  it("ignores out-of-order responses and preserves arrow, Enter and Escape behavior", async () => {
    const pending = {};
    mocks.searchTmdb.mockImplementation((query) => new Promise((resolve) => { pending[query] = resolve; }));
    const model = props(); render(<SearchModal {...model} />);
    type("first"); await settle(); type("second"); await settle();
    await act(async () => pending.second(response("Current Story")));
    await act(async () => pending.first(response("Stale Story")));
    expect(screen.queryByText("Stale Story")).not.toBeInTheDocument();
    const input = screen.getByPlaceholderText(/Search movies, series and people/);
    fireEvent.keyDown(input, { key: "ArrowDown" }); fireEvent.keyDown(input, { key: "Enter" });
    expect(model.onSelect).toHaveBeenCalledWith(expect.objectContaining({ title: "Current Story" }));
    expect(model.onViewAll).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Escape" }); expect(model.onClose).toHaveBeenCalledTimes(2);
  });
  it("invalidates pending searches when transport becomes offline", async () => {
    let resolve;
    mocks.searchTmdb.mockImplementation(() => new Promise((done) => { resolve = done; }));
    const model = props(); const view = render(<SearchModal {...model} />);
    type("pending"); await settle(); view.rerender(<SearchModal {...model} offline />);
    await act(async () => resolve(response("Late remote story")));
    expect(screen.queryByText("Late remote story")).not.toBeInTheDocument();
    expect(screen.queryByText(/No results/)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/offline/i);
  });
  it("invalidates an in-flight query when Quick Search closes", async () => {
    let resolve;
    mocks.searchTmdb.mockImplementation(() => new Promise((done) => { resolve = done; }));
    const model = props(); const view = render(<SearchModal {...model} />);
    type("pending"); await settle(); view.rerender(<SearchModal {...model} isOpen={false} />);
    await act(async () => resolve(response("Closed query")));
    expect(screen.queryByText("Closed query")).not.toBeInTheDocument();
  });
});

describe("Music Quick Search keyboard preservation", () => {
  it.each(["loading", "error", "empty"])("keeps the existing Music Enter fallback for %s independently of Cinema availability", async (state) => {
    window.electron = { musicSearch: vi.fn() };
    if (state === "loading") window.electron.musicSearch.mockImplementation(() => new Promise(() => {}));
    else if (state === "error") window.electron.musicSearch.mockRejectedValue(new Error("fixture music service failure"));
    else window.electron.musicSearch.mockResolvedValue({ results: [], errors: [] });
    const model = props(true);
    render(<SearchModal {...model} searchWorld="music" />);
    const input = screen.getByPlaceholderText(/Search tracks, artists and albums/);
    fireEvent.change(input, { target: { value: "music query" } }); await settle();
    const viewAll = screen.queryByRole("button", { name: /View all Music results for/ });
    if (state === "empty") expect(viewAll).toBeEnabled();
    else expect(viewAll).not.toBeInTheDocument();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(model.onViewAll).toHaveBeenCalledExactlyOnceWith("music query");
    expect(model.onClose).toHaveBeenCalledOnce();
    expect(mocks.searchTmdb).not.toHaveBeenCalled();
  });
});

describe("Slice B full SearchResultsPage preservation", () => {
  it("keeps service error separate from empty results and retries successfully", async () => {
    mocks.searchTmdb.mockRejectedValueOnce(new Error("provider failure")).mockResolvedValueOnce(response());
    render(<SearchResultsPage apiKey="fixture" item="film" isActive onNavigate={vi.fn()} />); await settle();
    expect(screen.getByText(/Search is temporarily unavailable/)).toBeInTheDocument();
    expect(screen.queryByText(/No .*results found/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" })); await settle();
    expect(screen.getByText(/No results found/)).toBeInTheDocument();
  });
  it("keeps the newer query when an old full-search request fails late", async () => {
    let rejectFirst;
    mocks.searchTmdb.mockImplementation((query) => query === "first" ? new Promise((_, reject) => { rejectFirst = reject; }) : Promise.resolve(response("Current Story")));
    const view = render(<SearchResultsPage apiKey="fixture" item="first" isActive onNavigate={vi.fn()} />); await settle();
    view.rerender(<SearchResultsPage apiKey="fixture" item="second" isActive onNavigate={vi.fn()} />); await settle();
    await act(async () => rejectFirst(new Error("late failure")));
    expect(screen.getByText("Current Story")).toBeInTheDocument();
    expect(screen.queryByText(/Search is temporarily unavailable/)).not.toBeInTheDocument();
  });
});
