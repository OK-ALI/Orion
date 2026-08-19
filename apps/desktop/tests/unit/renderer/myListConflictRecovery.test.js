import { describe, expect, it } from "vitest";
import { resolvePortableMyListSteadyStateConflictV1 } from "@orion/shared/api";
import {
  buildPortableMyListPreviewFromProfileV1,
  buildPortableMyListSteadyStateProfileV1,
  createPortableProfileV3,
  portableMyListNamespaceSignatureV1,
  portableMyListPreviewSignatureV1,
} from "@orion/shared/types";

function item(id, order, title = `Title ${id}`) {
  return {
    schemaVersion: 1,
    mediaType: "movie",
    mediaId: id,
    title,
    posterPath: null,
    backdropPath: null,
    year: null,
    order,
  };
}

function preview(ids) {
  const records = {};
  const orderedKeys = [];
  ids.forEach((id, order) => {
    const key = `movie_${id}`;
    orderedKeys.push(key);
    records[key] = item(id, order);
  });
  return { records, orderedKeys, rejectedKeys: [] };
}

function deep(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

class MemoryStore {
  constructor(profile) {
    this.profile = profile;
    this.tag = "tag-1";
    this.writeCount = 0;
  }

  async read() {
    return { state: "found", profile: deep(this.profile), revisionTag: this.tag, remoteModifiedAt: null };
  }

  async write(_key, request) {
    this.writeCount += 1;
    if (request.expectedRevisionTag !== this.tag) return { state: "conflict", revisionTag: this.tag };
    this.profile = deep(request.profile);
    this.tag = `${this.tag}-next`;
    return { state: "written", revisionTag: this.tag, remoteModifiedAt: null };
  }
}

function seededProfile(ids, now = 10) {
  const base = createPortableProfileV3("google-sub-1", 1);
  return buildPortableMyListSteadyStateProfileV1(base, preview(ids), {
    profileId: "google-sub-1",
    updatedBy: "seed",
    now,
  });
}

function checkpoint(profile, local) {
  return {
    profileId: "google-sub-1",
    localSignature: portableMyListPreviewSignatureV1(local),
    cloudNamespaceSignature: portableMyListNamespaceSignatureV1(profile),
    verifiedAt: 20,
  };
}

describe("P8 steady-state My List conflict recovery", () => {
  it("keeps the explicit local copy without silently preserving cloud-only titles", async () => {
    const original = seededProfile([1]);
    const cp = checkpoint(original, preview([1]));
    const changedCloud = buildPortableMyListSteadyStateProfileV1(original, preview([1, 2]), {
      profileId: "google-sub-1",
      updatedBy: "mobile",
      now: 40,
    });
    const store = new MemoryStore(changedCloud);
    let local = preview([1, 3]);

    const result = await resolvePortableMyListSteadyStateConflictV1({
      store,
      profileKey: "p",
      profileId: "google-sub-1",
      updatedBy: "desktop",
      checkpoint: cp,
      resolution: "keep-local",
      readLocalPreview: () => local,
      applyLocalPreview: (next) => { local = deep(next); },
      readBackDelaysMs: [0],
    });

    expect(result).toMatchObject({ state: "verified", resolution: "keep-local", count: 2 });
    const cloud = buildPortableMyListPreviewFromProfileV1(store.profile);
    expect(cloud.orderedKeys).toEqual(["movie_1", "movie_3"]);
    expect(store.profile.namespaces.myList.records.movie_2.deletedAt).not.toBeNull();
    expect(local.orderedKeys).toEqual(["movie_1", "movie_3"]);
  });

  it("keeps the explicit cloud copy through a stable pull without writing cloud state", async () => {
    const original = seededProfile([1]);
    const cp = checkpoint(original, preview([1]));
    const changedCloud = buildPortableMyListSteadyStateProfileV1(original, preview([1, 2]), {
      profileId: "google-sub-1",
      updatedBy: "mobile",
      now: 40,
    });
    const store = new MemoryStore(changedCloud);
    let local = preview([1, 3]);

    const result = await resolvePortableMyListSteadyStateConflictV1({
      store,
      profileKey: "p",
      profileId: "google-sub-1",
      updatedBy: "desktop",
      checkpoint: cp,
      resolution: "keep-cloud",
      readLocalPreview: () => local,
      applyLocalPreview: (next) => { local = deep(next); },
      readBackDelaysMs: [0],
    });

    expect(result).toMatchObject({ state: "verified", resolution: "keep-cloud", count: 2 });
    expect(store.writeCount).toBe(0);
    expect(local.orderedKeys).toEqual(["movie_1", "movie_2"]);
  });
});
