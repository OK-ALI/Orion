import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DiscoverPage from "../../../src/renderer/features/discover/DiscoverPage";
import { storage, STORAGE_KEYS } from "../../../src/renderer/services/settingsStore";

const mocks = vi.hoisted(() => ({ tmdbFetch: vi.fn() }));
vi.mock("../../../src/renderer/services/tmdb", () => ({ tmdbFetch: mocks.tmdbFetch }));
vi.mock("../../../src/renderer/components/media/MediaCard", () => ({
  default: ({ item, onClick }) => <button onClick={() => onClick(item)}>{item.title}</button>,
}));
const story = { id: 42, title: "Previously loaded story", popularity: 10 };
const provider = { provider_id: 8, provider_name: "Netflix" };
const props = (connectionState = "online") => ({ apiKey: "fixture", connectionState, offline: connectionState === "offline", onNavigate: vi.fn(), onCheckConnection: vi.fn() });
const noFakeEmpty = () => expect(screen.queryByText(/No trending|No titles match|No matches/i)).not.toBeInTheDocument();
beforeEach(() => {
  storage.set(STORAGE_KEYS.DISCOVERY_REGION, "US");
  mocks.tmdbFetch.mockReset().mockImplementation((path) => Promise.resolve({
    results: path.includes("watch/providers") ? [provider] : [story], total_pages: 1,
  }));
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("Slice B Discover connection honesty", () => {
  it("offers keyboard reachable local pathways and recheck offline without fake empty catalog messages", () => {
    const model = props("offline");
    render(<DiscoverPage {...model} />);
    expect(screen.getByRole("status")).toHaveTextContent(/offline/i);
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    for (const [name, route] of [["Open Downloads", "downloads"], ["Open Library", "library"]]) {
      const button = screen.getByRole("button", { name });
      button.focus(); expect(button).toHaveFocus(); fireEvent.click(button);
      expect(model.onNavigate).toHaveBeenCalledWith(route);
    }
    fireEvent.click(screen.getByRole("button", { name: "Check connection" }));
    expect(model.onCheckConnection).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Hollywood" })); noFakeEmpty();
    fireEvent.click(screen.getByRole("button", { name: "Browse All" })); noFakeEmpty();
    expect(mocks.tmdbFetch).not.toHaveBeenCalled();
  });

  it.each(["checking", "reconnecting", "offline"])("reads the existing provider cache before the %s remote guard", (state) => {
    storage.set("watchProviderCatalog_US", { at: Date.now(), results: { movie: [provider], tv: [] } });
    render(<DiscoverPage {...props(state)} />);
    expect(screen.getByRole("button", { name: /Netflix.*Explore/ })).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent(/previously loaded/i);
    expect(mocks.tmdbFetch).not.toHaveBeenCalled(); noFakeEmpty();
  });

  it("labels even an empty retained provider catalog as previously loaded while offline", () => {
    storage.set("watchProviderCatalog_US", { at: Date.now() - 172_800_000, results: { movie: [], tv: [] } });
    render(<DiscoverPage {...props("offline")} />);
    expect(screen.getByRole("status")).toHaveTextContent(/previously loaded.*out of date/i);
    expect(screen.getByRole("button", { name: /Netflix.*Not listed/ })).toBeDisabled();
    expect(mocks.tmdbFetch).not.toHaveBeenCalled();
  });

  it.each(["checking", "reconnecting", "offline", "degraded"])("retains regional results during %s without calling them fresh", async (state) => {
    const model = props();
    const view = render(<DiscoverPage {...model} />);
    fireEvent.click(screen.getByRole("button", { name: "Hollywood" }));
    const card = await screen.findByRole("button", { name: story.title });
    view.rerender(<DiscoverPage {...model} connectionState={state} offline={state === "offline"} />);
    expect(screen.getByRole("button", { name: story.title })).toBe(card);
    expect(screen.getByRole("status")).toHaveTextContent(/previously loaded/i);
    if (state === "degraded") {
      expect(screen.getByRole("status")).toHaveTextContent(/service.*limited/i);
      expect(screen.getByRole("status")).not.toHaveTextContent(/offline/i);
    }
    noFakeEmpty();
  });

  it("retains genre results through connection changes and clears them for different filters", async () => {
    const model = props();
    const view = render(<DiscoverPage {...model} />);
    fireEvent.click(screen.getByText("Action", { exact: true }));
    expect(await screen.findByRole("button", { name: story.title })).toBeInTheDocument();
    for (const state of ["checking", "reconnecting", "offline"]) {
      view.rerender(<DiscoverPage {...model} connectionState={state} offline={state === "offline"} />);
      expect(screen.getByRole("button", { name: story.title })).toBeInTheDocument(); noFakeEmpty();
    }
    fireEvent.click(screen.getByRole("button", { name: "TV Shows" }));
    expect(screen.queryByRole("button", { name: story.title })).not.toBeInTheDocument(); noFakeEmpty();
  });

  it("keeps successful Online Discover hubs, genres and media navigation", async () => {
    const model = props();
    render(<DiscoverPage {...model} />);
    expect(screen.getByRole("heading", { name: "Discover" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Choose your orbit" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Browse by Genre" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: /Netflix.*Explore/ })).toBeEnabled());
    fireEvent.click(screen.getByText("Action", { exact: true }));
    fireEvent.click(await screen.findByRole("button", { name: story.title }));
    expect(model.onNavigate).toHaveBeenCalledWith("movie", expect.objectContaining({ id: 42, media_type: "movie" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("keeps a successful zero-result discovery distinct from request failure", async () => {
    mocks.tmdbFetch.mockResolvedValue({ results: [], total_pages: 1 });
    render(<DiscoverPage {...props()} />);
    fireEvent.click(screen.getByText("Action", { exact: true }));
    expect(await screen.findByText(/No titles match/)).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it.each(["region", "genre"])("does not pair a %s request failure with empty-catalog language and retries the same request", async (kind) => {
    mocks.tmdbFetch.mockImplementation((path) => path.includes("watch/providers") ? Promise.resolve({ results: [provider] }) : Promise.reject(new Error("fixture service failure")));
    render(<DiscoverPage {...props()} />);
    if (kind === "region") fireEvent.click(screen.getByRole("button", { name: "Hollywood" }));
    else fireEvent.click(screen.getByText("Action", { exact: true }));
    expect(await screen.findByRole("status")).not.toHaveTextContent(/offline/i); noFakeEmpty();
    mocks.tmdbFetch.mockResolvedValue({ results: [story], total_pages: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("button", { name: story.title })).toBeInTheDocument();
  });

  it("does not call unavailable provider metadata a regional absence", async () => {
    mocks.tmdbFetch.mockRejectedValue(new Error("fixture service failure"));
    render(<DiscoverPage {...props()} />);
    await screen.findByRole("status");
    expect(screen.getByRole("heading", { name: "Cinema discovery is limited" })).toBeInTheDocument();
    expect(screen.queryByText(/Not listed in/)).not.toBeInTheDocument();
    noFakeEmpty();
  });

  it("ignores a late discovery response when the filters change or transport goes offline", async () => {
    let resolveFirst;
    mocks.tmdbFetch.mockImplementation((path) => path.includes("watch/providers") ? Promise.resolve({ results: [provider] }) : new Promise((resolve) => { resolveFirst = resolve; }));
    const model = props();
    const view = render(<DiscoverPage {...model} />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Netflix.*Explore/ })).toBeEnabled());
    fireEvent.click(screen.getByText("Action", { exact: true }));
    await waitFor(() => expect(resolveFirst).toBeTypeOf("function"));
    view.rerender(<DiscoverPage {...model} connectionState="offline" offline />);
    await act(async () => resolveFirst({ results: [story], total_pages: 1 }));
    expect(screen.queryByRole("button", { name: story.title })).not.toBeInTheDocument(); noFakeEmpty();
  });
});

it("rehydrates the same Discover query after recovery, retaining existing cards during the check", async () => {
  const model = props("online");
  const view = render(<DiscoverPage {...model} />);
  fireEvent.click(screen.getByRole("button", { name: "Hollywood" }));
  await screen.findByText(story.title);
  view.rerender(<DiscoverPage {...model} connectionState="offline" offline />);
  const card = screen.getByText(story.title);
  view.rerender(<DiscoverPage {...model} connectionState="reconnecting" />);
  expect(screen.getByText(story.title)).toBe(card);
  mocks.tmdbFetch.mockClear();
  view.rerender(<DiscoverPage {...model} connectionState="online" />);
  await waitFor(() => expect(mocks.tmdbFetch).toHaveBeenCalled());
  expect(screen.getByText(story.title)).toBeInTheDocument();
});
