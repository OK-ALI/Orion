import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ tmdbFetch: vi.fn() }));
vi.mock("../../../src/renderer/services/tmdb", () => ({ tmdbFetch: mocks.tmdbFetch }));
import { useLibraryState } from "../../../src/renderer/app/hooks/useLibraryState";
import { storage, STORAGE_KEYS } from "../../../src/renderer/services/settingsStore";

describe("library privacy behavior", () => {
  beforeEach(() => mocks.tmdbFetch.mockReset());
  it("does not save progress while watch history is disabled", () => {
    storage.set(STORAGE_KEYS.HISTORY_ENABLED, 0);
    const { result } = renderHook(() =>
      useLibraryState({ librarySort: "manual", setToast: vi.fn() }),
    );

    act(() => result.current.saveProgress("movie_42", 50));

    expect(storage.get(STORAGE_KEYS.WATCH_PROGRESS)).toBeNull();
    expect(result.current.progress).toEqual({});
  });

  it("hides and restores saved history when the preference changes", () => {
    storage.set(STORAGE_KEYS.HISTORY, [{ id: 42, media_type: "movie" }]);
    storage.set(STORAGE_KEYS.WATCH_PROGRESS, { movie_42: 50 });
    const { result } = renderHook(() =>
      useLibraryState({ librarySort: "manual", setToast: vi.fn() }),
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent("orion:history-enabled-changed", { detail: false }),
      );
    });
    expect(result.current.history).toEqual([]);
    expect(result.current.progress).toEqual({});

    act(() => {
      window.dispatchEvent(
        new CustomEvent("orion:history-enabled-changed", { detail: true }),
      );
    });
    expect(result.current.history).toHaveLength(1);
    expect(result.current.progress.movie_42).toBe(50);
  });

  it("hydrates legacy saved records and persists repaired metadata", async () => {
    storage.set(STORAGE_KEYS.SAVED, { movie_42: { id: 42, media_type: "movie", title: "Legacy", year: "2020" } });
    mocks.tmdbFetch.mockResolvedValue({ id: 42, title: "Legacy", release_date: "2020-04-03", poster_path: "/poster", backdrop_path: "/backdrop", vote_average: 8.4 });
    const { result } = renderHook(() => useLibraryState({ librarySort: "manual", setToast: vi.fn(), apiKey: "token" }));
    await waitFor(() => expect(result.current.savedList[0]?.release_date).toBe("2020-04-03"));
    expect(mocks.tmdbFetch).toHaveBeenCalledWith("/movie/42", "token");
    expect(storage.get(STORAGE_KEYS.SAVED).movie_42).toEqual(expect.objectContaining({ poster_path: "/poster", vote_average: 8.4 }));
  });

  it("includes saved records missing from a stale order and applies numeric sorts", () => {
    storage.set(STORAGE_KEYS.SAVED, {
      movie_1: { id: 1, media_type: "movie", title: "Older", year: 1999, vote_average: 9 },
      movie_2: { id: 2, media_type: "movie", title: "Newer", year: "2025", vote_average: 7 },
    });
    storage.set(STORAGE_KEYS.SAVED_ORDER, ["movie_1"]);
    const { result } = renderHook(() => useLibraryState({ librarySort: "year", setToast: vi.fn() }));
    expect(result.current.savedList.map((item) => item.id)).toEqual([2, 1]);
  });
});
