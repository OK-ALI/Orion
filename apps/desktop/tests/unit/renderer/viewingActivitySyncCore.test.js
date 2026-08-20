import { describe, expect, it } from "vitest";
import {
  buildPortableViewingActivityStateFromProfileV1,
  buildPortableViewingActivitySteadyStateProfileV1,
  createPortableProfileV3,
  mergePortableViewingActivityRecordsV1,
} from "@orion/shared/types";
import { buildLocalDesktopViewingActivitySnapshotV1 } from "../../../src/renderer/features/library/viewingStatePortableAdapter";

function historyValue(id, lastPlayedAt) {
  return {
    schemaVersion: 1,
    media: { mediaType: "movie", id, season: null, episode: null, title: `Movie ${id}`, year: 2026 },
    presentation: { posterPath: null, backdropPath: null, seriesTitle: null, episodeTitle: null },
    lastPlayedAt,
    verified: true,
  };
}

function progressValue(id, lastPlayedAt, currentTime = 40) {
  return {
    schemaVersion: 1,
    media: { mediaType: "movie", id, season: null, episode: null, title: `Movie ${id}`, year: 2026 },
    presentation: { posterPath: null, backdropPath: null, seriesTitle: null, episodeTitle: null },
    currentTime,
    duration: 100,
    percent: currentTime,
    startedAt: lastPlayedAt - 100,
    lastPlayedAt,
    verified: true,
  };
}

function preview(history = {}, progress = {}) {
  return { history, progress, rejected: { history: [], progress: [] } };
}

describe("V3-P8-006A Candidate 1 viewing activity core", () => {
  it("creates record revisions/tombstones while preserving unrelated namespaces", () => {
    const base = createPortableProfileV3("account-a", 1000);
    base.namespaces.futureNamespace = { keep: "me" };
    const first = buildPortableViewingActivitySteadyStateProfileV1(
      base,
      preview({ movie_7: historyValue(7, 1100) }, { movie_7: progressValue(7, 1100) }),
      { profileId: "account-a", updatedBy: "desktop-a", now: 1200 },
    );
    expect(first.namespaces.futureNamespace).toEqual({ keep: "me" });
    expect(first.namespaces.history.records.movie_7.revision).toBe(1);

    const removed = buildPortableViewingActivitySteadyStateProfileV1(
      first,
      preview(),
      { profileId: "account-a", updatedBy: "desktop-a", now: 1300 },
    );
    expect(removed.namespaces.history.records.movie_7).toMatchObject({ deletedAt: 1300, value: null, revision: 2 });
    expect(removed.namespaces.progress.records.movie_7).toMatchObject({ deletedAt: 1300, value: null, revision: 2 });
  });

  it("lets later verified playback win offline and fails safe on an exact-time timing conflict", () => {
    const left = buildPortableViewingActivitySteadyStateProfileV1(
      createPortableProfileV3("account-a", 1000),
      preview({}, { movie_7: progressValue(7, 2000, 40) }),
      { profileId: "account-a", updatedBy: "left", now: 2100 },
    );
    const right = buildPortableViewingActivitySteadyStateProfileV1(
      createPortableProfileV3("account-a", 1000),
      preview({}, { movie_7: progressValue(7, 2200, 60) }),
      { profileId: "account-a", updatedBy: "right", now: 2300 },
    );
    const merged = mergePortableViewingActivityRecordsV1(left, right);
    expect(merged.state).toBe("merged");
    expect(merged.progressRecords.movie_7.value.currentTime).toBe(60);

    const tied = buildPortableViewingActivitySteadyStateProfileV1(
      createPortableProfileV3("account-a", 1000),
      preview({}, { movie_7: progressValue(7, 2000, 70) }),
      { profileId: "account-a", updatedBy: "tie", now: 2400 },
    );
    const conflict = mergePortableViewingActivityRecordsV1(left, tied);
    expect(conflict).toMatchObject({ state: "needs-review", progressConflictKeys: ["movie_7"] });
  });

  it("maps portable Desktop progress into percentage, verified details and the real resume position", () => {
    const profile = buildPortableViewingActivitySteadyStateProfileV1(
      createPortableProfileV3("account-a", 1000),
      preview({ movie_7: historyValue(7, 2000) }, { movie_7: progressValue(7, 2000, 55) }),
      { profileId: "account-a", updatedBy: "mobile-a", now: 2100 },
    );
    const state = buildPortableViewingActivityStateFromProfileV1(profile);
    const snapshot = buildLocalDesktopViewingActivitySnapshotV1(state, {
      history: [{ id: 9, media_type: "movie", title: "Keep", playbackVerified: false }],
      progress: { movie_9: 10 },
      progressDetails: { movie_9: { currentTime: 10 } },
    });

    expect(snapshot.progress.movie_7).toBeCloseTo(55, 10);
    expect(snapshot.progressDetails.movie_7).toMatchObject({
      currentTime: 55,
      playbackVerified: true,
      playbackVerifiedOrigin: "portable-profile-v3",
    });
    expect(snapshot.resumeTimes.movie_7).toBe(55);
    expect(snapshot.history.some((entry) => entry.id === 9)).toBe(true);
  });
});
