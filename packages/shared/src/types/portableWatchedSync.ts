import { createPortableProfileV3 } from './portableProfile';
import type { PortableProfileV3, PortableRecordNamespaceV3 } from './portableProfile';
import {
  normalizePortableWatchedValueV1,
  portableViewingKey,
  type PortableWatchedValueV1,
} from './portableViewingState';

export const PORTABLE_WATCHED_SYNC_CHECKPOINT_SCHEMA_VERSION = 1 as const;

export interface PortableWatchedPreviewV1 {
  records: Record<string, PortableWatchedValueV1>;
  rejectedKeys: string[];
}

export interface PortableWatchedSyncCheckpointV1 {
  schemaVersion: typeof PORTABLE_WATCHED_SYNC_CHECKPOINT_SCHEMA_VERSION;
  profileId: string;
  localTruthSignature: string;
  cloudNamespaceSignature: string;
  verifiedAt: number;
}

export type PortableWatchedInspectionV1 =
  | { state: 'empty'; activeCount: 0; tombstoneCount: 0 }
  | { state: 'populated'; activeCount: number; tombstoneCount: number }
  | { state: 'invalid'; activeCount: number; tombstoneCount: number };

export interface PortableWatchedSteadyStateOptionsV1 {
  profileId: string;
  updatedBy: string;
  now?: number;
}

export type PortableWatchedReconcileDecisionV1 =
  | {
      state: 'aligned';
      cloudPreview: PortableWatchedPreviewV1;
      cloudNamespaceSignature: string;
    }
  | {
      state: 'ready';
      action: 'create' | 'push' | 'merge' | 'pull';
      targetPreview: PortableWatchedPreviewV1;
      cloudNamespaceSignature: string | null;
    }
  | {
      state: 'needs-review';
      reason:
        | 'local-invalid'
        | 'profile-missing-after-checkpoint'
        | 'profile-identity-mismatch'
        | 'cloud-invalid'
        | 'checkpoint-identity-mismatch'
        | 'tombstone-conflict'
        | 'both-changed'
        | 'checkpoint-drift';
      conflictKeys: string[];
    };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isPortableRecordNamespaceV3(value: unknown): value is PortableRecordNamespaceV3 {
  return isPlainObject(value)
    && value.schemaVersion === 1
    && typeof value.revision === 'number'
    && Number.isInteger(value.revision)
    && value.revision >= 0
    && typeof value.updatedAt === 'number'
    && Number.isFinite(value.updatedAt)
    && value.updatedAt >= 0
    && isPlainObject(value.records);
}

function requireText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

function requireTimestamp(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('Portable Watched timestamp must be finite.');
  }
  return value;
}

function isCanonicalPortableWatchedKey(key: string): boolean {
  return /^movie_.+$/u.test(key) || /^tv_.+_s[1-9]\d*_e[1-9]\d*$/u.test(key);
}

function watchedEquals(left: PortableWatchedValueV1, right: PortableWatchedValueV1): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!isPlainObject(value)) return value;
  const next: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) next[key] = canonicalValue(value[key]);
  return next;
}

function cloneWatchedValue(value: PortableWatchedValueV1): PortableWatchedValueV1 {
  return {
    schemaVersion: value.schemaVersion,
    kind: value.kind,
    media: { ...value.media },
  };
}

export function buildPortableWatchedPreviewV1(
  records: Record<string, unknown>,
): PortableWatchedPreviewV1 {
  const accepted: Record<string, PortableWatchedValueV1> = {};
  const rejectedKeys: string[] = [];
  for (const [key, raw] of Object.entries(records || {})) {
    const value = normalizePortableWatchedValueV1(raw);
    if (!value) {
      rejectedKeys.push(key);
      continue;
    }
    const canonicalKey = portableViewingKey(
      value.media.mediaType,
      value.media.id,
      value.media.season,
      value.media.episode,
    );
    if (canonicalKey !== key || accepted[key]) {
      rejectedKeys.push(key);
      continue;
    }
    accepted[key] = value;
  }
  return { records: accepted, rejectedKeys: rejectedKeys.sort() };
}

export function inspectPortableWatchedV1(profile: PortableProfileV3): PortableWatchedInspectionV1 {
  const namespace = profile.namespaces.watched;
  if (namespace == null) return { state: 'empty', activeCount: 0, tombstoneCount: 0 };
  if (!isPortableRecordNamespaceV3(namespace)) return { state: 'invalid', activeCount: 0, tombstoneCount: 0 };

  let activeCount = 0;
  let tombstoneCount = 0;
  for (const [key, record] of Object.entries(namespace.records)) {
    if (!isCanonicalPortableWatchedKey(key)) return { state: 'invalid', activeCount, tombstoneCount };
    if (record.deletedAt != null) {
      if (record.value !== null) return { state: 'invalid', activeCount, tombstoneCount };
      tombstoneCount += 1;
      continue;
    }
    const value = normalizePortableWatchedValueV1(record.value);
    if (!value) return { state: 'invalid', activeCount, tombstoneCount };
    const canonicalKey = portableViewingKey(value.media.mediaType, value.media.id, value.media.season, value.media.episode);
    if (canonicalKey !== key) return { state: 'invalid', activeCount, tombstoneCount };
    activeCount += 1;
  }

  return activeCount === 0 && tombstoneCount === 0
    ? { state: 'empty', activeCount: 0, tombstoneCount: 0 }
    : { state: 'populated', activeCount, tombstoneCount };
}

export function buildPortableWatchedPreviewFromProfileV1(
  profile: PortableProfileV3,
): PortableWatchedPreviewV1 | null {
  if (inspectPortableWatchedV1(profile).state === 'invalid') return null;
  const namespace = profile.namespaces.watched;
  if (namespace == null) return { records: {}, rejectedKeys: [] };
  if (!isPortableRecordNamespaceV3(namespace)) return null;

  const records: Record<string, PortableWatchedValueV1> = {};
  for (const [key, record] of Object.entries(namespace.records)) {
    if (record.deletedAt != null) continue;
    const value = normalizePortableWatchedValueV1(record.value);
    if (!value) return null;
    records[key] = value;
  }
  return { records, rejectedKeys: [] };
}

export function portableWatchedTombstoneKeysV1(profile: PortableProfileV3): string[] | null {
  if (inspectPortableWatchedV1(profile).state === 'invalid') return null;
  const namespace = profile.namespaces.watched;
  if (namespace == null) return [];
  if (!isPortableRecordNamespaceV3(namespace)) return null;
  return Object.entries(namespace.records)
    .filter(([, record]) => record.deletedAt != null)
    .map(([key]) => key)
    .sort();
}

export function portableWatchedPreviewSignatureV1(preview: PortableWatchedPreviewV1): string {
  const keys = Object.keys(preview.records).sort();
  return JSON.stringify({
    records: keys.map((key) => [key, canonicalValue(preview.records[key])]),
    rejectedKeys: [...preview.rejectedKeys].sort(),
  });
}

/**
 * Watched truth is exact identity, not presentation metadata. Desktop stores
 * only boolean watched keys and may not know the same title/year metadata as
 * Mobile, so a verified checkpoint must not manufacture a two-sided conflict
 * merely because presentation metadata differs for the same movie/episode.
 */
export function portableWatchedTruthSignatureV1(preview: PortableWatchedPreviewV1): string {
  return JSON.stringify({
    keys: Object.keys(preview.records).sort(),
    rejectedKeys: [...preview.rejectedKeys].sort(),
  });
}

export function portableWatchedNamespaceSignatureV1(profile: PortableProfileV3): string | null {
  const namespace = profile.namespaces.watched;
  if (namespace == null) return JSON.stringify({ state: 'missing' });
  if (!isPortableRecordNamespaceV3(namespace) || inspectPortableWatchedV1(profile).state === 'invalid') return null;
  const records = Object.keys(namespace.records).sort().map((key) => {
    const record = namespace.records[key]!;
    return [key, record.revision, record.updatedAt, record.updatedBy, record.deletedAt, canonicalValue(record.value)];
  });
  return JSON.stringify({
    schemaVersion: namespace.schemaVersion,
    revision: namespace.revision,
    updatedAt: namespace.updatedAt,
    records,
  });
}

export function portableWatchedActiveMatchesPreviewV1(
  profile: PortableProfileV3,
  preview: PortableWatchedPreviewV1,
): boolean {
  if (preview.rejectedKeys.length > 0) return false;
  const cloud = buildPortableWatchedPreviewFromProfileV1(profile);
  if (!cloud) return false;
  const localKeys = Object.keys(preview.records).sort();
  const cloudKeys = Object.keys(cloud.records).sort();
  if (localKeys.length !== cloudKeys.length) return false;
  return localKeys.every((key, index) => (
    cloudKeys[index] === key
    && watchedEquals(preview.records[key]!, cloud.records[key]!)
  ));
}

export function portableWatchedTruthMatchesPreviewV1(
  profile: PortableProfileV3,
  preview: PortableWatchedPreviewV1,
): boolean {
  if (preview.rejectedKeys.length > 0) return false;
  const cloud = buildPortableWatchedPreviewFromProfileV1(profile);
  if (!cloud) return false;
  return portableWatchedTruthSignatureV1(cloud) === portableWatchedTruthSignatureV1(preview);
}

/**
 * First enrollment is additive. Existing cloud positives stay positive, local
 * positives are added, and cloud tombstones are never resurrected implicitly.
 */
export function buildPortableWatchedFirstEnrollmentPreviewV1(
  profile: PortableProfileV3,
  localPreview: PortableWatchedPreviewV1,
): { preview: PortableWatchedPreviewV1; tombstoneConflictKeys: string[] } | null {
  if (localPreview.rejectedKeys.length > 0 || inspectPortableWatchedV1(profile).state === 'invalid') return null;
  const cloudPreview = buildPortableWatchedPreviewFromProfileV1(profile);
  const tombstones = portableWatchedTombstoneKeysV1(profile);
  if (!cloudPreview || !tombstones) return null;
  const tombstoneSet = new Set(tombstones);
  const conflictKeys = Object.keys(localPreview.records).filter((key) => tombstoneSet.has(key)).sort();
  if (conflictKeys.length > 0) {
    return { preview: cloudPreview, tombstoneConflictKeys: conflictKeys };
  }

  const records: Record<string, PortableWatchedValueV1> = {};
  for (const key of Object.keys(cloudPreview.records).sort()) {
    records[key] = cloneWatchedValue(cloudPreview.records[key]!);
  }
  for (const key of Object.keys(localPreview.records).sort()) {
    if (!records[key]) records[key] = cloneWatchedValue(localPreview.records[key]!);
  }
  return { preview: { records, rejectedKeys: [] }, tombstoneConflictKeys: [] };
}

export function planPortableWatchedReconciliationV1(input: {
  profile: PortableProfileV3 | null;
  profileId: string;
  localPreview: PortableWatchedPreviewV1;
  checkpoint: PortableWatchedSyncCheckpointV1 | null;
}): PortableWatchedReconcileDecisionV1 {
  const profileId = requireText(input.profileId, 'Portable profile id');
  if (input.localPreview.rejectedKeys.length > 0) {
    return { state: 'needs-review', reason: 'local-invalid', conflictKeys: [...input.localPreview.rejectedKeys] };
  }
  if (input.checkpoint && input.checkpoint.profileId !== profileId) {
    return { state: 'needs-review', reason: 'checkpoint-identity-mismatch', conflictKeys: [] };
  }
  if (!input.profile) {
    if (input.checkpoint) {
      return { state: 'needs-review', reason: 'profile-missing-after-checkpoint', conflictKeys: [] };
    }
    return {
      state: 'ready',
      action: 'create',
      targetPreview: input.localPreview,
      cloudNamespaceSignature: null,
    };
  }
  if (input.profile.profileId !== profileId) {
    return { state: 'needs-review', reason: 'profile-identity-mismatch', conflictKeys: [] };
  }
  if (inspectPortableWatchedV1(input.profile).state === 'invalid') {
    return { state: 'needs-review', reason: 'cloud-invalid', conflictKeys: [] };
  }
  const cloudPreview = buildPortableWatchedPreviewFromProfileV1(input.profile);
  const cloudNamespaceSignature = portableWatchedNamespaceSignatureV1(input.profile);
  if (!cloudPreview || !cloudNamespaceSignature) {
    return { state: 'needs-review', reason: 'cloud-invalid', conflictKeys: [] };
  }

  if (portableWatchedTruthMatchesPreviewV1(input.profile, input.localPreview)) {
    return { state: 'aligned', cloudPreview, cloudNamespaceSignature };
  }

  if (!input.checkpoint) {
    const first = buildPortableWatchedFirstEnrollmentPreviewV1(input.profile, input.localPreview);
    if (!first) return { state: 'needs-review', reason: 'cloud-invalid', conflictKeys: [] };
    if (first.tombstoneConflictKeys.length > 0) {
      return { state: 'needs-review', reason: 'tombstone-conflict', conflictKeys: first.tombstoneConflictKeys };
    }
    const localKeys = new Set(Object.keys(input.localPreview.records));
    const cloudKeys = new Set(Object.keys(cloudPreview.records));
    const localOnly = [...localKeys].filter((key) => !cloudKeys.has(key));
    const cloudOnly = [...cloudKeys].filter((key) => !localKeys.has(key));
    if (localOnly.length === 0 && cloudOnly.length > 0) {
      return { state: 'ready', action: 'pull', targetPreview: cloudPreview, cloudNamespaceSignature };
    }
    return {
      state: 'ready',
      action: localOnly.length > 0 && cloudOnly.length > 0 ? 'merge' : 'push',
      targetPreview: first.preview,
      cloudNamespaceSignature,
    };
  }

  const localChanged = portableWatchedTruthSignatureV1(input.localPreview) !== input.checkpoint.localTruthSignature;
  const cloudChanged = cloudNamespaceSignature !== input.checkpoint.cloudNamespaceSignature;
  if (localChanged && cloudChanged) {
    return { state: 'needs-review', reason: 'both-changed', conflictKeys: [] };
  }
  if (localChanged) {
    return { state: 'ready', action: 'push', targetPreview: input.localPreview, cloudNamespaceSignature };
  }
  if (cloudChanged) {
    return { state: 'ready', action: 'pull', targetPreview: cloudPreview, cloudNamespaceSignature };
  }
  return { state: 'needs-review', reason: 'checkpoint-drift', conflictKeys: [] };
}

export function buildPortableWatchedSteadyStateProfileV1(
  baseProfile: PortableProfileV3,
  preview: PortableWatchedPreviewV1,
  options: PortableWatchedSteadyStateOptionsV1,
): PortableProfileV3 {
  if (preview.rejectedKeys.length > 0) throw new Error('Portable Watched sync cannot include rejected local entries.');
  const profileId = requireText(options.profileId, 'Portable profile id');
  const updatedBy = requireText(options.updatedBy, 'Portable Watched updatedBy');
  if (baseProfile.profileId !== profileId) throw new Error('Portable Watched profile identity mismatch.');
  if (inspectPortableWatchedV1(baseProfile).state === 'invalid') {
    throw new Error('Portable Watched sync requires a valid cloud Watched namespace.');
  }

  const existingNamespace = baseProfile.namespaces.watched;
  const previous: PortableRecordNamespaceV3 = isPortableRecordNamespaceV3(existingNamespace)
    ? existingNamespace
    : { schemaVersion: 1, revision: 0, updatedAt: baseProfile.updatedAt, records: {} };
  const requestedNow = requireTimestamp(options.now ?? Date.now());
  const now = Math.max(requestedNow, baseProfile.updatedAt + 1, previous.updatedAt + 1);
  const records: PortableRecordNamespaceV3['records'] = {};

  for (const key of Object.keys(preview.records).sort()) {
    const value = preview.records[key]!;
    const canonicalKey = portableViewingKey(value.media.mediaType, value.media.id, value.media.season, value.media.episode);
    if (canonicalKey !== key) throw new Error('Portable Watched preview key is inconsistent.');
    const existing = previous.records[key];
    const existingValue = existing?.deletedAt == null ? normalizePortableWatchedValueV1(existing?.value) : null;
    // Watched truth is the canonical key. Preserve an existing active cloud
    // record when that key remains active so a metadata-poor device cannot
    // overwrite richer title/year metadata merely while syncing another key.
    const unchanged = !!existing && existing.deletedAt == null && !!existingValue;
    records[key] = unchanged ? existing : {
      revision: (existing?.revision ?? 0) + 1,
      updatedAt: now,
      updatedBy,
      deletedAt: null,
      value: { schemaVersion: value.schemaVersion, kind: value.kind, media: { ...value.media } },
    };
  }

  for (const [key, existing] of Object.entries(previous.records)) {
    if (Object.prototype.hasOwnProperty.call(preview.records, key)) continue;
    records[key] = existing.deletedAt != null ? existing : {
      revision: existing.revision + 1,
      updatedAt: now,
      updatedBy,
      deletedAt: now,
      value: null,
    };
  }

  return {
    ...baseProfile,
    revision: baseProfile.revision + 1,
    updatedAt: now,
    namespaces: {
      ...baseProfile.namespaces,
      watched: {
        schemaVersion: 1,
        revision: previous.revision + 1,
        updatedAt: now,
        records,
      },
    },
  };
}

export function buildPortableWatchedFirstEnrollmentProfileV1(
  baseProfile: PortableProfileV3 | null,
  preview: PortableWatchedPreviewV1,
  options: PortableWatchedSteadyStateOptionsV1,
): PortableProfileV3 {
  const profileId = requireText(options.profileId, 'Portable profile id');
  const now = requireTimestamp(options.now ?? Date.now());
  const base = baseProfile || createPortableProfileV3(profileId, now);
  return buildPortableWatchedSteadyStateProfileV1(base, preview, { ...options, profileId, now });
}
