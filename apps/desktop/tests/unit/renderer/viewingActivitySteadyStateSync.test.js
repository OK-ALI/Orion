import { describe, expect, it } from "vitest";
import {
  reconcilePortableViewingActivitySteadyStateSyncV1,
  resolvePortableViewingActivitySteadyStateConflictV1,
} from "@orion/shared/api";
import {
  buildPortableViewingActivitySteadyStateProfileV1,
  buildPortableViewingActivityStateFromProfileV1,
  createPortableProfileV3,
  portableViewingActivityNamespaceSignatureV1,
  portableViewingActivityTruthSignatureV1,
  PORTABLE_VIEWING_ACTIVITY_SYNC_CHECKPOINT_SCHEMA_VERSION,
} from "@orion/shared/types";

function progress(id, lastPlayedAt, currentTime = 40) {
  return {
    schemaVersion: 1,
    media: { mediaType: "movie", id, title: `Movie ${id}`, year: 2026, season: null, episode: null },
    presentation: { posterPath: null, backdropPath: null, seriesTitle: null, episodeTitle: null },
    currentTime,
    duration: 100,
    percent: currentTime,
    startedAt: lastPlayedAt - 100,
    lastPlayedAt,
    verified: true,
  };
}

function history(id, lastPlayedAt) {
  return {
    schemaVersion: 1,
    media: { mediaType: "movie", id, title: `Movie ${id}`, year: 2026, season: null, episode: null },
    presentation: { posterPath: null, backdropPath: null, seriesTitle: null, episodeTitle: null },
    lastPlayedAt,
    verified: true,
  };
}

function preview(records = {}) {
  return { history: {}, progress: records, rejected: { history: [], progress: [] } };
}

function profileFrom(profileId, records, now) {
  return buildPortableViewingActivitySteadyStateProfileV1(
    createPortableProfileV3(profileId, 1),
    preview(records),
    { profileId, updatedBy: profileId, now },
  );
}

function checkpoint(profileId, local, cloud) {
  return {
    schemaVersion: PORTABLE_VIEWING_ACTIVITY_SYNC_CHECKPOINT_SCHEMA_VERSION,
    profileId,
    localTruthSignature: portableViewingActivityTruthSignatureV1(local),
    cloudNamespaceSignature: portableViewingActivityNamespaceSignatureV1(cloud),
    verifiedAt: 1500,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function storeFor(initial) {
  let profile = clone(initial);
  let tag = "r1";
  let writes = 0;
  return {
    get writes() { return writes; },
    get profile() { return clone(profile); },
    async read() { return { state: "found", profile: clone(profile), revisionTag: tag, remoteModifiedAt: null }; },
    async write(_key, request) {
      if (request.expectedRevisionTag !== tag) return { state: "conflict", revisionTag: tag };
      profile = clone(request.profile);
      writes += 1;
      tag = `r${writes + 1}`;
      return { state: "written", revisionTag: tag, remoteModifiedAt: null };
    },
  };
}

async function reconcile({ baseProfile, basePreview, localPreview, cloudProfile = baseProfile }) {
  const store = storeFor(cloudProfile);
  let local = clone(localPreview);
  const result = await reconcilePortableViewingActivitySteadyStateSyncV1({
    store,
    profileKey: "profile.json",
    profileId: "account-a",
    updatedBy: "account-a",
    checkpoint: checkpoint("account-a", basePreview, baseProfile),
    readLocalPreview: () => clone(local),
    applyLocalState: (state) => { local = { history: clone(state.history), progress: clone(state.progress), rejected: { history: [], progress: [] } }; },
    readBackDelaysMs: [0],
  });
  return { result, store, local };
}

describe("V3-P8-006A C3 Viewing Activity steady-state sync", () => {
  it("requires an enrollment checkpoint before cloud I/O", async () => {
    let reads = 0;
    const result = await reconcilePortableViewingActivitySteadyStateSyncV1({
      store: { async read() { reads += 1; throw new Error("unexpected read"); }, async write() { throw new Error("unexpected write"); } },
      profileKey: "profile.json",
      profileId: "account-a",
      updatedBy: "account-a",
      checkpoint: null,
      readLocalPreview: () => preview(),
      applyLocalState: () => {},
    });
    expect(result).toEqual({ state: "unenrolled" });
    expect(reads).toBe(0);
  });

  it("turns a one-sided local removal into the existing portable tombstone path", async () => {
    const basePreview = preview({ movie_7: progress(7, 1000) });
    const baseProfile = profileFrom("account-a", basePreview.progress, 1100);
    const { result, store } = await reconcile({ baseProfile, basePreview, localPreview: preview() });
    expect(result.state).toBe("verified");
    expect(result.action).toBe("push");
    expect(store.profile.namespaces.progress.records.movie_7.deletedAt).toBeTypeOf("number");
  });

  it("pulls a one-sided cloud playback update and verifies local truth", async () => {
    const basePreview = preview({ movie_7: progress(7, 1000, 20) });
    const baseProfile = profileFrom("account-a", basePreview.progress, 1100);
    const cloudProfile = buildPortableViewingActivitySteadyStateProfileV1(
      baseProfile,
      preview({ movie_7: progress(7, 2200, 70) }),
      { profileId: "account-a", updatedBy: "other-device", now: 2300 },
    );
    const { result, local } = await reconcile({ baseProfile, basePreview, localPreview: basePreview, cloudProfile });
    expect(result).toMatchObject({ state: "verified", action: "pull" });
    expect(local.progress.movie_7.currentTime).toBe(70);
  });

  it("treats presentation-only Mobile enrichment as aligned verified event truth", async () => {
    const basePreview = {
      history: { movie_7: history(7, 1000) },
      progress: { movie_7: progress(7, 1000, 40) },
      rejected: { history: [], progress: [] },
    };
    const baseProfile = buildPortableViewingActivitySteadyStateProfileV1(
      createPortableProfileV3("account-a", 1),
      basePreview,
      { profileId: "account-a", updatedBy: "account-a", now: 1100 },
    );
    const localPreview = clone(basePreview);
    localPreview.history.movie_7.media.title = "Enriched Movie 7";
    localPreview.history.movie_7.presentation.posterPath = "/history-poster.jpg";
    localPreview.progress.movie_7.media.title = "Enriched Movie 7";
    localPreview.progress.movie_7.presentation.posterPath = "/progress-poster.jpg";

    const { result, store, local } = await reconcile({ baseProfile, basePreview, localPreview });
    expect(result).toMatchObject({ state: "verified", action: "aligned" });
    expect(store.writes).toBe(0);
    expect(local.history.movie_7.presentation.posterPath).toBe("/history-poster.jpg");
    expect(local.progress.movie_7.presentation.posterPath).toBe("/progress-poster.jpg");
  });

  it("keeps an event-aligned metadata-divergent checkpoint stable on the next reconcile", async () => {
    const basePreview = preview({ movie_7: progress(7, 1000, 40) });
    const baseProfile = profileFrom("account-a", basePreview.progress, 1100);
    const localPreview = clone(basePreview);
    localPreview.progress.movie_7.presentation.posterPath = "/mobile-enriched.jpg";
    const store = storeFor(baseProfile);
    let local = clone(localPreview);

    const first = await reconcilePortableViewingActivitySteadyStateSyncV1({
      store,
      profileKey: "profile.json",
      profileId: "account-a",
      updatedBy: "account-a",
      checkpoint: checkpoint("account-a", basePreview, baseProfile),
      readLocalPreview: () => clone(local),
      applyLocalState: (state) => { local = { history: clone(state.history), progress: clone(state.progress), rejected: { history: [], progress: [] } }; },
      readBackDelaysMs: [0],
    });
    expect(first).toMatchObject({ state: "verified", action: "aligned" });
    expect(store.writes).toBe(0);

    const second = await reconcilePortableViewingActivitySteadyStateSyncV1({
      store,
      profileKey: "profile.json",
      profileId: "account-a",
      updatedBy: "account-a",
      checkpoint: first.checkpoint,
      readLocalPreview: () => clone(local),
      applyLocalState: () => { throw new Error("event-aligned metadata must not be overwritten"); },
      readBackDelaysMs: [0],
    });
    expect(second).toMatchObject({ state: "verified", action: "aligned" });
    expect(store.writes).toBe(0);
    expect(local.progress.movie_7.presentation.posterPath).toBe("/mobile-enriched.jpg");
  });

  it("pushes a later real local event even when an older aligned record still has Mobile-only presentation enrichment", async () => {
    const basePreview = {
      history: { movie_7: history(7, 1000) },
      progress: { movie_7: progress(7, 1000, 40) },
      rejected: { history: [], progress: [] },
    };
    const baseProfile = buildPortableViewingActivitySteadyStateProfileV1(
      createPortableProfileV3("account-a", 1),
      basePreview,
      { profileId: "account-a", updatedBy: "account-a", now: 1100 },
    );
    const store = storeFor(baseProfile);
    let local = clone(basePreview);
    local.history.movie_7.media.title = "Enriched Movie 7";
    local.history.movie_7.presentation.posterPath = "/history-mobile.jpg";
    local.progress.movie_7.media.title = "Enriched Movie 7";
    local.progress.movie_7.presentation.posterPath = "/progress-mobile.jpg";

    const aligned = await reconcilePortableViewingActivitySteadyStateSyncV1({
      store,
      profileKey: "profile.json",
      profileId: "account-a",
      updatedBy: "account-a",
      checkpoint: checkpoint("account-a", basePreview, baseProfile),
      readLocalPreview: () => clone(local),
      applyLocalState: () => { throw new Error("metadata alignment must not replace local truth"); },
      readBackDelaysMs: [0],
    });
    expect(aligned).toMatchObject({ state: "verified", action: "aligned" });
    expect(store.writes).toBe(0);

    local.history.movie_8 = history(8, 3000);
    const pushed = await reconcilePortableViewingActivitySteadyStateSyncV1({
      store,
      profileKey: "profile.json",
      profileId: "account-a",
      updatedBy: "account-a",
      checkpoint: aligned.checkpoint,
      readLocalPreview: () => clone(local),
      applyLocalState: (state) => {
        local = { history: clone(state.history), progress: clone(state.progress), rejected: { history: [], progress: [] } };
      },
      readBackDelaysMs: [0],
    });

    expect(pushed).toMatchObject({ state: "verified", action: "push", count: { history: 2, progress: 1 } });
    expect(store.writes).toBe(1);
    expect(store.profile.namespaces.history.records.movie_8.value.lastPlayedAt).toBe(3000);
    expect(store.profile.namespaces.history.records.movie_7.value.presentation.posterPath).toBe("/history-mobile.jpg");
    expect(store.profile.namespaces.progress.records.movie_7.value.presentation.posterPath).toBe("/progress-mobile.jpg");
    expect(local.history.movie_7.presentation.posterPath).toBe("/history-mobile.jpg");
    expect(local.progress.movie_7.presentation.posterPath).toBe("/progress-mobile.jpg");
  });

  it("merges two-sided updates by verified event time when no removal is ambiguous", async () => {
    const basePreview = preview({ movie_7: progress(7, 1000, 20) });
    const baseProfile = profileFrom("account-a", basePreview.progress, 1100);
    const cloudProfile = buildPortableViewingActivitySteadyStateProfileV1(
      baseProfile,
      preview({ movie_7: progress(7, 2200, 70) }),
      { profileId: "account-a", updatedBy: "cloud-device", now: 2300 },
    );
    const localPreview = preview({ movie_7: progress(7, 2000, 60) });
    const { result, local } = await reconcile({ baseProfile, basePreview, localPreview, cloudProfile });
    expect(result).toMatchObject({ state: "verified", action: "merge" });
    expect(local.progress.movie_7.currentTime).toBe(70);
  });

  it("fails closed when two-sided divergence cannot distinguish a Cloud addition from an offline local removal", async () => {
    const basePreview = preview({ movie_1: progress(1, 1000, 20) });
    const baseProfile = profileFrom("account-a", basePreview.progress, 1100);
    const cloudProfile = buildPortableViewingActivitySteadyStateProfileV1(
      baseProfile,
      preview({ movie_1: progress(1, 1000, 20), movie_2: progress(2, 2200, 30) }),
      { profileId: "account-a", updatedBy: "cloud-device", now: 2300 },
    );
    const localPreview = preview({ movie_1: progress(1, 2100, 50) });
    const { result, store } = await reconcile({ baseProfile, basePreview, localPreview, cloudProfile });
    expect(result).toMatchObject({ state: "needs-review", reason: "two-sided-removal-ambiguity", progressConflictKeys: ["movie_2"] });
    expect(store.writes).toBe(0);
  });

  it("fails safe on exact-time contradictory verified progress", async () => {
    const basePreview = preview({ movie_7: progress(7, 1000, 20) });
    const baseProfile = profileFrom("account-a", basePreview.progress, 1100);
    const cloudProfile = buildPortableViewingActivitySteadyStateProfileV1(
      baseProfile,
      preview({ movie_7: progress(7, 2200, 70) }),
      { profileId: "account-a", updatedBy: "cloud-device", now: 2300 },
    );
    const localPreview = preview({ movie_7: progress(7, 2200, 60) });
    const { result, store } = await reconcile({ baseProfile, basePreview, localPreview, cloudProfile });
    expect(result).toMatchObject({ state: "needs-review", reason: "event-time-conflict", progressConflictKeys: ["movie_7"] });
    expect(store.writes).toBe(0);
  });


  it("recovers genuine two-sided divergence only through an explicit whole-copy device choice", async () => {
    const basePreview = preview({ movie_1: progress(1, 1000, 20) });
    const baseProfile = profileFrom("account-a", basePreview.progress, 1100);
    baseProfile.namespaces.futureNamespace = { keep: "me" };
    const cloudProfile = buildPortableViewingActivitySteadyStateProfileV1(
      baseProfile,
      preview({ movie_1: progress(1, 1000, 20), movie_2: progress(2, 2200, 30) }),
      { profileId: "account-a", updatedBy: "cloud-device", now: 2300 },
    );
    const localPreview = preview({ movie_1: progress(1, 2100, 50) });
    const store = storeFor(cloudProfile);
    let local = clone(localPreview);
    const result = await resolvePortableViewingActivitySteadyStateConflictV1({
      store,
      profileKey: "profile.json",
      profileId: "account-a",
      updatedBy: "account-a",
      checkpoint: checkpoint("account-a", basePreview, baseProfile),
      resolution: "keep-local",
      readLocalPreview: () => clone(local),
      applyLocalState: () => { throw new Error("keep-local must not replace local truth"); },
      readBackDelaysMs: [0],
    });
    expect(result).toMatchObject({ state: "verified", resolution: "keep-local" });
    expect(store.profile.namespaces.progress.records.movie_2.deletedAt).toBeTypeOf("number");
    expect(store.profile.namespaces.progress.records.movie_1.value.currentTime).toBe(50);
    expect(store.profile.namespaces.futureNamespace).toEqual({ keep: "me" });
  });

  it("recovers genuine two-sided divergence through a stable verified Orion Cloud choice", async () => {
    const basePreview = preview({ movie_1: progress(1, 1000, 20) });
    const baseProfile = profileFrom("account-a", basePreview.progress, 1100);
    const cloudProfile = buildPortableViewingActivitySteadyStateProfileV1(
      baseProfile,
      preview({ movie_1: progress(1, 1000, 20), movie_2: progress(2, 2200, 30) }),
      { profileId: "account-a", updatedBy: "cloud-device", now: 2300 },
    );
    let local = preview({ movie_1: progress(1, 2100, 50) });
    const store = storeFor(cloudProfile);
    const result = await resolvePortableViewingActivitySteadyStateConflictV1({
      store,
      profileKey: "profile.json",
      profileId: "account-a",
      updatedBy: "account-a",
      checkpoint: checkpoint("account-a", basePreview, baseProfile),
      resolution: "keep-cloud",
      readLocalPreview: () => clone(local),
      applyLocalState: (state) => { local = { history: clone(state.history), progress: clone(state.progress), rejected: { history: [], progress: [] } }; },
    });
    expect(result).toMatchObject({ state: "verified", resolution: "keep-cloud" });
    expect(local.progress.movie_1.currentTime).toBe(20);
    expect(local.progress.movie_2.currentTime).toBe(30);
    expect(store.writes).toBe(0);
  });

  it("does not expose whole-copy conflict recovery unless both copies changed after the checkpoint", async () => {
    const basePreview = preview({ movie_1: progress(1, 1000, 20) });
    const baseProfile = profileFrom("account-a", basePreview.progress, 1100);
    const store = storeFor(baseProfile);
    const local = preview({ movie_1: progress(1, 2100, 50) });
    const result = await resolvePortableViewingActivitySteadyStateConflictV1({
      store,
      profileKey: "profile.json",
      profileId: "account-a",
      updatedBy: "account-a",
      checkpoint: checkpoint("account-a", basePreview, baseProfile),
      resolution: "keep-local",
      readLocalPreview: () => clone(local),
      applyLocalState: () => {},
      readBackDelaysMs: [0],
    });
    expect(result).toEqual({ state: "needs-review", reason: "readiness-changed", cloudWasWritten: false });
    expect(store.writes).toBe(0);
  });

  it("preserves unknown namespaces during a verified steady-state write", async () => {
    const basePreview = preview({ movie_7: progress(7, 1000, 20) });
    const baseProfile = profileFrom("account-a", basePreview.progress, 1100);
    baseProfile.namespaces.futureNamespace = { keep: "me" };
    const { result, store } = await reconcile({ baseProfile, basePreview, localPreview: preview({ movie_7: progress(7, 2000, 60) }) });
    expect(result.state).toBe("verified");
    expect(store.profile.namespaces.futureNamespace).toEqual({ keep: "me" });
    expect(buildPortableViewingActivityStateFromProfileV1(store.profile).progress.movie_7.currentTime).toBe(60);
  });
  it("restores newer checkpoint-backed cloud truth when a Desktop cache regresses without a cloud change", async () => {
    const basePreview = preview({ movie_7: progress(7, 2000, 70) });
    const baseProfile = profileFrom("account-a", basePreview.progress, 2100);
    const localPreview = preview({ movie_7: progress(7, 1000, 20) });
    const { result, store, local } = await reconcile({ baseProfile, basePreview, localPreview });

    expect(result).toMatchObject({ state: "verified", count: { history: 0, progress: 1 } });
    expect(store.writes).toBe(0);
    expect(local.progress.movie_7.currentTime).toBe(70);
    expect(local.progress.movie_7.lastPlayedAt).toBe(2000);
  });

  it("keeps a newer verified cloud tombstone when stale Desktop playback reappears", async () => {
    const originalPreview = preview({ movie_7: progress(7, 1000, 20) });
    const originalProfile = profileFrom("account-a", originalPreview.progress, 1100);
    const deletedPreview = preview();
    const deletedProfile = buildPortableViewingActivitySteadyStateProfileV1(
      originalProfile,
      deletedPreview,
      { profileId: "account-a", updatedBy: "other-device", now: 3000 },
    );
    const store = storeFor(deletedProfile);
    let local = preview({ movie_7: progress(7, 1500, 30) });

    const result = await reconcilePortableViewingActivitySteadyStateSyncV1({
      store,
      profileKey: "profile.json",
      profileId: "account-a",
      updatedBy: "account-a",
      checkpoint: checkpoint("account-a", deletedPreview, deletedProfile),
      readLocalPreview: () => clone(local),
      applyLocalState: (state) => {
        local = { history: clone(state.history), progress: clone(state.progress), rejected: { history: [], progress: [] } };
      },
      readBackDelaysMs: [0],
    });

    expect(result).toMatchObject({ state: "verified", count: { history: 0, progress: 0 } });
    expect(store.writes).toBe(0);
    expect(local.progress).toEqual({});
    expect(store.profile.namespaces.progress.records.movie_7.deletedAt).toBe(3000);
  });

  it("still fails closed on a contradictory equal-time one-sided local playback update", async () => {
    const basePreview = preview({ movie_7: progress(7, 2000, 70) });
    const baseProfile = profileFrom("account-a", basePreview.progress, 2100);
    const localPreview = preview({ movie_7: progress(7, 2000, 60) });
    const { result, store } = await reconcile({ baseProfile, basePreview, localPreview });

    expect(result).toMatchObject({ state: "needs-review", reason: "local-update-unsafe" });
    expect(store.writes).toBe(0);
  });

});
