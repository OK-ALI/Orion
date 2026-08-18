import { describe, expect, it } from "vitest";
import { storage, STORAGE_KEYS } from "../../../src/renderer/services/settingsStore";
import { persistPlaybackProgressDetails } from "../../../src/renderer/services/viewingStateVerification";

describe("P8.4 Candidate 2 Desktop verified progress snapshots", () => {
  it("marks only evidence-backed progress as portable-safe", () => {
    const unverified = persistPlaybackProgressDetails("movie_7", {
      currentTime: 20,
      duration: 100,
      percent: 20,
    }, { verified: false, now: 1_000 });
    expect(unverified.playbackVerified).not.toBe(true);

    const verified = persistPlaybackProgressDetails("movie_7", {
      currentTime: 30,
      duration: 100,
      percent: 30,
    }, { verified: true, now: 2_000 });
    expect(verified).toEqual(expect.objectContaining({
      currentTime: 30,
      playbackVerified: true,
      playbackVerifiedAt: 2_000,
      startedAt: 2_000,
    }));
  });

  it("does not let a later opened-or-seek-only sample overwrite the last verified snapshot", () => {
    persistPlaybackProgressDetails("movie_7", {
      currentTime: 30,
      duration: 100,
      percent: 30,
    }, { verified: true, now: 2_000 });

    const retained = persistPlaybackProgressDetails("movie_7", {
      currentTime: 80,
      duration: 100,
      percent: 80,
    }, { verified: false, now: 3_000 });

    expect(retained.currentTime).toBe(30);
    expect(storage.get(STORAGE_KEYS.PROGRESS_DETAILS).movie_7.currentTime).toBe(30);
  });

  it("does not create new portable-safe progress while history tracking is disabled", () => {
    storage.set(STORAGE_KEYS.HISTORY_ENABLED, 0);
    const result = persistPlaybackProgressDetails("movie_8", {
      currentTime: 25,
      duration: 100,
      percent: 25,
    }, { verified: true, now: 4_000 });
    expect(result.playbackVerified).not.toBe(true);
  });
});
