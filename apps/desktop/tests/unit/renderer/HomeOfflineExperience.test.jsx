import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "../../../src/renderer/features/home/HomePage";
import AppRoutes from "../../../src/renderer/app/AppRoutes";

const mocks = vi.hoisted(() => ({ tmdbFetch: vi.fn() }));
vi.mock("../../../src/renderer/services/tmdb", async (importOriginal) => ({
  ...await importOriginal(),
  tmdbFetch: mocks.tmdbFetch,
}));
vi.mock("../../../src/renderer/shared/utils/useRatings", () => ({
  useRatings: () => ({ ratingsMap: {}, ageLimitSetting: null }),
  getRatingForItem: () => ({ cert: null, minAge: null }),
}));
vi.mock("../../../src/renderer/components/media/HeroBanner", () => ({
  default: ({ items, onSelect }) => <section aria-label="Spotlight"><button onClick={() => onSelect(items[0])}>{items[0].title}</button></section>,
}));
vi.mock("../../../src/renderer/components/media/MediaCarousel", () => ({
  default: ({ title, titleHighlight, items }) => <section aria-label={title + " " + titleHighlight}><h2>{title} {titleHighlight}</h2>{items.map((item) => <span key={item.id}>{item.title || item.name}</span>)}</section>,
}));

const movie = { id: 42, media_type: "movie", title: "Local Story", release_date: "2020-01-01" };
const episode = { id: 7, media_type: "tv", title: "Local Series", season: 2, episode: 3 };
const localMovie = { id: "movie-download", tmdbId: 42, mediaType: "movie", name: "Local Story", status: "completed", filePath: "C:\\Orion\\Local Story.mp4" };
const localEpisode = { id: "episode-download", tmdbId: 7, mediaType: "tv", season: 2, episode: 3, name: "Local Series", status: "completed", filePath: "C:\\Orion\\Series-S2E3.mp4" };

function homeProps(overrides = {}) {
  return {
    trending: [], trendingTV: [], loading: true, offline: true, connectionState: "offline",
    inProgress: [movie, episode], progress: { movie_42: 40, tv_7_s2e3: 60 },
    history: [], saved: [], watched: {}, downloads: [localMovie, localEpisode],
    onSelect: vi.fn(), onNavigate: vi.fn(), onRetry: vi.fn(), onCheckConnection: vi.fn(),
    onPlayLocal: vi.fn(), ...overrides,
  };
}

beforeEach(() => mocks.tmdbFetch.mockReset().mockResolvedValue({ results: [] }));

describe("P10A.3 Slice A Home local continuity", () => {
  it("keeps useful actions and local Continue Watching on offline Home", () => {
    render(<HomePage {...homeProps()} />);
    expect(screen.getByRole("status")).toHaveTextContent(/you're offline/i);
    expect(screen.getByRole("button", { name: "Open Downloads" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Open Library" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Check connection" })).toBeEnabled();
    expect(screen.getByRole("heading", { name: "Continue Watching" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /resume local story locally/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /resume local series.*s2.*e3.*locally/i })).toBeEnabled();
    expect(screen.getByText("40% watched")).toBeInTheDocument();
    expect(screen.getByText(/60% watched/)).toBeInTheDocument();
  });

  it("places the acknowledgement and local Continue Watching in the same Home content column", () => {
    const { container } = render(<HomePage {...homeProps()} />);
    const column = container.querySelector(".home-local-continuity > .homepage-content");
    const acknowledgement = screen.getByRole("region", { name: "Your local Orion is still available." });
    const continuation = screen.getByRole("region", { name: "Continue Watching" });
    expect(column).toBeInTheDocument();
    expect(acknowledgement.parentElement).toBe(column);
    expect(continuation.parentElement).toBe(column);
    expect([...column.children]).toEqual([acknowledgement, continuation]);
    expect(within(acknowledgement).getByRole("button", { name: "Check connection" })).toBeEnabled();
    expect(within(continuation).getByRole("button", { name: /resume local story locally/i })).toBeEnabled();
  });

  it("remains useful without local content and never shows remote skeletons or fake catalog emptiness", () => {
    const { container } = render(<HomePage {...homeProps({ inProgress: [], downloads: [] })} />);
    expect(screen.getByRole("status")).toHaveTextContent(/local Orion/i);
    expect(screen.getByRole("button", { name: "Open Downloads" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Open Library" })).toBeEnabled();
    expect(screen.queryByRole("heading", { name: "Continue Watching" })).not.toBeInTheDocument();
    expect(screen.queryByText(/no results|no titles|nothing to watch/i)).not.toBeInTheDocument();
    expect(container.querySelector(".skeleton")).toBeNull();
  });

  it.each(["checking", "reconnecting", "degraded"])("keeps local content and actions while %s", (connectionState) => {
    const { container } = render(<HomePage {...homeProps({ connectionState, offline: false })} />);
    expect(screen.getByRole("button", { name: /resume local story locally/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Open Downloads" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Open Library" })).toBeEnabled();
    expect(screen.queryByText(/you're offline/i)).not.toBeInTheDocument();
    expect(container.querySelector(".skeleton")).toBeNull();
    if (connectionState === "degraded") expect(screen.getByRole("status")).toHaveTextContent(/service.*limited/i);
  });

  it("preserves the local control and keyboard focus across unresolved connection transitions", () => {
    const props = homeProps();
    const { rerender } = render(<HomePage {...props} />);
    const resume = screen.getByRole("button", { name: /resume local story locally/i });
    resume.focus();
    for (const connectionState of ["checking", "reconnecting", "degraded", "offline"]) {
      rerender(<HomePage {...props} connectionState={connectionState} offline={connectionState === "offline"} />);
      expect(screen.getByRole("button", { name: /resume local story locally/i })).toBe(resume);
      expect(resume).toHaveFocus();
    }
  });

  it("does not replace existing local content with an online remote-loading skeleton", () => {
    const { container } = render(<HomePage {...homeProps({ connectionState: "online", offline: false })} />);
    expect(screen.getByRole("button", { name: /resume local story locally/i })).toBeEnabled();
    expect(container.querySelector(".skeleton")).toBeNull();
  });

  it("excludes cloud-only, missing and unrelated episode records from local actions", () => {
    render(<HomePage {...homeProps({ downloads: [
      { ...localMovie, filePath: null, driveFileId: "cloud" },
      { ...localEpisode, episode: 4 },
      { ...localEpisode, id: "missing", status: "missing" },
    ] })} />);
    expect(screen.queryByRole("heading", { name: "Continue Watching" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /resume.*locally/i })).not.toBeInTheDocument();
  });

  it("launches the exact local record without routing through remote title details", () => {
    const props = homeProps();
    render(<HomePage {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /resume local story locally/i }));
    expect(props.onPlayLocal).toHaveBeenCalledExactlyOnceWith(localMovie);
    expect(props.onSelect).not.toHaveBeenCalled();
    expect(props.onNavigate).not.toHaveBeenCalled();
    expect(mocks.tmdbFetch).not.toHaveBeenCalled();
  });

  it("uses the safe Downloads route when no local-player callback is supplied", () => {
    const props = homeProps({ onPlayLocal: undefined });
    render(<HomePage {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /resume local story locally/i }));
    expect(props.onNavigate).toHaveBeenCalledExactlyOnceWith("downloads");
    expect(props.onSelect).not.toHaveBeenCalled();
  });

  it("wires route actions to the existing navigation and connection owners", async () => {
    const props = homeProps();
    const network = { productState: "offline", recheck: vi.fn() };
    render(<AppRoutes model={{
      page: "home", trending: [], trendingTV: [], loadingHome: true, offline: true,
      inProgress: props.inProgress, progress: props.progress, downloads: props.downloads,
      history: [], savedList: [], watched: {},
      homeConnectionState: network.productState, onCheckHomeConnection: network.recheck,
      onPlayHomeLocal: props.onPlayLocal, navigate: props.onNavigate,
      retryHome: props.onRetry, handleSelectResult: props.onSelect,
    }} />);
    fireEvent.click(await screen.findByRole("button", { name: "Open Downloads" }));
    fireEvent.click(screen.getByRole("button", { name: "Open Library" }));
    fireEvent.click(screen.getByRole("button", { name: "Check connection" }));
    fireEvent.click(screen.getByRole("button", { name: /resume local story locally/i }));
    expect(props.onNavigate.mock.calls).toEqual([["downloads"], ["library"]]);
    expect(network.recheck).toHaveBeenCalledExactlyOnceWith();
    expect(props.onRetry).not.toHaveBeenCalled();
    expect(props.onPlayLocal).toHaveBeenCalledExactlyOnceWith(localMovie);
  });

  it("preserves the loaded Online Home hierarchy, remote requests and selection behavior", () => {
    const props = homeProps({
      offline: false, connectionState: "online", loading: false, apiKey: "test-token",
      trending: [{ id: 100, title: "Trending Movie" }],
      trendingTV: [{ id: 101, name: "Trending Series" }],
      saved: [{ id: 102, title: "Saved Movie", media_type: "movie" }],
    });
    const { container } = render(<HomePage {...props} />);
    expect(container.firstChild).toHaveClass("fade-in", "homepage-container");
    expect(container.querySelector(".home-local-continuity")).toBeNull();
    expect(screen.getByRole("region", { name: "Spotlight" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent))
      .toEqual(["Continue Watching", "My List", "Trending Movies", "Trending TV Shows"]);
    fireEvent.click(screen.getByRole("button", { name: "Open Local Story" }));
    expect(props.onSelect).toHaveBeenCalledWith(movie);
    expect(props.onPlayLocal).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("region", { name: "Spotlight" })).getByRole("button"));
    expect(props.onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ id: 100, media_type: "movie" }));
    expect(mocks.tmdbFetch.mock.calls.map(([path]) => path)).toEqual(expect.arrayContaining([
      "/movie/top_rated?page=1", "/tv/top_rated?page=1",
    ]));
  });
});

it("refreshes remote Home rows after a degraded recovery while keeping local continuity mounted", async () => {
  const { act } = await import("@testing-library/react");
  const props = homeProps({ apiKey: "fixture", offline: false, connectionState: "degraded", recoveryEpoch: 0 });
  const view = render(<HomePage {...props} />);
  await act(async () => {});
  const resume = screen.getByRole("button", { name: /resume local story locally/i });
  mocks.tmdbFetch.mockClear();
  view.rerender(<HomePage {...props} connectionState="checking" />);
  await act(async () => {});
  expect(mocks.tmdbFetch).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: /resume local story locally/i })).toBe(resume);
  view.rerender(<HomePage {...props} connectionState="online" recoveryEpoch={1} />);
  await act(async () => {});
  expect(mocks.tmdbFetch).toHaveBeenCalledWith("/movie/top_rated?page=1", "fixture", expect.anything());
  expect(screen.getByRole("button", { name: /resume local story locally/i })).toBe(resume);
});
