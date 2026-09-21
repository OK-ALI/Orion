// ── App Update Utilities ──────────────────────────────────────────────────────

import {
  ORION_RELEASE_INTEGRITY_MANIFEST_NAME_V1,
  ORION_RELEASE_INTEGRITY_MANIFEST_NAME_V2,
  ORION_PROVIDER_STATUS_MANIFEST_NAME_V1,
  ORION_WINDOWS_RELEASE_SIGNER_SHA256_V1,
  canOrionUpdaterInstallV2,
  compareOrionVersionsV1,
  findOrionReleaseIntegrityArtifactV1,
  findOrionReleaseIntegrityArtifactV2,
  normalizeOrionReleaseChannelV1,
  normalizeOrionVersionV1,
  resolveOrionReleaseIntegrityManifestV1,
  resolveOrionReleaseIntegrityEnvelopeV2,
  resolveOrionProviderStatusV1,
  resolveOrionReleaseTruthV1,
  installOrionProviderStatusV1,
  verifyOrionReleaseSignatureV1,
} from "@orion/shared/types";

export const GITHUB_REPO = "OK-ALI/Orion";

const HIDDEN_RELEASE_DIRECTIVE_RE = /<!--\s*orion-(?:mobile|desktop)-rollout\s*:\s*\d{1,3}\s*-->/gi;

const desktopUpdateCheckListeners = new Set();
let latestDesktopUpdateCheckEvent = null;

function publishDesktopUpdateCheckEvent(event) {
  latestDesktopUpdateCheckEvent = event;

  for (const listener of desktopUpdateCheckListeners) {
    try {
      listener(event);
    } catch (error) {
      console.error("Desktop update-check listener failed:", error);
    }
  }
}

export function subscribeToDesktopUpdateChecks(listener) {
  if (typeof listener !== "function") return () => {};

  desktopUpdateCheckListeners.add(listener);

  if (latestDesktopUpdateCheckEvent) {
    try {
      listener(latestDesktopUpdateCheckEvent);
    } catch (error) {
      console.error("Desktop update-check listener failed:", error);
    }
  }

  return () => {
    desktopUpdateCheckListeners.delete(listener);
  };
}

export function formatOrionReleaseNotes(notes = "") {
  return String(notes || "")
    .replace(HIDDEN_RELEASE_DIRECTIVE_RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

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
    `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=100`,
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

async function refreshProviderStatus(release) {
  const asset = release?.artifacts?.find(
    (candidate) => candidate.name === ORION_PROVIDER_STATUS_MANIFEST_NAME_V1,
  );
  if (!asset) return false;
  try {
    const response = await fetch(asset.url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return false;
    const payload = resolveOrionProviderStatusV1(
      await response.json(),
      verifyOrionReleaseSignatureV1,
    );
    return installOrionProviderStatusV1(payload);
  } catch {
    return false;
  }
}

export async function fetchOrionReleaseTruth(channel = "stable") {
  const releases = await fetchGithubReleases();

  return resolveOrionReleaseTruthV1(
    releases,
    normalizeOrionReleaseChannelV1(channel),
  );
}

async function fetchReleaseIntegrity(release, currentVersion = "0.0.0") {
  const v2Asset = (release?.artifacts || []).find(
    (artifact) => artifact.name === ORION_RELEASE_INTEGRITY_MANIFEST_NAME_V2,
  );
  if (v2Asset) {
    try {
      const response = await fetch(v2Asset.url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error("Release verification is unavailable.");
      const envelope = await response.json();
      const payload = resolveOrionReleaseIntegrityEnvelopeV2(
        envelope,
        verifyOrionReleaseSignatureV1,
        release,
      );
      if (!payload) throw new Error("Release verification failed.");
      if (
        compareOrionVersionsV1(release.version, currentVersion) > 0
        && !canOrionUpdaterInstallV2(payload, currentVersion)
      ) {
        return {
          status: "incompatible",
          reason: "Install an earlier Orion update first.",
          manifestUrl: v2Asset.url,
          manifest: null,
          payload: null,
          schemaVersion: 2,
        };
      }
      return {
        status: "ready",
        reason: null,
        manifestUrl: v2Asset.url,
        manifest: null,
        payload,
        envelope,
        schemaVersion: 2,
      };
    } catch {
      return {
        status: "invalid",
        reason: "We couldn't verify this update. Nothing was installed.",
        manifestUrl: v2Asset.url,
        manifest: null,
        payload: null,
        schemaVersion: 2,
      };
    }
  }

  if (compareOrionVersionsV1(currentVersion, "3.2.0") >= 0) {
    return {
      status: "missing",
      reason: "We couldn't verify this update. Nothing was installed.",
      manifestUrl: null,
      manifest: null,
      payload: null,
      schemaVersion: null,
    };
  }
  const manifestAsset = (release?.artifacts || []).find(
    (artifact) => artifact.name === ORION_RELEASE_INTEGRITY_MANIFEST_NAME_V1,
  );

  if (!manifestAsset) {
    return {
      status: "missing",
      reason: "This release does not publish Orion integrity metadata.",
      manifestUrl: null,
      manifest: null,
      payload: null,
      schemaVersion: 1,
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
        payload: null,
        schemaVersion: 1,
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
        payload: null,
        schemaVersion: 1,
      };
    }

    return {
      status: "ready",
      reason: null,
      manifestUrl: manifestAsset.url,
      manifest,
      payload: null,
      schemaVersion: 1,
    };
  } catch (error) {
    return {
      status: "invalid",
      reason: error?.message || "Unable to load release integrity metadata.",
      manifestUrl: manifestAsset.url,
      manifest: null,
      payload: null,
      schemaVersion: 1,
    };
  }
}

async function findCompatibleDesktopBridge(releases, channel, currentVersion, excludedTag) {
  for (const rawRelease of releases) {
    const truth = resolveOrionReleaseTruthV1([rawRelease], channel);
    const candidate = truth.desktop.release;
    if (!candidate || candidate.tag === excludedTag) continue;
    if (compareOrionVersionsV1(candidate.version, currentVersion) <= 0) continue;
    const integrity = await fetchReleaseIntegrity(candidate, currentVersion);
    if (integrity.status === "ready") return { truth, release: candidate, integrity };
  }
  return null;
}


function buildMobileInstallerIntegrity(release, apk, integrityResult) {
  if (!release || !apk) {
    return {
      ok: false,
      status: "unpublished",
      reason: "No Android installer is published in this channel yet.",
      expectedSize: null,
      expectedSha256: null,
      expectedSignerSha256: null,
    };
  }

  if (integrityResult.status !== "ready" || (!integrityResult.manifest && !integrityResult.payload)) {
    return {
      ok: false,
      status: integrityResult.status,
      reason: integrityResult.reason || "Release verification metadata is unavailable.",
      expectedSize: null,
      expectedSha256: null,
      expectedSignerSha256: null,
    };
  }

  const entry = integrityResult.schemaVersion === 2
    ? findOrionReleaseIntegrityArtifactV2(integrityResult.payload, apk.name, "android")
    : findOrionReleaseIntegrityArtifactV1(integrityResult.manifest, apk.name);

  if (!entry) {
    return {
      ok: false,
      status: "invalid",
      reason: `No integrity record exists for ${apk.name}.`,
      expectedSize: null,
      expectedSha256: null,
      expectedSignerSha256: null,
    };
  }

  if (apk.size !== null && apk.size !== entry.size) {
    return {
      ok: false,
      status: "invalid",
      reason: "The published APK size does not match Orion release metadata.",
      expectedSize: null,
      expectedSha256: null,
      expectedSignerSha256: null,
    };
  }

  if (!entry.signerSha256) {
    return {
      ok: false,
      status: "invalid",
      reason: "The published APK is missing Orion signing-identity metadata.",
      expectedSize: null,
      expectedSha256: null,
      expectedSignerSha256: null,
    };
  }

  return {
    ok: true,
    status: "ready",
    reason: null,
    expectedSize: entry.size,
    expectedSha256: entry.sha256,
    expectedSignerSha256: entry.signerSha256,
  };
}

export async function fetchOrionMobileDistributionStatus(channel = "stable") {
  const releaseTruth = await fetchOrionReleaseTruth(channel);
  const release = releaseTruth.mobile.release;
  const apk = releaseTruth.mobile.apk;

  if (!release || !apk) {
    return {
      releaseTruth,
      release,
      apk,
      notes: formatOrionReleaseNotes(release?.notes),
      installerReady: false,
      integrity: buildMobileInstallerIntegrity(release, apk, {
        status: "missing",
        reason: "No Android installer is published in this channel yet.",
        manifest: null,
      }),
    };
  }

  const integrityResult = await fetchReleaseIntegrity(release, release.version);
  const integrity = buildMobileInstallerIntegrity(release, apk, integrityResult);

  return {
    releaseTruth,
    release,
    apk,
    notes: formatOrionReleaseNotes(release.notes),
    installerReady: integrity.ok,
    integrity,
  };
}

function formatForArtifact(artifact) {
  return DESKTOP_FORMAT_BY_KIND[artifact?.kind] || null;
}

function buildIntegrityByFormat(release, integrityResult) {
  const byFormat = {};

  for (const artifact of release?.artifacts || []) {
    const format = formatForArtifact(artifact);
    if (!format) continue;

    const entry = integrityResult.schemaVersion === 2
      ? findOrionReleaseIntegrityArtifactV2(integrityResult.payload, artifact.name, "windows")
      : findOrionReleaseIntegrityArtifactV1(integrityResult.manifest, artifact.name);

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

    if (format === "exe" && entry.signerSha256 !== ORION_WINDOWS_RELEASE_SIGNER_SHA256_V1) {
      byFormat[format] = {
        ok: false,
        reason: "We couldn't verify this update. Nothing was installed.",
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
  const requestedChannel = normalizeOrionReleaseChannelV1(channel);

  publishDesktopUpdateCheckEvent({
    phase: "checking",
    channel: requestedChannel,
    result: null,
    error: null,
  });

  try {
    const currentVersion = await getCurrentVersion();
    const updateTransaction = typeof window !== "undefined" && window.electron?.getUpdateTransaction
      ? await window.electron.getUpdateTransaction().catch(() => null)
      : null;
    const releases = await fetchGithubReleases();
    let releaseTruth = resolveOrionReleaseTruthV1(releases, requestedChannel);
    let data = releaseTruth.desktop.release;

    if (!data) {
      throw new Error(`No ${releaseTruth.channel} Desktop release found`);
    }

    await refreshProviderStatus(data);

    let integrityResult = await fetchReleaseIntegrity(data, currentVersion);
    if (integrityResult.status === "incompatible") {
      const bridge = await findCompatibleDesktopBridge(
        releases,
        requestedChannel,
        currentVersion,
        data.tag,
      );
      if (bridge) {
        releaseTruth = bridge.truth;
        data = bridge.release;
        integrityResult = bridge.integrity;
      }
    }

    const assets = {};
    const assetNames = {};

    for (const artifact of data.artifacts || []) {
      const format = formatForArtifact(artifact);
      if (!format) continue;
      assets[format] = artifact.url;
      assetNames[format] = artifact.name;
    }

    const integrity = {
      status: integrityResult.status,
      envelope: integrityResult.envelope || null,
      reason: integrityResult.reason,
      manifestUrl: integrityResult.manifestUrl,
      byFormat: buildIntegrityByFormat(data, integrityResult),
    };

    const result = {
      latest: data.version || currentVersion,
      current: currentVersion,
      url: data.url,
      changelog: formatOrionReleaseNotes(data.notes),
      assets,
      assetNames,
      integrity,
      channel: releaseTruth.channel,
      releaseTruth,
      updateTransaction,
      hasUpdate: compareOrionVersionsV1(data.version, currentVersion) > 0,
    };

    publishDesktopUpdateCheckEvent({
      phase: "complete",
      channel: releaseTruth.channel,
      result,
      error: null,
    });

    return result;
  } catch (error) {
    publishDesktopUpdateCheckEvent({
      phase: "failed",
      channel: requestedChannel,
      result: null,
      error,
    });
    throw error;
  }
}
