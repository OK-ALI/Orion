export const ORION_RELEASE_TRUTH_SCHEMA_V1 = 1 as const;
export const ORION_MIN_ANDROID_API_V1 = 24 as const;
export const ORION_MIN_ANDROID_LABEL_V1 = 'Android 7.0+' as const;

export type OrionReleaseChannelV1 = 'stable' | 'preview';

export type OrionUpdateStateV1 =
  | 'idle'
  | 'checking'
  | 'current'
  | 'available'
  | 'downloading'
  | 'verifying'
  | 'ready'
  | 'installing'
  | 'restart-required'
  | 'failed'
  | 'unsupported';

export type OrionReleaseArtifactKindV1 =
  | 'windows-exe'
  | 'windows-zip'
  | 'mac-dmg'
  | 'linux-appimage'
  | 'linux-deb'
  | 'linux-pacman'
  | 'android-apk'
  | 'other';

export interface OrionReleaseArtifactV1 {
  name: string;
  url: string;
  size: number | null;
  contentType: string | null;
  kind: OrionReleaseArtifactKindV1;
}

export interface OrionReleaseEntryV1 {
  version: string;
  tag: string;
  name: string;
  publishedAt: string | null;
  prerelease: boolean;
  url: string;
  notes: string;
  artifacts: readonly OrionReleaseArtifactV1[];
}

export interface OrionDesktopReleaseTruthV1 {
  release: OrionReleaseEntryV1 | null;
  installerAvailable: boolean;
}

export interface OrionMobileReleaseTruthV1 {
  release: OrionReleaseEntryV1 | null;
  installerAvailable: boolean;
  apk: OrionReleaseArtifactV1 | null;
  minimumAndroidApi: typeof ORION_MIN_ANDROID_API_V1;
  minimumAndroidLabel: typeof ORION_MIN_ANDROID_LABEL_V1;
}

export interface OrionReleaseTruthV1 {
  schemaVersion: typeof ORION_RELEASE_TRUTH_SCHEMA_V1;
  channel: OrionReleaseChannelV1;
  desktop: OrionDesktopReleaseTruthV1;
  mobile: OrionMobileReleaseTruthV1;
}

export interface GitHubReleaseAssetLikeV1 {
  name?: unknown;
  browser_download_url?: unknown;
  size?: unknown;
  content_type?: unknown;
}

export interface GitHubReleaseLikeV1 {
  tag_name?: unknown;
  name?: unknown;
  published_at?: unknown;
  prerelease?: unknown;
  draft?: unknown;
  html_url?: unknown;
  body?: unknown;
  assets?: unknown;
}

interface ParsedVersionV1 {
  numeric: readonly [number, number, number];
  prerelease: string | null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeOrionReleaseChannelV1(value: unknown): OrionReleaseChannelV1 {
  return value === 'preview' ? 'preview' : 'stable';
}

export function normalizeOrionVersionV1(value: unknown): string {
  const raw = text(value).replace(/^v/i, '');
  const match = raw.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-+](.+))?$/);
  if (!match) return '';
  const major = Number(match[1] || 0);
  const minor = Number(match[2] || 0);
  const patch = Number(match[3] || 0);
  const suffix = text(match[4]);
  return `${major}.${minor}.${patch}${suffix ? `-${suffix}` : ''}`;
}

function parseVersion(value: unknown): ParsedVersionV1 | null {
  const normalized = normalizeOrionVersionV1(value);
  if (!normalized) return null;
  const [main, ...suffix] = normalized.split('-');
  const parts = main.split('.').map((part) => Number(part));
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null;
  return {
    numeric: [parts[0]!, parts[1]!, parts[2]!] as const,
    prerelease: suffix.length ? suffix.join('-') : null,
  };
}

function comparePrerelease(left: string | null, right: string | null): number {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;

  const leftParts = left.split('.');
  const rightParts = right.split('.');
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const a = leftParts[index];
    const b = rightParts[index];
    if (a === undefined) return -1;
    if (b === undefined) return 1;
    if (a === b) continue;
    const aNumber = /^\d+$/.test(a) ? Number(a) : null;
    const bNumber = /^\d+$/.test(b) ? Number(b) : null;
    if (aNumber !== null && bNumber !== null) return aNumber > bNumber ? 1 : -1;
    if (aNumber !== null) return -1;
    if (bNumber !== null) return 1;
    return a.localeCompare(b);
  }
  return 0;
}

export function compareOrionVersionsV1(left: unknown, right: unknown): number {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  for (let index = 0; index < 3; index += 1) {
    if (a.numeric[index] > b.numeric[index]) return 1;
    if (a.numeric[index] < b.numeric[index]) return -1;
  }
  return comparePrerelease(a.prerelease, b.prerelease);
}

export function classifyOrionReleaseArtifactV1(nameValue: unknown): OrionReleaseArtifactKindV1 {
  const name = text(nameValue).toLowerCase();
  if (name.endsWith('.apk')) return 'android-apk';
  if (name.endsWith('.exe')) return 'windows-exe';
  if (name.endsWith('.dmg')) return 'mac-dmg';
  if (name.endsWith('.appimage')) return 'linux-appimage';
  if (name.endsWith('.deb')) return 'linux-deb';
  if (name.endsWith('.pacman')) return 'linux-pacman';
  if (name.endsWith('.zip') && /(?:win|windows)/.test(name)) return 'windows-zip';
  return 'other';
}

function normalizeArtifact(asset: GitHubReleaseAssetLikeV1): OrionReleaseArtifactV1 | null {
  const name = text(asset?.name);
  const url = text(asset?.browser_download_url);
  if (!name || !url) return null;
  const size = typeof asset.size === 'number' && Number.isFinite(asset.size) && asset.size >= 0
    ? asset.size
    : null;
  return {
    name,
    url,
    size,
    contentType: text(asset.content_type) || null,
    kind: classifyOrionReleaseArtifactV1(name),
  };
}

function normalizeRelease(release: GitHubReleaseLikeV1): OrionReleaseEntryV1 | null {
  if (!release || release.draft === true) return null;
  const tag = text(release.tag_name);
  const version = normalizeOrionVersionV1(tag);
  const url = text(release.html_url);
  if (!tag || !version || !url) return null;
  const rawAssets = Array.isArray(release.assets) ? release.assets : [];
  const artifacts = rawAssets
    .map((asset) => normalizeArtifact((asset || {}) as GitHubReleaseAssetLikeV1))
    .filter((asset): asset is OrionReleaseArtifactV1 => !!asset);
  return {
    version,
    tag,
    name: text(release.name) || tag,
    publishedAt: text(release.published_at) || null,
    prerelease: release.prerelease === true,
    url,
    notes: text(release.body),
    artifacts,
  };
}

function isEligibleForChannel(release: OrionReleaseEntryV1, channel: OrionReleaseChannelV1): boolean {
  return channel === 'preview' || !release.prerelease;
}

function newestEligible(
  releases: readonly OrionReleaseEntryV1[],
  channel: OrionReleaseChannelV1,
  predicate: (release: OrionReleaseEntryV1) => boolean,
): OrionReleaseEntryV1 | null {
  return releases
    .filter((release) => isEligibleForChannel(release, channel) && predicate(release))
    .sort((left, right) => {
      const versionOrder = compareOrionVersionsV1(right.version, left.version);
      if (versionOrder !== 0) return versionOrder;
      return String(right.publishedAt || '').localeCompare(String(left.publishedAt || ''));
    })[0] || null;
}

function hasDesktopInstaller(release: OrionReleaseEntryV1): boolean {
  return release.artifacts.some((artifact) => [
    'windows-exe',
    'mac-dmg',
    'linux-appimage',
    'linux-deb',
    'linux-pacman',
  ].includes(artifact.kind));
}

function mobileApk(release: OrionReleaseEntryV1 | null): OrionReleaseArtifactV1 | null {
  return release?.artifacts.find((artifact) => artifact.kind === 'android-apk') || null;
}

export function resolveOrionReleaseTruthV1(
  rawReleases: readonly GitHubReleaseLikeV1[] | unknown,
  channelValue: unknown = 'stable',
): OrionReleaseTruthV1 {
  const channel = normalizeOrionReleaseChannelV1(channelValue);
  const releases = (Array.isArray(rawReleases) ? rawReleases : [])
    .map((release) => normalizeRelease((release || {}) as GitHubReleaseLikeV1))
    .filter((release): release is OrionReleaseEntryV1 => !!release);

  // Preview widens eligibility; it never forces a downgrade to an older prerelease.
  const desktopRelease = newestEligible(releases, channel, hasDesktopInstaller);
  const mobileRelease = newestEligible(
    releases,
    channel,
    (release) => release.artifacts.some((artifact) => artifact.kind === 'android-apk'),
  );
  const apk = mobileApk(mobileRelease);

  return {
    schemaVersion: ORION_RELEASE_TRUTH_SCHEMA_V1,
    channel,
    desktop: {
      release: desktopRelease,
      installerAvailable: !!desktopRelease,
    },
    mobile: {
      release: mobileRelease,
      installerAvailable: !!apk,
      apk,
      minimumAndroidApi: ORION_MIN_ANDROID_API_V1,
      minimumAndroidLabel: ORION_MIN_ANDROID_LABEL_V1,
    },
  };
}
