export const ORION_PROVIDER_STATUS_SCHEMA_V1 = 1 as const;
export const ORION_PROVIDER_STATUS_MANIFEST_NAME_V1 = 'orion-provider-status-v1.json' as const;

export type OrionProviderStatusActionV1 = 'demote' | 'restore';
export type OrionProviderAvailabilityV1 = 'ready' | 'having-trouble' | 'temporarily-unavailable';

export interface OrionProviderStatusEntryV1 {
  sourceId: string;
  action: OrionProviderStatusActionV1;
  availability: OrionProviderAvailabilityV1;
  message: string;
}

export interface OrionProviderStatusPayloadV1 {
  schemaVersion: typeof ORION_PROVIDER_STATUS_SCHEMA_V1;
  sequence: number;
  publishedAt: string;
  expiresAt: string;
  statuses: OrionProviderStatusEntryV1[];
}

type SignatureVerifier = (keyId: string, payload: Uint8Array, signature: Uint8Array) => boolean;

let activeProviderStatus: OrionProviderStatusPayloadV1 | null = null;
let providerStatusRevision = 0;
const providerStatusListeners = new Set<() => void>();

function decode(value: unknown): Uint8Array | null {
  const input = typeof value === 'string' ? value : '';
  if (!input || !/^[A-Za-z0-9_-]+$/.test(input)) return null;
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - input.length % 4) % 4);
  try {
    if (typeof globalThis.atob === 'function') {
      const binary = globalThis.atob(base64);
      return Uint8Array.from(binary, (character) => character.charCodeAt(0));
    }
    const BufferConstructor = (globalThis as unknown as { Buffer?: { from(value: string, encoding: string): Uint8Array } }).Buffer;
    return BufferConstructor ? new Uint8Array(BufferConstructor.from(base64, 'base64')) : null;
  } catch {
    return null;
  }
}

export function resolveOrionProviderStatusV1(
  raw: unknown,
  verifySignature: SignatureVerifier,
  now = Date.now(),
): OrionProviderStatusPayloadV1 | null {
  if (!raw || typeof raw !== 'object') return null;
  const envelope = raw as Record<string, unknown>;
  if (envelope.schemaVersion !== 1 || envelope.algorithm !== 'Ed25519') return null;
  const keyId = typeof envelope.keyId === 'string' ? envelope.keyId : '';
  const payloadBytes = decode(envelope.payload);
  const signatureBytes = decode(envelope.signature);
  if (!keyId || !payloadBytes || !signatureBytes || !verifySignature(keyId, payloadBytes, signatureBytes)) return null;
  let decoded: unknown;
  try { decoded = JSON.parse(new TextDecoder().decode(payloadBytes)); } catch { return null; }
  if (!decoded || typeof decoded !== 'object') return null;
  const payload = decoded as Record<string, unknown>;
  const sequence = Number(payload.sequence);
  const publishedAt = typeof payload.publishedAt === 'string' ? Date.parse(payload.publishedAt) : NaN;
  const expiresAt = typeof payload.expiresAt === 'string' ? Date.parse(payload.expiresAt) : NaN;
  if (payload.schemaVersion !== 1 || !Number.isSafeInteger(sequence) || sequence <= 0) return null;
  if (!Number.isFinite(publishedAt) || !Number.isFinite(expiresAt) || expiresAt <= now || publishedAt > now + 300_000) return null;
  if (!Array.isArray(payload.statuses)) return null;
  const seen = new Set<string>();
  const statuses: OrionProviderStatusEntryV1[] = [];
  for (const rawStatus of payload.statuses) {
    if (!rawStatus || typeof rawStatus !== 'object') return null;
    const status = rawStatus as Record<string, unknown>;
    const sourceId = typeof status.sourceId === 'string' ? status.sourceId.trim() : '';
    const action = status.action;
    const availability = status.availability;
    const message = typeof status.message === 'string' ? status.message.trim().slice(0, 120) : '';
    if (!sourceId || seen.has(sourceId) || !['demote', 'restore'].includes(String(action))) return null;
    if (!['ready', 'having-trouble', 'temporarily-unavailable'].includes(String(availability)) || !message) return null;
    seen.add(sourceId);
    statuses.push({ sourceId, action: action as OrionProviderStatusActionV1, availability: availability as OrionProviderAvailabilityV1, message });
  }
  return {
    schemaVersion: 1,
    sequence,
    publishedAt: new Date(publishedAt).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    statuses,
  };
}

/** Installs only a newer verified payload; callers must resolve and verify it first. */
export function installOrionProviderStatusV1(payload: OrionProviderStatusPayloadV1 | null): boolean {
  if (!payload || payload.sequence <= (activeProviderStatus?.sequence ?? 0)) return false;
  activeProviderStatus = payload;
  providerStatusRevision += 1;
  for (const listener of providerStatusListeners) listener();
  return true;
}

export function getActiveOrionProviderStatusV1(): OrionProviderStatusPayloadV1 | null {
  return activeProviderStatus;
}

export function getOrionProviderStatusRevisionV1(): number {
  return providerStatusRevision;
}

export function subscribeOrionProviderStatusV1(listener: () => void): () => void {
  providerStatusListeners.add(listener);
  return () => providerStatusListeners.delete(listener);
}

/** Remote status can demote a bundled source or restore its bundled policy; it cannot add or promote one. */
export function applyOrionProviderStatusV1<T extends {
  id: string;
  routingMode?: 'automatic' | 'manual-only';
  availability?: OrionProviderAvailabilityV1;
  availabilityReason?: string;
}>(sources: readonly T[], payload: OrionProviderStatusPayloadV1 | null): readonly T[] {
  if (!payload) return sources;
  const byId = new Map(payload.statuses.map((status) => [status.sourceId, status]));
  return Object.freeze(sources.map((source) => {
    const status = byId.get(source.id);
    if (!status) return source;
    if (status.action === 'restore') return source;
    return Object.freeze({
      ...source,
      routingMode: 'manual-only' as const,
      availability: status.availability,
      availabilityReason: status.message,
    });
  }));
}
