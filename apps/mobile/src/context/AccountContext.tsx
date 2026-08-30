import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import type { OrionAccountProfile, OrionAccountState } from '../features/account/accountTypes';
import {
  clearGoogleCredentialState,
  isNativeGoogleIdentityAvailable,
  signInWithGoogle,
} from '../features/account/nativeGoogleIdentity';
import {
  clearAccountSession,
  loadAccountSession,
  saveAccountSession,
} from '../features/account/accountSessionStore';
import { clearGoogleDriveAuthorizationCache } from '../features/account/nativeGoogleDriveAuthorization';

interface AccountContextValue {
  state: OrionAccountState;
  googleConfigured: boolean;
  nativeGoogleAvailable: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  clearFeedback: () => void;
}

const AccountContext = createContext<AccountContextValue | null>(null);

const GOOGLE_WEB_CLIENT_ID = (process.env.EXPO_PUBLIC_ORION_GOOGLE_WEB_CLIENT_ID || '').trim();

function friendlyFailure(code?: string): string {
  if (code === 'GOOGLE_SIGN_IN_CANCELLED') return 'Google sign-in was cancelled. Nothing changed.';
  if (code === 'GOOGLE_NO_CREDENTIAL') return 'No Google account was available for sign-in. Check the accounts on this device and try again.';
  if (code === 'GOOGLE_CLIENT_ID_MISSING') return 'This Orion build is missing its Google sign-in configuration.';
  if (code === 'GOOGLE_IDENTITY_UNAVAILABLE') return 'Google sign-in is unavailable on this device build.';
  return 'Google sign-in could not finish. Your local Orion data was not changed.';
}

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const nativeGoogleAvailable = isNativeGoogleIdentityAvailable();
  const googleConfigured = Platform.OS === 'android' && nativeGoogleAvailable && !!GOOGLE_WEB_CLIENT_ID;
  const [state, setState] = useState<OrionAccountState>({
    phase: 'restoring',
    profile: null,
    feedback: null,
  });

  useEffect(() => {
    let cancelled = false;
    void loadAccountSession().then((profile) => {
      if (cancelled) return;
      setState({
        phase: profile ? 'signed-in' : 'signed-out',
        profile,
        feedback: null,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async () => {
    if (!googleConfigured) {
      setState((current) => ({
        ...current,
        phase: current.profile ? 'signed-in' : 'error',
        feedback: friendlyFailure(nativeGoogleAvailable ? 'GOOGLE_CLIENT_ID_MISSING' : 'GOOGLE_IDENTITY_UNAVAILABLE'),
      }));
      return;
    }

    setState((current) => ({ ...current, phase: 'signing-in', feedback: null }));
    try {
      const result = await signInWithGoogle(GOOGLE_WEB_CLIENT_ID);
      const profile: OrionAccountProfile = {
        schemaVersion: 1,
        provider: 'google',
        accountId: result.accountId,
        email: result.email,
        displayName: result.displayName?.trim() || null,
        givenName: result.givenName?.trim() || null,
        familyName: result.familyName?.trim() || null,
        avatarUrl: result.avatarUrl?.trim() || null,
        connectedAt: Date.now(),
      };
      await saveAccountSession(profile);
      setState({ phase: 'signed-in', profile, feedback: null });
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error
        ? String((error as { code?: unknown }).code || '')
        : '';
      const cancelled = code === 'GOOGLE_SIGN_IN_CANCELLED';
      setState({
        phase: cancelled ? 'cancelled' : 'error',
        profile: null,
        feedback: friendlyFailure(code),
      });
    }
  }, [googleConfigured, nativeGoogleAvailable]);

  const signOut = useCallback(async () => {
    let profileBeforeSignOut: OrionAccountProfile | null = null;
    setState((current) => {
      profileBeforeSignOut = current.profile;
      return {
        ...current,
        phase: 'signing-out',
        feedback: null,
      };
    });

    try {
      await clearAccountSession();
    } catch {
      setState({
        phase: profileBeforeSignOut ? 'signed-in' : 'error',
        profile: profileBeforeSignOut,
        feedback: 'Orion could not disconnect Google securely. Nothing was removed. Please try again.',
      });
      return;
    }

    try {
      await clearGoogleDriveAuthorizationCache();
    } catch {
      // OAuth token-cache cleanup is best-effort after Orion has securely
      // removed its local connected-account snapshot. No Drive grant is revoked here.
    }

    try {
      await clearGoogleCredentialState();
    } catch {
      // Credential Manager cleanup is best-effort after Orion has securely
      // removed its local connected-account snapshot.
    }

    setState({
      phase: 'signed-out',
      profile: null,
      feedback: 'Google was disconnected from Orion. Your local library stays on this device.',
    });
  }, []);

  const clearFeedback = useCallback(() => {
    setState((current) => ({
      ...current,
      phase: current.profile ? 'signed-in' : 'signed-out',
      feedback: null,
    }));
  }, []);

  const value = useMemo<AccountContextValue>(() => ({
    state,
    googleConfigured,
    nativeGoogleAvailable,
    signIn,
    signOut,
    clearFeedback,
  }), [clearFeedback, googleConfigured, nativeGoogleAvailable, signIn, signOut, state]);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useOrionAccount() {
  const value = useContext(AccountContext);
  if (!value) throw new Error('useOrionAccount must be used within AccountProvider');
  return value;
}
