import { NativeModules, Platform } from 'react-native';
import {
  PORTABLE_PROFILE_PRIMARY_KEY,
  normalizePortableProfileV3,
  type PortableProfileV3,
} from '@orion/shared/types';

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

interface OrionGoogleDriveProfileReadOnlyNativeModule {
  readPortableProfile(accountEmail: string, profileKey: string): Promise<NativeReadResult>;
}

const nativeModule = NativeModules.OrionGoogleDriveProfileStore as
  | OrionGoogleDriveProfileReadOnlyNativeModule
  | undefined;

export type OrionCloudReadOnlyProbeResult =
  | {
      state: 'missing';
      profileKey: typeof PORTABLE_PROFILE_PRIMARY_KEY;
    }
  | {
      state: 'found';
      profileKey: typeof PORTABLE_PROFILE_PRIMARY_KEY;
      profile: PortableProfileV3;
      revisionTag: string;
      remoteModifiedAt: number | null;
    };

export function isNativeOrionCloudReadOnlyProbeAvailable(): boolean {
  return Platform.OS === 'android' && !!nativeModule;
}

function requireNative(): OrionGoogleDriveProfileReadOnlyNativeModule {
  if (!isNativeOrionCloudReadOnlyProbeAvailable() || !nativeModule) {
    throw Object.assign(new Error('Orion Cloud read-only profile probe is unavailable on this build.'), {
      code: 'GOOGLE_DRIVE_PROFILE_STORE_UNAVAILABLE',
    });
  }
  return nativeModule;
}

/**
 * Phase 2.2 preservation gate.
 *
 * This adapter deliberately exposes only the native read operation. It cannot
 * create, update, replace, or delete an Orion Cloud profile.
 */
export async function readExistingOrionPrimaryProfile(
  accountEmail: string,
): Promise<OrionCloudReadOnlyProbeResult> {
  const normalizedEmail = accountEmail.trim();
  if (!normalizedEmail) {
    throw new Error('Google account email is required for the Orion Cloud visibility check.');
  }

  const result = await requireNative().readPortableProfile(
    normalizedEmail,
    PORTABLE_PROFILE_PRIMARY_KEY,
  );

  if (result.state === 'missing') {
    return {
      state: 'missing',
      profileKey: PORTABLE_PROFILE_PRIMARY_KEY,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.profileJson);
  } catch {
    throw Object.assign(new Error('Existing Orion Cloud profile contains invalid JSON.'), {
      code: 'GOOGLE_DRIVE_PROFILE_INVALID',
    });
  }

  const profile = normalizePortableProfileV3(parsed);
  if (!profile) {
    throw Object.assign(new Error('Existing Orion Cloud profile failed PortableProfileV3 validation.'), {
      code: 'GOOGLE_DRIVE_PROFILE_INVALID',
    });
  }

  return {
    state: 'found',
    profileKey: PORTABLE_PROFILE_PRIMARY_KEY,
    profile,
    revisionTag: result.revisionTag,
    remoteModifiedAt:
      typeof result.remoteModifiedAt === 'number' && Number.isFinite(result.remoteModifiedAt)
        ? result.remoteModifiedAt
        : null,
  };
}
