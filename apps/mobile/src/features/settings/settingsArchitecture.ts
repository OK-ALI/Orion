export type MobileSettingsSectionStatus = 'active' | 'reserved';

export type MobileSettingsSectionId =
  | 'account'
  | 'appearance'
  | 'performance'
  | 'sync'
  | 'playback'
  | 'accessibility'
  | 'notifications'
  | 'updates'
  | 'connect'
  | 'downloads';

export interface MobileSettingsSectionDefinition {
  id: MobileSettingsSectionId;
  label: string;
  status: MobileSettingsSectionStatus;
}

// Keep the full Mobile settings information architecture explicit without
// exposing controls before their owning feature is ready. A reserved section
// becomes visible only when its real implementation lands.
export const MOBILE_SETTINGS_SECTIONS: readonly MobileSettingsSectionDefinition[] = [
  { id: 'account', label: 'Account', status: 'active' },
  { id: 'appearance', label: 'Appearance', status: 'active' },
  { id: 'performance', label: 'Performance', status: 'active' },
  { id: 'sync', label: 'Sync', status: 'reserved' },
  { id: 'playback', label: 'Playback', status: 'reserved' },
  { id: 'accessibility', label: 'Accessibility', status: 'active' },
  { id: 'notifications', label: 'Notifications', status: 'active' },
  { id: 'updates', label: 'Updates', status: 'active' },
  { id: 'connect', label: 'Connect', status: 'reserved' },
  { id: 'downloads', label: 'Downloads', status: 'active' },
] as const;

export const MOBILE_ACTIVE_SETTINGS_SECTIONS = MOBILE_SETTINGS_SECTIONS.filter(
  (section) => section.status === 'active',
);

export const MOBILE_SETTINGS_SECTION_BY_ID = Object.fromEntries(
  MOBILE_SETTINGS_SECTIONS.map((section) => [section.id, section]),
) as Record<MobileSettingsSectionId, MobileSettingsSectionDefinition>;
