import Constants from 'expo-constants';
import { getRegisteredSource } from '@orion/shared/sources';
import { SMART_CONNECT_PROTOCOL_VERSION } from '@orion/shared/types';
import {
  getMobileStorageHealth,
  type MobileStorageHealth,
} from './storageAdapter';

export interface MobileDiagnosticsSnapshot {
  appVersion: string;
  buildKind: string;
  storage: MobileStorageHealth;
  route: string;
  networkState: string;
  smartConnectState: string;
  smartConnectProtocol: number;
  smartConnectDiscoveryMethod: string | null;
  smartConnectDiscoveryDurationMs: number | null;
  smartConnectNsdResultCount: number;
  smartConnectReconnectAttempt: number;
  smartConnectPairingFailure: string | null;
  smartConnectLockoutRemainingMs: number | null;
  smartConnectLastAuthenticatedAt: number | null;
  smartConnectLastDeviceAck: string | null;
  activeSourceId: string | null;
  sourceHealth: string | null;
  playbackState: string | null;
  playbackSurface: string | null;
  playbackEvidence: string | null;
  telemetryAgeMs: number | null;
  handoffState: string | null;
  handoffStrategy: string | null;
  handoffRequestedTime: number | null;
  handoffConfirmedTime: number | null;
  handoffFailureCode: string | null;
  lastProgressPersistedAt: number | null;
  lastHistoryPersistedAt: number | null;
  lastError: { area: string; code: string; message: string } | null;
  capturedAt: number;
}

interface DiagnosticsMutableState {
  route: string;
  networkState: string;
  smartConnectState: string;
  smartConnectDiscoveryMethod: string | null;
  smartConnectDiscoveryDurationMs: number | null;
  smartConnectNsdResultCount: number;
  smartConnectReconnectAttempt: number;
  smartConnectPairingFailure: string | null;
  smartConnectLockoutUntil: number | null;
  smartConnectLastAuthenticatedAt: number | null;
  smartConnectLastDeviceAck: string | null;
  activeSourceId: string | null;
  sourceHealth: string | null;
  playbackState: string | null;
  playbackSurface: string | null;
  playbackEvidence: string | null;
  lastTelemetryAt: number | null;
  handoffState: string | null;
  handoffStrategy: string | null;
  handoffRequestedTime: number | null;
  handoffConfirmedTime: number | null;
  handoffFailureCode: string | null;
  lastProgressPersistedAt: number | null;
  lastHistoryPersistedAt: number | null;
  lastError: MobileDiagnosticsSnapshot['lastError'];
}

const state: DiagnosticsMutableState = {
  route: '/',
  networkState: 'unknown',
  smartConnectState: 'disconnected',
  smartConnectDiscoveryMethod: null,
  smartConnectDiscoveryDurationMs: null,
  smartConnectNsdResultCount: 0,
  smartConnectReconnectAttempt: 0,
  smartConnectPairingFailure: null,
  smartConnectLockoutUntil: null,
  smartConnectLastAuthenticatedAt: null,
  smartConnectLastDeviceAck: null,
  activeSourceId: null,
  sourceHealth: null,
  playbackState: null,
  playbackSurface: null,
  playbackEvidence: null,
  lastTelemetryAt: null,
  handoffState: null,
  handoffStrategy: null,
  handoffRequestedTime: null,
  handoffConfirmedTime: null,
  handoffFailureCode: null,
  lastProgressPersistedAt: null,
  lastHistoryPersistedAt: null,
  lastError: null,
};

const SAFE_TOKEN_PATTERN = /\b(token|secret|password|authorization|cookie|key)\b/gi;
const URL_PATTERN = /\b(?:https?|file):\/\/\S+/gi;
const IPV4_PATTERN = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;

function sanitizeDiagnosticText(value: unknown): string {
  return String(value ?? 'Unknown error')
    .replace(URL_PATTERN, '[redacted-url]')
    .replace(IPV4_PATTERN, '[redacted-address]')
    .replace(SAFE_TOKEN_PATTERN, '[redacted-field]')
    .slice(0, 240);
}

export function updateMobileDiagnostics(
  update: Partial<Omit<DiagnosticsMutableState, 'lastError'>>,
) {
  Object.assign(state, update);
}

export function reportMobileDiagnosticError(error: {
  area: string;
  code: string;
  message: unknown;
}) {
  state.lastError = {
    area: sanitizeDiagnosticText(error.area),
    code: sanitizeDiagnosticText(error.code),
    message: sanitizeDiagnosticText(error.message),
  };
}

export function clearMobileDiagnosticError(area?: string) {
  if (!area || state.lastError?.area === area) state.lastError = null;
}

type PlaybackTraceEvent = 'url-build' | 'surface-mount' | 'webview-mount' | 'handoff' | 'telemetry' | 'settlement' | 'resume-result' | 'warning-clear';
const playbackTraceIds = new Map<string, number>();
const playbackTraceScopes = new Map<number, { rows: number; counts: Record<string, number>; lastPosition?: number }>();
let playbackTraceSequence = 0;
const traceCategories = new Set([
  'url-param', 'verified-seek', 'none', 'preparing', 'loading', 'seeking', 'unconfirmed', 'confirmed', 'failed',
  'playing', 'paused', 'buffering', 'ended', 'error', 'accepted', 'requested', 'applied', 'unavailable',
  'inactive-or-terminal', 'missing-target-or-snapshot', 'source-mismatch', 'missing-session', 'invalid-position',
  'pre-attempt-observation', 'stale-observation', 'future-observation', 'session-mismatch', 'implausible-forward-position',
  'target-outside-tolerance', 'target-attempt-mismatch', 'target-identity-mismatch', 'target-observation-expired',
  'target-observation-missed', 'target-forward-proof-insufficient', 'target-observation-retained', 'target-reached',
  'not-playing', 'non-advancing-observation', 'non-advancing-position', 'settled', 'attempt-mismatch',
  'TARGET_NOT_CONFIRMED', 'POSITION_NOT_RESTORED', 'POSITION_UNAVAILABLE', 'SEEK_UNAVAILABLE', 'NO_CONFIRMED_TARGET',
  'stale-sequence', 'stale-observation-time', 'invalid-observation-time', 'invalid-currentTime', 'invalid-duration',
  'invalid-bufferedPosition', 'position-after-duration', 'impossible-duration-change', 'unexplained-regression',
  'invalid-current-time', 'invalid-buffered-position', 'invalid-sequence', 'stale-bridge-sequence', 'unexpected-origin',
  'invalid-state', 'invalid-evidence', 'parse-rejected', 'released',
]);
const safeTraceCategory = (value?: string | null) => value == null ? null : traceCategories.has(value) ? value : 'rejected-category';
function playbackTraceId(kind: string, value?: string | null) {
  if (!value) return null;
  const identity = `${kind}:${value}`;
  if (!playbackTraceIds.has(identity)) {
    if (playbackTraceIds.size >= 128) playbackTraceIds.delete(playbackTraceIds.keys().next().value!);
    playbackTraceIds.set(identity, ++playbackTraceSequence);
  }
  return playbackTraceIds.get(identity)!;
}

/** Existing diagnostic lane: bounded numeric identities and allowlisted categories only. */
export function traceMobilePlayback(event: PlaybackTraceEvent, fields: {
  sourceId: string; attemptId?: string | null; sessionId?: string | null; routeIdentity?: string | null;
  strategy?: string; state?: string; target?: number | null; position?: number | null; reason?: string | null; verified?: boolean; persistenceEligible?: boolean;
  boundSessionId?: string; targetAttemptId?: string; targetSessionId?: string; targetPosition?: number;
  targetObservedAt?: number; targetReachedAt?: number; confirmedTime?: number | null; handoffState?: string; warningVisible?: boolean;
}) {
  const provider = getRegisteredSource(fields.sourceId)?.id || 'unknown';
  const attempt = playbackTraceId('attempt', fields.attemptId), session = playbackTraceId('session', fields.sessionId);
  const route = playbackTraceId('route', fields.routeIdentity);
  const scope = attempt || playbackTraceId('scope', `${route || 0}:${provider}`)!;
  if (!playbackTraceScopes.has(scope)) {
    if (playbackTraceScopes.size >= 64) playbackTraceScopes.delete(playbackTraceScopes.keys().next().value!);
    playbackTraceScopes.set(scope, { rows: 0, counts: {} });
  }
  const trace = playbackTraceScopes.get(scope)!;
  if (trace.rows >= 128 && event !== 'settlement' && event !== 'warning-clear') return;
  trace.rows++;
  trace.counts[event] = (trace.counts[event] || 0) + 1;
  if (event === 'telemetry' && fields.reason === 'accepted') {
    if (fields.state === 'playing') trace.counts.playing = (trace.counts.playing || 0) + 1;
    if (fields.state === 'buffering') trace.counts.buffering = (trace.counts.buffering || 0) + 1;
    if (fields.state === 'playing' && fields.position != null && trace.lastPosition != null && fields.position > trace.lastPosition)
      trace.counts.forward = (trace.counts.forward || 0) + 1;
    if (fields.position != null) trace.lastPosition = fields.position;
  }
  if (event === 'resume-result' && fields.reason === 'requested') trace.counts.seek = (trace.counts.seek || 0) + 1;
  if (event === 'resume-result' && fields.reason === 'applied') trace.counts.targetApplied = (trace.counts.targetApplied || 0) + 1;
  const rounded = (value?: number | null) => value != null && Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
  console.info('[OrionContinuity]', JSON.stringify({ event, provider, attempt, session, route, sequence: trace.rows,
    at: Date.now(), strategy: safeTraceCategory(fields.strategy), state: safeTraceCategory(fields.state),
    target: rounded(fields.target), position: rounded(fields.position), reason: safeTraceCategory(fields.reason),
    verified: fields.verified === true, persistenceEligible: fields.persistenceEligible === true,
    boundSession: playbackTraceId('session', fields.boundSessionId), targetAttempt: playbackTraceId('attempt', fields.targetAttemptId),
    targetSession: playbackTraceId('session', fields.targetSessionId), targetPosition: rounded(fields.targetPosition),
    targetObservedAt: rounded(fields.targetObservedAt), targetReachedAt: rounded(fields.targetReachedAt), confirmedTime: rounded(fields.confirmedTime),
    handoffState: safeTraceCategory(fields.handoffState), warningVisible: fields.warningVisible === true,
    warningOwner: fields.warningVisible === true ? 'handoff' : null,
    urlBuilds: trace.counts['url-build'] || 0, surfaces: trace.counts['surface-mount'] || 0,
    webViews: trace.counts['webview-mount'] || 0, seeks: trace.counts.seek || 0, targetApplied: trace.counts.targetApplied || 0,
    playing: trace.counts.playing || 0, buffering: trace.counts.buffering || 0, forward: trace.counts.forward || 0 }));
}

export function getMobileDiagnosticsSnapshot(): MobileDiagnosticsSnapshot {
  return {
    appVersion: Constants.expoConfig?.version ?? 'unknown',
    buildKind: __DEV__ ? 'development' : 'production',
    storage: getMobileStorageHealth(),
    route: state.route,
    networkState: state.networkState,
    smartConnectState: state.smartConnectState,
    smartConnectProtocol: SMART_CONNECT_PROTOCOL_VERSION,
    smartConnectDiscoveryMethod: state.smartConnectDiscoveryMethod,
    smartConnectDiscoveryDurationMs: state.smartConnectDiscoveryDurationMs,
    smartConnectNsdResultCount: state.smartConnectNsdResultCount,
    smartConnectReconnectAttempt: state.smartConnectReconnectAttempt,
    smartConnectPairingFailure: state.smartConnectPairingFailure,
    smartConnectLockoutRemainingMs: state.smartConnectLockoutUntil == null
      ? null
      : Math.max(0, state.smartConnectLockoutUntil - Date.now()),
    smartConnectLastAuthenticatedAt: state.smartConnectLastAuthenticatedAt,
    smartConnectLastDeviceAck: state.smartConnectLastDeviceAck,
    activeSourceId: state.activeSourceId,
    sourceHealth: state.sourceHealth,
    playbackState: state.playbackState,
    playbackSurface: state.playbackSurface,
    playbackEvidence: state.playbackEvidence,
    telemetryAgeMs: state.lastTelemetryAt == null
      ? null
      : Math.max(0, Date.now() - state.lastTelemetryAt),
    handoffState: state.handoffState,
    handoffStrategy: state.handoffStrategy,
    handoffRequestedTime: state.handoffRequestedTime,
    handoffConfirmedTime: state.handoffConfirmedTime,
    handoffFailureCode: state.handoffFailureCode,
    lastProgressPersistedAt: state.lastProgressPersistedAt,
    lastHistoryPersistedAt: state.lastHistoryPersistedAt,
    lastError: state.lastError ? { ...state.lastError } : null,
    capturedAt: Date.now(),
  };
}
