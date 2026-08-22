// ── App Update Utilities ──────────────────────────────────────────────────────

import {
  compareOrionVersionsV1,
  normalizeOrionReleaseChannelV1,
  normalizeOrionVersionV1,
  resolveOrionReleaseTruthV1,
} from "@orion/shared/types";

export const GITHUB_REPO = "OK-ALI/Orion";

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
  if (!Array.isArray(releases)) throw new Error("GitHub release response is invalid");
  return releases;
}

export async function fetchOrionReleaseTruth(channel = "stable") {
  const releases = await fetchGithubReleases();
  return resolveOrionReleaseTruthV1(
    releases,
    normalizeOrionReleaseChannelV1(channel),
  );
}

export async function checkForUpdates(channel = "stable") {
  const currentVersion = await getCurrentVersion();
  const releaseTruth = await fetchOrionReleaseTruth(channel);
  const data = releaseTruth.desktop.release;
  if (!data) throw new Error(`No ${releaseTruth.channel} Desktop release found`);

  const assets = {};
  for (const artifact of data.artifacts || []) {
    if (artifact.kind === "linux-appimage") assets.appimage = artifact.url;
    else if (artifact.kind === "linux-deb") assets.deb = artifact.url;
    else if (artifact.kind === "windows-exe") assets.exe = artifact.url;
    else if (artifact.kind === "linux-pacman") assets.pacman = artifact.url;
    else if (artifact.kind === "mac-dmg") assets.dmg = artifact.url;
  }

  return {
    latest: data.version || currentVersion,
    current: currentVersion,
    url: data.url,
    changelog: data.notes || "",
    assets,
    channel: releaseTruth.channel,
    releaseTruth,
    hasUpdate: compareOrionVersionsV1(data.version, currentVersion) > 0,
  };
}
