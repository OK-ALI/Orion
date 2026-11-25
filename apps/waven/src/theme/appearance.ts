import { wavenColors } from './tokens';

export const WAVEN_THEME_IDS = [
  'noir',
  'hikari',
  'hikari-night',
] as const;

export type WavenThemeId = typeof WAVEN_THEME_IDS[number];

export const WAVEN_MOTION_LEVELS = [
  'subtle',
  'expressive',
  'reduced',
] as const;

export type WavenMotionIntensity = typeof WAVEN_MOTION_LEVELS[number];

export const WAVEN_PERFORMANCE_PROFILES = [
  'auto',
  'battery-saver',
  'balanced',
  'enhanced',
] as const;

export type WavenPerformanceProfile =
  typeof WAVEN_PERFORMANCE_PROFILES[number];

export type WavenSystemAppearance =
  'light' | 'dark' | null | undefined;

export type WavenThemeColors = Readonly<{
  [K in keyof typeof wavenColors]: string;
}>;

export interface WavenThemeIdentity {
  readonly id: WavenThemeId;
  readonly name: string;
  readonly scheme: 'light' | 'dark';
}

export const WAVEN_THEME_IDENTITIES:
  Readonly<Record<WavenThemeId, WavenThemeIdentity>> = Object.freeze({
    noir: Object.freeze({
      id: 'noir',
      name: 'WAVEN NOIR',
      scheme: 'dark',
    }),
    hikari: Object.freeze({
      id: 'hikari',
      name: 'WAVEN HIKARI',
      scheme: 'light',
    }),
    'hikari-night': Object.freeze({
      id: 'hikari-night',
      name: 'WAVEN HIKARI NIGHT',
      scheme: 'dark',
    }),
  });

// Preserve the accepted V8.5 palette as the NOIR baseline.
// HIKARI palettes and visual materials belong to V8.6.2.
export const WAVEN_NOIR_COLORS: WavenThemeColors =
  Object.freeze({ ...wavenColors });

export interface WavenAppearancePreferences {
  readonly version: 1;
  readonly theme: WavenThemeId;
  readonly followSystem: boolean;
  readonly motion: WavenMotionIntensity;
  readonly performance: WavenPerformanceProfile;
}

export const DEFAULT_WAVEN_APPEARANCE:
  WavenAppearancePreferences = Object.freeze({
    version: 1,
    theme: 'noir',
    followSystem: false,
    motion: 'subtle',
    performance: 'auto',
  });

export function resolveWavenTheme(
  preferences: WavenAppearancePreferences,
  system: WavenSystemAppearance,
): WavenThemeId {
  if (!preferences.followSystem) return preferences.theme;
  if (system === 'light') return 'hikari';
  if (system === 'dark') return 'hikari-night';
  return preferences.theme;
}

export function resolveWavenMotion(
  preferences: WavenAppearancePreferences,
  systemReducedMotion: boolean | null | undefined,
): WavenMotionIntensity {
  // Unknown accessibility state remains conservative until resolved.
  if (systemReducedMotion !== false) return 'reduced';
  return preferences.motion;
}

export function validateWavenAppearance(
  value: unknown,
): WavenAppearancePreferences | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  const allowed = [
    'version', 'theme', 'followSystem', 'motion', 'performance',
  ];

  if (
    Object.keys(record).length !== allowed.length ||
    !allowed.every(key =>
      Object.prototype.hasOwnProperty.call(record, key))
  ) {
    return null;
  }

  if (
    record.version !== 1 ||
    typeof record.followSystem !== 'boolean' ||
    !WAVEN_THEME_IDS.includes(record.theme as WavenThemeId) ||
    !WAVEN_MOTION_LEVELS.includes(
      record.motion as WavenMotionIntensity) ||
    !WAVEN_PERFORMANCE_PROFILES.includes(
      record.performance as WavenPerformanceProfile)
  ) {
    return null;
  }

  return Object.freeze({
    version: 1,
    theme: record.theme as WavenThemeId,
    followSystem: record.followSystem,
    motion: record.motion as WavenMotionIntensity,
    performance: record.performance as WavenPerformanceProfile,
  });
}

export function decodeWavenAppearance(
  raw: string,
): WavenAppearancePreferences | null {
  if (raw.length > 4096) return null;

  try {
    return validateWavenAppearance(JSON.parse(raw));
  } catch {
    return null;
  }
}
