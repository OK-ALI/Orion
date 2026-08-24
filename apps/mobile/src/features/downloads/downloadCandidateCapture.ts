import { DeviceEventEmitter, NativeModules, Platform } from 'react-native';
import type {
  MobileDownloadCandidatePreflightV1,
  MobileDownloadCandidateV1,
  MobileDownloadExpiryV1,
  MobileDownloadManifestKindV1,
  MobileDownloadMediaIdentityV1,
  MobileDownloadPreflightStateV1,
  MobileDownloadProtectionV1,
  MobileDownloadQualityV1,
  MobileDownloadReachabilityV1,
  MobileDownloadStorageRequirementV1,
} from '@orion/shared/types';

const EVENT_NAME = 'OrionDownloadCandidate';
const MAX_REASON_LENGTH = 180;
const SOURCE_RESOLUTION_RETENTION_MS = 2 * 60_000;

const MANIFEST_KINDS = new Set<MobileDownloadManifestKindV1>(['direct', 'hls', 'dash', 'extensionless', 'unknown']);
const RESOLVED_MANIFEST_KINDS = new Set<MobileDownloadCandidatePreflightV1['resolvedManifestKind']>(['direct', 'hls', 'dash', 'unknown']);
const EXPIRY_STATES = new Set<MobileDownloadExpiryV1>(['stable', 'session', 'time-bounded', 'expired', 'unknown']);
const PROTECTION_STATES = new Set<MobileDownloadProtectionV1>(['clear', 'unknown', 'protected']);
const PREFLIGHT_STATES = new Set<MobileDownloadPreflightStateV1>([
  'checking',
  'ready',
  'unsupported',
  'protected',
  'expired',
  'unreachable',
  'action-required',
]);
const REACHABILITY_STATES = new Set<MobileDownloadReachabilityV1>(['reachable', 'unreachable', 'unknown']);
const STORAGE_REQUIREMENT_STATES = new Set<MobileDownloadStorageRequirementV1>(['known', 'unknown']);
const QUALITY_STATES = new Set<MobileDownloadQualityV1>(['best', '1080p', '720p', '480p']);

interface NativeDownloadCaptureModule {
  bindRequestContext(candidateId: string, jobId: string): Promise<{ ok: boolean; requestContextId?: string | null; expiresAt?: number | null }>;
  releaseSession(sessionId: string): void;
  releaseJobContext(jobId: string): void;
}

interface ActiveCaptureSessionV1 {
  playbackSessionId: string;
  sourceId: string;
  providerClass: string | null;
  itemKey: string;
  media: MobileDownloadMediaIdentityV1;
}

export interface BeginMobileDownloadCaptureSessionInputV1 extends ActiveCaptureSessionV1 {}

export interface MobileDownloadCandidateSnapshotV1 {
  candidate: MobileDownloadCandidateV1;
  itemKey: string;
}

type Listener = (snapshots: readonly MobileDownloadCandidateSnapshotV1[]) => void;

let activeSession: ActiveCaptureSessionV1 | null = null;
let eventSubscription: { remove(): void } | null = null;
let snapshots: MobileDownloadCandidateSnapshotV1[] = [];
let pendingSourceResolution: { itemKey: string; method: MobileDownloadTransferMethodV1; expiresAt: number; autoReturnIssued: boolean } | null = null;
const retainedSourceSessions = new Map<string, Set<string>>();
const listeners = new Set<Listener>();

function nativeModule(): NativeDownloadCaptureModule | null {
  if (Platform.OS !== 'android') return null;
  return NativeModules.OrionDownloadCapture as NativeDownloadCaptureModule | undefined || null;
}

function text(value: unknown, max = 120): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
  return normalized || null;
}

function finiteNonNegative(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function integerNonNegative(value: unknown): number | null {
  const normalized = finiteNonNegative(value);
  return normalized === null ? null : Math.trunc(normalized);
}

function normalizePreflight(value: unknown, candidateId: string): MobileDownloadCandidatePreflightV1 | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  const state = input.state;
  const reachability = input.reachability;
  const resolvedManifestKind = input.resolvedManifestKind;
  const expiry = input.expiry;
  const protection = input.protection;
  const storageRequirement = input.storageRequirement;
  if (!PREFLIGHT_STATES.has(state as MobileDownloadPreflightStateV1)) return null;
  if (!REACHABILITY_STATES.has(reachability as MobileDownloadReachabilityV1)) return null;
  if (!RESOLVED_MANIFEST_KINDS.has(resolvedManifestKind as MobileDownloadCandidatePreflightV1['resolvedManifestKind'])) return null;
  if (!EXPIRY_STATES.has(expiry as MobileDownloadExpiryV1)) return null;
  if (!PROTECTION_STATES.has(protection as MobileDownloadProtectionV1)) return null;
  if (!STORAGE_REQUIREMENT_STATES.has(storageRequirement as MobileDownloadStorageRequirementV1)) return null;

  const payloadCandidateId = text(input.candidateId);
  if (payloadCandidateId !== candidateId) return null;

  return {
    schemaVersion: 1,
    candidateId,
    state: state as MobileDownloadPreflightStateV1,
    reachability: reachability as MobileDownloadReachabilityV1,
    resolvedManifestKind: resolvedManifestKind as MobileDownloadCandidatePreflightV1['resolvedManifestKind'],
    expiry: expiry as MobileDownloadExpiryV1,
    protection: protection as MobileDownloadProtectionV1,
    requestContextReady: input.requestContextReady === true,
    descendantCount: integerNonNegative(input.descendantCount) ?? 0,
    requiredBytes: integerNonNegative(input.requiredBytes),
    storageRequirement: storageRequirement as MobileDownloadStorageRequirementV1,
    orionLibraryFreeBytes: integerNonNegative(input.orionLibraryFreeBytes),
    reasonCode: text(input.reasonCode, 80),
    reason: text(input.reason, MAX_REASON_LENGTH),
    checkedAt: integerNonNegative(input.checkedAt) ?? Date.now(),
  };
}

/**
 * Rebuilds native capture output field-by-field. Unknown native fields are
 * discarded so a future broker change cannot accidentally expose URL/header/
 * cookie material to React presentation state.
 */
export function normalizeMobileDownloadCandidateEventV1(
  value: unknown,
  session: ActiveCaptureSessionV1 | null = activeSession,
): MobileDownloadCandidateSnapshotV1 | null {
  if (!session || !value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  if (input.schemaVersion !== 1) return null;
  if (text(input.playbackSessionId) !== session.playbackSessionId) return null;
  if (text(input.sourceId) !== session.sourceId) return null;

  const candidateId = text(input.candidateId);
  const requestContextId = text(input.requestContextId);
  const manifestKind = input.manifestKind;
  const expiry = input.expiry;
  const protection = input.protection;
  if (!candidateId || !requestContextId) return null;
  if (!MANIFEST_KINDS.has(manifestKind as MobileDownloadManifestKindV1)) return null;
  if (!EXPIRY_STATES.has(expiry as MobileDownloadExpiryV1)) return null;
  if (!PROTECTION_STATES.has(protection as MobileDownloadProtectionV1)) return null;

  const preflight = normalizePreflight(input.preflight, candidateId);
  if (!preflight) return null;

  const nativeCapabilities = input.capabilities && typeof input.capabilities === 'object'
    ? input.capabilities as Record<string, unknown>
    : {};
  const qualities = Array.isArray(input.availableQualities)
    ? input.availableQualities.filter((quality): quality is MobileDownloadQualityV1 => QUALITY_STATES.has(quality as MobileDownloadQualityV1))
    : [];

  const candidate: MobileDownloadCandidateV1 = {
    schemaVersion: 1,
    candidateId,
    playbackSessionId: session.playbackSessionId,
    requestContextId,
    media: { ...session.media },
    sourceId: session.sourceId,
    providerClass: text(input.providerClass, 40) || session.providerClass,
    manifestKind: manifestKind as MobileDownloadManifestKindV1,
    capabilities: {
      orionLibrary: nativeCapabilities.orionLibrary === true,
      deviceStorage: nativeCapabilities.deviceStorage === true,
      resumable: nativeCapabilities.resumable === true,
      subtitles: nativeCapabilities.subtitles === true,
      audioSelection: nativeCapabilities.audioSelection === true,
      deviceStorageBlockedReason: text(nativeCapabilities.deviceStorageBlockedReason, MAX_REASON_LENGTH),
    },
    expiry: expiry as MobileDownloadExpiryV1,
    protection: protection as MobileDownloadProtectionV1,
    availableQualities: qualities.length ? qualities : ['best'],
    preflight,
    capturedAt: integerNonNegative(input.capturedAt) ?? preflight.checkedAt,
  };

  return { candidate, itemKey: session.itemKey };
}

function publish(): void {
  const current = snapshots.slice();
  listeners.forEach((listener) => listener(current));
}


function releaseRetainedSessions(itemKey: string): void {
  const sessions = retainedSourceSessions.get(itemKey);
  if (sessions) {
    for (const sessionId of sessions) nativeModule()?.releaseSession(sessionId);
  }
  retainedSourceSessions.delete(itemKey);
}

function pendingSourceResolutionActive(itemKey?: string): boolean {
  if (!pendingSourceResolution) return false;
  if (pendingSourceResolution.expiresAt <= Date.now()) {
    const expiredItemKey = pendingSourceResolution.itemKey;
    pendingSourceResolution = null;
    releaseRetainedSessions(expiredItemKey);
    snapshots = snapshots.filter((entry) => entry.itemKey !== expiredItemKey);
    publish();
    return false;
  }
  return itemKey === undefined || pendingSourceResolution.itemKey === itemKey;
}

/**
 * Explicitly retains only the selected title's short-lived playback candidate
 * while the user returns from Player to the Download sheet. Native request
 * material remains opaque and bounded by the broker's own expiry rules.
 */
export function requestMobileDownloadSourceResolutionV1(itemKey: string, method: MobileDownloadTransferMethodV1 = 'auto'): void {
  const clean = text(itemKey, 180);
  if (!clean) return;
  if (pendingSourceResolution && pendingSourceResolution.itemKey !== clean) {
    releaseRetainedSessions(pendingSourceResolution.itemKey);
    snapshots = snapshots.filter((entry) => entry.itemKey !== pendingSourceResolution?.itemKey);
  }
  pendingSourceResolution = { itemKey: clean, method, expiresAt: Date.now() + SOURCE_RESOLUTION_RETENTION_MS, autoReturnIssued: false };
  ensureEventSubscription();
}


export function getMobileDownloadSourceResolutionIntentV1(itemKey: string): { method: MobileDownloadTransferMethodV1; autoReturnIssued: boolean } | null {
  if (!pendingSourceResolutionActive(itemKey) || !pendingSourceResolution) return null;
  return { method: pendingSourceResolution.method, autoReturnIssued: pendingSourceResolution.autoReturnIssued };
}

export function markMobileDownloadSourceAutoReturnIssuedV1(itemKey: string): boolean {
  if (!pendingSourceResolutionActive(itemKey) || !pendingSourceResolution || pendingSourceResolution.autoReturnIssued) return false;
  pendingSourceResolution.autoReturnIssued = true;
  return true;
}

export function completeMobileDownloadSourceResolutionV1(itemKey: string): void {
  if (pendingSourceResolution?.itemKey === itemKey) pendingSourceResolution = null;
  releaseRetainedSessions(itemKey);
  snapshots = snapshots.filter((entry) => entry.itemKey !== itemKey);
  publish();
}

export function cancelMobileDownloadSourceResolutionV1(itemKey: string): void {
  completeMobileDownloadSourceResolutionV1(itemKey);
}

function ensureEventSubscription(): void {
  if (eventSubscription || Platform.OS !== 'android') return;
  eventSubscription = DeviceEventEmitter.addListener(EVENT_NAME, (payload) => {
    const normalized = normalizeMobileDownloadCandidateEventV1(payload);
    if (!normalized) return;
    snapshots = [
      normalized,
      ...snapshots.filter((entry) => entry.candidate.candidateId !== normalized.candidate.candidateId),
    ].slice(0, 12);
    publish();
  });
}

export function beginMobileDownloadCaptureSessionV1(input: BeginMobileDownloadCaptureSessionInputV1): () => void {
  pendingSourceResolutionActive();
  activeSession = {
    playbackSessionId: input.playbackSessionId,
    sourceId: input.sourceId,
    providerClass: input.providerClass,
    itemKey: input.itemKey,
    media: { ...input.media },
  };
  // A source switch must never let Auto silently select a stale provider.
  snapshots = snapshots.filter((entry) => entry.itemKey !== input.itemKey);
  ensureEventSubscription();
  publish();

  return () => {
    if (activeSession?.playbackSessionId !== input.playbackSessionId) return;
    if (pendingSourceResolutionActive(input.itemKey)) {
      const sessions = retainedSourceSessions.get(input.itemKey) || new Set<string>();
      sessions.add(input.playbackSessionId);
      retainedSourceSessions.set(input.itemKey, sessions);
    } else {
      nativeModule()?.releaseSession(input.playbackSessionId);
      snapshots = snapshots.filter((entry) => entry.itemKey !== input.itemKey);
    }
    activeSession = null;
    publish();
  };
}

export function getMobileDownloadCandidateSnapshotsV1(): readonly MobileDownloadCandidateSnapshotV1[] {
  return snapshots.slice();
}

export type MobileDownloadTransferMethodV1 = 'auto' | 'fragments';

export interface MobileDownloadCandidateSelectionV1 {
  method: MobileDownloadTransferMethodV1;
  resolvedMethod: 'fragments';
  candidate: MobileDownloadCandidateV1;
}

function isReadyDownloadCandidate(candidate: MobileDownloadCandidateV1): boolean {
  return candidate.preflight.state === 'ready' &&
    candidate.preflight.requestContextReady === true &&
    candidate.capabilities.orionLibrary === true;
}


export function scoreMobileDownloadCandidateV1(candidate: MobileDownloadCandidateV1): number {
  const kind = candidate.preflight.resolvedManifestKind;
  let score = kind === 'hls' ? 200 : kind === 'dash' ? 150 : 0;
  if (candidate.preflight.protection === 'clear') score += 20;
  if (candidate.capabilities.resumable) score += 10;
  if (candidate.expiry === 'stable') score += 8;
  else if (candidate.expiry === 'session') score += 4;
  score += Math.min(20, Math.floor(candidate.preflight.descendantCount / 25));
  return score;
}

export function selectMobileDownloadCandidateForItemV1(
  itemKey: string,
  method: MobileDownloadTransferMethodV1 = 'auto',
  values: readonly MobileDownloadCandidateSnapshotV1[] = snapshots,
  destination: 'orion-library' | 'device-storage' = 'orion-library',
): MobileDownloadCandidateSelectionV1 | null {
  if (destination !== 'orion-library') return null;
  const fragmentCandidate = values
    .filter((entry) => entry.itemKey === itemKey)
    .map((entry) => entry.candidate)
    .filter(isReadyDownloadCandidate)
    .filter((candidate) => candidate.preflight.resolvedManifestKind === 'hls' || candidate.preflight.resolvedManifestKind === 'dash')
    .sort((left, right) => scoreMobileDownloadCandidateV1(right) - scoreMobileDownloadCandidateV1(left) || right.capturedAt - left.capturedAt)[0];
  return fragmentCandidate ? { method, resolvedMethod: 'fragments', candidate: fragmentCandidate } : null;
}

export function getLatestMobileDownloadCandidateForItemV1(itemKey: string): MobileDownloadCandidateV1 | null {
  return snapshots.find((entry) => entry.itemKey === itemKey)?.candidate ?? null;
}

export function subscribeMobileDownloadCandidatesV1(listener: Listener): () => void {
  listeners.add(listener);
  listener(snapshots.slice());
  return () => listeners.delete(listener);
}

/**
 * Binds only an already-preflighted opaque candidate to a durable job id.
 * No arbitrary URL or request headers can be supplied from JavaScript.
 */
export async function bindMobileDownloadRequestContextV1(
  candidateId: string,
  jobId: string,
): Promise<{ requestContextId: string; expiresAt: number | null }> {
  const module = nativeModule();
  if (!module) throw new Error('Android download request context is unavailable.');
  const result = await module.bindRequestContext(candidateId, jobId);
  const requestContextId = text(result?.requestContextId);
  if (!result?.ok || !requestContextId) throw new Error('The captured download request context is no longer available.');
  return {
    requestContextId,
    expiresAt: integerNonNegative(result.expiresAt),
  };
}

export function releaseMobileDownloadJobContextV1(jobId: string): void {
  nativeModule()?.releaseJobContext(jobId);
}
