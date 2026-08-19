import type { PortableProfileV3, PortableRecordNamespaceV3 } from './portableProfile';
import {
  normalizePortableWatchedValueV1,
  portableViewingKey,
  type PortableWatchedValueV1,
} from './portableViewingState';

export interface PortableWatchedPreviewV1 {
  records: Record<string, PortableWatchedValueV1>;
  rejectedKeys: string[];
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

export function portableWatchedPreviewSignatureV1(preview: PortableWatchedPreviewV1): string {
  const keys = Object.keys(preview.records).sort();
  return JSON.stringify({
    records: keys.map((key) => [key, canonicalValue(preview.records[key])]),
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
    const unchanged = !!existing && existing.deletedAt == null && !!existingValue && watchedEquals(existingValue, value);
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
