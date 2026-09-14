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
  clearAuthorizationCache(): Promise<boolean>;
}

const nativeModule = NativeModules.OrionGoogleDriveAuthorization as OrionGoogleDriveAuthorizationNativeModule | undefined;

export function isNativeOrionDriveAuthorizationAvailable(): boolean {
  return Platform.OS === 'android' && !!nativeModule;
}

export async function checkOrionDriveReadAccess(
  accountEmail: string,
): Promise<OrionCloudDriveAuthorizationCheckResult> {
  if (!isNativeOrionDriveAuthorizationAvailable() || !nativeModule) {
    throw Object.assign(new Error('Orion Cloud Drive authorization is unavailable on this build.'), {
      code: 'GOOGLE_DRIVE_AUTH_UNAVAILABLE',
    });
  }
  return nativeModule.checkAppDataAuthorization(accountEmail.trim());
}

export async function authorizeOrionDriveReadAccess(
  accountEmail: string,
): Promise<OrionCloudDriveAuthorizationResult> {
  if (!isNativeOrionDriveAuthorizationAvailable() || !nativeModule) {
    throw Object.assign(new Error('Orion Cloud Drive authorization is unavailable on this build.'), {
      code: 'GOOGLE_DRIVE_AUTH_UNAVAILABLE',
    });
  }
  return nativeModule.authorizeAppData(accountEmail.trim());
}

export async function clearOrionDriveAuthorizationCache(): Promise<void> {
  if (!isNativeOrionDriveAuthorizationAvailable() || !nativeModule) return;
  await nativeModule.clearAuthorizationCache();
}
