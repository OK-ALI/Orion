import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useLibraryState } from "../../../src/renderer/app/hooks/useLibraryState";
import { storage, STORAGE_KEYS } from "../../../src/renderer/services/settingsStore";

describe("Phase 8 Count Truth Continue Watching parity", () => {
  it("uses verified portable playback truth and keeps only the latest resumable episode per series", () => {
    storage.set(STORAGE_KEYS.HISTORY_ENABLED, 1);
    storage.set(STORAGE_KEYS.HISTORY, [
      { id: 1, title: "Eligible", media_type: "movie" },
      { id: 2, title: "Too complete", media_type: "movie" },
      { id: 3, title: "Too soon", media_type: "movie" },
      { id: 4, title: "Unverified", media_type: "movie" },
      { id: 5, title: "Watched", media_type: "movie" },
      { id: 6, title: "Unknown duration", media_type: "movie" },
      {
        id: 7,
        title: "Series",
        name: "Series",
        media_type: "tv",
        season: 1,
        episode: 1,
        episodeName: "Older",
      },
      {
        id: 7,
        title: "Series",
        name: "Series",
        media_type: "tv",
        season: 1,
        episode: 2,
        episodeName: "Latest",
      },
    ]);
    storage.set(STORAGE_KEYS.WATCH_PROGRESS, {
      movie_1: 50,
      movie_2: 94,
      movie_3: 10,
      movie_4: 50,
      movie_5: 50,
      movie_6: 0,
      tv_7_s1e1: 50,
      tv_7_s1e2: 60,
    });
    storage.set(STORAGE_KEYS.WATCHED, {
      movie_5: true,
    });
    storage.set(STORAGE_KEYS.PROGRESS_DETAILS, {
      movie_1: {
        currentTime: 120,
        duration: 240,
        percent: 50,
        updatedAt: 1001,
        playbackVerified: true,
        playbackVerifiedAt: 1001,
        startedAt: 1001,
      },
      movie_2: {
        currentTime: 94,
        duration: 100,
        percent: 94,
        updatedAt: 1002,
        playbackVerified: true,
        playbackVerifiedAt: 1002,
        startedAt: 1002,
      },
      movie_3: {
        currentTime: 10,
        duration: 100,
        percent: 10,
        updatedAt: 1003,
        playbackVerified: true,
        playbackVerifiedAt: 1003,
        startedAt: 1003,
      },
      movie_4: {
        currentTime: 50,
        duration: 100,
        percent: 50,
        updatedAt: 1004,
      },
      movie_5: {
        currentTime: 50,
        duration: 100,
        percent: 50,
        updatedAt: 1005,
        playbackVerified: true,
        playbackVerifiedAt: 1005,
        startedAt: 1005,
      },
      movie_6: {
        currentTime: 45,
        duration: 0,
        percent: null,
        updatedAt: 1006,
        playbackVerified: true,
        playbackVerifiedAt: 1006,
        startedAt: 1006,
      },
      tv_7_s1e1: {
        currentTime: 50,
        duration: 100,
        percent: 50,
        updatedAt: 2000,
        playbackVerified: true,
        playbackVerifiedAt: 2000,
        startedAt: 2000,
      },
      tv_7_s1e2: {
        currentTime: 60,
        duration: 100,
        percent: 60,
        updatedAt: 3000,
        playbackVerified: true,
        playbackVerifiedAt: 3000,
        startedAt: 3000,
      },
    });

    const { result } = renderHook(() =>
      useLibraryState({
        librarySort: "manual",
        setToast: () => {},
        apiKey: null,
      }),
    );

    expect(result.current.inProgress.map((item) => item._pk)).toEqual([
      "tv_7_s1e2",
      "movie_6",
      "movie_1",
    ]);
    expect(result.current.inProgress.some((item) => item._pk === "tv_7_s1e1")).toBe(false);
  });
});
