import { NativeModules, Platform } from 'react-native';

export const GOOGLE_DRIVE_APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

export interface GoogleDriveAuthorizationResult {
  authorized: true;
  accountEmail: string;
  scope: typeof GOOGLE_DRIVE_APPDATA_SCOPE;
  grantedScopes: string[];
}

export interface GoogleDriveAuthorizationCheckResult {
  authorized: boolean;
  interactionRequired: boolean;
  accountEmail: string;
  scope: typeof GOOGLE_DRIVE_APPDATA_SCOPE;
  grantedScopes: string[];
}

interface OrionGoogleDriveAuthorizationNativeModule {
  checkAppDataAuthorization(accountEmail: string): Promise<GoogleDriveAuthorizationCheckResult>;
  authorizeAppData(accountEmail: string): Promise<GoogleDriveAuthorizationResult>;
  revokeAppData(accountEmail: string): Promise<boolean>;
  clearAuthorizationCache(): Promise<boolean>;
}

const nativeModule = NativeModules.OrionGoogleDriveAuthorization as OrionGoogleDriveAuthorizationNativeModule | undefined;

export function isNativeGoogleDriveAuthorizationAvailable(): boolean {
  return Platform.OS === 'android' && !!nativeModule;
}

export async function checkGoogleDriveAppDataAuthorization(accountEmail: string): Promise<GoogleDriveAuthorizationCheckResult> {
  if (!isNativeGoogleDriveAuthorizationAvailable() || !nativeModule) {
    throw Object.assign(new Error('Google Drive authorization is unavailable on this build.'), {
      code: 'GOOGLE_DRIVE_AUTH_UNAVAILABLE',
    });
  }
  return nativeModule.checkAppDataAuthorization(accountEmail);
}

export async function authorizeGoogleDriveAppData(accountEmail: string): Promise<GoogleDriveAuthorizationResult> {
  if (!isNativeGoogleDriveAuthorizationAvailable() || !nativeModule) {
    throw Object.assign(new Error('Google Drive authorization is unavailable on this build.'), {
      code: 'GOOGLE_DRIVE_AUTH_UNAVAILABLE',
    });
  }
  return nativeModule.authorizeAppData(accountEmail);
}

export async function revokeGoogleDriveAppData(accountEmail: string): Promise<void> {
  if (!isNativeGoogleDriveAuthorizationAvailable() || !nativeModule) {
    throw Object.assign(new Error('Google Drive authorization is unavailable on this build.'), {
      code: 'GOOGLE_DRIVE_AUTH_UNAVAILABLE',
    });
  }
  await nativeModule.revokeAppData(accountEmail);
}

export async function clearGoogleDriveAuthorizationCache(): Promise<void> {
  if (!isNativeGoogleDriveAuthorizationAvailable() || !nativeModule) return;
  await nativeModule.clearAuthorizationCache();
}
