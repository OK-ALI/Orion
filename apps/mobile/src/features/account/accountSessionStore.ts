import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { OrionAccountProfile } from './accountTypes';

const ACCOUNT_SESSION_KEY = 'orion.mobile.account.session.v1';

function normalizeText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeStoredProfile(value: unknown): OrionAccountProfile | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<OrionAccountProfile>;
  const accountId = normalizeText(candidate.accountId);
  const email = normalizeText(candidate.email);
  if (
    candidate.schemaVersion !== 1
    || candidate.provider !== 'google'
    || !accountId
    || !email
    || typeof candidate.connectedAt !== 'number'
    || !Number.isFinite(candidate.connectedAt)
  ) {
    return null;
  }
  return {
    schemaVersion: 1,
    provider: 'google',
    accountId,
    email,
    displayName: normalizeText(candidate.displayName),
    givenName: normalizeText(candidate.givenName),
    familyName: normalizeText(candidate.familyName),
    avatarUrl: normalizeText(candidate.avatarUrl),
    connectedAt: candidate.connectedAt,
  };
}

export async function loadAccountSession(): Promise<OrionAccountProfile | null> {
  if (Platform.OS === 'web') return null;
  try {
    const raw = await SecureStore.getItemAsync(ACCOUNT_SESSION_KEY);
    if (!raw) return null;
    const normalized = normalizeStoredProfile(JSON.parse(raw));
    if (!normalized) await SecureStore.deleteItemAsync(ACCOUNT_SESSION_KEY);
    return normalized;
  } catch {
    return null;
  }
}

export async function saveAccountSession(profile: OrionAccountProfile): Promise<void> {
  if (Platform.OS === 'web') return;
  await SecureStore.setItemAsync(ACCOUNT_SESSION_KEY, JSON.stringify(profile));
}

export async function clearAccountSession(): Promise<void> {
  if (Platform.OS === 'web') return;
  await SecureStore.deleteItemAsync(ACCOUNT_SESSION_KEY);
}