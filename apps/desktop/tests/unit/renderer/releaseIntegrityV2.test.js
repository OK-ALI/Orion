import { describe, expect, it } from "vitest";
import {
  canOrionUpdaterInstallV2,
  findOrionReleaseIntegrityArtifactV2,
  resolveOrionReleaseIntegrityEnvelopeV2,
} from "@orion/shared/types";

const release = {
  version: "4.0.0",
  tag: "v4.0.0",
  name: "Orion 4.0.0",
  publishedAt: "2026-09-15T00:00:00.000Z",
  prerelease: false,
  url: "https://github.com/OK-ALI/Orion/releases/tag/v4.0.0",
  notes: "",
  artifacts: [],
};

function envelope(payload) {
  return {
    schemaVersion: 2,
    algorithm: "Ed25519",
    keyId: "test-key",
    payload: Buffer.from(JSON.stringify(payload), "utf8").toString("base64url"),
    signature: Buffer.alloc(64, 1).toString("base64url"),
  };
}

function futurePayload(overrides = {}) {
  return {
    schemaVersion: 2,
    sequence: 400,
    tag: "v4.0.0",
    version: "4.0.0",
    channel: "stable",
    publishedAt: "2026-09-15T00:00:00.000Z",
    minimumUpdaterVersion: "3.2.0",
    rolloutPercentage: 100,
    artifacts: [{
      platform: "windows",
      name: "Orion.Setup.4.0.0.exe",
      size: 4096,
      sha256: "ab".repeat(32),
      productId: "com.orion.musicplanet",
      buildNumber: null,
      signerSha256: "99b64a75f98bbe40ac9a435753c41b5159297df9870fb3fe7a927d2d50db6dc5",
    }],
    ...overrides,
  };
}

describe("OrionReleaseIntegrityV2", () => {
  it("processes a signed simulated future release and enforces updater compatibility", () => {
    const payload = resolveOrionReleaseIntegrityEnvelopeV2(
      envelope(futurePayload()),
      () => true,
      release,
    );
    expect(payload?.version).toBe("4.0.0");
    expect(canOrionUpdaterInstallV2(payload, "3.2.0")).toBe(true);
    expect(canOrionUpdaterInstallV2(payload, "3.1.0")).toBe(false);
    expect(findOrionReleaseIntegrityArtifactV2(payload, "Orion.Setup.4.0.0.exe", "windows")?.productId)
      .toBe("com.orion.musicplanet");
  });

  it("rejects a failed signature, wrong release binding, and unknown channel", () => {
    expect(resolveOrionReleaseIntegrityEnvelopeV2(envelope(futurePayload()), () => false, release)).toBeNull();
    expect(resolveOrionReleaseIntegrityEnvelopeV2(envelope(futurePayload({ tag: "v4.0.1" })), () => true, release)).toBeNull();
    expect(resolveOrionReleaseIntegrityEnvelopeV2(envelope(futurePayload({ channel: "nightly" })), () => true, release)).toBeNull();
  });
});
