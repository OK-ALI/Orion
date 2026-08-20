import type {
  PortableProfileRecordV3,
  PortableProfileV3,
  PortableRecordNamespaceV3,
} from './portableProfile';
import {
  normalizePortableHistoryValueV1,
  normalizePortableProgressValueV1,
  portableViewingKey,
  type PortableHistoryValueV1,
  type PortableProgressValueV1,
} from './portableViewingState';

export interface PortableViewingActivityPreviewV1 {
  history: Record<string, PortableHistoryValueV1>;
  progress: Record<string, PortableProgressValueV1>;
  rejected: { history: string[]; progress: string[] };
}

export interface PortableViewingActivityStateV1 extends PortableViewingActivityPreviewV1 {
  tombstones: { history: string[]; progress: string[] };
}

export interface PortableViewingActivityBuildOptionsV1 {
  profileId: string;
  updatedBy: string;
  now?: number;
}

export type PortableViewingActivityMergeV1 =
  | {
      state: 'merged';
      historyRecords: Record<string, PortableProfileRecordV3>;
      progressRecords: Record<string, PortableProfileRecordV3>;
    }
  | {
      state: 'needs-review';
      historyConflictKeys: string[];
      progressConflictKeys: string[];
    };

type ActivityDomain = 'history' | 'progress';
type ActivityValue = PortableHistoryValueV1 | PortableProgressValueV1;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function requireText(value: string, label: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

function requireTimestamp(value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new Error('Portable viewing activity timestamp must be finite.');
  return value;
}

function namespaceFrom(profile: PortableProfileV3, domain: ActivityDomain): PortableRecordNamespaceV3 | null {
  const value = profile.namespaces[domain];
  if (!isPlainObject(value) || value.schemaVersion !== 1 || !isPlainObject(value.records)) return null;
  if (!Number.isInteger(value.revision) || Number(value.revision) < 0) return null;
  if (!Number.isFinite(value.updatedAt) || Number(value.updatedAt) < 0) return null;
  return value as unknown as PortableRecordNamespaceV3;
}

function normalizeValue(domain: ActivityDomain, value: unknown): ActivityValue | null {
  return domain === 'history'
    ? normalizePortableHistoryValueV1(value)
    : normalizePortableProgressValueV1(value);
}

function eventTime(domain: ActivityDomain, record: PortableProfileRecordV3): number | null {
  if (record.deletedAt != null) return record.deletedAt;
  const value = normalizeValue(domain, record.value);
  return value ? value.lastPlayedAt : null;
}

function canonicalKey(value: ActivityValue): string {
  return portableViewingKey(
    value.media.mediaType,
    value.media.id,
    value.media.season,
    value.media.episode,
  );
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (!isPlainObject(value)) return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

function cloneRecord(record: PortableProfileRecordV3): PortableProfileRecordV3 {
  return JSON.parse(JSON.stringify(record)) as PortableProfileRecordV3;
}

function preferRecord(left: PortableProfileRecordV3, right: PortableProfileRecordV3): PortableProfileRecordV3 {
  if (left.revision !== right.revision) return cloneRecord(left.revision > right.revision ? left : right);
  if (left.updatedAt !== right.updatedAt) return cloneRecord(left.updatedAt > right.updatedAt ? left : right);
  return cloneRecord(left.updatedBy.localeCompare(right.updatedBy) >= 0 ? left : right);
}

function recordMapSignature(records: Record<string, PortableProfileRecordV3>): unknown[] {
  return Object.keys(records).sort().map((key) => [key, records[key]]);
}

export function portableViewingActivityTruthSignatureV1(preview: PortableViewingActivityPreviewV1): string {
  return canonicalJson({
    history: Object.keys(preview.history).sort().map((key) => [key, preview.history[key]]),
    progress: Object.keys(preview.progress).sort().map((key) => [key, preview.progress[key]]),
    rejected: {
      history: [...preview.rejected.history].sort(),
      progress: [...preview.rejected.progress].sort(),
    },
  });
}

export function portableViewingActivityNamespaceSignatureV1(profile: PortableProfileV3): string | null {
  const history = namespaceFrom(profile, 'history');
  const progress = namespaceFrom(profile, 'progress');
  if (!history || !progress) return null;
  return canonicalJson({
    history: { revision: history.revision, records: recordMapSignature(history.records) },
    progress: { revision: progress.revision, records: recordMapSignature(progress.records) },
  });
}

function readDomainState(profile: PortableProfileV3, domain: ActivityDomain) {
  const namespace = namespaceFrom(profile, domain);
  if (!namespace) return null;
  const active: Record<string, ActivityValue> = {};
  const tombstones: string[] = [];
  for (const [key, record] of Object.entries(namespace.records)) {
    if (record.deletedAt != null) {
      if (record.value !== null) return null;
      tombstones.push(key);
      continue;
    }
    const value = normalizeValue(domain, record.value);
    if (!value || canonicalKey(value) !== key) return null;
    active[key] = value;
  }
  return { active, tombstones: tombstones.sort() };
}

export function buildPortableViewingActivityStateFromProfileV1(
  profile: PortableProfileV3,
): PortableViewingActivityStateV1 | null {
  const history = readDomainState(profile, 'history');
  const progress = readDomainState(profile, 'progress');
  if (!history || !progress) return null;
  return {
    history: history.active as Record<string, PortableHistoryValueV1>,
    progress: progress.active as Record<string, PortableProgressValueV1>,
    rejected: { history: [], progress: [] },
    tombstones: { history: history.tombstones, progress: progress.tombstones },
  };
}

function buildSteadyStateNamespace(
  domain: ActivityDomain,
  previous: PortableRecordNamespaceV3,
  local: Record<string, ActivityValue>,
  updatedBy: string,
  now: number,
): { namespace: PortableRecordNamespaceV3; changed: boolean } {
  const records: Record<string, PortableProfileRecordV3> = {};
  let changed = false;

  for (const key of Object.keys(local).sort()) {
    const value = local[key]!;
    if (canonicalKey(value) !== key) throw new Error(`Portable ${domain} preview key is inconsistent.`);
    const existing = previous.records[key];
    if (!existing) {
      changed = true;
      records[key] = { revision: 1, updatedAt: now, updatedBy, deletedAt: null, value: value as any };
      continue;
    }

    const existingTime = eventTime(domain, existing);
    if (existingTime == null) throw new Error(`Portable ${domain} namespace contains an invalid record.`);
    if (existing.deletedAt != null) {
      if (value.lastPlayedAt <= existing.deletedAt) {
        throw new Error(`Portable ${domain} cannot resurrect a newer deletion.`);
      }
      changed = true;
      records[key] = {
        revision: existing.revision + 1,
        updatedAt: now,
        updatedBy,
        deletedAt: null,
        value: value as any,
      };
      continue;
    }

    const existingValue = normalizeValue(domain, existing.value);
    if (!existingValue) throw new Error(`Portable ${domain} namespace contains an invalid active record.`);
    if (canonicalJson(existingValue) === canonicalJson(value)) {
      records[key] = existing;
      continue;
    }
    if (value.lastPlayedAt < existingValue.lastPlayedAt) {
      throw new Error(`Portable ${domain} local truth is older than the verified profile record.`);
    }
    if (value.lastPlayedAt === existingValue.lastPlayedAt) {
      throw new Error(`Portable ${domain} has an ambiguous equal-time update.`);
    }

    changed = true;
    records[key] = {
      revision: existing.revision + 1,
      updatedAt: now,
      updatedBy,
      deletedAt: null,
      value: value as any,
    };
  }

  for (const [key, existing] of Object.entries(previous.records)) {
    if (Object.prototype.hasOwnProperty.call(local, key)) continue;
    if (existing.deletedAt != null) {
      records[key] = existing;
      continue;
    }
    changed = true;
    records[key] = {
      revision: existing.revision + 1,
      updatedAt: now,
      updatedBy,
      deletedAt: now,
      value: null,
    };
  }

  return {
    namespace: changed
      ? { schemaVersion: 1, revision: previous.revision + 1, updatedAt: now, records }
      : previous,
    changed,
  };
}

export function buildPortableViewingActivitySteadyStateProfileV1(
  baseProfile: PortableProfileV3,
  preview: PortableViewingActivityPreviewV1,
  options: PortableViewingActivityBuildOptionsV1,
): PortableProfileV3 {
  if (preview.rejected.history.length || preview.rejected.progress.length) {
    throw new Error('Portable viewing activity cannot include rejected local entries.');
  }
  const profileId = requireText(options.profileId, 'Portable profile id');
  const updatedBy = requireText(options.updatedBy, 'Portable viewing activity updatedBy');
  if (baseProfile.profileId !== profileId) throw new Error('Portable viewing activity profile identity mismatch.');

  const history = namespaceFrom(baseProfile, 'history');
  const progress = namespaceFrom(baseProfile, 'progress');
  if (!history || !progress) throw new Error('Portable viewing activity requires valid history and progress namespaces.');

  const requested = requireTimestamp(options.now ?? Date.now());
  const now = Math.max(requested, baseProfile.updatedAt + 1, history.updatedAt + 1, progress.updatedAt + 1);
  const nextHistory = buildSteadyStateNamespace('history', history, preview.history, updatedBy, now);
  const nextProgress = buildSteadyStateNamespace('progress', progress, preview.progress, updatedBy, now);
  if (!nextHistory.changed && !nextProgress.changed) return baseProfile;

  return {
    ...baseProfile,
    revision: baseProfile.revision + 1,
    updatedAt: now,
    namespaces: {
      ...baseProfile.namespaces,
      history: nextHistory.namespace,
      progress: nextProgress.namespace,
    },
  };
}

function mergeDomainRecords(
  domain: ActivityDomain,
  left: Record<string, PortableProfileRecordV3>,
  right: Record<string, PortableProfileRecordV3>,
) {
  const records: Record<string, PortableProfileRecordV3> = {};
  const conflictKeys: string[] = [];
  for (const key of [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()) {
    const a = left[key];
    const b = right[key];
    if (!a) { records[key] = cloneRecord(b!); continue; }
    if (!b) { records[key] = cloneRecord(a); continue; }
    const aTime = eventTime(domain, a);
    const bTime = eventTime(domain, b);
    if (aTime == null || bTime == null) { conflictKeys.push(key); continue; }
    if (aTime !== bTime) { records[key] = cloneRecord(aTime > bTime ? a : b); continue; }
    if (a.deletedAt != null || b.deletedAt != null) {
      if (a.deletedAt != null && b.deletedAt == null) records[key] = cloneRecord(a);
      else if (b.deletedAt != null && a.deletedAt == null) records[key] = cloneRecord(b);
      else records[key] = preferRecord(a, b);
      continue;
    }
    const aValue = normalizeValue(domain, a.value);
    const bValue = normalizeValue(domain, b.value);
    if (!aValue || !bValue || canonicalKey(aValue) !== key || canonicalKey(bValue) !== key) {
      conflictKeys.push(key);
      continue;
    }
    if (canonicalJson(aValue) !== canonicalJson(bValue)) {
      conflictKeys.push(key);
      continue;
    }
    records[key] = preferRecord(a, b);
  }
  return { records, conflictKeys };
}

export function mergePortableViewingActivityRecordsV1(
  leftProfile: PortableProfileV3,
  rightProfile: PortableProfileV3,
): PortableViewingActivityMergeV1 {
  if (leftProfile.profileId !== rightProfile.profileId) {
    return { state: 'needs-review', historyConflictKeys: ['profile-identity'], progressConflictKeys: [] };
  }
  const leftHistory = namespaceFrom(leftProfile, 'history');
  const rightHistory = namespaceFrom(rightProfile, 'history');
  const leftProgress = namespaceFrom(leftProfile, 'progress');
  const rightProgress = namespaceFrom(rightProfile, 'progress');
  if (!leftHistory || !rightHistory || !leftProgress || !rightProgress) {
    return { state: 'needs-review', historyConflictKeys: ['invalid-namespace'], progressConflictKeys: [] };
  }

  const history = mergeDomainRecords('history', leftHistory.records, rightHistory.records);
  const progress = mergeDomainRecords('progress', leftProgress.records, rightProgress.records);
  if (history.conflictKeys.length || progress.conflictKeys.length) {
    return {
      state: 'needs-review',
      historyConflictKeys: history.conflictKeys,
      progressConflictKeys: progress.conflictKeys,
    };
  }
  return { state: 'merged', historyRecords: history.records, progressRecords: progress.records };
}
