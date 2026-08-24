import type {
  MobileDownloadDestinationModeV1,
  MobileDownloadPreferencesV1,
  MobileDownloadQualityV1,
  MobileDownloadStorageTargetV1,
  MobileDownloadSubtitlePreferenceV1,
} from '@orion/shared/types';
import { mmkvStorageAdapter } from '../../services/storageAdapter';
import { normalizeMobileDownloadStorageTargetV1 } from './contracts';

export const MOBILE_DOWNLOAD_PREFERENCES_KEY_V1 = 'orion.mobile.downloads.preferences.v1';

type PreferenceListener = (preferences: MobileDownloadPreferencesV1) => void;
const listeners = new Set<PreferenceListener>();

export const DEFAULT_MOBILE_DOWNLOAD_PREFERENCES_V1: MobileDownloadPreferencesV1 = Object.freeze({
  schemaVersion: 1,
  defaultDestination: 'orion-library',
  deviceStorageTarget: null,
  preferredQuality: 'best',
  subtitlePreference: 'preferred',
});

function defaults(): MobileDownloadPreferencesV1 {
  return { ...DEFAULT_MOBILE_DOWNLOAD_PREFERENCES_V1, deviceStorageTarget: null };
}

const qualities = new Set<MobileDownloadQualityV1>(['best', '1080p', '720p', '480p']);

export function normalizeMobileDownloadPreferencesV1(value: unknown): MobileDownloadPreferencesV1 {
  if (!value || typeof value !== 'object' || (value as { schemaVersion?: unknown }).schemaVersion !== 1) {
    return defaults();
  }
  const input = value as Partial<MobileDownloadPreferencesV1>;
  const defaultDestination: MobileDownloadDestinationModeV1 = input.defaultDestination === 'device-storage'
    ? 'device-storage'
    : 'orion-library';
  const normalizedDeviceStorageTarget = normalizeMobileDownloadStorageTargetV1(input.deviceStorageTarget);
  const deviceStorageTarget = normalizedDeviceStorageTarget?.mode === 'device-storage'
    ? normalizedDeviceStorageTarget
    : null;
  return {
    schemaVersion: 1,
    defaultDestination,
    deviceStorageTarget,
    preferredQuality: qualities.has(input.preferredQuality as MobileDownloadQualityV1)
      ? input.preferredQuality as MobileDownloadQualityV1
      : 'best',
    subtitlePreference: input.subtitlePreference === 'none' ? 'none' : 'preferred',
  };
}

export function getMobileDownloadPreferencesV1(): MobileDownloadPreferencesV1 {
  try {
    const raw = mmkvStorageAdapter.get(MOBILE_DOWNLOAD_PREFERENCES_KEY_V1);
    return normalizeMobileDownloadPreferencesV1(raw ? JSON.parse(raw) : null);
  } catch {
    return defaults();
  }
}

function persist(preferences: MobileDownloadPreferencesV1): MobileDownloadPreferencesV1 {
  const normalized = normalizeMobileDownloadPreferencesV1(preferences);
  mmkvStorageAdapter.set(MOBILE_DOWNLOAD_PREFERENCES_KEY_V1, JSON.stringify(normalized));
  for (const listener of listeners) listener(normalized);
  return normalized;
}

export function setMobileDownloadDefaultDestinationV1(
  defaultDestination: MobileDownloadDestinationModeV1,
): MobileDownloadPreferencesV1 {
  return persist({ ...getMobileDownloadPreferencesV1(), defaultDestination });
}

export function setMobileDownloadPreferredQualityV1(
  preferredQuality: MobileDownloadQualityV1,
): MobileDownloadPreferencesV1 {
  return persist({ ...getMobileDownloadPreferencesV1(), preferredQuality });
}

export function setMobileDownloadSubtitlePreferenceV1(
  subtitlePreference: MobileDownloadSubtitlePreferenceV1,
): MobileDownloadPreferencesV1 {
  return persist({ ...getMobileDownloadPreferencesV1(), subtitlePreference });
}

export function setMobileDownloadDeviceStorageTargetV1(
  deviceStorageTarget: MobileDownloadStorageTargetV1 | null,
): MobileDownloadPreferencesV1 {
  return persist({ ...getMobileDownloadPreferencesV1(), deviceStorageTarget });
}

export function subscribeMobileDownloadPreferencesV1(listener: PreferenceListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
