import * as SecureStore from 'expo-secure-store';
import type { WavenGoogleIdentityProfile } from '../../infrastructure/orionCloud/nativeGoogleIdentity';

const WAVEN_ENTRY_SESSION_KEY = 'waven.entry-session.v1';

export type WavenEntryMode = 'local' | 'google';

export interface WavenEntrySession {
  version: 1;
  mode: WavenEntryMode;
  completedAt: string;
  profile: WavenGoogleIdentityProfile | null;
}

type WavenEntrySessionListener = (session: WavenEntrySession | null) => void;

const wavenEntrySessionListeners = new Set<WavenEntrySessionListener>();

function publishWavenEntrySession(session: WavenEntrySession | null): void {
  for (const listener of wavenEntrySessionListeners) {
    listener(session);
  }
}

export function subscribeWavenEntrySession(
  listener: WavenEntrySessionListener,
): () => void {
  wavenEntrySessionListeners.add(listener);

  return () => {
    wavenEntrySessionListeners.delete(listener);
  };
}
function isGoogleProfile(value: unknown): value is WavenGoogleIdentityProfile {
  if (!value || typeof value !== 'object') return false;

  const profile = value as Partial<WavenGoogleIdentityProfile>;
  return profile.provider === 'google'
    && typeof profile.accountId === 'string'
    && profile.accountId.trim().length > 0
    && typeof profile.email === 'string'
    && profile.email.trim().length > 0;
}

function parseSession(raw: string | null): WavenEntrySession | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<WavenEntrySession>;
    if (parsed.version !== 1) return null;
    if (parsed.mode !== 'local' && parsed.mode !== 'google') return null;
    if (typeof parsed.completedAt !== 'string' || !parsed.completedAt) return null;

    if (parsed.mode === 'google') {
      if (!isGoogleProfile(parsed.profile)) return null;
      return {
        version: 1,
        mode: 'google',
        completedAt: parsed.completedAt,
        profile: parsed.profile,
      };
    }

    return {
      version: 1,
      mode: 'local',
      completedAt: parsed.completedAt,
      profile: null,
    };
  } catch {
    return null;
  }
}

export async function readWavenEntrySession(): Promise<WavenEntrySession | null> {
  const raw = await SecureStore.getItemAsync(WAVEN_ENTRY_SESSION_KEY);
  return parseSession(raw);
}

export async function completeWavenEntryLocally(): Promise<WavenEntrySession> {
  const session: WavenEntrySession = {
    version: 1,
    mode: 'local',
    completedAt: new Date().toISOString(),
    profile: null,
  };

  await SecureStore.setItemAsync(WAVEN_ENTRY_SESSION_KEY, JSON.stringify(session));
  publishWavenEntrySession(session);
  return session;
}

export async function completeWavenEntryWithGoogle(
  profile: WavenGoogleIdentityProfile,
): Promise<WavenEntrySession> {
  const session: WavenEntrySession = {
    version: 1,
    mode: 'google',
    completedAt: new Date().toISOString(),
    profile,
  };

  await SecureStore.setItemAsync(WAVEN_ENTRY_SESSION_KEY, JSON.stringify(session));
  publishWavenEntrySession(session);
  return session;
}

export async function clearWavenEntrySession(): Promise<void> {
  await SecureStore.deleteItemAsync(WAVEN_ENTRY_SESSION_KEY);
  publishWavenEntrySession(null);
}
