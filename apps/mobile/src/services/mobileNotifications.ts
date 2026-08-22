import { Platform } from 'react-native';
import { mmkvStorageAdapter } from './storageAdapter';

export type MobileNotificationCategoryV1 =
  | 'appUpdates'
  | 'syncFailures'
  | 'offlineRecovery'
  | 'providerHealth'
  | 'watchlist';

export type MobileNotificationPermissionV1 = 'unsupported' | 'undetermined' | 'granted' | 'denied';

export type MobileNotificationTargetV1 =
  | { target: 'home' }
  | { target: 'settings'; section: 'account' | 'updates' | 'notifications' }
  | { target: 'media'; mediaId: string; mediaType: 'movie' | 'tv' };

export interface MobileNotificationPreferencesV1 {
  schemaVersion: 1;
  enabled: boolean;
  categories: Record<MobileNotificationCategoryV1, boolean>;
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

export interface MobileNotificationEventV1 {
  category: MobileNotificationCategoryV1;
  dedupeKey: string;
  title: string;
  body: string;
  target: MobileNotificationTargetV1;
}

export const MOBILE_NOTIFICATION_CATEGORY_COPY_V1: Readonly<Record<
  MobileNotificationCategoryV1,
  { label: string; description: string }
>> = Object.freeze({
  appUpdates: Object.freeze({
    label: 'Orion updates',
    description: 'New Orion versions ready to install.',
  }),
  syncFailures: Object.freeze({
    label: 'Sync alerts',
    description: 'Know when your library needs attention.',
  }),
  offlineRecovery: Object.freeze({
    label: 'Back online',
    description: 'When Orion reconnects after being offline.',
  }),
  providerHealth: Object.freeze({
    label: 'Playback issues',
    description: 'When a selected playback source stops working.',
  }),
  watchlist: Object.freeze({
    label: 'My List releases',
    description: 'Saved movies, shows and anime release or become available to watch.',
  }),
});

const PREFERENCES_KEY = 'orion.mobile.notifications.preferences.v1';
const DEDUPE_KEY = 'orion.mobile.notifications.dedupe.v1';
const MAX_DEDUPE_RECORDS = 160;
const DEDUPE_RETENTION_MS = 30 * 24 * 60 * 60_000;

export const DEFAULT_MOBILE_NOTIFICATION_PREFERENCES_V1: MobileNotificationPreferencesV1 = Object.freeze({
  schemaVersion: 1,
  enabled: false,
  categories: Object.freeze({
    appUpdates: true,
    syncFailures: true,
    offlineRecovery: true,
    providerHealth: false,
    watchlist: false,
  }),
  quietHours: Object.freeze({
    enabled: false,
    start: '22:00',
    end: '08:00',
  }),
});

type PreferenceListener = (preferences: MobileNotificationPreferencesV1) => void;
const preferenceListeners = new Set<PreferenceListener>();
let handlerInstalled = false;
let channelsReady = false;

function cloneDefaults(): MobileNotificationPreferencesV1 {
  return {
    ...DEFAULT_MOBILE_NOTIFICATION_PREFERENCES_V1,
    categories: { ...DEFAULT_MOBILE_NOTIFICATION_PREFERENCES_V1.categories },
    quietHours: { ...DEFAULT_MOBILE_NOTIFICATION_PREFERENCES_V1.quietHours },
  };
}

export function isValidNotificationTimeV1(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(value || '').trim());
}

function normalizePreferences(value: any): MobileNotificationPreferencesV1 {
  const defaults = cloneDefaults();
  if (!value || value.schemaVersion !== 1) return defaults;
  return {
    schemaVersion: 1,
    enabled: value.enabled === true,
    categories: {
      appUpdates: value.categories?.appUpdates !== false,
      syncFailures: value.categories?.syncFailures !== false,
      offlineRecovery: value.categories?.offlineRecovery !== false,
      providerHealth: value.categories?.providerHealth === true,
      watchlist: value.categories?.watchlist === true,
    },
    quietHours: {
      enabled: value.quietHours?.enabled === true,
      start: isValidNotificationTimeV1(value.quietHours?.start) ? value.quietHours.start : defaults.quietHours.start,
      end: isValidNotificationTimeV1(value.quietHours?.end) ? value.quietHours.end : defaults.quietHours.end,
    },
  };
}

export function getMobileNotificationPreferencesV1(): MobileNotificationPreferencesV1 {
  try {
    return normalizePreferences(JSON.parse(mmkvStorageAdapter.get(PREFERENCES_KEY) || 'null'));
  } catch {
    return cloneDefaults();
  }
}

function persistPreferences(preferences: MobileNotificationPreferencesV1): MobileNotificationPreferencesV1 {
  mmkvStorageAdapter.set(PREFERENCES_KEY, JSON.stringify(preferences));
  for (const listener of preferenceListeners) listener(preferences);
  return preferences;
}

export function setMobileNotificationsEnabledV1(enabled: boolean): MobileNotificationPreferencesV1 {
  const current = getMobileNotificationPreferencesV1();
  return persistPreferences({ ...current, enabled });
}

export function setMobileNotificationCategoryV1(
  category: MobileNotificationCategoryV1,
  enabled: boolean,
): MobileNotificationPreferencesV1 {
  const current = getMobileNotificationPreferencesV1();
  return persistPreferences({
    ...current,
    categories: { ...current.categories, [category]: enabled },
  });
}

export function setMobileNotificationQuietHoursV1(input: {
  enabled?: boolean;
  start?: string;
  end?: string;
}): MobileNotificationPreferencesV1 {
  const current = getMobileNotificationPreferencesV1();
  const start = input.start === undefined ? current.quietHours.start : input.start.trim();
  const end = input.end === undefined ? current.quietHours.end : input.end.trim();
  if (!isValidNotificationTimeV1(start) || !isValidNotificationTimeV1(end)) {
    throw new Error('NOTIFICATION_QUIET_HOURS_INVALID');
  }
  return persistPreferences({
    ...current,
    quietHours: {
      enabled: input.enabled ?? current.quietHours.enabled,
      start,
      end,
    },
  });
}

export function subscribeMobileNotificationPreferencesV1(listener: PreferenceListener): () => void {
  preferenceListeners.add(listener);
  return () => preferenceListeners.delete(listener);
}

function minuteOfDay(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

export function isMobileNotificationQuietHoursV1(
  preferences: MobileNotificationPreferencesV1,
  now = new Date(),
): boolean {
  if (!preferences.quietHours.enabled) return false;
  const start = minuteOfDay(preferences.quietHours.start);
  const end = minuteOfDay(preferences.quietHours.end);
  const current = now.getHours() * 60 + now.getMinutes();
  if (start === end) return true;
  return start < end
    ? current >= start && current < end
    : current >= start || current < end;
}

function readDedupe(): Record<string, number> {
  try {
    const parsed = JSON.parse(mmkvStorageAdapter.get(DEDUPE_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function pruneDedupe(records: Record<string, number>, now: number): Record<string, number> {
  const recent = Object.entries(records)
    .filter(([, timestamp]) => Number.isFinite(timestamp) && now - timestamp <= DEDUPE_RETENTION_MS)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_DEDUPE_RECORDS);
  return Object.fromEntries(recent);
}

export function hasDeliveredMobileNotificationV1(dedupeKey: string): boolean {
  return Number.isFinite(readDedupe()[dedupeKey]);
}

function markDelivered(dedupeKey: string, now: number): void {
  const records = pruneDedupe(readDedupe(), now);
  records[dedupeKey] = now;
  mmkvStorageAdapter.set(DEDUPE_KEY, JSON.stringify(pruneDedupe(records, now)));
}

async function loadNotificationsModule() {
  if (Platform.OS === 'web') return null;
  return import('expo-notifications');
}

async function ensureAndroidChannelsV1(): Promise<void> {
  if (Platform.OS !== 'android' || channelsReady) return;
  const Notifications = await loadNotificationsModule();
  if (!Notifications) return;
  const channels = [
    ['orion-updates', 'Orion updates', Notifications.AndroidImportance.DEFAULT],
    ['orion-sync', 'Orion sync', Notifications.AndroidImportance.DEFAULT],
    ['orion-availability', 'Orion availability', Notifications.AndroidImportance.DEFAULT],
    ['orion-status', 'Orion status', Notifications.AndroidImportance.LOW],
  ] as const;
  for (const [id, name, importance] of channels) {
    await Notifications.setNotificationChannelAsync(id, { name, importance });
  }
  channelsReady = true;
}

export async function initializeMobileNotificationsV1(): Promise<void> {
  const Notifications = await loadNotificationsModule();
  if (!Notifications) return;
  if (!handlerInstalled) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    handlerInstalled = true;
  }
  await ensureAndroidChannelsV1();
}

function permissionFromStatus(status: { granted?: boolean; status?: string }): MobileNotificationPermissionV1 {
  if (status.granted) return 'granted';
  if (status.status === 'denied') return 'denied';
  return 'undetermined';
}

export async function getMobileNotificationPermissionV1(): Promise<MobileNotificationPermissionV1> {
  if (Platform.OS === 'web') return 'unsupported';
  try {
    const Notifications = await loadNotificationsModule();
    if (!Notifications) return 'unsupported';
    return permissionFromStatus(await Notifications.getPermissionsAsync());
  } catch {
    return 'unsupported';
  }
}

export async function requestMobileNotificationPermissionV1(): Promise<MobileNotificationPermissionV1> {
  if (Platform.OS === 'web') return 'unsupported';
  try {
    await initializeMobileNotificationsV1();
    const Notifications = await loadNotificationsModule();
    if (!Notifications) return 'unsupported';
    const existing = permissionFromStatus(await Notifications.getPermissionsAsync());
    if (existing === 'granted') return existing;
    return permissionFromStatus(await Notifications.requestPermissionsAsync());
  } catch {
    return 'denied';
  }
}

function channelForCategory(category: MobileNotificationCategoryV1): string {
  if (category === 'appUpdates') return 'orion-updates';
  if (category === 'syncFailures') return 'orion-sync';
  if (category === 'watchlist') return 'orion-availability';
  return 'orion-status';
}

export function shouldDeliverMobileNotificationV1(
  event: MobileNotificationEventV1,
  preferences = getMobileNotificationPreferencesV1(),
  now = new Date(),
): { deliver: boolean; reason: 'ready' | 'disabled' | 'category-disabled' | 'quiet-hours' | 'duplicate' } {
  if (!preferences.enabled) return { deliver: false, reason: 'disabled' };
  if (!preferences.categories[event.category]) return { deliver: false, reason: 'category-disabled' };
  if (isMobileNotificationQuietHoursV1(preferences, now)) return { deliver: false, reason: 'quiet-hours' };
  if (hasDeliveredMobileNotificationV1(event.dedupeKey)) return { deliver: false, reason: 'duplicate' };
  return { deliver: true, reason: 'ready' };
}

export async function deliverMobileNotificationV1(event: MobileNotificationEventV1): Promise<boolean> {
  const decision = shouldDeliverMobileNotificationV1(event);
  if (!decision.deliver) return false;
  if (await getMobileNotificationPermissionV1() !== 'granted') return false;

  try {
    await initializeMobileNotificationsV1();
    const Notifications = await loadNotificationsModule();
    if (!Notifications) return false;
    const trigger = Platform.OS === 'android'
      ? { channelId: channelForCategory(event.category) }
      : null;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: event.title,
        body: event.body,
        data: event.target,
      },
      trigger,
    });
    markDelivered(event.dedupeKey, Date.now());
    return true;
  } catch {
    return false;
  }
}

/** User-invoked device smoke test. This intentionally bypasses category, quiet-hour,
 * and dedupe policy because pressing the Settings action is the explicit user intent. */
export async function sendMobileNotificationSelfTestV1(): Promise<boolean> {
  if (await getMobileNotificationPermissionV1() !== 'granted') return false;
  try {
    await initializeMobileNotificationsV1();
    const Notifications = await loadNotificationsModule();
    if (!Notifications) return false;
    const trigger = Platform.OS === 'android' ? { channelId: 'orion-status' } : null;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Notifications are working',
        body: 'Orion alerts are ready on this device. Tap to return to Notifications.',
        data: { target: 'settings', section: 'notifications' },
      },
      trigger,
    });
    return true;
  } catch {
    return false;
  }
}

export function resolveMobileNotificationTargetV1(data: unknown): MobileNotificationTargetV1 | null {
  if (!data || typeof data !== 'object') return null;
  const value = data as Record<string, unknown>;
  if (value.target === 'home') return { target: 'home' };
  if (
    value.target === 'settings'
    && (value.section === 'account' || value.section === 'updates' || value.section === 'notifications')
  ) {
    return { target: 'settings', section: value.section };
  }
  if (
    value.target === 'media'
    && typeof value.mediaId === 'string'
    && value.mediaId.length > 0
    && (value.mediaType === 'movie' || value.mediaType === 'tv')
  ) {
    return { target: 'media', mediaId: value.mediaId, mediaType: value.mediaType };
  }
  return null;
}
