import { describe, expect, it } from "vitest";
import {
  executePortableWatchedOneShotSyncV1,
  inspectPortableWatchedOneShotSyncV1,
  reconcilePortableWatchedSteadyStateSyncV1,
  resolvePortableWatchedSteadyStateConflictV1,
} from "@orion/shared/api";
import {
  buildPortableWatchedSteadyStateProfileV1,
  createPortableProfileV3,
  portableWatchedNamespaceSignatureV1,
  portableWatchedTruthSignatureV1,
  PORTABLE_VIEWING_STATE_SCHEMA_VERSION,
  PORTABLE_WATCHED_SYNC_CHECKPOINT_SCHEMA_VERSION,
} from "@orion/shared/types";

function movie(id, title = null) {
  return {
    schemaVersion: PORTABLE_VIEWING_STATE_SCHEMA_VERSION,
    kind: "movie",
    media: { mediaType: "movie", id, season: null, episode: null, title, year: null },
  };
}

function preview(records) {
  return { records, rejectedKeys: [] };
}

function deep(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

class MemoryStore {
  constructor(profile = null) {
    this.profile = profile;
    this.tag = profile ? "tag-1" : null;
    this.forceConflict = false;
    this.afterWriteReads = 0;
    this.readCount = 0;
    this.writeCount = 0;
  }

  async read() {
    this.readCount += 1;
    if (!this.profile) return { state: "missing", revisionTag: null };
    return { state: "found", profile: deep(this.profile), revisionTag: this.tag, remoteModifiedAt: null };
  }

  async write(_key, request) {
    this.writeCount += 1;
    if (this.forceConflict || request.expectedRevisionTag !== this.tag) {
      return { state: "conflict", revisionTag: this.tag };
    }
    this.profile = deep(request.profile);
    this.tag = this.tag ? `${this.tag}-next` : "tag-created";
    return { state: "written", revisionTag: this.tag, remoteModifiedAt: null };
  }
}

function profileWith(records, now = 10) {
  const base = createPortableProfileV3("google-sub-1", 1);
  return buildPortableWatchedSteadyStateProfileV1(base, preview(records), {
    profileId: "google-sub-1",
    updatedBy: "seed",
    now,
  });
}

function checkpoint(profile, local) {
  return {
    schemaVersion: PORTABLE_WATCHED_SYNC_CHECKPOINT_SCHEMA_VERSION,
    profileId: "google-sub-1",
    localTruthSignature: portableWatchedTruthSignatureV1(local),
    cloudNamespaceSignature: portableWatchedNamespaceSignatureV1(profile),
    verifiedAt: 20,
  };
}

describe("P8.4 C3-C explicit Watched one-shot reconciliation", () => {
  it("treats matching canonical truth as aligned even when presentation metadata differs", async () => {
    const store = new MemoryStore(profileWith({ movie_1: movie(1, "Cloud title") }));
    const local = preview({ movie_1: movie(1, null) });
    const result = await inspectPortableWatchedOneShotSyncV1({
      store, profileKey: "orion-primary-profile-v3", profileId: "google-sub-1", localPreview: local, checkpoint: null,
    });
    expect(result.state).toBe("aligned");
    expect(result.checkpoint.localTruthSignature).toBe(portableWatchedTruthSignatureV1(local));
  });

  it("first enrollment unions active cloud and local positives without degrading cloud metadata", async () => {
    const store = new MemoryStore(profileWith({ movie_1: movie(1, "Rich cloud title") }));
    let local = preview({ movie_2: movie(2, "Local") });
    const inspection = await inspectPortableWatchedOneShotSyncV1({
      store, profileKey: "p", profileId: "google-sub-1", localPreview: local, checkpoint: null,
    });
    expect(inspection).toMatchObject({ state: "ready", action: "merge", targetCount: 2 });
    const result = await executePortableWatchedOneShotSyncV1({
      store, profileKey: "p", profileId: "google-sub-1", updatedBy: "desktop", expectedConfirmationKey: inspection.confirmationKey,
      checkpoint: null,
      readLocalPreview: () => local,
      applyLocalPreview: (next) => { local = deep(next); },
      readBackDelaysMs: [0],
    });
    expect(result).toMatchObject({ state: "verified", action: "merge", count: 2 });
    expect(Object.keys(local.records)).toEqual(["movie_1", "movie_2"]);
    expect(store.profile.namespaces.watched.records.movie_1.value.media.title).toBe("Rich cloud title");
  });

  it("first enrollment pulls when local truth is a strict subset of cloud truth", async () => {
    const store = new MemoryStore(profileWith({ movie_1: movie(1), movie_2: movie(2) }));
    const local = preview({ movie_1: movie(1) });
    const result = await inspectPortableWatchedOneShotSyncV1({
      store, profileKey: "p", profileId: "google-sub-1", localPreview: local, checkpoint: null,
    });
    expect(result).toMatchObject({ state: "ready", action: "pull", targetCount: 2 });
  });

  it("first enrollment pushes when cloud truth is a strict subset of local truth", async () => {
    const store = new MemoryStore(profileWith({ movie_1: movie(1) }));
    const local = preview({ movie_1: movie(1), movie_2: movie(2) });
    const result = await inspectPortableWatchedOneShotSyncV1({
      store, profileKey: "p", profileId: "google-sub-1", localPreview: local, checkpoint: null,
    });
    expect(result).toMatchObject({ state: "ready", action: "push", targetCount: 2 });
  });

  it("first enrollment creates a missing profile only after explicit confirmation", async () => {
    const store = new MemoryStore(null);
    let local = preview({ movie_7: movie(7) });
    const inspection = await inspectPortableWatchedOneShotSyncV1({
      store, profileKey: "p", profileId: "google-sub-1", localPreview: local, checkpoint: null,
    });
    expect(inspection).toMatchObject({ state: "ready", action: "create", targetCount: 1 });
    expect(store.profile).toBeNull();
    const result = await executePortableWatchedOneShotSyncV1({
      store, profileKey: "p", profileId: "google-sub-1", updatedBy: "mobile", expectedConfirmationKey: inspection.confirmationKey,
      checkpoint: null, readLocalPreview: () => local, applyLocalPreview: (next) => { local = deep(next); }, readBackDelaysMs: [0],
    });
    expect(result).toMatchObject({ state: "verified", action: "create", count: 1 });
    expect(store.profile.profileId).toBe("google-sub-1");
    expect(Object.keys(store.profile.namespaces.watched.records)).toEqual(["movie_7"]);
  });

  it("first enrollment blocks local positives that collide with existing cloud tombstones", async () => {
    const seeded = profileWith({ movie_1: movie(1, "One") });
    const tombstoned = buildPortableWatchedSteadyStateProfileV1(seeded, preview({}), {
      profileId: "google-sub-1", updatedBy: "mobile", now: 30,
    });
    const result = await inspectPortableWatchedOneShotSyncV1({
      store: new MemoryStore(tombstoned), profileKey: "p", profileId: "google-sub-1",
      localPreview: preview({ movie_1: movie(1, "One") }), checkpoint: null,
    });
    expect(result).toMatchObject({ state: "needs-review", reason: "tombstone-conflict", conflictKeys: ["movie_1"] });
  });

  it("post-checkpoint local-only change pushes an intentional removal as a tombstone", async () => {
    const cloud = profileWith({ movie_1: movie(1), movie_2: movie(2) });
    const synced = preview({ movie_1: movie(1), movie_2: movie(2) });
    const cp = checkpoint(cloud, synced);
    let local = preview({ movie_2: movie(2) });
    const store = new MemoryStore(cloud);
    const inspection = await inspectPortableWatchedOneShotSyncV1({ store, profileKey: "p", profileId: "google-sub-1", localPreview: local, checkpoint: cp });
    expect(inspection).toMatchObject({ state: "ready", action: "push" });
    const result = await executePortableWatchedOneShotSyncV1({
      store, profileKey: "p", profileId: "google-sub-1", updatedBy: "mobile", expectedConfirmationKey: inspection.confirmationKey,
      checkpoint: cp, readLocalPreview: () => local, applyLocalPreview: (next) => { local = deep(next); }, readBackDelaysMs: [0],
    });
    expect(result.state).toBe("verified");
    expect(store.profile.namespaces.watched.records.movie_1.deletedAt).not.toBeNull();
    expect(store.profile.namespaces.watched.records.movie_2.deletedAt).toBeNull();
  });

  it("post-checkpoint cloud-only change performs a stable pull", async () => {
    const original = profileWith({ movie_1: movie(1) });
    const synced = preview({ movie_1: movie(1) });
    const cp = checkpoint(original, synced);
    const changedCloud = buildPortableWatchedSteadyStateProfileV1(original, preview({ movie_1: movie(1), movie_2: movie(2) }), {
      profileId: "google-sub-1", updatedBy: "desktop", now: 40,
    });
    const store = new MemoryStore(changedCloud);
    let local = synced;
    const inspection = await inspectPortableWatchedOneShotSyncV1({ store, profileKey: "p", profileId: "google-sub-1", localPreview: local, checkpoint: cp });
    expect(inspection).toMatchObject({ state: "ready", action: "pull", targetCount: 2 });
    const result = await executePortableWatchedOneShotSyncV1({
      store, profileKey: "p", profileId: "google-sub-1", updatedBy: "mobile", expectedConfirmationKey: inspection.confirmationKey,
      checkpoint: cp, readLocalPreview: () => local, applyLocalPreview: (next) => { local = deep(next); },
    });
    expect(result).toMatchObject({ state: "verified", action: "pull", count: 2 });
    expect(Object.keys(local.records)).toEqual(["movie_1", "movie_2"]);
  });

  it("fails closed when both sides changed since the checkpoint", async () => {
    const original = profileWith({ movie_1: movie(1) });
    const cp = checkpoint(original, preview({ movie_1: movie(1) }));
    const cloud = buildPortableWatchedSteadyStateProfileV1(original, preview({ movie_1: movie(1), movie_2: movie(2) }), {
      profileId: "google-sub-1", updatedBy: "desktop", now: 40,
    });
    const result = await inspectPortableWatchedOneShotSyncV1({
      store: new MemoryStore(cloud), profileKey: "p", profileId: "google-sub-1",
      localPreview: preview({ movie_1: movie(1), movie_3: movie(3) }), checkpoint: cp,
    });
    expect(result).toMatchObject({ state: "needs-review", reason: "both-changed" });
  });

  it("maps conditional-write conflicts to Needs review without mutating local state", async () => {
    const cloud = profileWith({});
    const store = new MemoryStore(cloud);
    let local = preview({ movie_1: movie(1) });
    const inspection = await inspectPortableWatchedOneShotSyncV1({ store, profileKey: "p", profileId: "google-sub-1", localPreview: local, checkpoint: null });
    store.forceConflict = true;
    const result = await executePortableWatchedOneShotSyncV1({
      store, profileKey: "p", profileId: "google-sub-1", updatedBy: "mobile", expectedConfirmationKey: inspection.confirmationKey,
      checkpoint: null, readLocalPreview: () => local, applyLocalPreview: (next) => { local = deep(next); }, readBackDelaysMs: [0],
    });
    expect(result).toEqual({ state: "needs-review", reason: "cloud-conflict", cloudWasWritten: false });
    expect(Object.keys(local.records)).toEqual(["movie_1"]);
  });

  it("accepts a fresh opaque post-write revision tag when the candidate profile body is identical", async () => {
    const store = new MemoryStore(profileWith({}));
    let local = preview({ movie_1: movie(1) });
    const inspection = await inspectPortableWatchedOneShotSyncV1({
      store, profileKey: "p", profileId: "google-sub-1", localPreview: local, checkpoint: null,
    });
    const originalWrite = store.write.bind(store);
    store.write = async (...args) => {
      const result = await originalWrite(...args);
      const writtenTag = result.revisionTag;
      store.tag = `${writtenTag}-backend-refresh`;
      return { ...result, revisionTag: writtenTag };
    };
    const result = await executePortableWatchedOneShotSyncV1({
      store, profileKey: "p", profileId: "google-sub-1", updatedBy: "desktop", expectedConfirmationKey: inspection.confirmationKey,
      checkpoint: null, readLocalPreview: () => local, applyLocalPreview: (next) => { local = deep(next); }, readBackDelaysMs: [0],
    });
    expect(result).toMatchObject({ state: "verified", action: "push", count: 1 });
  });

  it("still rejects a post-write read when the semantic profile body changed", async () => {
    const store = new MemoryStore(profileWith({}));
    let local = preview({ movie_1: movie(1) });
    const inspection = await inspectPortableWatchedOneShotSyncV1({
      store, profileKey: "p", profileId: "google-sub-1", localPreview: local, checkpoint: null,
    });
    const originalWrite = store.write.bind(store);
    store.write = async (...args) => {
      const result = await originalWrite(...args);
      store.profile.namespaces.future = { changedByAnotherWriter: true };
      store.tag = `${result.revisionTag}-other-writer`;
      return result;
    };
    const result = await executePortableWatchedOneShotSyncV1({
      store, profileKey: "p", profileId: "google-sub-1", updatedBy: "desktop", expectedConfirmationKey: inspection.confirmationKey,
      checkpoint: null, readLocalPreview: () => local, applyLocalPreview: (next) => { local = deep(next); }, readBackDelaysMs: [0],
    });
    expect(result).toEqual({ state: "needs-review", reason: "cloud-verification-failed", cloudWasWritten: true });
  });

  it("compares unrelated namespaces semantically rather than by JSON property order", async () => {
    const base = profileWith({});
    base.namespaces.future = { z: 1, a: { y: 2, x: 3 } };
    const store = new MemoryStore(base);
    let local = preview({ movie_1: movie(1) });
    const inspection = await inspectPortableWatchedOneShotSyncV1({
      store, profileKey: "p", profileId: "google-sub-1", localPreview: local, checkpoint: null,
    });
    const originalRead = store.read.bind(store);
    let afterWrite = false;
    const originalWrite = store.write.bind(store);
    store.write = async (...args) => {
      const result = await originalWrite(...args);
      afterWrite = true;
      return result;
    };
    store.read = async () => {
      const result = await originalRead();
      if (afterWrite && result.state === "found") {
        result.profile.namespaces.future = { a: { x: 3, y: 2 }, z: 1 };
      }
      return result;
    };
    const result = await executePortableWatchedOneShotSyncV1({
      store, profileKey: "p", profileId: "google-sub-1", updatedBy: "desktop", expectedConfirmationKey: inspection.confirmationKey,
      checkpoint: null, readLocalPreview: () => local, applyLocalPreview: (next) => { local = deep(next); }, readBackDelaysMs: [0],
    });
    expect(result).toMatchObject({ state: "verified", action: "push", count: 1 });
  });

  it("does not overwrite a newer local change after a verified cloud write", async () => {
    const store = new MemoryStore(profileWith({ movie_1: movie(1) }));
    let local = preview({ movie_2: movie(2) });
    const inspection = await inspectPortableWatchedOneShotSyncV1({ store, profileKey: "p", profileId: "google-sub-1", localPreview: local, checkpoint: null });
    const originalWrite = store.write.bind(store);
    store.write = async (...args) => {
      const result = await originalWrite(...args);
      local = preview({ movie_2: movie(2), movie_3: movie(3) });
      return result;
    };
    const result = await executePortableWatchedOneShotSyncV1({
      store, profileKey: "p", profileId: "google-sub-1", updatedBy: "desktop", expectedConfirmationKey: inspection.confirmationKey,
      checkpoint: null, readLocalPreview: () => local, applyLocalPreview: (next) => { local = deep(next); }, readBackDelaysMs: [0],
    });
    expect(result).toEqual({ state: "needs-review", reason: "local-changed-during-sync", cloudWasWritten: true });
    expect(Object.keys(local.records)).toEqual(["movie_2", "movie_3"]);
    expect(Object.keys(store.profile.namespaces.watched.records)).toContain("movie_1");
  });
});


describe("P8.4 C3-D automatic Watched steady-state reconciliation", () => {
  it("requires an established checkpoint before any cloud read or write", async () => {
    const store = new MemoryStore(profileWith({ movie_1: movie(1) }));
    const result = await reconcilePortableWatchedSteadyStateSyncV1({
      store,
      profileKey: "p",
      profileId: "google-sub-1",
      updatedBy: "desktop",
      checkpoint: null,
      readLocalPreview: () => preview({ movie_1: movie(1) }),
      applyLocalPreview: () => { throw new Error("must not apply before enrollment"); },
      readBackDelaysMs: [0],
    });
    expect(result).toEqual({ state: "unenrolled" });
    expect(store.readCount).toBe(0);
    expect(store.writeCount).toBe(0);
  });

  it("reuses C3-C to automatically push a one-sided local change and verify a new checkpoint", async () => {
    const original = profileWith({ movie_1: movie(1) });
    const synced = preview({ movie_1: movie(1) });
    const cp = checkpoint(original, synced);
    let local = preview({ movie_1: movie(1), movie_2: movie(2) });
    const store = new MemoryStore(original);
    const result = await reconcilePortableWatchedSteadyStateSyncV1({
      store, profileKey: "p", profileId: "google-sub-1", updatedBy: "desktop", checkpoint: cp,
      readLocalPreview: () => local, applyLocalPreview: (next) => { local = deep(next); },
      readBackDelaysMs: [0], shouldProceed: () => true,
    });
    expect(result).toMatchObject({ state: "verified", action: "push", count: 2 });
    expect(store.writeCount).toBe(1);
    expect(Object.keys(store.profile.namespaces.watched.records)).toEqual(["movie_1", "movie_2"]);
  });

  it("turns an established local unwatch into the existing portable tombstone path", async () => {
    const original = profileWith({ movie_1: movie(1), movie_2: movie(2) });
    const synced = preview({ movie_1: movie(1), movie_2: movie(2) });
    const cp = checkpoint(original, synced);
    let local = preview({ movie_1: movie(1) });
    const store = new MemoryStore(original);
    const result = await reconcilePortableWatchedSteadyStateSyncV1({
      store, profileKey: "p", profileId: "google-sub-1", updatedBy: "desktop", checkpoint: cp,
      readLocalPreview: () => local, applyLocalPreview: (next) => { local = deep(next); },
      readBackDelaysMs: [0], shouldProceed: () => true,
    });
    expect(result).toMatchObject({ state: "verified", action: "push", count: 1 });
    expect(store.writeCount).toBe(1);
    expect(store.profile.namespaces.watched.records.movie_2.deletedAt).not.toBeNull();
    expect(store.profile.namespaces.watched.records.movie_2.value).toBeNull();
  });

  it("automatically pulls a one-sided cloud change through the same stable C3-C pull path", async () => {
    const original = profileWith({ movie_1: movie(1) });
    const synced = preview({ movie_1: movie(1) });
    const cp = checkpoint(original, synced);
    const cloud = buildPortableWatchedSteadyStateProfileV1(original, preview({ movie_1: movie(1), movie_2: movie(2) }), {
      profileId: "google-sub-1", updatedBy: "mobile", now: 40,
    });
    let local = synced;
    const store = new MemoryStore(cloud);
    const result = await reconcilePortableWatchedSteadyStateSyncV1({
      store, profileKey: "p", profileId: "google-sub-1", updatedBy: "desktop", checkpoint: cp,
      readLocalPreview: () => local, applyLocalPreview: (next) => { local = deep(next); },
      shouldProceed: () => true,
    });
    expect(result).toMatchObject({ state: "verified", action: "pull", count: 2 });
    expect(store.writeCount).toBe(0);
    expect(Object.keys(local.records)).toEqual(["movie_1", "movie_2"]);
  });

  it("leaves both copies untouched when both sides changed after the checkpoint", async () => {
    const original = profileWith({ movie_1: movie(1) });
    const cp = checkpoint(original, preview({ movie_1: movie(1) }));
    const cloud = buildPortableWatchedSteadyStateProfileV1(original, preview({ movie_1: movie(1), movie_2: movie(2) }), {
      profileId: "google-sub-1", updatedBy: "mobile", now: 40,
    });
    let local = preview({ movie_1: movie(1), movie_3: movie(3) });
    let applies = 0;
    const store = new MemoryStore(cloud);
    const result = await reconcilePortableWatchedSteadyStateSyncV1({
      store, profileKey: "p", profileId: "google-sub-1", updatedBy: "desktop", checkpoint: cp,
      readLocalPreview: () => local, applyLocalPreview: () => { applies += 1; },
      readBackDelaysMs: [0], shouldProceed: () => true,
    });
    expect(result).toMatchObject({ state: "needs-review", reason: "both-changed", cloudWasWritten: false });
    expect(store.writeCount).toBe(0);
    expect(applies).toBe(0);
    expect(Object.keys(local.records)).toEqual(["movie_1", "movie_3"]);
  });


  it("lets an explicit local choice recover genuine two-sided divergence without unioning Watched intent", async () => {
    const original = profileWith({ movie_1: movie(1) });
    const cp = checkpoint(original, preview({ movie_1: movie(1) }));
    const cloud = buildPortableWatchedSteadyStateProfileV1(original, preview({ movie_1: movie(1), movie_2: movie(2) }), {
      profileId: "google-sub-1", updatedBy: "mobile", now: 40,
    });
    const store = new MemoryStore(cloud);
    let local = preview({ movie_1: movie(1), movie_3: movie(3) });
    const result = await resolvePortableWatchedSteadyStateConflictV1({
      store, profileKey: "p", profileId: "google-sub-1", updatedBy: "desktop", checkpoint: cp,
      resolution: "keep-local", readLocalPreview: () => local, applyLocalPreview: (next) => { local = deep(next); },
      readBackDelaysMs: [0],
    });
    expect(result).toMatchObject({ state: "verified", resolution: "keep-local", count: 2 });
    expect(store.profile.namespaces.watched.records.movie_2.deletedAt).not.toBeNull();
    expect(store.profile.namespaces.watched.records.movie_3.deletedAt).toBeNull();
    expect(Object.keys(local.records)).toEqual(["movie_1", "movie_3"]);
  });

  it("lets an explicit cloud choice recover divergence through a stable pull without rewriting cloud Watched", async () => {
    const original = profileWith({ movie_1: movie(1) });
    const cp = checkpoint(original, preview({ movie_1: movie(1) }));
    const cloud = buildPortableWatchedSteadyStateProfileV1(original, preview({ movie_1: movie(1), movie_2: movie(2) }), {
      profileId: "google-sub-1", updatedBy: "mobile", now: 40,
    });
    const store = new MemoryStore(cloud);
    let local = preview({ movie_1: movie(1), movie_3: movie(3) });
    const result = await resolvePortableWatchedSteadyStateConflictV1({
      store, profileKey: "p", profileId: "google-sub-1", updatedBy: "desktop", checkpoint: cp,
      resolution: "keep-cloud", readLocalPreview: () => local, applyLocalPreview: (next) => { local = deep(next); },
      readBackDelaysMs: [0],
    });
    expect(result).toMatchObject({ state: "verified", resolution: "keep-cloud", count: 2 });
    expect(store.writeCount).toBe(0);
    expect(Object.keys(local.records)).toEqual(["movie_1", "movie_2"]);
  });

  it("cancels an automatic transaction before mutation when local policy turns off", async () => {
    const original = profileWith({ movie_1: movie(1) });
    const cp = checkpoint(original, preview({ movie_1: movie(1) }));
    let local = preview({ movie_1: movie(1), movie_2: movie(2) });
    let applies = 0;
    const store = new MemoryStore(original);
    const result = await reconcilePortableWatchedSteadyStateSyncV1({
      store, profileKey: "p", profileId: "google-sub-1", updatedBy: "desktop", checkpoint: cp,
      readLocalPreview: () => local, applyLocalPreview: () => { applies += 1; },
      readBackDelaysMs: [0], shouldProceed: () => false,
    });
    expect(result).toEqual({ state: "cancelled" });
    expect(store.writeCount).toBe(0);
    expect(applies).toBe(0);
  });
});
