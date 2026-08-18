import { describe, expect, it } from "vitest";
import { evaluatePortableProfileProbe } from "../../../src/renderer/services/portableProfileProbe";

function namespace() {
  return { schemaVersion: 1, revision: 0, updatedAt: 1000, records: {} };
}

function profile(profileId = "google-sub-1") {
  return {
    schemaVersion: 3,
    profileId,
    revision: 2,
    createdAt: 900,
    updatedAt: 1000,
    namespaces: {
      myList: namespace(),
      watched: namespace(),
      history: namespace(),
      progress: namespace(),
      preferences: namespace(),
    },
  };
}

describe("P8.4 C3-A Desktop PortableProfileV3 probe", () => {
  it("accepts a visible profile only when Google subject identity matches", () => {
    const result = evaluatePortableProfileProbe(
      { sub: "google-sub-1", email: "person@example.com" },
      {
        ok: true,
        state: "found",
        profileJson: JSON.stringify(profile()),
        revisionTag: "version:7",
        remoteModifiedAt: 1000,
      },
    );

    expect(result.state).toBe("matched");
    expect(result.cloudProfileId).toBe("google-sub-1");
    expect(result.namespaceNames).toEqual(["history", "myList", "preferences", "progress", "watched"]);
  });

  it("fails closed when a visible profile belongs to a different Orion identity", () => {
    const result = evaluatePortableProfileProbe(
      { sub: "desktop-sub" },
      { ok: true, state: "found", profileJson: JSON.stringify(profile("mobile-sub")), revisionTag: "version:8" },
    );
    expect(result.state).toBe("identity-mismatch");
  });

  it("treats a missing appDataFolder profile as read-only evidence, not permission to create one", () => {
    const result = evaluatePortableProfileProbe(
      { sub: "google-sub-1" },
      { ok: true, state: "missing", revisionTag: null },
    );
    expect(result.state).toBe("missing");
    expect(result.message).toMatch(/created or changed nothing/i);
  });

  it("fails closed if Desktop Google identity has no stable subject id", () => {
    const result = evaluatePortableProfileProbe(
      { email: "person@example.com" },
      { ok: true, state: "found", profileJson: JSON.stringify(profile()), revisionTag: "version:9" },
    );
    expect(result.state).toBe("identity-unavailable");
  });
});
