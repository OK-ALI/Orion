import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  ORION_ANDROID_RELEASE_SIGNER_SHA256_V1,
  ORION_RELEASE_INTEGRITY_MANIFEST_NAME_V1,
  compareOrionVersionsV1,
  findOrionReleaseIntegrityArtifactV1,
  normalizeOrionReleaseChannelV1,
  resolveOrionReleaseIntegrityManifestV1,
  resolveOrionReleaseTruthV1,
  type OrionReleaseChannelV1,
  type OrionReleaseEntryV1,
  type OrionReleaseIntegrityArtifactV1,
  type OrionReleaseTruthV1,
  type OrionUpdateStateV1,
} from '@orion/shared/types';
import { mmkvStorageAdapter } from './storageAdapter';
import {
  applyMobileStagedRolloutV1,
  getMobileRolloutBucketV1,
  isMobileRolloutEligibleV1,
  resolveMobileRolloutPercentageV1,
  type MobileRolloutStatusV1,
} from './mobileUpdateLifecycle';

const GITHUB_RELEASES_URL = 'https://api.github.com/repos/OK-ALI/Orion/releases?per_page=20';
const CHANNEL_KEY = 'orion.mobile.updateChannel.v1';
const LAST_CHECKED_KEY = 'orion.mobile.updateLastChecked.v1';

export interface MobileReleaseIntegrityV1 {
  status: 'unavailable' | 'missing' | 'invalid' | 'ready';
  reason: string | null;
  artifact: OrionReleaseIntegrityArtifactV1 | null;
}

export interface MobileReleaseCheckV1 {
  state: Extract<OrionUpdateStateV1, 'current' | 'available' | 'unsupported'>;
  currentVersion: string;
  channel: OrionReleaseChannelV1;
  lastCheckedAt: number;
  releaseTruth: OrionReleaseTruthV1;
  publishedRelease: OrionReleaseEntryV1 | null;
  rollout: MobileRolloutStatusV1;
  integrity: MobileReleaseIntegrityV1;
}

export function getMobileCurrentVersionV1(): string {
  return Constants.expoConfig?.version || '0.0.0';
}

export function getMobileUpdateChannelV1(): OrionReleaseChannelV1 {
  return normalizeOrionReleaseChannelV1(mmkvStorageAdapter.get(CHANNEL_KEY));
}

export function setMobileUpdateChannelV1(channel: OrionReleaseChannelV1): void {
  mmkvStorageAdapter.set(CHANNEL_KEY, normalizeOrionReleaseChannelV1(channel));
}

export function getMobileUpdateLastCheckedV1(): number | null {
  const value = Number(mmkvStorageAdapter.get(LAST_CHECKED_KEY));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function setLastChecked(value: number): void {
  mmkvStorageAdapter.set(LAST_CHECKED_KEY, String(value));
}

function androidApiLevel(): number | null {
  if (Platform.OS !== 'android') return null;
  const value = Number(Platform.Version);
  return Number.isFinite(value) ? value : null;
}

async function fetchWithTimeout(url: string, accept: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    return await fetch(url, {
      headers: { Accept: accept },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchGitHubReleases(): Promise<unknown[]> {
  const response = await fetchWithTimeout(GITHUB_RELEASES_URL, 'application/vnd.github+json');
  if (!response.ok) throw new Error(`GitHub API error ${response.status}`);
  const releases = await response.json();
  if (!Array.isArray(releases)) throw new Error('GitHub release response is invalid');
  return releases;
}

async function resolveMobileIntegrity(releaseTruth: OrionReleaseTruthV1): Promise<MobileReleaseIntegrityV1> {
  const release = releaseTruth.mobile.release;
  const apk = releaseTruth.mobile.apk;
  if (!release || !apk) {
    return { status: 'unavailable', reason: 'No Mobile APK is published for this channel.', artifact: null };
  }

  const manifestAsset = release.artifacts.find(
    (artifact) => artifact.name === ORION_RELEASE_INTEGRITY_MANIFEST_NAME_V1,
  );
  if (!manifestAsset) {
    return { status: 'missing', reason: 'This release does not publish Orion integrity metadata.', artifact: null };
  }

  try {
    const response = await fetchWithTimeout(manifestAsset.url, 'application/json');
    if (!response.ok) {
      return { status: 'invalid', reason: `Integrity manifest returned HTTP ${response.status}.`, artifact: null };
    }
    const manifest = resolveOrionReleaseIntegrityManifestV1(await response.json(), release);
    const artifact = findOrionReleaseIntegrityArtifactV1(manifest, apk.name);
    if (!manifest || !artifact) {
      return { status: 'invalid', reason: 'The published APK is missing from the release integrity manifest.', artifact: null };
    }
    if (apk.size !== null && apk.size !== artifact.size) {
      return { status: 'invalid', reason: 'The published APK size does not match its integrity record.', artifact: null };
    }
    if (artifact.signerSha256 !== ORION_ANDROID_RELEASE_SIGNER_SHA256_V1) {
      return { status: 'invalid', reason: 'The published APK signer does not match Orion production identity.', artifact: null };
    }
    return { status: 'ready', reason: null, artifact };
  } catch (error) {
    return {
      status: 'invalid',
      reason: error instanceof Error ? error.message : 'Unable to load release integrity metadata.',
      artifact: null,
    };
  }
}

export async function checkMobileReleaseTruthV1(
  requestedChannel: OrionReleaseChannelV1 = getMobileUpdateChannelV1(),
): Promise<MobileReleaseCheckV1> {
  const channel = normalizeOrionReleaseChannelV1(requestedChannel);
  const releases = await fetchGitHubReleases();
  const publishedTruth = resolveOrionReleaseTruthV1(releases, channel);
  const publishedRelease = publishedTruth.mobile.release;
  const rolloutBucket = getMobileRolloutBucketV1();
  const rolloutPercentage = resolveMobileRolloutPercentageV1(publishedRelease?.notes);
  const rolloutStaged = !!publishedRelease && rolloutPercentage < 100;
  const rolloutEligible = !rolloutStaged
    || isMobileRolloutEligibleV1(publishedRelease?.notes, rolloutBucket);
  const rolloutReleases = applyMobileStagedRolloutV1(releases, rolloutBucket);
  const releaseTruth = resolveOrionReleaseTruthV1(rolloutReleases, channel);
  const integrity = await resolveMobileIntegrity(releaseTruth);
  const currentVersion = getMobileCurrentVersionV1();
  const offeredRelease = releaseTruth.mobile.release;
  const apiLevel = androidApiLevel();
  const unsupported = apiLevel !== null && apiLevel < releaseTruth.mobile.minimumAndroidApi;
  const hasNewerPublishedMobile = !!publishedRelease
    && compareOrionVersionsV1(publishedRelease.version, currentVersion) > 0;
  const hasNewerOfferedMobile = !!offeredRelease
    && compareOrionVersionsV1(offeredRelease.version, currentVersion) > 0;
  const rolloutDeferred = hasNewerPublishedMobile
    && rolloutStaged
    && !rolloutEligible
    && (!offeredRelease || compareOrionVersionsV1(publishedRelease?.version, offeredRelease.version) > 0);
  const rollout: MobileRolloutStatusV1 = {
    bucket: rolloutBucket,
    percentage: rolloutPercentage,
    staged: rolloutStaged,
    eligible: rolloutEligible,
    deferred: rolloutDeferred,
    latestVersion: publishedRelease?.version || null,
    offeredVersion: offeredRelease?.version || null,
  };
  const state: MobileReleaseCheckV1['state'] = unsupported
    ? 'unsupported'
    : hasNewerOfferedMobile
      ? 'available'
      : 'current';
  const lastCheckedAt = Date.now();
  setLastChecked(lastCheckedAt);
  return {
    state,
    currentVersion,
    channel,
    lastCheckedAt,
    releaseTruth,
    publishedRelease,
    rollout,
    integrity,
  };
}
