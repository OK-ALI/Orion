// ── App Update Utilities ──────────────────────────────────────────────────────

import {
  ORION_RELEASE_INTEGRITY_MANIFEST_NAME_V1,
  compareOrionVersionsV1,
  findOrionReleaseIntegrityArtifactV1,
  normalizeOrionReleaseChannelV1,
  normalizeOrionVersionV1,
  resolveOrionReleaseIntegrityManifestV1,
  resolveOrionReleaseTruthV1,
} from "@orion/shared/types";

export const GITHUB_REPO = "OK-ALI/Orion";

const DESKTOP_FORMAT_BY_KIND = Object.freeze({
  "windows-exe": "exe",
  "linux-appimage": "appimage",
  "linux-deb": "deb",
  "linux-pacman": "pacman",
  "mac-dmg": "dmg",
});

// Backward-compatible helpers retained for existing callers/tests.
export function normaliseVersion(v) {
  const normalized = normalizeOrionVersionV1(v) || "0.0.0";
  return normalized.split("-")[0].split(".").map(Number);
}

export function semverGt(a, b) {
  return compareOrionVersionsV1(a.join("."), b.join(".")) > 0;
}

async function getCurrentVersion() {
  if (typeof window !== "undefined" && window.electron?.getAppVersion) {
    return window.electron.getAppVersion();
  }
  return "0.0.0";
}

async function fetchGithubReleases() {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=20`,
    {
      headers: { Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(8000),
    },
  );

  if (!res.ok) throw new Error(`GitHub API error ${res.status}`);

  const releases = await res.json();

  if (!Array.isArray(releases)) {
    throw new Error("GitHub release response is invalid");
  }

  return releases;
}

export async function fetchOrionReleaseTruth(channel = "stable") {
  const releases = await fetchGithubReleases();

  return resolveOrionReleaseTruthV1(
    releases,
    normalizeOrionReleaseChannelV1(channel),
  );
}

async function fetchReleaseIntegrity(release) {
  const manifestAsset = (release?.artifacts || []).find(
    (artifact) => artifact.name === ORION_RELEASE_INTEGRITY_MANIFEST_NAME_V1,
  );

  if (!manifestAsset) {
    return {
      status: "missing",
      reason: "This release does not publish Orion integrity metadata.",
      manifestUrl: null,
      manifest: null,
    };
  }

  try {
    const response = await fetch(manifestAsset.url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return {
        status: "invalid",
        reason: `Integrity manifest returned HTTP ${response.status}.`,
        manifestUrl: manifestAsset.url,
        manifest: null,
      };
    }

    const manifest = resolveOrionReleaseIntegrityManifestV1(
      await response.json(),
      release,
    );

    if (!manifest) {
      return {
        status: "invalid",
        reason: "Release integrity metadata is invalid or belongs to another release.",
        manifestUrl: manifestAsset.url,
        manifest: null,
      };
    }

    return {
      status: "ready",
      reason: null,
      manifestUrl: manifestAsset.url,
      manifest,
    };
  } catch (error) {
    return {
      status: "invalid",
      reason: error?.message || "Unable to load release integrity metadata.",
      manifestUrl: manifestAsset.url,
      manifest: null,
    };
  }
}

function formatForArtifact(artifact) {
  return DESKTOP_FORMAT_BY_KIND[artifact?.kind] || null;
}

function buildIntegrityByFormat(release, integrityResult) {
  const byFormat = {};

  for (const artifact of release?.artifacts || []) {
    const format = formatForArtifact(artifact);
    if (!format) continue;

    const entry = findOrionReleaseIntegrityArtifactV1(
      integrityResult.manifest,
      artifact.name,
    );

    if (!entry) {
      byFormat[format] = {
        ok: false,
        reason: integrityResult.reason || `No integrity record exists for ${artifact.name}.`,
      };
      continue;
    }

    if (artifact.size !== null && artifact.size !== entry.size) {
      byFormat[format] = {
        ok: false,
        reason: `Published size does not match the integrity record for ${artifact.name}.`,
      };
      continue;
    }

    if (format === "exe" && !entry.signerSha256) {
      byFormat[format] = {
        ok: false,
        reason: "Windows automatic installation requires a published signer fingerprint.",
      };
      continue;
    }

    byFormat[format] = {
      ok: true,
      reason: null,
      assetName: artifact.name,
      expectedSize: entry.size,
      expectedSha256: entry.sha256,
      expectedSignerSha256: entry.signerSha256,
    };
  }

  return byFormat;
}

export async function checkForUpdates(channel = "stable") {
  const currentVersion = await getCurrentVersion();
  const releaseTruth = await fetchOrionReleaseTruth(channel);
  const data = releaseTruth.desktop.release;

  if (!data) {
    throw new Error(`No ${releaseTruth.channel} Desktop release found`);
  }

  const assets = {};
  const assetNames = {};

  for (const artifact of data.artifacts || []) {
    const format = formatForArtifact(artifact);
    if (!format) continue;
    assets[format] = artifact.url;
    assetNames[format] = artifact.name;
  }

  const integrityResult = await fetchReleaseIntegrity(data);

  const integrity = {
    status: integrityResult.status,
    reason: integrityResult.reason,
    manifestUrl: integrityResult.manifestUrl,
    byFormat: buildIntegrityByFormat(data, integrityResult),
  };

  return {
    latest: data.version || currentVersion,
    current: currentVersion,
    url: data.url,
    changelog: data.notes || "",
    assets,
    assetNames,
    integrity,
    channel: releaseTruth.channel,
    releaseTruth,
    hasUpdate: compareOrionVersionsV1(data.version, currentVersion) > 0,
  };
}