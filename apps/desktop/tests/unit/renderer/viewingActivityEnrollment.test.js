import { describe, expect, it } from "vitest";
import {
  executePortableViewingActivityOneShotSyncV1,
  inspectPortableViewingActivityOneShotSyncV1,
} from "@orion/shared/api";
import {
  buildPortableViewingActivitySteadyStateProfileV1,
  createPortableProfileV3,
} from "@orion/shared/types";

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
    percent: (currentTime / 100) * 100,
    startedAt: lastPlayedAt - 100,
    lastPlayedAt,
    verified: true,
  };
}

function preview(history = {}, progress = {}) {
  return { history, progress, rejected: { history: [], progress: [] } };
}

function profileWithActivity(profileId, activity, now = 3000) {
  return buildPortableViewingActivitySteadyStateProfileV1(
    createPortableProfileV3(profileId, 1000),
    activity,
    { profileId, updatedBy: "seed", now },
  );
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

class MemoryCloudStore {
  constructor(profile = null) {
    this.profile = clone(profile);
    this.tag = profile ? "r1" : null;
    this.conflictNextWrite = false;
    this.writeCount = 0;
  }

  async read() {
    if (!this.profile) return { state: "missing", revisionTag: null };
    return { state: "found", profile: clone(this.profile), revisionTag: this.tag, remoteModifiedAt: null };
  }

  async write(_key, request) {
    this.writeCount += 1;
    if (this.conflictNextWrite || request.expectedRevisionTag !== this.tag) {
      this.conflictNextWrite = false;
      return { state: "conflict", revisionTag: this.tag };
    }
    this.profile = clone(request.profile);
    this.tag = this.tag === null ? "r1" : `r${Number(this.tag.slice(1)) + 1}`;
    return { state: "written", revisionTag: this.tag, remoteModifiedAt: null };
  }
}

describe("V3-P8-006A C2 Viewing Activity first enrollment", () => {
  it("treats missing legacy History and Progress namespaces as empty instead of invalid", async () => {
    const legacyCloud = createPortableProfileV3("account-a", 1000);
    delete legacyCloud.namespaces.history;
    delete legacyCloud.namespaces.progress;
    legacyCloud.namespaces.futureNamespace = { keep: "me" };

    const local = preview({ movie_3: historyValue(3, 2100) }, { movie_3: progressValue(3, 2100, 25) });
    const store = new MemoryCloudStore(legacyCloud);

    const inspection = await inspectPortableViewingActivityOneShotSyncV1({
      store,
      profileKey: "profile",
      profileId: "account-a",
      updatedBy: "desktop-a",
      localPreview: local,
    });

    expect(inspection.state).toBe("ready");
    expect(inspection.availableResolutions).toContain("device");
    expect(inspection.availableResolutions).toContain("cloud");
    expect(inspection.availableResolutions).toContain("combine");

    let applied = clone(local);
    const result = await executePortableViewingActivityOneShotSyncV1({
      store,
      profileKey: "profile",
      profileId: "account-a",
      updatedBy: "desktop-a",
      resolution: "combine",
      expectedConfirmationKey: inspection.confirmationKey,
      readLocalPreview: () => clone(applied),
      applyLocalState: (state) => { applied = preview(clone(state.history), clone(state.progress)); },
      readBackDelaysMs: [0],
    });

    expect(result).toMatchObject({ state: "verified", resolution: "combine", cloudWasWritten: true });
    expect(store.profile.namespaces.history.records.movie_3).toBeTruthy();
    expect(store.profile.namespaces.progress.records.movie_3).toBeTruthy();
    expect(store.profile.namespaces.futureNamespace).toEqual({ keep: "me" });
  });

  it("still fails closed for a present but semantically invalid Viewing Activity namespace", async () => {
    const malformed = createPortableProfileV3("account-a", 1000);
    malformed.namespaces.history.records.bad_key = {
      revision: 1,
      updatedAt: 1500,
      updatedBy: "legacy",
      deletedAt: null,
      value: { schemaVersion: 1, broken: true },
    };

    const result = await inspectPortableViewingActivityOneShotSyncV1({
      store: new MemoryCloudStore(malformed),
      profileKey: "profile",
      profileId: "account-a",
      updatedBy: "desktop-a",
      localPreview: preview(),
    });

    expect(result).toMatchObject({ state: "needs-review", reason: "cloud-invalid" });
  });
  it("enrolls exact semantic alignment without writing Orion Cloud", async () => {
    const local = preview({ movie_7: historyValue(7, 2000) }, { movie_7: progressValue(7, 2000, 55) });
    const store = new MemoryCloudStore(profileWithActivity("account-a", local));
    const before = clone(store.profile);

    const result = await inspectPortableViewingActivityOneShotSyncV1({
      store,
      profileKey: "profile",
      profileId: "account-a",
      updatedBy: "desktop-a",
      localPreview: local,
    });

    expect(result.state).toBe("aligned");
    expect(result.checkpoint.profileId).toBe("account-a");
    expect(store.profile).toEqual(before);
  });

  it("combines by verified event time, preserves unknown namespaces, and verifies local apply before checkpoint", async () => {
    const cloud = profileWithActivity(
      "account-a",
      preview({ movie_7: historyValue(7, 2000) }, { movie_7: progressValue(7, 2000, 40) }),
    );
    cloud.namespaces.futureNamespace = { keep: "me" };
    const store = new MemoryCloudStore(cloud);
    let local = preview({ movie_7: historyValue(7, 2200), movie_9: historyValue(9, 2100) }, { movie_7: progressValue(7, 2200, 70) });

    const inspection = await inspectPortableViewingActivityOneShotSyncV1({
      store,
      profileKey: "profile",
      profileId: "account-a",
      updatedBy: "desktop-a",
      localPreview: local,
    });
    expect(inspection.state).toBe("ready");
    expect(inspection.availableResolutions).toContain("combine");

    const result = await executePortableViewingActivityOneShotSyncV1({
      store,
      profileKey: "profile",
      profileId: "account-a",
      updatedBy: "desktop-a",
      resolution: "combine",
      expectedConfirmationKey: inspection.confirmationKey,
      readLocalPreview: () => clone(local),
      applyLocalState: (state) => {
        local = preview(clone(state.history), clone(state.progress));
      },
      readBackDelaysMs: [0],
    });

    expect(result.state).toBe("verified");
    expect(result.cloudWasWritten).toBe(true);
    expect(store.profile.namespaces.futureNamespace).toEqual({ keep: "me" });
    expect(local.progress.movie_7.currentTime).toBe(70);
    expect(local.history.movie_9.media.id).toBe(9);
    expect(result.checkpoint.profileId).toBe("account-a");
  });

  it("creates a missing Viewing Activity profile only from the explicit device choice", async () => {
    const local = preview({ movie_3: historyValue(3, 2100) }, { movie_3: progressValue(3, 2100, 25) });
    const store = new MemoryCloudStore(null);

    const inspection = await inspectPortableViewingActivityOneShotSyncV1({
      store, profileKey: "profile", profileId: "account-a", updatedBy: "desktop-a", localPreview: local,
    });

    expect(inspection).toMatchObject({ state: "ready", availableResolutions: ["device"] });
    expect(store.profile).toBeNull();

    let applied = clone(local);
    const result = await executePortableViewingActivityOneShotSyncV1({
      store,
      profileKey: "profile",
      profileId: "account-a",
      updatedBy: "desktop-a",
      resolution: "device",
      expectedConfirmationKey: inspection.confirmationKey,
      readLocalPreview: () => clone(applied),
      applyLocalState: (state) => { applied = preview(clone(state.history), clone(state.progress)); },
      readBackDelaysMs: [0],
    });

    expect(result).toMatchObject({ state: "verified", resolution: "device", cloudWasWritten: true });
    expect(store.writeCount).toBe(1);
    expect(store.profile.profileId).toBe("account-a");
  });

  it("lets Keep Orion Cloud remove portable local activity that is absent from Cloud", async () => {
    const cloud = profileWithActivity("account-a", preview({ movie_7: historyValue(7, 2400) }));
    const store = new MemoryCloudStore(cloud);
    let local = preview({
      movie_7: historyValue(7, 2000),
      movie_9: historyValue(9, 2100),
    }, { movie_9: progressValue(9, 2100, 35) });

    const inspection = await inspectPortableViewingActivityOneShotSyncV1({
      store, profileKey: "profile", profileId: "account-a", updatedBy: "desktop-a", localPreview: local,
    });
    expect(inspection.state).toBe("ready");
    expect(inspection.availableResolutions).toContain("cloud");

    const result = await executePortableViewingActivityOneShotSyncV1({
      store,
      profileKey: "profile",
      profileId: "account-a",
      updatedBy: "desktop-a",
      resolution: "cloud",
      expectedConfirmationKey: inspection.confirmationKey,
      readLocalPreview: () => clone(local),
      applyLocalState: (state) => { local = preview(clone(state.history), clone(state.progress)); },
      readBackDelaysMs: [0],
    });

    expect(result).toMatchObject({ state: "verified", resolution: "cloud", cloudWasWritten: false });
    expect(local.history.movie_7.lastPlayedAt).toBe(2400);
    expect(local.history.movie_9).toBeUndefined();
    expect(local.progress.movie_9).toBeUndefined();
    expect(store.writeCount).toBe(0);
  });

  it("blocks Keep Device from resurrecting a newer Cloud removal", async () => {
    const seeded = profileWithActivity("account-a", preview({ movie_7: historyValue(7, 2000) }), 2100);
    const removed = buildPortableViewingActivitySteadyStateProfileV1(
      seeded,
      preview(),
      { profileId: "account-a", updatedBy: "cloud-newer", now: 2600 },
    );
    const local = preview({ movie_7: historyValue(7, 2200) });

    const inspection = await inspectPortableViewingActivityOneShotSyncV1({
      store: new MemoryCloudStore(removed),
      profileKey: "profile",
      profileId: "account-a",
      updatedBy: "desktop-a",
      localPreview: local,
    });

    expect(inspection.state).toBe("ready");
    expect(inspection.availableResolutions).not.toContain("device");
    expect(inspection.availableResolutions).toContain("cloud");
  });

  it("does not offer Combine for exact-time playback ambiguity", async () => {
    const cloud = profileWithActivity(
      "account-a",
      preview({}, { movie_7: progressValue(7, 2200, 40) }),
    );
    const local = preview({}, { movie_7: progressValue(7, 2200, 70) });

    const inspection = await inspectPortableViewingActivityOneShotSyncV1({
      store: new MemoryCloudStore(cloud),
      profileKey: "profile",
      profileId: "account-a",
      updatedBy: "desktop-a",
      localPreview: local,
    });

    expect(inspection.state).toBe("ready");
    expect(inspection.availableResolutions).not.toContain("combine");
    expect(inspection.availableResolutions).toContain("cloud");
  });

  it("fails closed when local playback changes after a verified Cloud write", async () => {
    const cloud = profileWithActivity("account-a", preview({ movie_7: historyValue(7, 2000) }));
    const store = new MemoryCloudStore(cloud);
    const original = preview({ movie_7: historyValue(7, 2200) });
    const changed = preview({ movie_7: historyValue(7, 2300) });

    const inspection = await inspectPortableViewingActivityOneShotSyncV1({
      store, profileKey: "profile", profileId: "account-a", updatedBy: "desktop-a", localPreview: original,
    });
    expect(inspection.state).toBe("ready");

    let reads = 0;
    const result = await executePortableViewingActivityOneShotSyncV1({
      store,
      profileKey: "profile",
      profileId: "account-a",
      updatedBy: "desktop-a",
      resolution: "device",
      expectedConfirmationKey: inspection.confirmationKey,
      readLocalPreview: () => clone(reads++ === 0 ? original : changed),
      applyLocalState: () => { throw new Error("should not apply stale state"); },
      readBackDelaysMs: [0],
    });

    expect(result).toEqual({ state: "needs-review", reason: "local-changed-during-sync", cloudWasWritten: true });
    expect(store.writeCount).toBe(1);
  });

  it("fails closed on a conditional Cloud conflict and never creates verification evidence", async () => {
    const cloud = profileWithActivity("account-a", preview({ movie_7: historyValue(7, 2000) }));
    const store = new MemoryCloudStore(cloud);
    const local = preview({ movie_7: historyValue(7, 2200) });
    const inspection = await inspectPortableViewingActivityOneShotSyncV1({
      store,
      profileKey: "profile",
      profileId: "account-a",
      updatedBy: "desktop-a",
      localPreview: local,
    });
    expect(inspection.state).toBe("ready");
    store.conflictNextWrite = true;

    const result = await executePortableViewingActivityOneShotSyncV1({
      store,
      profileKey: "profile",
      profileId: "account-a",
      updatedBy: "desktop-a",
      resolution: "device",
      expectedConfirmationKey: inspection.confirmationKey,
      readLocalPreview: () => local,
      applyLocalState: () => { throw new Error("should not apply"); },
      readBackDelaysMs: [0],
    });

    expect(result).toEqual({ state: "needs-review", reason: "cloud-conflict", cloudWasWritten: false });
  });

  it("does not create a checkpoint when local application cannot be verified", async () => {
    const cloud = profileWithActivity("account-a", preview({ movie_7: historyValue(7, 2400) }));
    const store = new MemoryCloudStore(cloud);
    const local = preview({ movie_7: historyValue(7, 2000) });
    const inspection = await inspectPortableViewingActivityOneShotSyncV1({
      store,
      profileKey: "profile",
      profileId: "account-a",
      updatedBy: "desktop-a",
      localPreview: local,
    });
    expect(inspection.state).toBe("ready");

    const result = await executePortableViewingActivityOneShotSyncV1({
      store,
      profileKey: "profile",
      profileId: "account-a",
      updatedBy: "desktop-a",
      resolution: "cloud",
      expectedConfirmationKey: inspection.confirmationKey,
      readLocalPreview: () => local,
      applyLocalState: () => { throw new Error("disk full"); },
      readBackDelaysMs: [0],
    });

    expect(result).toEqual({ state: "needs-review", reason: "local-apply-failed", cloudWasWritten: false });
  });
});
