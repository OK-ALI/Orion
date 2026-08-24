import type {
  MobileDownloadAssetV1,
  MobileDownloadFailureV1,
  MobileDownloadJobV1,
  MobileDownloadMediaIdentityV1,
  MobileDownloadTrackV1,
  OfflineMediaEntryV1,
} from '@orion/shared/types';
import { mmkvStorageAdapter } from '../../services/storageAdapter';
import {
  isMobileDownloadJobStateV1,
  normalizeMobileDownloadProgressV1,
  normalizeMobileDownloadStorageTargetV1,
} from './contracts';

export const MOBILE_DOWNLOAD_REPOSITORY_KEY_V1 = 'orion.mobile.downloads.repository.v1';

export interface MobileDownloadRepositorySnapshotV1 {
  schemaVersion: 1;
  jobs: MobileDownloadJobV1[];
  assets: MobileDownloadAssetV1[];
  offlineEntries: OfflineMediaEntryV1[];
  updatedAt: number;
}

type RepositoryListener = (snapshot: MobileDownloadRepositorySnapshotV1) => void;
const listeners = new Set<RepositoryListener>();

function emptySnapshot(): MobileDownloadRepositorySnapshotV1 {
  return { schemaVersion: 1, jobs: [], assets: [], offlineEntries: [], updatedAt: 0 };
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : stringValue(value);
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function nonNegativeInteger(value: unknown): number {
  const parsed = finite(value);
  return parsed === null ? 0 : Math.max(0, Math.trunc(parsed));
}

function nullableNonNegativeInteger(value: unknown): number | null {
  const parsed = finite(value);
  return parsed === null ? null : Math.max(0, Math.trunc(parsed));
}

function normalizeMedia(value: unknown): MobileDownloadMediaIdentityV1 | null {
  const input = record(value);
  if (!input || input.schemaVersion !== 1) return null;
  if (typeof input.id !== 'string' && typeof input.id !== 'number') return null;
  if (input.mediaType !== 'movie' && input.mediaType !== 'tv') return null;
  const title = stringValue(input.title);
  if (!title) return null;
  if (input.libraryKind !== 'movie' && input.libraryKind !== 'series' && input.libraryKind !== 'anime') return null;

  return {
    schemaVersion: 1,
    id: input.id,
    mediaType: input.mediaType,
    title,
    year: nullableNonNegativeInteger(input.year),
    season: nullableNonNegativeInteger(input.season),
    episode: nullableNonNegativeInteger(input.episode),
    libraryKind: input.libraryKind,
    seriesTitle: nullableString(input.seriesTitle),
    episodeTitle: nullableString(input.episodeTitle),
    posterPath: nullableString(input.posterPath),
    backdropPath: nullableString(input.backdropPath),
  };
}

function normalizeFailure(value: unknown): MobileDownloadFailureV1 | null {
  const input = record(value);
  if (!input) return null;
  const code = stringValue(input.code);
  const message = stringValue(input.message);
  if (!code || !message) return null;
  return {
    code,
    message,
    retryable: input.retryable === true,
    actionRequired: input.actionRequired === true,
  };
}

function normalizeTracks(value: unknown): MobileDownloadTrackV1[] {
  if (!Array.isArray(value)) return [];
  const tracks: MobileDownloadTrackV1[] = [];
  for (const item of value) {
    const input = record(item);
    if (!input) continue;
    const id = stringValue(input.id);
    const label = stringValue(input.label);
    if (!id || !label || (input.kind !== 'audio' && input.kind !== 'subtitle')) continue;
    tracks.push({
      id,
      kind: input.kind,
      language: nullableString(input.language),
      label,
      format: nullableString(input.format),
      default: input.default === true,
    });
  }
  return tracks;
}

export function normalizeMobileDownloadJobV1(value: unknown): MobileDownloadJobV1 | null {
  const input = record(value);
  if (!input || input.schemaVersion !== 1) return null;
  const jobId = stringValue(input.jobId);
  const candidateId = stringValue(input.candidateId);
  const media = normalizeMedia(input.media);
  const storageTarget = normalizeMobileDownloadStorageTargetV1(input.storageTarget);
  if (!jobId || !candidateId || !media || !storageTarget) return null;
  if (input.destination !== 'orion-library' && input.destination !== 'device-storage') return null;
  if (storageTarget.mode !== input.destination) return null;
  if (!['best', '1080p', '720p', '480p'].includes(String(input.requestedQuality))) return null;
  if (!isMobileDownloadJobStateV1(input.state)) return null;

  const selectedSubtitleAssetIds = Array.isArray(input.selectedSubtitleAssetIds)
    ? [...new Set(input.selectedSubtitleAssetIds.map(stringValue).filter((entry): entry is string => Boolean(entry)))]
    : [];

  return {
    schemaVersion: 1,
    jobId,
    candidateId,
    media,
    destination: input.destination,
    storageTarget,
    requestedQuality: input.requestedQuality as MobileDownloadJobV1['requestedQuality'],
    selectedSubtitleAssetIds,
    state: input.state,
    progress: normalizeMobileDownloadProgressV1(input.progress),
    retryCount: nonNegativeInteger(input.retryCount),
    recoveryCount: nonNegativeInteger(input.recoveryCount),
    failure: normalizeFailure(input.failure),
    createdAt: finite(input.createdAt) ?? 0,
    updatedAt: finite(input.updatedAt) ?? 0,
    startedAt: finite(input.startedAt),
    completedAt: finite(input.completedAt),
  };
}

export function normalizeMobileDownloadAssetV1(value: unknown): MobileDownloadAssetV1 | null {
  const input = record(value);
  if (!input || input.schemaVersion !== 1) return null;
  const assetId = stringValue(input.assetId);
  const jobId = stringValue(input.jobId);
  const media = normalizeMedia(input.media);
  const storageTarget = normalizeMobileDownloadStorageTargetV1(input.storageTarget);
  const locator = record(input.locator);
  const locatorValue = stringValue(locator?.value);
  const container = stringValue(input.container);
  const sourceId = stringValue(input.sourceId);
  if (!assetId || !jobId || !media || !storageTarget || !locator || !locatorValue || !container || !sourceId) return null;
  if (input.destination !== 'orion-library' && input.destination !== 'device-storage') return null;
  if (storageTarget.mode !== input.destination) return null;
  if (locator.kind !== 'managed' && locator.kind !== 'content-uri' && locator.kind !== 'file-uri') return null;

  return {
    schemaVersion: 1,
    assetId,
    jobId,
    media,
    destination: input.destination,
    storageTarget,
    locator: { kind: locator.kind, value: locatorValue },
    container,
    mimeType: nullableString(input.mimeType),
    verifiedSizeBytes: Math.max(0, finite(input.verifiedSizeBytes) ?? 0),
    sha256: nullableString(input.sha256),
    tracks: normalizeTracks(input.tracks),
    sourceId,
    playInOrion: input.playInOrion === true,
    externallyVisible: input.externallyVisible === true,
    verifiedAt: finite(input.verifiedAt) ?? 0,
  };
}

export function normalizeOfflineMediaEntryV1(value: unknown): OfflineMediaEntryV1 | null {
  const input = record(value);
  if (!input || input.schemaVersion !== 1) return null;
  const entryId = stringValue(input.entryId);
  const groupKey = stringValue(input.groupKey);
  const media = normalizeMedia(input.media);
  const primaryAssetId = stringValue(input.primaryAssetId);
  const title = stringValue(input.title);
  if (!entryId || !groupKey || !media || !primaryAssetId || !title) return null;

  const assetIds = Array.isArray(input.assetIds)
    ? [...new Set(input.assetIds.map(stringValue).filter((entry): entry is string => Boolean(entry)))]
    : [];
  if (!assetIds.includes(primaryAssetId)) assetIds.unshift(primaryAssetId);

  return {
    schemaVersion: 1,
    entryId,
    groupKey,
    media,
    assetIds,
    primaryAssetId,
    title,
    seriesTitle: nullableString(input.seriesTitle),
    episodeTitle: nullableString(input.episodeTitle),
    posterPath: nullableString(input.posterPath),
    backdropPath: nullableString(input.backdropPath),
    updatedAt: finite(input.updatedAt) ?? 0,
  };
}

/**
 * Schema boundary and migration entry point.
 *
 * P10.1 has only V1 persisted state. Unknown/future schemas fail closed to an
 * empty V1 repository. Every accepted V1 record is rebuilt field-by-field so
 * unknown runtime properties cannot hitchhike into durable/presentation state.
 */
export function normalizeMobileDownloadRepositoryV1(value: unknown): MobileDownloadRepositorySnapshotV1 {
  const input = record(value);
  if (!input || input.schemaVersion !== 1) return emptySnapshot();

  return {
    schemaVersion: 1,
    jobs: Array.isArray(input.jobs)
      ? input.jobs.map(normalizeMobileDownloadJobV1).filter((entry): entry is MobileDownloadJobV1 => Boolean(entry))
      : [],
    assets: Array.isArray(input.assets)
      ? input.assets.map(normalizeMobileDownloadAssetV1).filter((entry): entry is MobileDownloadAssetV1 => Boolean(entry))
      : [],
    offlineEntries: Array.isArray(input.offlineEntries)
      ? input.offlineEntries.map(normalizeOfflineMediaEntryV1).filter((entry): entry is OfflineMediaEntryV1 => Boolean(entry))
      : [],
    updatedAt: finite(input.updatedAt) ?? 0,
  };
}

export function readMobileDownloadRepositoryV1(): MobileDownloadRepositorySnapshotV1 {
  try {
    const raw = mmkvStorageAdapter.get(MOBILE_DOWNLOAD_REPOSITORY_KEY_V1);
    return normalizeMobileDownloadRepositoryV1(raw ? JSON.parse(raw) : null);
  } catch {
    return emptySnapshot();
  }
}

export function writeMobileDownloadRepositoryV1(
  snapshot: MobileDownloadRepositorySnapshotV1,
): MobileDownloadRepositorySnapshotV1 {
  const normalized = normalizeMobileDownloadRepositoryV1({ ...snapshot, schemaVersion: 1 });
  const persisted = { ...normalized, updatedAt: Date.now() };
  mmkvStorageAdapter.set(MOBILE_DOWNLOAD_REPOSITORY_KEY_V1, JSON.stringify(persisted));
  for (const listener of listeners) listener(persisted);
  return persisted;
}

export function listMobileDownloadJobsV1(): MobileDownloadJobV1[] {
  return readMobileDownloadRepositoryV1().jobs;
}

export function listMobileDownloadAssetsV1(): MobileDownloadAssetV1[] {
  return readMobileDownloadRepositoryV1().assets;
}

export function listOfflineMediaEntriesV1(): OfflineMediaEntryV1[] {
  return readMobileDownloadRepositoryV1().offlineEntries;
}

export function upsertMobileDownloadJobV1(job: MobileDownloadJobV1): MobileDownloadRepositorySnapshotV1 {
  const current = readMobileDownloadRepositoryV1();
  const normalizedJob = normalizeMobileDownloadJobV1(job);
  if (!normalizedJob) return current;
  const jobs = [normalizedJob, ...current.jobs.filter((entry) => entry.jobId !== normalizedJob.jobId)];
  return writeMobileDownloadRepositoryV1({ ...current, jobs });
}

export function upsertMobileDownloadAssetV1(asset: MobileDownloadAssetV1): MobileDownloadRepositorySnapshotV1 {
  const current = readMobileDownloadRepositoryV1();
  const normalizedAsset = normalizeMobileDownloadAssetV1(asset);
  if (!normalizedAsset) return current;
  const assets = [normalizedAsset, ...current.assets.filter((entry) => entry.assetId !== normalizedAsset.assetId)];
  return writeMobileDownloadRepositoryV1({ ...current, assets });
}

export function upsertOfflineMediaEntryV1(entry: OfflineMediaEntryV1): MobileDownloadRepositorySnapshotV1 {
  const current = readMobileDownloadRepositoryV1();
  const normalizedEntry = normalizeOfflineMediaEntryV1(entry);
  if (!normalizedEntry) return current;
  const offlineEntries = [normalizedEntry, ...current.offlineEntries.filter((item) => item.entryId !== normalizedEntry.entryId)];
  return writeMobileDownloadRepositoryV1({ ...current, offlineEntries });
}

export function subscribeMobileDownloadRepositoryV1(listener: RepositoryListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
