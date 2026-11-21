import type { IStorageAdapter } from "@orion/shared/api";
import type { OrionThemeId } from "@orion/shared/types";
import {
  CUSTOM_PALETTE_ROLES, inheritedCustomPalette, isHexColor,
  type CustomPaletteOverrides, type CustomPaletteProfile, type CustomPaletteRole, type PaletteIssue,
} from "./customAppearancePalette";

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
  return isHexColor(value);
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

export const ADVANCED_THEME_PREFERENCES_KEY = "mobileThemePreferencesV3";

export type MobileAppearanceThemeId = OrionThemeId | "custom-light";
type AdvancedLightThemeId = LightThemeId | "custom-light";

export interface ThemePreferencesV3 {
  schemaVersion: 3;
  manualTheme: MobileAppearanceThemeId;
  lightTheme: AdvancedLightThemeId;
  darkTheme: DarkThemeId;
  followSystem: boolean;
  reducedMotion: boolean;
  custom: {
    light: CustomPaletteOverrides;
    dark: { colors: CustomPaletteOverrides; rendering: "legacy" | "adaptive" };
  };
}

export type AdvancedAppearanceChoices = Omit<ThemePreferencesV3, "schemaVersion" | "reducedMotion"> & {
  /** A whole-profile reset targets every leaf, including roles originally inherited. Draft only. */
  resetProfiles?: readonly CustomPaletteProfile[];
};
export type PreferenceRecovery = { path: string; reason: "missing" | "invalid" };
type AdvancedThemePreferencesLoad = {
  preferences: ThemePreferencesV3;
  saveStatus: ThemePreferencesLoad["saveStatus"] | "corrupted";
  recoveries: PreferenceRecovery[];
};

export function isMobileAppearanceTheme(value: unknown): value is MobileAppearanceThemeId {
  return value === "custom-light" || isTheme(value);
}

function isAdvancedLightTheme(value: unknown): value is AdvancedLightThemeId {
  return value === "custom-light" || value === DEFAULT_LIGHT_THEME;
}

export function resolveAdvancedThemeSelection(
  preferences: ThemePreferencesV3, scheme: AppearanceScheme,
): MobileAppearanceThemeId {
  if (!preferences.followSystem) return preferences.manualTheme;
  return scheme === "light" ? preferences.lightTheme : preferences.darkTheme;
}

/** Keep the Phase 2B editor and schema-1 consumer view on the historical IDs. */
export function legacyThemeId(theme: MobileAppearanceThemeId): OrionThemeId {
  return theme === "custom-light" ? DEFAULT_LIGHT_THEME : theme;
}

export function getAdvancedAppearanceChoices(
  { manualTheme, lightTheme, darkTheme, followSystem, custom }: ThemePreferencesV3,
): AdvancedAppearanceChoices {
  return { manualTheme, lightTheme, darkTheme, followSystem, custom };
}

export function getLegacyAppearanceChoices(preferences: ThemePreferencesV3): AppearanceChoices {
  return {
    manualTheme: legacyThemeId(preferences.manualTheme),
    lightTheme: DEFAULT_LIGHT_THEME,
    darkTheme: preferences.darkTheme,
    followSystem: preferences.followSystem,
    customAccent: preferences.custom.dark.colors.accent,
  };
}

function toAdvancedPreferences({ manualTheme, lightTheme, darkTheme, followSystem, reducedMotion, customAccent }:
  ThemePreferencesV2): ThemePreferencesV3 {
  return {
    schemaVersion: 3,
    manualTheme, lightTheme, darkTheme, followSystem, reducedMotion,
    custom: {
      light: inheritedCustomPalette(),
      dark: { colors: { ...inheritedCustomPalette(), accent: customAccent }, rendering: "legacy" },
    },
  };
}

function recordObject(value: unknown): StoredRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isRendering(value: unknown): value is ThemePreferencesV3["custom"]["dark"]["rendering"] {
  return value === "legacy" || value === "adaptive";
}

function isColorOverride(value: unknown): value is string | null {
  return value === null || isHexColor(value);
}

function normalizeAdvancedRecord(record: Record<string, unknown>, fallback: ThemePreferencesV3) {
  const recoveries: PreferenceRecovery[] = [];
  const read = <T,>(owner: StoredRecord, key: string, prefix: string,
    check: (value: unknown) => value is T, defaultValue: T): T => {
    const value = owner?.[key];
    if (check(value)) return value;
    recoveries.push({
      path: prefix + key,
      reason: owner && Object.prototype.hasOwnProperty.call(owner, key) ? "invalid" : "missing",
    });
    return defaultValue;
  };
  const readObject = (owner: StoredRecord, key: string, prefix: string) =>
    read(owner, key, prefix, (value): value is Record<string, unknown> => recordObject(value) !== null, null);
  const roles = (owner: StoredRecord, prefix: string, defaults: CustomPaletteOverrides): CustomPaletteOverrides => {
    const color = (role: CustomPaletteRole) => {
      const value = read(owner, role, prefix, isColorOverride, defaults[role]);
      return value === null ? null : normalizeAccent(value);
    };
    return { accent: color("accent"), background: color("background"), surface: color("surface"),
      text: color("text"), border: color("border") };
  };

  const custom = readObject(record, "custom", "");
  const light = readObject(custom, "light", "custom.");
  const dark = readObject(custom, "dark", "custom.");
  const darkColors = readObject(dark, "colors", "custom.dark.");
  const preferences: ThemePreferencesV3 = {
    schemaVersion: 3,
    manualTheme: read(record, "manualTheme", "", isMobileAppearanceTheme, fallback.manualTheme),
    lightTheme: read(record, "lightTheme", "", isAdvancedLightTheme, fallback.lightTheme),
    darkTheme: read(record, "darkTheme", "", isDarkTheme, fallback.darkTheme),
    followSystem: read(record, "followSystem", "", isBoolean, fallback.followSystem),
    reducedMotion: read(record, "reducedMotion", "", isBoolean, fallback.reducedMotion),
    custom: {
      light: roles(light, "custom.light.", fallback.custom.light),
      dark: {
        colors: roles(darkColors, "custom.dark.colors.", fallback.custom.dark.colors),
        rendering: read(dark, "rendering", "custom.dark.", isRendering, fallback.custom.dark.rendering),
      },
    },
  };
  if (preferences.custom.dark.rendering === "legacy" &&
      CUSTOM_PALETTE_ROLES.some(role => role !== "accent" && preferences.custom.dark.colors[role] !== null)) {
    if (!recoveries.some(recovery => recovery.path === "custom.dark.rendering")) {
      recoveries.push({ path: "custom.dark.rendering", reason: "invalid" });
    }
    // Valid advanced roles reveal an adaptive profile even if its rendering marker was damaged.
    preferences.custom.dark.rendering = "adaptive";
  }
  return { preferences, recoveries };
}

export function loadAdvancedThemePreferences(
  storage: Pick<IStorageAdapter, "get">, scheme: AppearanceScheme | null, storageUnavailable: boolean,
): AdvancedThemePreferencesLoad {
  let unavailable = storageUnavailable;
  let raw: string | null = null;
  try {
    raw = storage.get(ADVANCED_THEME_PREFERENCES_KEY);
  } catch {
    unavailable = true;
  }

  const record = parseRecord(raw);
  if (record?.schemaVersion === 3) {
    const defaults = toAdvancedPreferences(migrateLegacyPreferences(null, scheme));
    const loaded = normalizeAdvancedRecord(record, defaults);
    if (loaded.recoveries.length === 0) {
      return { ...loaded, saveStatus: unavailable ? "unavailable" : "ready" };
    }
  }

  const previous = loadThemePreferences(storage, scheme, unavailable);
  const fallback = toAdvancedPreferences(previous.preferences);
  if (record?.schemaVersion === 3) {
    return { ...normalizeAdvancedRecord(record, fallback), saveStatus: previous.saveStatus };
  }
  if (raw !== null) {
    const reason = record?.schemaVersion === undefined ? "corrupted" : "unsupported";
    return { preferences: fallback, recoveries: [{ path: ADVANCED_THEME_PREFERENCES_KEY, reason: "invalid" }],
      saveStatus: previous.saveStatus === "unavailable" ? "unavailable" : reason };
  }
  return { preferences: fallback, recoveries: [], saveStatus: previous.saveStatus };
}

export function editAdvancedPaletteRole(draft: AdvancedAppearanceChoices, profile: CustomPaletteProfile,
  role: CustomPaletteRole, color: string | null): AdvancedAppearanceChoices {
  const value = isHexColor(color) ? normalizeAccent(color) : color;
  const palette = profile === "light" ? draft.custom.light : draft.custom.dark.colors;
  if (palette[role] === value) return draft;
  const colors = { ...palette, [role]: value };
  return {
    ...draft, custom: profile === "light" ? { ...draft.custom, light: colors }
      : { ...draft.custom, dark: { colors, rendering: value === null ? draft.custom.dark.rendering : "adaptive" } },
  };
}

export function resetAdvancedPaletteProfile(
  draft: AdvancedAppearanceChoices, profile: CustomPaletteProfile,
): AdvancedAppearanceChoices {
  const colors = inheritedCustomPalette();
  return {
    ...draft, resetProfiles: [...new Set([...(draft.resetProfiles ?? []), profile])],
    custom: profile === "light" ? { ...draft.custom, light: colors }
      : { ...draft.custom, dark: { colors, rendering: "legacy" } },
  };
}

export type AdvancedAppearanceWrite =
  | { ok: true; preferences: ThemePreferencesV3 }
  | { ok: false; message: string };

const ADVANCED_SELECTION_KEYS = ["manualTheme", "lightTheme", "darkTheme", "followSystem"] as const;

export function prepareAdvancedAppearanceWrite(
  opening: AdvancedAppearanceChoices, edited: AdvancedAppearanceChoices, current: ThemePreferencesV3,
  validate: (candidate: ThemePreferencesV3, profile: CustomPaletteProfile) => PaletteIssue[],
): AdvancedAppearanceWrite {
  if (!isMobileAppearanceTheme(edited.manualTheme) || !isAdvancedLightTheme(edited.lightTheme) ||
      !isDarkTheme(edited.darkTheme) || !isBoolean(edited.followSystem) ||
      !isRendering(edited.custom.dark.rendering) ||
      CUSTOM_PALETTE_ROLES.some(role => !isColorOverride(edited.custom.light[role])
        || !isColorOverride(edited.custom.dark.colors[role]))) {
    return { ok: false, message: "Choose supported themes and enter valid six-digit HEX colors." };
  }

  let conflict = false;
  const mergeLeaf = <T,>(before: T, request: T, saved: T, reset = false): T => {
    if ((!reset && request === before) || request === saved) return saved;
    if (saved !== before) conflict = true;
    return request;
  };
  const mergeColors = (before: CustomPaletteOverrides, request: CustomPaletteOverrides,
    saved: CustomPaletteOverrides, reset: boolean) => {
    const next = { ...saved };
    for (const role of CUSTOM_PALETTE_ROLES) {
      const color = request[role];
      next[role] = mergeLeaf(before[role], color === null ? null : normalizeAccent(color), saved[role], reset);
    }
    return CUSTOM_PALETTE_ROLES.some(role => next[role] !== saved[role]) ? next : saved;
  };
  const resetLight = edited.resetProfiles?.includes("light") ?? false;
  const resetDark = edited.resetProfiles?.includes("dark") ?? false;
  const light = mergeColors(opening.custom.light, edited.custom.light, current.custom.light, resetLight);
  const darkColors = mergeColors(opening.custom.dark.colors, edited.custom.dark.colors, current.custom.dark.colors, resetDark);
  const requestedDarkColor = CUSTOM_PALETTE_ROLES.some(role => {
    const color = edited.custom.dark.colors[role];
    return color !== null && normalizeAccent(color) !== opening.custom.dark.colors[role];
  });
  const savedMode = current.custom.dark.rendering;
  const requestedMode = requestedDarkColor ? "adaptive"
    : resetDark && CUSTOM_PALETTE_ROLES.every(role => darkColors[role] === null) ? "legacy" : savedMode;
  const rendering = mergeLeaf(opening.custom.dark.rendering, requestedMode, savedMode, resetDark || requestedDarkColor);

  const candidate: ThemePreferencesV3 = {
    ...current,
    manualTheme: mergeLeaf(opening.manualTheme, edited.manualTheme, current.manualTheme),
    lightTheme: mergeLeaf(opening.lightTheme, edited.lightTheme, current.lightTheme),
    darkTheme: mergeLeaf(opening.darkTheme, edited.darkTheme, current.darkTheme),
    followSystem: mergeLeaf(opening.followSystem, edited.followSystem, current.followSystem),
    custom: { light, dark: { colors: darkColors, rendering } },
  };
  if (conflict) {
    return { ok: false, message: "Appearance changed while you were editing. Keep your draft, or discard it and reopen Studio to review the latest choices." };
  }

  const darkChanged = darkColors !== current.custom.dark.colors || rendering !== current.custom.dark.rendering;
  for (const profile of ["light", "dark"] as const) {
    if (profile === "light" ? light !== current.custom.light : darkChanged && rendering === "adaptive") {
      const issue = validate(candidate, profile)[0];
      if (issue) {
        const reason = issue.code === "scheme-luminance" ? "does not match the profile’s light or dark range"
          : issue.code === "text-contrast" ? "does not have enough contrast against the palette’s surfaces"
          : "needs a valid six-digit HEX color";
        return { ok: false, message: `Custom ${profile === "light" ? "Light" : "Dark"} ${issue.role} ${reason}.` };
      }
    }
  }

  const changed = light !== current.custom.light || darkChanged || ADVANCED_SELECTION_KEYS.some(key => candidate[key] !== current[key]);
  return { ok: true, preferences: changed ? candidate : current };
}
