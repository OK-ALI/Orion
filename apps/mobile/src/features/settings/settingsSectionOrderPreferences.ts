import { useSyncExternalStore } from 'react';
import { mmkvStorageAdapter } from '../../services/storageAdapter';
import {
  MOBILE_ACTIVE_SETTINGS_SECTIONS,
  type MobileSettingsSectionId,
} from './settingsArchitecture';

export const SETTINGS_SECTION_ORDER_STORAGE_KEY_V1 = 'orion.mobile.settings.section-order.v1';

export interface SettingsSectionOrderPreferencesV1 {
  schemaVersion: 1;
  order: MobileSettingsSectionId[];
}

const DEFAULT_ORDER = MOBILE_ACTIVE_SETTINGS_SECTIONS.map((section) => section.id);
const ACTIVE_IDS = new Set<MobileSettingsSectionId>(DEFAULT_ORDER);
const DEFAULT_PREFERENCES: SettingsSectionOrderPreferencesV1 = {
  schemaVersion: 1,
  order: [...DEFAULT_ORDER],
};

function isActiveSectionId(value: unknown): value is MobileSettingsSectionId {
  return typeof value === 'string' && ACTIVE_IDS.has(value as MobileSettingsSectionId);
}

export function normalizeSettingsSectionOrderPreferences(input: unknown): SettingsSectionOrderPreferencesV1 {
  const value = input && typeof input === 'object'
    ? input as Partial<SettingsSectionOrderPreferencesV1>
    : {};
  const requested = Array.isArray(value.order) ? value.order.filter(isActiveSectionId) : [];
  const seen = new Set<MobileSettingsSectionId>();
  const order = requested.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  for (const id of DEFAULT_ORDER) {
    if (!seen.has(id)) order.push(id);
  }
  return { schemaVersion: 1, order };
}

function readPreferences(): SettingsSectionOrderPreferencesV1 {
  try {
    const raw = mmkvStorageAdapter.get(SETTINGS_SECTION_ORDER_STORAGE_KEY_V1);
    return raw ? normalizeSettingsSectionOrderPreferences(JSON.parse(raw)) : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

let snapshot = readPreferences();
const listeners = new Set<() => void>();

function publish(next: SettingsSectionOrderPreferencesV1) {
  snapshot = normalizeSettingsSectionOrderPreferences(next);
  mmkvStorageAdapter.set(SETTINGS_SECTION_ORDER_STORAGE_KEY_V1, JSON.stringify(snapshot));
  for (const listener of listeners) listener();
}

export function getSettingsSectionOrderPreferences(): SettingsSectionOrderPreferencesV1 {
  return snapshot;
}

export function subscribeSettingsSectionOrderPreferences(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSettingsSectionOrderPreferences(): SettingsSectionOrderPreferencesV1 {
  return useSyncExternalStore(
    subscribeSettingsSectionOrderPreferences,
    getSettingsSectionOrderPreferences,
    getSettingsSectionOrderPreferences,
  );
}

export function moveSettingsSection(id: MobileSettingsSectionId, targetIndex: number) {
  if (!ACTIVE_IDS.has(id)) return;
  const order = snapshot.order.filter((value) => value !== id);
  const clamped = Math.max(0, Math.min(order.length, targetIndex));
  order.splice(clamped, 0, id);
  publish({ ...snapshot, order });
}
