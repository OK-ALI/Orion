import { NativeModules, Platform } from 'react-native';
import type {
  CloudProfileReadResult,
  CloudProfileStore,
  CloudProfileWriteRequest,
  CloudProfileWriteResult,
} from '@orion/shared/api';
import { normalizePortableProfileV3 } from '@orion/shared/types';

interface NativeMissingResult {
  state: 'missing';
  revisionTag: null;
}

interface NativeFoundResult {
  state: 'found';
  profileJson: string;
  revisionTag: string;
  remoteModifiedAt: number | null;
}

type NativeReadResult = NativeMissingResult | NativeFoundResult;

type NativeWriteResult =
  | { state: 'written'; revisionTag: string; remoteModifiedAt: number | null }
  | { state: 'conflict'; revisionTag: string | null };

interface OrionGoogleDriveProfileStoreNativeModule {
  readPortableProfile(accountEmail: string, profileKey: string): Promise<NativeReadResult>;
  writePortableProfile(
    accountEmail: string,
    profileKey: string,
    profileJson: string,
    expectedRevisionTag: string | null,
  ): Promise<NativeWriteResult>;
}

const nativeModule = NativeModules.OrionGoogleDriveProfileStore as OrionGoogleDriveProfileStoreNativeModule | undefined;

export function isNativeGoogleDriveProfileStoreAvailable(): boolean {
  return Platform.OS === 'android' && !!nativeModule;
}

function requireNative(): OrionGoogleDriveProfileStoreNativeModule {
  if (!isNativeGoogleDriveProfileStoreAvailable() || !nativeModule) {
    throw Object.assign(new Error('Google Drive profile storage is unavailable on this build.'), {
      code: 'GOOGLE_DRIVE_PROFILE_STORE_UNAVAILABLE',
    });
  }
  return nativeModule;
}

function nonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

/**
 * Google Drive appDataFolder implementation of the shared CloudProfileStore.
 *
 * OAuth tokens remain entirely inside the native Android layer. This class
 * crosses the bridge with PortableProfileV3 JSON and opaque revision tags only.
 */
export class GoogleDriveCloudProfileStore implements CloudProfileStore {
  private readonly accountEmail: string;

  constructor(accountEmail: string) {
    this.accountEmail = nonEmpty(accountEmail, 'Google account email');
  }

  async read(profileKey: string): Promise<CloudProfileReadResult> {
    const result = await requireNative().readPortableProfile(
      this.accountEmail,
      nonEmpty(profileKey, 'Cloud profile key'),
    );
    if (result.state === 'missing') {
      return { state: 'missing', revisionTag: null };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(result.profileJson);
    } catch {
      throw Object.assign(new Error('The Orion cloud profile contains invalid JSON.'), {
        code: 'GOOGLE_DRIVE_PROFILE_INVALID',
      });
    }
    const profile = normalizePortableProfileV3(parsed);
    if (!profile) {
      throw Object.assign(new Error('The Orion cloud profile failed PortableProfileV3 validation.'), {
        code: 'GOOGLE_DRIVE_PROFILE_INVALID',
      });
    }

    return {
      state: 'found',
      profile,
      revisionTag: result.revisionTag,
      remoteModifiedAt: typeof result.remoteModifiedAt === 'number' && Number.isFinite(result.remoteModifiedAt)
        ? result.remoteModifiedAt
        : null,
    };
  }

  async write(
    profileKey: string,
    request: CloudProfileWriteRequest,
  ): Promise<CloudProfileWriteResult> {
    const normalized = normalizePortableProfileV3(request.profile);
    if (!normalized) {
      throw Object.assign(new Error('Refusing to write an invalid PortableProfileV3 document.'), {
        code: 'GOOGLE_DRIVE_PROFILE_INVALID',
      });
    }

    const result = await requireNative().writePortableProfile(
      this.accountEmail,
      nonEmpty(profileKey, 'Cloud profile key'),
      JSON.stringify(normalized),
      request.expectedRevisionTag,
    );

    if (result.state === 'conflict') {
      return { state: 'conflict', revisionTag: result.revisionTag };
    }
    return {
      state: 'written',
      revisionTag: result.revisionTag,
      remoteModifiedAt: typeof result.remoteModifiedAt === 'number' && Number.isFinite(result.remoteModifiedAt)
        ? result.remoteModifiedAt
        : null,
    };
  }
}
