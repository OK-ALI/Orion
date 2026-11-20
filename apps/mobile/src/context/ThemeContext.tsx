import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Appearance, AppState, type ColorSchemeName } from "react-native";
import type { MobileThemePreferences, OrionThemeId } from "@orion/shared/types";
import { getMobileStorageHealth, mmkvStorageAdapter } from "../services/storageAdapter";
import { useSystemReducedMotion } from "../hooks/useSystemReducedMotion";
import {
  getAppearanceChoices,
  isCustomAccent,
  loadThemePreferences,
  normalizeAccent,
  prepareAppearancePatch,
  resolveThemeSelection,
  THEME_PREFERENCES_KEY,
  type AppearanceChoices,
  type AppearanceScheme,
  type ThemePreferencesV2,
} from "../features/appearance/appearancePreferences";

export interface MobileThemeTokens {
  id: OrionThemeId;
  dark: boolean;
  background: string;
  elevated: string;
  surface: string;
  surfaceHover: string;
  input: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  mediaScrim: string;
  success: string;
  warning: string;
  danger: string;
}

const DEFAULT_CUSTOM_ACCENT = "#E50914";

function accentChannels(value: string): [number, number, number] {
  const normalized = normalizeAccent(value);
  return [
    Number.parseInt(normalized.slice(1, 3), 16),
    Number.parseInt(normalized.slice(3, 5), 16),
    Number.parseInt(normalized.slice(5, 7), 16),
  ];
}

function accentSoft(value: string): string {
  const [red, green, blue] = accentChannels(value);
  return `rgba(${red},${green},${blue},0.16)`;
}

function onAccent(value: string): string {
  const [red, green, blue] = accentChannels(value);
  const channel = (component: number) => {
    const srgb = component / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  };
  const luminance = 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
  const whiteContrast = 1.05 / (luminance + 0.05);
  const blackContrast = (luminance + 0.05) / 0.05;
  return blackContrast > whiteContrast ? "#000000" : "#ffffff";
}

const THEMES: Record<OrionThemeId, MobileThemeTokens> = {
  "midnight-premiere": {
    id: "midnight-premiere", dark: true, background: "#08070c", elevated: "#100e17",
    surface: "#191622", surfaceHover: "#252033", input: "#14111c", text: "#f4f1f6",
    textSecondary: "#b5aeba", textMuted: "#777080", border: "rgba(255,255,255,0.10)",
    accent: "#E50914", accentSoft: "rgba(229,9,20,0.16)", onAccent: "#ffffff",
    mediaScrim: "rgba(3,3,8,0.78)", success: "#48c774", warning: "#ffb845", danger: "#ff4757",
  },
  amoled: {
    id: "amoled", dark: true, background: "#000000", elevated: "#080808", surface: "#101010",
    surfaceHover: "#191919", input: "#0c0c0c", text: "#ffffff", textSecondary: "#b8b8b8",
    textMuted: "#737373", border: "rgba(255,255,255,0.12)", accent: "#ff1f2d",
    accentSoft: "rgba(255,31,45,0.16)", onAccent: "#ffffff", mediaScrim: "rgba(0,0,0,0.82)",
    success: "#54d38a", warning: "#ffc35c", danger: "#ff5260",
  },
  mocha: {
    id: "mocha", dark: true, background: "#17110f", elevated: "#211816", surface: "#2b201d",
    surfaceHover: "#392b27", input: "#241a18", text: "#f5ebe3", textSecondary: "#c8b5aa",
    textMuted: "#8f7a70", border: "rgba(245,235,227,0.12)", accent: "#d96852",
    accentSoft: "rgba(217,104,82,0.16)", onAccent: "#ffffff", mediaScrim: "rgba(18,10,8,0.80)",
    success: "#79c98b", warning: "#e7b35e", danger: "#e56868",
  },
  slate: {
    id: "slate", dark: true, background: "#0b1017", elevated: "#121a24", surface: "#1a2532",
    surfaceHover: "#243244", input: "#151f2a", text: "#eef4fb", textSecondary: "#aebccc",
    textMuted: "#6f8093", border: "rgba(214,230,246,0.12)", accent: "#6f8fb8",
    accentSoft: "rgba(111,143,184,0.17)", onAccent: "#ffffff", mediaScrim: "rgba(5,9,14,0.80)",
    success: "#5fc797", warning: "#dfae5d", danger: "#ef6877",
  },
  "projector-silver": {
    id: "projector-silver", dark: false, background: "#f1ede5", elevated: "#faf8f4",
    surface: "#e8e2d9", surfaceHover: "#ded7cc", input: "#ffffff", text: "#211f23",
    textSecondary: "#55505a", textMuted: "#77717b", border: "rgba(32,29,34,0.16)",
    accent: "#a1121d", accentSoft: "rgba(161,18,29,0.12)", onAccent: "#ffffff",
    mediaScrim: "rgba(15,13,16,0.70)", success: "#267a4b", warning: "#966613", danger: "#b32635",
  },
  custom: {
    id: "custom", dark: true, background: "#09090d", elevated: "#111118", surface: "#191923",
    surfaceHover: "#242432", input: "#14141d", text: "#f4f4f7", textSecondary: "#b2b2bd",
    textMuted: "#747482", border: "rgba(255,255,255,0.10)", accent: DEFAULT_CUSTOM_ACCENT,
    accentSoft: "rgba(229,9,20,0.16)", onAccent: "#ffffff", mediaScrim: "rgba(3,3,8,0.78)",
    success: "#48c774", warning: "#ffb845", danger: "#ff4757",
  },
};

interface ThemeContextValue {
  systemReducedMotion: boolean | null;
  theme: MobileThemeTokens;
  preferences: MobileThemePreferences;
  appearanceChoices: AppearanceChoices;
  appearanceSaveBlock: string | null;
  systemScheme: AppearanceScheme;
  applyAppearanceChoices: (opening: AppearanceChoices, edited: AppearanceChoices) => AppearanceApplyResult;
  setTheme: (theme: OrionThemeId) => void;
  setReducedMotion: (value: boolean) => void;
  setFollowSystem: (value: boolean) => void;
  setCustomAccent: (value: string | null) => boolean;
  preferenceSaveError: string | null;
  dismissPreferenceSaveError: () => void;
}

type AppearanceApplyResult = { ok: true } | { ok: false; message: string };

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function resolvePalette(themeId: OrionThemeId, customAccent: string | null): MobileThemeTokens {
  const base = THEMES[themeId];
  if (themeId !== "custom" || !customAccent) return base;
  const accent = normalizeAccent(customAccent);
  return {
    ...base,
    accent,
    accentSoft: accentSoft(accent),
    onAccent: onAccent(accent),
  };
}

function normalizeSystemScheme(scheme: ColorSchemeName | null | undefined): "light" | "dark" {
  return scheme === "light" ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemReducedMotion = useSystemReducedMotion();
  const [systemScheme, setSystemScheme] = useState(() => normalizeSystemScheme(Appearance.getColorScheme()));
  const [initial] = useState(() => loadThemePreferences(
    mmkvStorageAdapter,
    systemScheme,
    getMobileStorageHealth().state === "unavailable",
  ));
  const [applied, setApplied] = useState(initial.preferences);
  const committed = useRef(applied);
  const [preferenceSaveError, setPreferenceSaveError] = useState<string | null>(null);
  const dismissPreferenceSaveError = useCallback(() => setPreferenceSaveError(null), []);

  const appearanceChoices = useMemo(() => getAppearanceChoices(applied), [applied]);
  const appearanceSaveBlock = initial.saveStatus === "unsupported"
    ? "These settings were saved by a different version of Orion."
    : initial.saveStatus === "unavailable"
      ? "Local storage is unavailable. Reopen Orion and try again."
      : null;

  const persist = useCallback((
    patch: Partial<Omit<ThemePreferencesV2, "schemaVersion">>,
    reportError: (message: string) => void = setPreferenceSaveError,
  ) => {
    const previous = committed.current;
    if (Object.entries(patch).every(([key, value]) => previous[key as keyof ThemePreferencesV2] === value)) {
      return true;
    }
    if (appearanceSaveBlock) {
      reportError(appearanceSaveBlock);
      return false;
    }

    const next = { ...previous, ...patch };
    try {
      mmkvStorageAdapter.set(THEME_PREFERENCES_KEY, JSON.stringify(next));
    } catch {
      reportError("Try again to save your changes.");
      return false;
    }

    // Later updates can run before React renders the saved snapshot.
    committed.current = next;
    setApplied(next);
    setPreferenceSaveError(null);
    return true;
  }, [appearanceSaveBlock]);

  const applyAppearanceChoices = useCallback((opening: AppearanceChoices, edited: AppearanceChoices): AppearanceApplyResult => {
    const plan = prepareAppearancePatch(opening, edited, getAppearanceChoices(committed.current));
    if (!plan.ok) return plan;
    let message = "Try again to save your changes.";
    if (persist(plan.patch, error => { message = error; })) return { ok: true };
    return { ok: false, message };
  }, [persist]);

  const setTheme = useCallback((manualTheme: OrionThemeId) => {
    persist({ manualTheme, followSystem: false });
  }, [persist]);
  const setReducedMotion = useCallback((reducedMotion: boolean) => {
    persist({ reducedMotion });
  }, [persist]);
  const setFollowSystem = useCallback((followSystem: boolean) => {
    persist({ followSystem });
  }, [persist]);
  const setCustomAccent = useCallback((value: string | null) => {
    if (value !== null && !isCustomAccent(value)) return false;
    const customAccent = value === null ? null : normalizeAccent(value);
    return persist({ manualTheme: "custom", followSystem: false, customAccent });
  }, [persist]);

  React.useEffect(() => {
    const appearance = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(normalizeSystemScheme(colorScheme));
    });
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") setSystemScheme(normalizeSystemScheme(Appearance.getColorScheme()));
    });
    setSystemScheme(normalizeSystemScheme(Appearance.getColorScheme()));
    return () => {
      appearance.remove();
      appState.remove();
    };
  }, []);

  const { customAccent, followSystem, reducedMotion } = applied;
  const themeId = resolveThemeSelection(applied, systemScheme);
  const theme = useMemo(() => resolvePalette(themeId, customAccent), [themeId, customAccent]);
  // Existing consumers use this view of the effective selection. V2 alone is saved.
  const preferences = useMemo<MobileThemePreferences>(() => ({
    schemaVersion: 1,
    theme: themeId,
    customAccent,
    followSystem,
    reducedMotion,
  }), [themeId, customAccent, followSystem, reducedMotion]);

  return (
    <ThemeContext.Provider value={{
      theme, preferences, systemReducedMotion, setTheme, setReducedMotion, setFollowSystem, setCustomAccent,
      preferenceSaveError, dismissPreferenceSaveError,
      appearanceChoices, appearanceSaveBlock, systemScheme, applyAppearanceChoices,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useOrionTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useOrionTheme must be used within ThemeProvider");
  return value;
}

export const ORION_MOBILE_THEMES = THEMES;
