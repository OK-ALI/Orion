import { NativeModules, Platform } from 'react-native';

export interface WavenGoogleIdentityProfile {
  provider: 'google';
  accountId: string;
  email: string;
  displayName?: string | null;
  givenName?: string | null;
  familyName?: string | null;
  avatarUrl?: string | null;
}

interface OrionGoogleIdentityNativeModule {
  signIn(serverClientId: string): Promise<WavenGoogleIdentityProfile>;
  clearCredentialState(): Promise<boolean>;
}

const nativeModule = NativeModules.OrionGoogleIdentity as OrionGoogleIdentityNativeModule | undefined;

export function isNativeOrionGoogleIdentityAvailable(): boolean {
  return Platform.OS === 'android' && !!nativeModule;
}

export async function signInToOrionCloud(serverClientId: string): Promise<WavenGoogleIdentityProfile> {
  const normalized = serverClientId.trim();
  if (!normalized) {
    throw Object.assign(new Error('Orion Cloud Google Web client ID is missing.'), {
      code: 'GOOGLE_CLIENT_ID_MISSING',
    });
  }
  if (!isNativeOrionGoogleIdentityAvailable() || !nativeModule) {
    throw Object.assign(new Error('Orion Cloud Google identity is unavailable on this build.'), {
      code: 'GOOGLE_IDENTITY_UNAVAILABLE',
    });
  }
  return nativeModule.signIn(normalized);
}

export async function clearOrionGoogleCredentialState(): Promise<void> {
  if (!isNativeOrionGoogleIdentityAvailable() || !nativeModule) return;
  await nativeModule.clearCredentialState();
}
