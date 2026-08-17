import { PORTABLE_PROFILE_SCHEMA_VERSION } from "./portableProfile";
import type {
  PortableProfileV3,
  PortableRecordNamespaceV3,
} from "./portableProfile";

export const PORTABLE_MY_LIST_ITEM_SCHEMA_VERSION = 1 as const;

export interface PortableMyListItemV1 {
  schemaVersion: typeof PORTABLE_MY_LIST_ITEM_SCHEMA_VERSION;
  mediaType: "movie" | "tv";
  mediaId: number;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  year: string | null;
  order: number;
}

export interface PortableMyListPreviewV1 {
  records: Record<string, PortableMyListItemV1>;
  orderedKeys: string[];
  rejectedKeys: string[];
}

export type PortableMyListInspectionV1 =
  | { state: "empty"; activeCount: 0; tombstoneCount: 0 }
  | { state: "populated"; activeCount: number; tombstoneCount: number }
  | { state: "invalid"; activeCount: number; tombstoneCount: number };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nullablePath(value: unknown): string | null {
  if (value == null || value === "") return null;
  return typeof value === "string" ? value : null;
}

function mediaTypeForLocalItem(value: Record<string, unknown>): "movie" | "tv" | null {
  if (value.media_type === "movie" || value.media_type === "tv") return value.media_type;
  if (typeof value.first_air_date === "string" || typeof value.name === "string") return "tv";
  if (typeof value.release_date === "string" || typeof value.title === "string") return "movie";
  return null;
}

function yearForLocalItem(value: Record<string, unknown>): string | null {
  const raw = value.year ?? value.release_date ?? value.first_air_date;
  if (raw == null) return null;
  const match = String(raw).match(/^\s*(\d{4})/);
  return match?.[1] ?? null;
}

export function portableMyListRecordKey(
  mediaType: "movie" | "tv",
  mediaId: number,
): string {
  return `${mediaType}_${mediaId}`;
}

export function normalizePortableMyListItemV1(
  value: unknown,
): PortableMyListItemV1 | null {
  if (!isPlainObject(value)) return null;
  if (value.schemaVersion !== PORTABLE_MY_LIST_ITEM_SCHEMA_VERSION) return null;
  if (value.mediaType !== "movie" && value.mediaType !== "tv") return null;

  const mediaId = typeof value.mediaId === "number"
    && Number.isInteger(value.mediaId)
    && value.mediaId > 0
    ? value.mediaId
    : null;
  const title = nonEmptyString(value.title);
  const posterPath = nullablePath(value.posterPath);
  const backdropPath = nullablePath(value.backdropPath);
  const year = value.year == null
    ? null
    : (typeof value.year === "string" && /^\d{4}$/.test(value.year) ? value.year : null);
  const order = typeof value.order === "number"
    && Number.isInteger(value.order)
    && value.order >= 0
    ? value.order
    : null;

  if (mediaId == null || !title || order == null) return null;
  if (value.posterPath != null && posterPath == null) return null;
  if (value.backdropPath != null && backdropPath == null) return null;
  if (value.year != null && year == null) return null;

  return {
    schemaVersion: PORTABLE_MY_LIST_ITEM_SCHEMA_VERSION,
    mediaType: value.mediaType,
    mediaId,
    title,
    posterPath,
    backdropPath,
    year,
    order,
  };
}

/**
 * Builds a constrained read-only preview from Mobile's current My List.
 * No record revisions, persistence, cloud writes, or local mutation occur here.
 */
export function buildPortableMyListPreviewV1(
  saved: Record<string, unknown>,
  savedOrder: readonly string[],
): PortableMyListPreviewV1 {
  const orderedSourceKeys: string[] = [];
  const seen = new Set<string>();

  for (const key of savedOrder) {
    if (!seen.has(key) && Object.prototype.hasOwnProperty.call(saved, key)) {
      seen.add(key);
      orderedSourceKeys.push(key);
    }
  }
  for (const key of Object.keys(saved)) {
    if (!seen.has(key)) {
      seen.add(key);
      orderedSourceKeys.push(key);
    }
  }

  const records: Record<string, PortableMyListItemV1> = {};
  const rejectedKeys: string[] = [];

  orderedSourceKeys.forEach((sourceKey, order) => {
    const raw = saved[sourceKey];
    if (!isPlainObject(raw)) {
      rejectedKeys.push(sourceKey);
      return;
    }

    const mediaType = mediaTypeForLocalItem(raw);
    const mediaId = typeof raw.id === "number"
      && Number.isInteger(raw.id)
      && raw.id > 0
      ? raw.id
      : null;
    const title = nonEmptyString(
      mediaType === "tv" ? (raw.name ?? raw.title) : (raw.title ?? raw.name),
    );

    if (!mediaType || mediaId == null || !title) {
      rejectedKeys.push(sourceKey);
      return;
    }

    const canonicalKey = portableMyListRecordKey(mediaType, mediaId);
    if (canonicalKey !== sourceKey || records[canonicalKey]) {
      rejectedKeys.push(sourceKey);
      return;
    }

    const posterPath = nullablePath(raw.poster_path);
    const backdropPath = nullablePath(raw.backdrop_path);
    if (
      (raw.poster_path != null && raw.poster_path !== "" && posterPath == null)
      || (raw.backdrop_path != null && raw.backdrop_path !== "" && backdropPath == null)
    ) {
      rejectedKeys.push(sourceKey);
      return;
    }

    records[canonicalKey] = {
      schemaVersion: PORTABLE_MY_LIST_ITEM_SCHEMA_VERSION,
      mediaType,
      mediaId,
      title,
      posterPath,
      backdropPath,
      year: yearForLocalItem(raw),
      order,
    };
  });

  return {
    records,
    orderedKeys: Object.keys(records).sort(
      (a, b) => records[a]!.order - records[b]!.order,
    ),
    rejectedKeys,
  };
}

function isPortableRecordNamespaceV3(
  value: unknown,
): value is PortableRecordNamespaceV3 {
  return isPlainObject(value)
    && value.schemaVersion === 1
    && typeof value.revision === "number"
    && Number.isInteger(value.revision)
    && value.revision >= 0
    && typeof value.updatedAt === "number"
    && Number.isFinite(value.updatedAt)
    && isPlainObject(value.records);
}

/**
 * Semantically inspects My List inside an already structurally validated V3
 * profile. Future or malformed payloads are blocked rather than guessed at.
 */
export function inspectPortableMyListV1(
  profile: PortableProfileV3,
): PortableMyListInspectionV1 {
  const namespace = profile.namespaces.myList;
  if (namespace == null) {
    return { state: "empty", activeCount: 0, tombstoneCount: 0 };
  }
  if (!isPortableRecordNamespaceV3(namespace)) {
    return { state: "invalid", activeCount: 0, tombstoneCount: 0 };
  }

  let activeCount = 0;
  let tombstoneCount = 0;

  for (const [key, record] of Object.entries(namespace.records)) {
    if (record.deletedAt != null) {
      tombstoneCount += 1;
      continue;
    }

    const item = normalizePortableMyListItemV1(record.value);
    if (!item || portableMyListRecordKey(item.mediaType, item.mediaId) !== key) {
      return { state: "invalid", activeCount, tombstoneCount };
    }
    activeCount += 1;
  }

  if (activeCount === 0 && tombstoneCount === 0) {
    return { state: "empty", activeCount: 0, tombstoneCount: 0 };
  }
  return { state: "populated", activeCount, tombstoneCount };
}
export interface PortableMyListEnrollmentOptionsV1 {
  profileId: string;
  updatedBy: string;
  now?: number;
}

function requireFiniteTimestamp(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Portable My List enrollment timestamp must be finite.");
  }
  return value;
}

function requireNonEmptyText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

function portableMyListItemEquals(
  left: PortableMyListItemV1,
  right: PortableMyListItemV1,
): boolean {
  return left.schemaVersion === right.schemaVersion
    && left.mediaType === right.mediaType
    && left.mediaId === right.mediaId
    && left.title === right.title
    && left.posterPath === right.posterPath
    && left.backdropPath === right.backdropPath
    && left.year === right.year
    && left.order === right.order;
}

/**
 * Builds the first cloud-enrollment mutation for My List only.
 *
 * Existing profiles are copied with every unrelated/unknown namespace intact.
 * The helper refuses populated, tombstoned, malformed, or identity-mismatched
 * cloud state so Candidate 2 cannot silently merge or overwrite it.
 */
export function buildPortableMyListEnrollmentProfileV1(
  baseProfile: PortableProfileV3 | null,
  preview: PortableMyListPreviewV1,
  options: PortableMyListEnrollmentOptionsV1,
): PortableProfileV3 {
  if (preview.rejectedKeys.length > 0) {
    throw new Error("Portable My List enrollment cannot include rejected local entries.");
  }

  const profileId = requireNonEmptyText(options.profileId, "Portable profile id");
  const updatedBy = requireNonEmptyText(options.updatedBy, "Portable My List updatedBy");
  if (baseProfile && baseProfile.profileId !== profileId) {
    throw new Error("Portable My List enrollment profile identity mismatch.");
  }

  if (baseProfile) {
    const inspection = inspectPortableMyListV1(baseProfile);
    if (inspection.state !== "empty") {
      throw new Error("Portable My List enrollment requires an empty cloud My List.");
    }
  }

  const requestedNow = requireFiniteTimestamp(options.now ?? Date.now());
  const now = baseProfile
    ? Math.max(requestedNow, baseProfile.updatedAt + 1)
    : requestedNow;
  const existingNamespace = baseProfile?.namespaces.myList;
  const namespaceRevision = isPortableRecordNamespaceV3(existingNamespace)
    ? existingNamespace.revision + 1
    : 1;

  const records: PortableRecordNamespaceV3["records"] = {};
  for (const key of preview.orderedKeys) {
    const item = preview.records[key];
    if (!item) {
      throw new Error("Portable My List enrollment preview is inconsistent.");
    }
    records[key] = {
      revision: 1,
      updatedAt: now,
      updatedBy,
      deletedAt: null,
      value: { ...item },
    };
  }

  const myList: PortableRecordNamespaceV3 = {
    schemaVersion: 1,
    revision: namespaceRevision,
    updatedAt: now,
    records,
  };

  return {
    schemaVersion: PORTABLE_PROFILE_SCHEMA_VERSION,
    profileId,
    revision: (baseProfile?.revision ?? 0) + 1,
    createdAt: baseProfile?.createdAt ?? now,
    updatedAt: now,
    namespaces: {
      ...(baseProfile?.namespaces ?? {}),
      myList,
    },
  };
}

/**
 * Exact semantic comparison used by enrollment/read-back verification.
 * Tombstones, extra records, malformed values, wrong keys, or changed order
 * all fail closed.
 */
export function portableMyListMatchesPreviewV1(
  profile: PortableProfileV3,
  preview: PortableMyListPreviewV1,
): boolean {
  if (preview.rejectedKeys.length > 0) return false;

  const namespace = profile.namespaces.myList;
  if (!isPortableRecordNamespaceV3(namespace)) return false;

  const keys = Object.keys(namespace.records);
  if (keys.length !== preview.orderedKeys.length) return false;

  for (const key of preview.orderedKeys) {
    const expected = preview.records[key];
    const record = namespace.records[key];
    if (!expected || !record || record.deletedAt != null || record.value == null) {
      return false;
    }
    const actual = normalizePortableMyListItemV1(record.value);
    if (!actual || portableMyListRecordKey(actual.mediaType, actual.mediaId) !== key) {
      return false;
    }
    if (!portableMyListItemEquals(actual, expected)) return false;
  }

  return true;
}



export interface PortableMyListSteadyStateOptionsV1 {
  profileId: string;
  updatedBy: string;
  now?: number;
}

function canonicalPortableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalPortableValue);
  if (!isPlainObject(value)) return value;
  const next: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    next[key] = canonicalPortableValue(value[key]);
  }
  return next;
}

/**
 * Deterministic semantic signature for a local My List preview. This is used
 * only as a reconciliation checkpoint; it is not persisted as cloud truth.
 */
export function portableMyListPreviewSignatureV1(
  preview: PortableMyListPreviewV1,
): string {
  return JSON.stringify({
    orderedKeys: preview.orderedKeys,
    records: preview.orderedKeys.map((key) => [key, preview.records[key] ?? null]),
    rejectedKeys: [...preview.rejectedKeys].sort(),
  });
}

/**
 * Deterministic signature for the My List namespace only. Unrelated profile
 * revisions/namespaces do not make My List look conflicted when later phases
 * update other portable data.
 */
export function portableMyListNamespaceSignatureV1(
  profile: PortableProfileV3,
): string | null {
  const namespace = profile.namespaces.myList;
  if (namespace == null) return JSON.stringify({ state: "missing" });
  if (!isPortableRecordNamespaceV3(namespace)) return null;

  const records = Object.keys(namespace.records).sort().map((key) => {
    const record = namespace.records[key]!;
    return [
      key,
      record.revision,
      record.updatedAt,
      record.updatedBy,
      record.deletedAt,
      canonicalPortableValue(record.value),
    ];
  });
  return JSON.stringify({
    schemaVersion: namespace.schemaVersion,
    revision: namespace.revision,
    updatedAt: namespace.updatedAt,
    records,
  });
}

/**
 * Converts a validated cloud namespace into its active ordered My List view.
 * Tombstones are intentionally omitted from the active preview but remain in
 * the cloud namespace. Duplicate/gapped ordering is rejected rather than
 * guessed at during a cross-device restore.
 */
export function buildPortableMyListPreviewFromProfileV1(
  profile: PortableProfileV3,
): PortableMyListPreviewV1 | null {
  const namespace = profile.namespaces.myList;
  if (namespace == null) {
    return { records: {}, orderedKeys: [], rejectedKeys: [] };
  }
  if (!isPortableRecordNamespaceV3(namespace)) return null;

  const records: Record<string, PortableMyListItemV1> = {};
  const ordered: Array<{ key: string; order: number }> = [];
  const seenOrders = new Set<number>();

  for (const [key, record] of Object.entries(namespace.records)) {
    if (record.deletedAt != null) continue;
    const item = normalizePortableMyListItemV1(record.value);
    if (!item || portableMyListRecordKey(item.mediaType, item.mediaId) !== key) {
      return null;
    }
    if (seenOrders.has(item.order)) return null;
    seenOrders.add(item.order);
    records[key] = item;
    ordered.push({ key, order: item.order });
  }

  ordered.sort((left, right) => left.order - right.order);
  for (let index = 0; index < ordered.length; index += 1) {
    if (ordered[index]!.order !== index) return null;
  }

  return {
    records,
    orderedKeys: ordered.map((entry) => entry.key),
    rejectedKeys: [],
  };
}

/**
 * Steady-state semantic comparison. Unlike the Candidate 2 enrollment matcher,
 * tombstones are permitted because removals must remain portable without
 * appearing as active My List items.
 */
export function portableMyListActiveMatchesPreviewV1(
  profile: PortableProfileV3,
  preview: PortableMyListPreviewV1,
): boolean {
  if (preview.rejectedKeys.length > 0) return false;
  const cloud = buildPortableMyListPreviewFromProfileV1(profile);
  if (!cloud || cloud.orderedKeys.length !== preview.orderedKeys.length) return false;
  for (let index = 0; index < preview.orderedKeys.length; index += 1) {
    const key = preview.orderedKeys[index]!;
    if (cloud.orderedKeys[index] !== key) return false;
    const left = preview.records[key];
    const right = cloud.records[key];
    if (!left || !right || !portableMyListItemEquals(left, right)) return false;
  }
  return true;
}

/**
 * Candidate 3 steady-state My List mutation. It updates only My List, keeps
 * all unrelated/unknown namespaces byte-for-byte equivalent at the JS object
 * level, advances changed record revisions, and writes removals as tombstones.
 */
export function buildPortableMyListSteadyStateProfileV1(
  baseProfile: PortableProfileV3,
  preview: PortableMyListPreviewV1,
  options: PortableMyListSteadyStateOptionsV1,
): PortableProfileV3 {
  if (preview.rejectedKeys.length > 0) {
    throw new Error("Portable My List sync cannot include rejected local entries.");
  }
  const profileId = requireNonEmptyText(options.profileId, "Portable profile id");
  const updatedBy = requireNonEmptyText(options.updatedBy, "Portable My List updatedBy");
  if (baseProfile.profileId !== profileId) {
    throw new Error("Portable My List steady-state profile identity mismatch.");
  }

  const inspection = inspectPortableMyListV1(baseProfile);
  if (inspection.state === "invalid") {
    throw new Error("Portable My List steady-state sync requires a valid cloud My List.");
  }

  const existingNamespace = baseProfile.namespaces.myList;
  const previous = isPortableRecordNamespaceV3(existingNamespace)
    ? existingNamespace
    : {
        schemaVersion: 1 as const,
        revision: 0,
        updatedAt: baseProfile.updatedAt,
        records: {},
      };
  const requestedNow = requireFiniteTimestamp(options.now ?? Date.now());
  const now = Math.max(requestedNow, baseProfile.updatedAt + 1, previous.updatedAt + 1);
  const records: PortableRecordNamespaceV3["records"] = {};

  for (const key of preview.orderedKeys) {
    const item = preview.records[key];
    if (!item) throw new Error("Portable My List steady-state preview is inconsistent.");
    const existing = previous.records[key];
    const normalizedExisting = existing?.deletedAt == null
      ? normalizePortableMyListItemV1(existing?.value)
      : null;
    const unchanged = !!existing
      && existing.deletedAt == null
      && !!normalizedExisting
      && portableMyListItemEquals(normalizedExisting, item);

    records[key] = unchanged
      ? existing
      : {
          revision: (existing?.revision ?? 0) + 1,
          updatedAt: now,
          updatedBy,
          deletedAt: null,
          value: { ...item },
        };
  }

  for (const [key, existing] of Object.entries(previous.records)) {
    if (Object.prototype.hasOwnProperty.call(preview.records, key)) continue;
    records[key] = existing.deletedAt != null
      ? existing
      : {
          revision: existing.revision + 1,
          updatedAt: now,
          updatedBy,
          deletedAt: now,
          value: null,
        };
  }

  const myList: PortableRecordNamespaceV3 = {
    schemaVersion: 1,
    revision: previous.revision + 1,
    updatedAt: now,
    records,
  };

  return {
    ...baseProfile,
    revision: baseProfile.revision + 1,
    updatedAt: now,
    namespaces: {
      ...baseProfile.namespaces,
      myList,
    },
  };
}
