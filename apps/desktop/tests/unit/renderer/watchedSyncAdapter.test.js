import { describe, expect, it } from "vitest";
import {
  PORTABLE_VIEWING_STATE_SCHEMA_VERSION,
  buildPortableWatchedPreviewFromProfileV1,
  buildPortableWatchedPreviewV1,
  buildPortableWatchedSteadyStateProfileV1,
  portableWatchedActiveMatchesPreviewV1,
  portableWatchedNamespaceSignatureV1,
  portableWatchedPreviewSignatureV1,
} from "@orion/shared/types";
import { buildLocalDesktopWatchedSnapshotV1 } from "../../../src/renderer/features/library/watchedSyncAdapter";

function movie(id, title = null) {
  return {
    schemaVersion: PORTABLE_VIEWING_STATE_SCHEMA_VERSION,
    kind: "movie",
    media: { mediaType: "movie", id, season: null, episode: null, title, year: null },
  };
}

function episode(id, season, episodeNumber, title = null) {
  return {
    schemaVersion: PORTABLE_VIEWING_STATE_SCHEMA_VERSION,
    kind: "episode",
    media: { mediaType: "tv", id, season, episode: episodeNumber, title, year: null },
  };
}

function baseProfile() {
  const myList = { schemaVersion: 1, revision: 7, updatedAt: 70, records: {} };
  return {
    schemaVersion: 3,
    profileId: "google-sub-1",
    revision: 10,
    createdAt: 1,
    updatedAt: 100,
    namespaces: {
      myList,
      watched: {
        schemaVersion: 1,
        revision: 2,
        updatedAt: 90,
        records: {
          movie_1: { revision: 1, updatedAt: 80, updatedBy: "mobile-a", deletedAt: null, value: movie(1, "One") },
          tv_2_s1_e3: { revision: 1, updatedAt: 90, updatedBy: "mobile-a", deletedAt: null, value: episode(2, 1, 3, "Series") },
        },
      },
    },
  };
}

describe("P8.4 C3-B portable Watched namespace", () => {
  it("uses exact canonical movie/episode truth and rejects mismatched keys", () => {
    const preview = buildPortableWatchedPreviewV1({
      movie_1: movie(1, "One"),
      tv_2_s1_e3: episode(2, 1, 3, "Series"),
      tv_2: episode(2, 1, 4, "Series"),
    });
    expect(Object.keys(preview.records)).toEqual(["movie_1", "tv_2_s1_e3"]);
    expect(preview.rejectedKeys).toEqual(["tv_2"]);
  });

  it("writes removals as tombstones, preserves unrelated namespaces, and advances changed records", () => {
    const base = baseProfile();
    const preview = buildPortableWatchedPreviewV1({
      movie_1: movie(1, "One"),
      movie_3: movie(3, "Three"),
    });
    const next = buildPortableWatchedSteadyStateProfileV1(base, preview, {
      profileId: "google-sub-1",
      updatedBy: "desktop-a",
      now: 200,
    });

    expect(next.namespaces.myList).toBe(base.namespaces.myList);
    expect(next.namespaces.watched.records.movie_1).toBe(base.namespaces.watched.records.movie_1);
    expect(next.namespaces.watched.records.movie_3).toEqual(expect.objectContaining({ revision: 1, deletedAt: null }));
    expect(next.namespaces.watched.records.tv_2_s1_e3).toEqual(expect.objectContaining({
      revision: 2,
      deletedAt: 200,
      value: null,
    }));
    expect(next.revision).toBe(11);
    expect(next.namespaces.watched.revision).toBe(3);
  });

  it("derives active cloud truth without resurrecting tombstones", () => {
    const base = baseProfile();
    const first = buildPortableWatchedSteadyStateProfileV1(
      base,
      buildPortableWatchedPreviewV1({ movie_1: movie(1, "One") }),
      { profileId: "google-sub-1", updatedBy: "desktop-a", now: 200 },
    );
    const active = buildPortableWatchedPreviewFromProfileV1(first);
    expect(active).not.toBeNull();
    expect(Object.keys(active.records)).toEqual(["movie_1"]);
    expect(first.namespaces.watched.records.tv_2_s1_e3.deletedAt).toBe(200);
    expect(portableWatchedActiveMatchesPreviewV1(first, active)).toBe(true);
  });

  it("keeps local and cloud signatures scoped to Watched only", () => {
    const base = baseProfile();
    const local = buildPortableWatchedPreviewV1({ movie_1: movie(1, "One") });
    const changedUnrelated = {
      ...base,
      namespaces: {
        ...base.namespaces,
        preferences: { theme: "different" },
      },
    };
    expect(portableWatchedPreviewSignatureV1(local)).toBe(portableWatchedPreviewSignatureV1(local));
    expect(portableWatchedNamespaceSignatureV1(changedUnrelated)).toBe(portableWatchedNamespaceSignatureV1(base));
  });

  it("maps portable exact episode keys back to Desktop's existing native watched key shape", () => {
    const preview = buildPortableWatchedPreviewV1({
      movie_1: movie(1, "One"),
      tv_2_s1_e3: episode(2, 1, 3, "Series"),
    });
    expect(buildLocalDesktopWatchedSnapshotV1(preview)).toEqual({
      movie_1: true,
      tv_2_s1e3: true,
    });
  });
});
