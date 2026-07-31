import Constants from 'expo-constants';
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
  activeSourceId: string | null;
  sourceHealth: string | null;
  lastError: { area: string; code: string; message: string } | null;
  capturedAt: number;
}

interface DiagnosticsMutableState {
  route: string;
  networkState: string;
  smartConnectState: string;
  activeSourceId: string | null;
  sourceHealth: string | null;
  lastError: MobileDiagnosticsSnapshot['lastError'];
}

const state: DiagnosticsMutableState = {
  route: '/',
  networkState: 'unknown',
  smartConnectState: 'disconnected',
  activeSourceId: null,
  sourceHealth: null,
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

export function getMobileDiagnosticsSnapshot(): MobileDiagnosticsSnapshot {
  return {
    appVersion: Constants.expoConfig?.version ?? 'unknown',
    buildKind: __DEV__ ? 'development' : 'production',
    storage: getMobileStorageHealth(),
    route: state.route,
    networkState: state.networkState,
    smartConnectState: state.smartConnectState,
    smartConnectProtocol: SMART_CONNECT_PROTOCOL_VERSION,
    activeSourceId: state.activeSourceId,
    sourceHealth: state.sourceHealth,
    lastError: state.lastError ? { ...state.lastError } : null,
    capturedAt: Date.now(),
  };
}

