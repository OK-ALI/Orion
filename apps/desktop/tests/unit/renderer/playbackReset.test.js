import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  STORAGE_KEYS,
  storage,
  requestPlaybackReset,
  hasPlaybackReset,
  clearPlaybackReset,
} from "../../../src/renderer/services/settingsStore";
import {
  BACKUP_KEYS,
  collectBackupData,
} from "../../../src/renderer/services/backup";
import { seekWebviewToPosition } from "../../../src/renderer/features/player/services/webviewLifecycle";
import { clearAllViewingState, resetViewingToNotStarted } from "../../../src/renderer/features/player/services/viewingReset";

describe("playback reset intent", () => {
  const originalElectron = window.electron;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(window, "electron", {
      configurable: true,
      writable: true,
      value: originalElectron,
    });
  });

  it("persists an exact-key reset until it is explicitly cleared", () => {
    requestPlaybackReset("movie_42");

    expect(hasPlaybackReset("movie_42")).toBe(true);
    expect(hasPlaybackReset("movie_43")).toBe(false);

    clearPlaybackReset("movie_42");
    expect(hasPlaybackReset("movie_42")).toBe(false);
    expect(storage.get(STORAGE_KEYS.PLAYBACK_RESET_PENDING)).toBeNull();
  });

  it("keeps independent reset requests isolated by viewing key", () => {
    requestPlaybackReset("movie_42");
    requestPlaybackReset("tv_7_s1e2");

    clearPlaybackReset("movie_42");

    expect(hasPlaybackReset("movie_42")).toBe(false);
    expect(hasPlaybackReset("tv_7_s1e2")).toBe(true);
  });



  it("clears all Orion viewing progress and requests one exact reset", () => {
    storage.set(STORAGE_KEYS.PROGRESS_DETAILS, {
      movie_42: { currentTime: 900, duration: 5400, percent: 16 },
      movie_99: { currentTime: 120, duration: 3600, percent: 3 },
    });
    storage.set("dlTime_movie_42", 900);
    const saveProgress = vi.fn();
    const markUnwatched = vi.fn();

    expect(
      resetViewingToNotStarted("movie_42", {
        saveProgress,
        markUnwatched,
      }),
    ).toBe(true);

    expect(saveProgress).toHaveBeenCalledWith("movie_42", null);
    expect(markUnwatched).toHaveBeenCalledWith("movie_42");
    expect(storage.get("dlTime_movie_42")).toBeNull();
    expect(storage.get(STORAGE_KEYS.PROGRESS_DETAILS)).toEqual({
      movie_99: { currentTime: 120, duration: 3600, percent: 3 },
    });
    expect(hasPlaybackReset("movie_42")).toBe(true);
  });


  it("clear-all viewing state removes progress details, dlTime keys, and pending reset markers", () => {
    storage.set(STORAGE_KEYS.WATCH_PROGRESS, { movie_42: 40 });
    storage.set(STORAGE_KEYS.PROGRESS_DETAILS, { movie_42: { currentTime: 900, duration: 5400 } });
    storage.set(STORAGE_KEYS.HISTORY, [{ id: 42, media_type: "movie" }]);
    storage.set(STORAGE_KEYS.WATCHED, { movie_42: true });
    storage.set(STORAGE_KEYS.SAVED, { movie_99: { id: 99 } });
    storage.set("dlTime_movie_42", 900);
    storage.set("dlTime_tv_7_s1e2", 300);
    requestPlaybackReset("movie_42");

    expect(clearAllViewingState()).toBe(true);

    expect(storage.get(STORAGE_KEYS.WATCH_PROGRESS)).toBeNull();
    expect(storage.get(STORAGE_KEYS.PROGRESS_DETAILS)).toBeNull();
    expect(storage.get(STORAGE_KEYS.HISTORY)).toBeNull();
    expect(storage.get(STORAGE_KEYS.WATCHED)).toBeNull();
    expect(storage.get(STORAGE_KEYS.PLAYBACK_RESET_PENDING)).toBeNull();
    expect(storage.get("dlTime_movie_42")).toBeNull();
    expect(storage.get("dlTime_tv_7_s1e2")).toBeNull();
    expect(storage.get(STORAGE_KEYS.SAVED)).toEqual({ movie_99: { id: 99 } });
  });

  it("keeps pending reset intent out of backup payloads", () => {
    requestPlaybackReset("movie_42");

    expect(BACKUP_KEYS).not.toContain(STORAGE_KEYS.PLAYBACK_RESET_PENDING);
    expect(collectBackupData()).not.toHaveProperty(STORAGE_KEYS.PLAYBACK_RESET_PENDING);
  });

  it("accepts an already-on-target video as verified without a redundant seek", async () => {
    const controlVideo = vi.fn();
    const queryVideoProgress = vi.fn().mockResolvedValue({
      currentTime: 0,
      duration: 5400,
      paused: true,
      recentUserSeek: false,
      lastUserSeekTo: null,
      lastPlaybackGestureAt: 0,
    });
    Object.defineProperty(window, "electron", {
      configurable: true,
      writable: true,
      value: { queryVideoProgress, controlVideo },
    });

    const webview = {
      isConnected: true,
      getWebContentsId: () => 17,
    };

    await expect(
      seekWebviewToPosition(webview, 0, {
        attempts: 1,
        delayMs: 0,
        stabilizeMs: 0,
      }),
    ).resolves.toBe(true);

    expect(controlVideo).not.toHaveBeenCalled();
  });
});
