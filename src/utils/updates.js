// ── App Update Utilities ──────────────────────────────────────────────────────

export const GITHUB_REPO = "OK-ALI/orion";

export function normaliseVersion(v) {
  const parts = String(v).replace(/^v/i, "").split(".");
  while (parts.length < 3) parts.push("0");
  return parts.slice(0, 3).map(Number);
}

export function semverGt(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return false;
}

async function getCurrentVersion() {
  if (typeof window !== "undefined" && window.electron?.getAppVersion) {
    return window.electron.getAppVersion();
  }
  return "0.0.0";
}

export async function checkForUpdates() {
  const currentVersion = await getCurrentVersion();

  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=10`,
    {
      headers: { Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(8000),
    },
  );
  if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
  const releases = await res.json();

  const data = Array.isArray(releases)
    ? releases.find((r) => !r.prerelease && !r.draft)
    : null;
  if (!data) throw new Error("No stable release found");

  const latestRaw = (data.tag_name || "").replace(/^v/i, "");
  const latestParts = normaliseVersion(latestRaw);
  const currentParts = normaliseVersion(currentVersion);
  const url =
    data.html_url || `https://github.com/${GITHUB_REPO}/releases/latest`;

  const assets = {};
  for (const asset of data.assets || []) {
    const name = asset.name.toLowerCase();
    if (name.endsWith(".appimage"))
      assets.appimage = asset.browser_download_url;
    else if (name.endsWith(".deb")) assets.deb = asset.browser_download_url;
    else if (name.endsWith(".exe"))
      assets.exe = asset.browser_download_url;
    else if (name.endsWith(".pacman"))
      assets.pacman = asset.browser_download_url;
    else if (name.endsWith(".dmg"))
      assets.dmg = asset.browser_download_url;
  }

  return {
    latest: latestRaw || currentVersion,
    current: currentVersion,
    url,
    changelog: data.body || "",
    assets,
    hasUpdate: latestRaw !== "" && semverGt(latestParts, currentParts),
  };
}
