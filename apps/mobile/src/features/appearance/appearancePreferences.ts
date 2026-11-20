import type { IStorageAdapter } from "@orion/shared/api";
import type { OrionThemeId } from "@orion/shared/types";

const LEGACY_THEME_KEY = "mobileThemePreferencesV1";
export const THEME_PREFERENCES_KEY = "mobileThemePreferencesV2";

type LightThemeId = Extract<OrionThemeId, "projector-silver">;
type DarkThemeId = Exclude<OrionThemeId, LightThemeId>;

const DEFAULT_LIGHT_THEME: LightThemeId = "projector-silver";
const DEFAULT_DARK_THEME: DarkThemeId = "midnight-premiere";
const DARK_THEME_IDS: ReadonlySet<unknown> = new Set<DarkThemeId>([
  DEFAULT_DARK_THEME, "amoled", "mocha", "slate", "custom",
]);

export interface ThemePreferencesV2 {
  schemaVersion: 2;
  manualTheme: OrionThemeId;
  lightTheme: LightThemeId;
  darkTheme: DarkThemeId;
  followSystem: boolean;
  customAccent: string | null;
  reducedMotion: boolean;
}

type ThemePreferencesLoad = {
  preferences: ThemePreferencesV2;
  saveStatus: "ready" | "unavailable" | "unsupported";
};

function isDarkTheme(value: unknown): value is DarkThemeId {
  return DARK_THEME_IDS.has(value);
}

function isTheme(value: unknown): value is OrionThemeId {
  return value === DEFAULT_LIGHT_THEME || isDarkTheme(value);
}

export function isCustomAccent(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

export function normalizeAccent(value: string): string {
  return value.toUpperCase();
}

function readAccent(value: unknown, fallback: string | null): string | null {
  if (value === null) return null;
  return isCustomAccent(value) ? normalizeAccent(value) : fallback;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

type StoredRecord = Record<string, unknown> | null;

function migrateLegacyPreferences(legacy: StoredRecord, scheme: "light" | "dark" | null): ThemePreferencesV2 {
  const v1 = legacy?.schemaVersion === 1 ? legacy : null;
  return {
    schemaVersion: 2,
    manualTheme: isTheme(v1?.theme) ? v1.theme : scheme === "light" ? DEFAULT_LIGHT_THEME : DEFAULT_DARK_THEME,
    lightTheme: DEFAULT_LIGHT_THEME,
    darkTheme: DEFAULT_DARK_THEME,
    followSystem: readBoolean(v1?.followSystem, true),
    customAccent: readAccent(v1?.customAccent, null),
    reducedMotion: readBoolean(v1?.reducedMotion, false),
  };
}

function normalizeThemePreferences(record: StoredRecord, fallback: ThemePreferencesV2): ThemePreferencesV2 {
  if (record?.schemaVersion !== 2) return fallback;
  return {
    schemaVersion: 2,
    manualTheme: isTheme(record.manualTheme) ? record.manualTheme : fallback.manualTheme,
    lightTheme: record.lightTheme === DEFAULT_LIGHT_THEME ? record.lightTheme : fallback.lightTheme,
    darkTheme: isDarkTheme(record.darkTheme) ? record.darkTheme : fallback.darkTheme,
    followSystem: readBoolean(record.followSystem, fallback.followSystem),
    customAccent: readAccent(record.customAccent, fallback.customAccent),
    reducedMotion: readBoolean(record.reducedMotion, fallback.reducedMotion),
  };
}

function parseRecord(raw: string | null): StoredRecord {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value) ? value as StoredRecord : null;
  } catch {
    return null;
  }
}

export function loadThemePreferences(
  storage: Pick<IStorageAdapter, "get">,
  scheme: "light" | "dark" | null,
  storageUnavailable: boolean,
): ThemePreferencesLoad {
  let unavailable = storageUnavailable;
  const read = (key: string) => {
    try {
      return parseRecord(storage.get(key));
    } catch {
      unavailable = true;
      return null;
    }
  };
  const record = read(THEME_PREFERENCES_KEY);
  const legacy = read(LEGACY_THEME_KEY);
  const unsupported = record?.schemaVersion !== undefined && record.schemaVersion !== 2;
  const fallback = migrateLegacyPreferences(legacy, scheme);

  return {
    preferences: normalizeThemePreferences(record, fallback),
    saveStatus: unavailable ? "unavailable" : unsupported ? "unsupported" : "ready",
  };
}

export function resolveThemeSelection(
  preferences: ThemePreferencesV2,
  scheme: "light" | "dark" | null,
): OrionThemeId {
  if (!preferences.followSystem) return preferences.manualTheme;
  return scheme === "light" ? preferences.lightTheme : preferences.darkTheme;
}


export type AppearanceChoices = Pick<ThemePreferencesV2,
  "manualTheme" | "lightTheme" | "darkTheme" | "followSystem" | "customAccent">;
export type AppearanceScheme = "light" | "dark";

const APPEARANCE_KEYS = ["manualTheme", "lightTheme", "darkTheme", "followSystem", "customAccent"] as const;

export function getAppearanceChoices(
  { manualTheme, lightTheme, darkTheme, followSystem, customAccent }: ThemePreferencesV2,
): AppearanceChoices {
  return { manualTheme, lightTheme, darkTheme, followSystem, customAccent };
}

export function matchesThemeScheme(theme: OrionThemeId, scheme: AppearanceScheme): boolean {
  return scheme === "light" ? theme === DEFAULT_LIGHT_THEME : isDarkTheme(theme);
}

export function chooseSystemTheme(
  choices: AppearanceChoices, scheme: AppearanceScheme, theme: OrionThemeId,
): AppearanceChoices {
  if (scheme === "light" && theme === DEFAULT_LIGHT_THEME) return { ...choices, lightTheme: theme };
  if (scheme === "dark" && isDarkTheme(theme)) return { ...choices, darkTheme: theme };
  return choices;
}

export function resetSystemTheme(choices: AppearanceChoices, scheme: AppearanceScheme): AppearanceChoices {
  return chooseSystemTheme(choices, scheme, scheme === "light" ? DEFAULT_LIGHT_THEME : DEFAULT_DARK_THEME);
}

export function prepareAppearancePatch(
  opening: AppearanceChoices, edited: AppearanceChoices, current: AppearanceChoices,
): { ok: true; patch: Partial<AppearanceChoices> } | { ok: false; message: string } {
  if (!isTheme(edited.manualTheme) || edited.lightTheme !== DEFAULT_LIGHT_THEME ||
      !isDarkTheme(edited.darkTheme) || typeof edited.followSystem !== "boolean" ||
      (edited.customAccent !== null && !isCustomAccent(edited.customAccent))) {
    return { ok: false, message: "Choose supported themes and enter a valid six-digit HEX accent." };
  }
  const normalized = { ...edited, customAccent: readAccent(edited.customAccent, null) };
  const changed = APPEARANCE_KEYS.filter(key => normalized[key] !== opening[key] && normalized[key] !== current[key]);
  if (changed.some(key => opening[key] !== current[key])) {
    return { ok: false, message: "Appearance changed while you were editing. Keep your draft, or discard it and reopen Studio to review the latest choices." };
  }
  return { ok: true, patch: Object.fromEntries(changed.map(key => [key, normalized[key]])) };
}
