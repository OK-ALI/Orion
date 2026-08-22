import { describe, expect, it } from "vitest";
import {
  ORION_RELEASE_INTEGRITY_MANIFEST_NAME_V1,
  findOrionReleaseIntegrityArtifactV1,
  resolveOrionReleaseIntegrityManifestV1,
  resolveOrionReleaseTruthV1,
} from "@orion/shared/types";

const release = {
  tag_name: "v3.0.0",
  name: "Orion v3.0.0",
  published_at: "2026-08-22T12:00:00Z",
  prerelease: false,
  draft: false,
  html_url: "https://github.com/OK-ALI/Orion/releases/tag/v3.0.0",
  body: "Release notes",
  assets: [
    {
      name: "Orion-Setup-3.0.0.exe",
      browser_download_url:
        "https://github.com/OK-ALI/Orion/releases/download/v3.0.0/Orion-Setup-3.0.0.exe",
      size: 123456,
      content_type: "application/octet-stream",
    },
    {
      name: ORION_RELEASE_INTEGRITY_MANIFEST_NAME_V1,
      browser_download_url:
        "https://github.com/OK-ALI/Orion/releases/download/v3.0.0/orion-release-integrity-v1.json",
      size: 1024,
      content_type: "application/json",
    },
  ],
};

describe("P9.2 release-integrity contract", () => {
  it("accepts a manifest bound to the exact normalized release", () => {
    const truth = resolveOrionReleaseTruthV1([release], "stable");
    const desktop = truth.desktop.release;

    const manifest = resolveOrionReleaseIntegrityManifestV1(
      {
        schemaVersion: 1,
        tag: "v3.0.0",
        version: "3.0.0",
        artifacts: [
          {
            name: "Orion-Setup-3.0.0.exe",
            size: 123456,
            sha256: "aa".repeat(32),
            signerSha256: "bb".repeat(32),
          },
        ],
      },
      desktop,
    );

    expect(manifest).not.toBeNull();
    expect(
      findOrionReleaseIntegrityArtifactV1(
        manifest,
        "Orion-Setup-3.0.0.exe",
      )?.sha256,
    ).toBe("aa".repeat(32));
  });

  it("rejects integrity metadata for another release", () => {
    const truth = resolveOrionReleaseTruthV1([release], "stable");

    const manifest = resolveOrionReleaseIntegrityManifestV1(
      {
        schemaVersion: 1,
        tag: "v2.0.1",
        version: "2.0.1",
        artifacts: [
          {
            name: "Orion-Setup-3.0.0.exe",
            size: 123456,
            sha256: "aa".repeat(32),
            signerSha256: "bb".repeat(32),
          },
        ],
      },
      truth.desktop.release,
    );

    expect(manifest).toBeNull();
  });

  it("rejects malformed hashes and duplicate artifact identities", () => {
    expect(
      resolveOrionReleaseIntegrityManifestV1({
        schemaVersion: 1,
        tag: "v3.0.0",
        version: "3.0.0",
        artifacts: [
          {
            name: "Orion.exe",
            size: 10,
            sha256: "not-a-sha",
          },
        ],
      }),
    ).toBeNull();

    expect(
      resolveOrionReleaseIntegrityManifestV1({
        schemaVersion: 1,
        tag: "v3.0.0",
        version: "3.0.0",
        artifacts: [
          {
            name: "Orion.exe",
            size: 10,
            sha256: "aa".repeat(32),
          },
          {
            name: "Orion.exe",
            size: 10,
            sha256: "bb".repeat(32),
          },
        ],
      }),
    ).toBeNull();
  });
});