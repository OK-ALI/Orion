/**
 * Orion Portable Profile V3
 *
 * Backend-neutral cross-device profile contract. This module deliberately
 * defines portable data envelopes only. It does not read MMKV/localStorage,
 * authorize Google, call Drive, or mutate any platform library.
 */

export const PORTABLE_PROFILE_SCHEMA_VERSION = 3 as const;
export const PORTABLE_PROFILE_PRIMARY_KEY = "orion-primary-profile-v3" as const;
export const PORTABLE_NAMESPACE_SCHEMA_VERSION = 1 as const;

export const PORTABLE_PROFILE_KNOWN_NAMESPACES = [
  "myList",
  "history",
  "watched",
  "progress",
  "preferences",
] as const;

export type PortableKnownNamespace =
  (typeof PORTABLE_PROFILE_KNOWN_NAMESPACES)[number];

export type PortableJsonPrimitive = string | number | boolean | null;
export type PortableJsonValue =
  | PortableJsonPrimitive
  | PortableJsonValue[]
  | { [key: string]: PortableJsonValue };

export interface PortableProfileRecordV3 {
  /**
   * Monotonic revision for this logical record. Merge code can combine this
   * with updatedAt/updatedBy when two devices advance the same record offline.
   */
  revision: number;
  updatedAt: number;
  updatedBy: string;
  /**
   * A non-null deletedAt is a tombstone. Tombstones remain portable so an
   * offline device cannot resurrect a record that was deleted elsewhere.
   */
  deletedAt: number | null;
  value: PortableJsonValue | null;
}

export interface PortableRecordNamespaceV3 {
  schemaVersion: typeof PORTABLE_NAMESPACE_SCHEMA_VERSION;
  revision: number;
  updatedAt: number;
  records: Record<string, PortableProfileRecordV3>;
}

/**
 * Known V3 namespaces use PortableRecordNamespaceV3. Unknown namespaces are
 * retained as opaque JSON so newer Orion clients can round-trip data through
 * an older client without silently deleting it.
 */
export type PortableProfileNamespacesV3 = Record<
  string,
  PortableRecordNamespaceV3 | PortableJsonValue
>;

export interface PortableProfileV3 {
  schemaVersion: typeof PORTABLE_PROFILE_SCHEMA_VERSION;
  /**
   * Opaque Orion profile identity. Storage backends must not interpret it as
   * an email address, Google token, Drive id, or device path.
   */
  profileId: string;
  revision: number;
  createdAt: number;
  updatedAt: number;
  namespaces: PortableProfileNamespacesV3;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function finiteTimestamp(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : null;
}

function positiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

function nonEmptyText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeJsonValue(value: unknown): PortableJsonValue | undefined {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (Array.isArray(value)) {
    const normalized: PortableJsonValue[] = [];
    for (const item of value) {
      const next = normalizeJsonValue(item);
      if (next === undefined) return undefined;
      normalized.push(next);
    }
    return normalized;
  }
  if (!isPlainObject(value)) return undefined;

  const normalized: Record<string, PortableJsonValue> = {};
  for (const [key, item] of Object.entries(value)) {
    const next = normalizeJsonValue(item);
    if (next === undefined) return undefined;
    normalized[key] = next;
  }
  return normalized;
}

function normalizePortableRecord(
  value: unknown,
): PortableProfileRecordV3 | null {
  if (!isPlainObject(value)) return null;
  const revision = positiveInteger(value.revision);
  const updatedAt = finiteTimestamp(value.updatedAt);
  const updatedBy = nonEmptyText(value.updatedBy);
  const deletedAt = value.deletedAt === null
    ? null
    : finiteTimestamp(value.deletedAt);

  if (revision == null || updatedAt == null || !updatedBy) return null;
  if (value.deletedAt !== null && deletedAt == null) return null;

  if (deletedAt != null) {
    if (value.value !== null) return null;
    return { revision, updatedAt, updatedBy, deletedAt, value: null };
  }

  const normalizedValue = normalizeJsonValue(value.value);
  if (normalizedValue === undefined) return null;
  return {
    revision,
    updatedAt,
    updatedBy,
    deletedAt: null,
    value: normalizedValue,
  };
}

function normalizeKnownNamespace(
  value: unknown,
): PortableRecordNamespaceV3 | null {
  if (!isPlainObject(value)) return null;
  if (value.schemaVersion !== PORTABLE_NAMESPACE_SCHEMA_VERSION) return null;

  const revision = nonNegativeInteger(value.revision);
  const updatedAt = finiteTimestamp(value.updatedAt);
  if (revision == null || updatedAt == null || !isPlainObject(value.records)) {
    return null;
  }

  const records: Record<string, PortableProfileRecordV3> = {};
  for (const [key, record] of Object.entries(value.records)) {
    if (!key) return null;
    const normalized = normalizePortableRecord(record);
    if (!normalized) return null;
    records[key] = normalized;
  }

  return {
    schemaVersion: PORTABLE_NAMESPACE_SCHEMA_VERSION,
    revision,
    updatedAt,
    records,
  };
}

function isKnownNamespace(
  name: string,
): name is PortableKnownNamespace {
  return (PORTABLE_PROFILE_KNOWN_NAMESPACES as readonly string[]).includes(name);
}

export function createEmptyPortableNamespaceV3(
  now: number,
): PortableRecordNamespaceV3 {
  const timestamp = finiteTimestamp(now);
  if (timestamp == null) throw new Error("Portable namespace timestamp must be finite.");
  return {
    schemaVersion: PORTABLE_NAMESPACE_SCHEMA_VERSION,
    revision: 0,
    updatedAt: timestamp,
    records: {},
  };
}

export function createPortableProfileV3(
  profileId: string,
  now = Date.now(),
): PortableProfileV3 {
  const normalizedProfileId = nonEmptyText(profileId);
  const timestamp = finiteTimestamp(now);
  if (!normalizedProfileId) throw new Error("Portable profile id is required.");
  if (timestamp == null) throw new Error("Portable profile timestamp must be finite.");

  const namespaces: PortableProfileNamespacesV3 = {};
  for (const name of PORTABLE_PROFILE_KNOWN_NAMESPACES) {
    namespaces[name] = createEmptyPortableNamespaceV3(timestamp);
  }

  return {
    schemaVersion: PORTABLE_PROFILE_SCHEMA_VERSION,
    profileId: normalizedProfileId,
    revision: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    namespaces,
  };
}

/**
 * Validates a V3 document crossing a cloud boundary.
 *
 * Known namespaces are validated structurally. Unknown namespaces are copied
 * as opaque JSON rather than interpreted or discarded.
 */
export function normalizePortableProfileV3(
  value: unknown,
): PortableProfileV3 | null {
  if (!isPlainObject(value)) return null;
  if (value.schemaVersion !== PORTABLE_PROFILE_SCHEMA_VERSION) return null;

  const profileId = nonEmptyText(value.profileId);
  const revision = nonNegativeInteger(value.revision);
  const createdAt = finiteTimestamp(value.createdAt);
  const updatedAt = finiteTimestamp(value.updatedAt);
  if (
    !profileId
    || revision == null
    || createdAt == null
    || updatedAt == null
    || !isPlainObject(value.namespaces)
  ) {
    return null;
  }

  const namespaces: PortableProfileNamespacesV3 = {};
  for (const [name, namespace] of Object.entries(value.namespaces)) {
    if (isKnownNamespace(name)) {
      const normalized = normalizeKnownNamespace(namespace);
      if (!normalized) return null;
      namespaces[name] = normalized;
      continue;
    }

    const opaque = normalizeJsonValue(namespace);
    if (opaque === undefined) return null;
    namespaces[name] = opaque;
  }

  return {
    schemaVersion: PORTABLE_PROFILE_SCHEMA_VERSION,
    profileId,
    revision,
    createdAt,
    updatedAt,
    namespaces,
  };
}
