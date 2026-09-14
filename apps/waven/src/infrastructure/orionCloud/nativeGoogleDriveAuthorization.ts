import { NativeModules, Platform } from 'react-native';

export const ORION_CLOUD_DRIVE_APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

export interface OrionCloudDriveAuthorizationResult {
  authorized: true;
  accountEmail: string;
  scope: typeof ORION_CLOUD_DRIVE_APPDATA_SCOPE;
  grantedScopes: string[];
}

export interface OrionCloudDriveAuthorizationCheckResult {
  authorized: boolean;
  interactionRequired: boolean;
  accountEmail: string;
  scope: typeof ORION_CLOUD_DRIVE_APPDATA_SCOPE;
  grantedScopes: string[];
}

interface OrionGoogleDriveAuthorizationNativeModule {
  checkAppDataAuthorization(accountEmail: string): Promise<OrionCloudDriveAuthorizationCheckResult>;
  authorizeAppData(accountEmail: string): Promise<OrionCloudDriveAuthorizationResult>;
  revokeAppData(accountEmail: string): Promise<boolean>;
  clearAuthorizationCache(): Promise<boolean>;
}

const nativeModule = NativeModules.OrionGoogleDriveAuthorization as OrionGoogleDriveAuthorizationNativeModule | undefined;

export function isNativeOrionDriveAuthorizationAvailable(): boolean {
  return Platform.OS === 'android' && !!nativeModule;
}

function requireAccountEmail(accountEmail: string): string {
  const normalizedEmail = accountEmail.trim();
  if (!normalizedEmail) {
    throw Object.assign(new Error('A connected Google account is required for Orion Cloud Drive access.'), {
      code: 'GOOGLE_DRIVE_ACCOUNT_MISSING',
    });
  }
  return normalizedEmail;
}

export async function checkOrionDriveReadAccess(
  accountEmail: string,
): Promise<OrionCloudDriveAuthorizationCheckResult> {
  if (!isNativeOrionDriveAuthorizationAvailable() || !nativeModule) {
    throw Object.assign(new Error('Orion Cloud Drive authorization is unavailable on this build.'), {
      code: 'GOOGLE_DRIVE_AUTH_UNAVAILABLE',
    });
  }
  return nativeModule.checkAppDataAuthorization(requireAccountEmail(accountEmail));
}

export async function authorizeOrionDriveReadAccess(
  accountEmail: string,
): Promise<OrionCloudDriveAuthorizationResult> {
  if (!isNativeOrionDriveAuthorizationAvailable() || !nativeModule) {
    throw Object.assign(new Error('Orion Cloud Drive authorization is unavailable on this build.'), {
      code: 'GOOGLE_DRIVE_AUTH_UNAVAILABLE',
    });
  }
  return nativeModule.authorizeAppData(requireAccountEmail(accountEmail));
}

export async function revokeOrionDriveAccess(accountEmail: string): Promise<void> {
  if (!isNativeOrionDriveAuthorizationAvailable() || !nativeModule) {
    throw Object.assign(new Error('Orion Cloud Drive authorization is unavailable on this build.'), {
      code: 'GOOGLE_DRIVE_AUTH_UNAVAILABLE',
    });
  }
  await nativeModule.revokeAppData(requireAccountEmail(accountEmail));
}

export async function clearOrionDriveAuthorizationCache(): Promise<void> {
  if (!isNativeOrionDriveAuthorizationAvailable() || !nativeModule) return;
  await nativeModule.clearAuthorizationCache();
}
