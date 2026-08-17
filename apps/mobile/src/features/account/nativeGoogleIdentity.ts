import { NativeModules, Platform } from 'react-native';
import type { NativeGoogleIdentityProfile } from './accountTypes';

interface OrionGoogleIdentityNativeModule {
  signIn(serverClientId: string): Promise<NativeGoogleIdentityProfile>;
  clearCredentialState(): Promise<boolean>;
}

const nativeModule = NativeModules.OrionGoogleIdentity as OrionGoogleIdentityNativeModule | undefined;

export function isNativeGoogleIdentityAvailable(): boolean {
  return Platform.OS === 'android' && !!nativeModule;
}

export async function signInWithGoogle(serverClientId: string): Promise<NativeGoogleIdentityProfile> {
  if (!isNativeGoogleIdentityAvailable() || !nativeModule) {
    throw Object.assign(new Error('Google identity is unavailable on this build.'), {
      code: 'GOOGLE_IDENTITY_UNAVAILABLE',
    });
  }
  return nativeModule.signIn(serverClientId);
}

export async function clearGoogleCredentialState(): Promise<void> {
  if (!isNativeGoogleIdentityAvailable() || !nativeModule) return;
  await nativeModule.clearCredentialState();
}