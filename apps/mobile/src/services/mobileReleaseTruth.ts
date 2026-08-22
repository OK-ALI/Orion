import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  compareOrionVersionsV1,
  normalizeOrionReleaseChannelV1,
  resolveOrionReleaseTruthV1,
  type OrionReleaseChannelV1,
  type OrionReleaseTruthV1,
  type OrionUpdateStateV1,
} from '@orion/shared/types';
import { mmkvStorageAdapter } from './storageAdapter';

const GITHUB_RELEASES_URL = 'https://api.github.com/repos/OK-ALI/Orion/releases?per_page=20';
const CHANNEL_KEY = 'orion.mobile.updateChannel.v1';
const LAST_CHECKED_KEY = 'orion.mobile.updateLastChecked.v1';

export interface MobileReleaseCheckV1 {
  state: Extract<OrionUpdateStateV1, 'current' | 'available' | 'unsupported'>;
  currentVersion: string;
  channel: OrionReleaseChannelV1;
  lastCheckedAt: number;
  releaseTruth: OrionReleaseTruthV1;
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

async function fetchGitHubReleases(): Promise<unknown[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(GITHUB_RELEASES_URL, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`GitHub API error ${response.status}`);
    const releases = await response.json();
    if (!Array.isArray(releases)) throw new Error('GitHub release response is invalid');
    return releases;
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkMobileReleaseTruthV1(
  requestedChannel: OrionReleaseChannelV1 = getMobileUpdateChannelV1(),
): Promise<MobileReleaseCheckV1> {
  const channel = normalizeOrionReleaseChannelV1(requestedChannel);
  const releases = await fetchGitHubReleases();
  const releaseTruth = resolveOrionReleaseTruthV1(releases, channel);
  const currentVersion = getMobileCurrentVersionV1();
  const latestMobileRelease = releaseTruth.mobile.release;
  const apiLevel = androidApiLevel();
  const unsupported = apiLevel !== null && apiLevel < releaseTruth.mobile.minimumAndroidApi;
  const hasNewerPublishedMobile = !!latestMobileRelease
    && compareOrionVersionsV1(latestMobileRelease.version, currentVersion) > 0;
  const state: MobileReleaseCheckV1['state'] = unsupported
    ? 'unsupported'
    : hasNewerPublishedMobile
      ? 'available'
      : 'current';
  const lastCheckedAt = Date.now();
  setLastChecked(lastCheckedAt);
  return { state, currentVersion, channel, lastCheckedAt, releaseTruth };
}
