import { mmkvStorageAdapter } from './storageAdapter';

const MOBILE_ROLLOUT_BUCKET_KEY = 'orion.mobile.updateRolloutBucket.v1';
const MOBILE_ROLLOUT_DIRECTIVE = /<!--\s*orion-mobile-rollout\s*:\s*(\d{1,3})\s*%?\s*-->/i;
const MOBILE_ROLLOUT_DIRECTIVE_GLOBAL = /<!--\s*orion-mobile-rollout\s*:\s*\d{1,3}\s*%?\s*-->/gi;

export interface MobileRolloutStatusV1 {
  bucket: number;
  percentage: number;
  staged: boolean;
  eligible: boolean;
  deferred: boolean;
  latestVersion: string | null;
  offeredVersion: string | null;
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isAndroidApkAsset(asset: unknown): boolean {
  if (!asset || typeof asset !== 'object') return false;
  const name = asText((asset as { name?: unknown }).name).toLowerCase();
  return name.endsWith('.apk');
}

export function getMobileRolloutBucketV1(): number {
  const stored = Number(mmkvStorageAdapter.get(MOBILE_ROLLOUT_BUCKET_KEY));
  if (Number.isInteger(stored) && stored >= 0 && stored <= 99) return stored;

  const bucket = Math.floor(Math.random() * 100);
  mmkvStorageAdapter.set(MOBILE_ROLLOUT_BUCKET_KEY, String(bucket));
  return bucket;
}

export function resolveMobileRolloutPercentageV1(notesValue: unknown): number {
  const notes = asText(notesValue);
  const match = notes.match(MOBILE_ROLLOUT_DIRECTIVE);
  if (!match) return 100;
  const percentage = Number(match[1]);
  return Number.isInteger(percentage) && percentage >= 0 && percentage <= 100
    ? percentage
    : 100;
}

export function isMobileRolloutEligibleV1(notesValue: unknown, bucketValue: number): boolean {
  const percentage = resolveMobileRolloutPercentageV1(notesValue);
  const bucket = Number.isInteger(bucketValue) && bucketValue >= 0 && bucketValue <= 99
    ? bucketValue
    : 99;
  return percentage >= 100 || bucket < percentage;
}

export function applyMobileStagedRolloutV1(rawReleases: readonly unknown[], bucket: number): unknown[] {
  return rawReleases.map((rawRelease) => {
    if (!rawRelease || typeof rawRelease !== 'object') return rawRelease;
    const release = rawRelease as Record<string, unknown>;
    const percentage = resolveMobileRolloutPercentageV1(release.body);
    if (percentage >= 100 || isMobileRolloutEligibleV1(release.body, bucket)) return rawRelease;
    if (!Array.isArray(release.assets)) return rawRelease;

    // Keep the release and all non-Mobile assets visible. Only the Android APK is
    // withheld for devices outside this release's deterministic rollout cohort.
    return {
      ...release,
      assets: release.assets.filter((asset) => !isAndroidApkAsset(asset)),
    };
  });
}

export function formatMobileReleaseNotesV1(notesValue: unknown): string {
  const notes = asText(notesValue);
  if (!notes) return '';
  return notes
    .replace(MOBILE_ROLLOUT_DIRECTIVE_GLOBAL, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
