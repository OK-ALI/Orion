import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Appearance, AppState, type ColorSchemeName } from "react-native";
import type { MobileThemePreferences, OrionThemeId } from "@orion/shared/types";
import { mmkvStorageAdapter } from "../services/storageAdapter";

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

const THEME_STORAGE_KEY = "mobileThemePreferencesV1";

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
    textMuted: "#747482", border: "rgba(255,255,255,0.10)", accent: "#E50914",
    accentSoft: "rgba(229,9,20,0.16)", onAccent: "#ffffff", mediaScrim: "rgba(3,3,8,0.78)",
    success: "#48c774", warning: "#ffb845", danger: "#ff4757",
  },
};

interface ThemeContextValue {
  theme: MobileThemeTokens;
  preferences: MobileThemePreferences;
  setTheme: (theme: OrionThemeId) => void;
  setReducedMotion: (value: boolean) => void;
  setFollowSystem: (value: boolean) => void;
  setCustomAccent: (value: string | null) => boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function loadPreferences(systemDark: boolean): MobileThemePreferences {
  try {
    const parsed = JSON.parse(mmkvStorageAdapter.get(THEME_STORAGE_KEY) || "{}");
    if (parsed?.schemaVersion === 1 && THEMES[parsed.theme as OrionThemeId]) return parsed;
  } catch {}
  return {
    schemaVersion: 1,
    theme: systemDark ? "midnight-premiere" : "projector-silver",
    followSystem: true,
    reducedMotion: false,
    customAccent: null,
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(() => Appearance.getColorScheme() || "dark");
  const [preferences, setPreferences] = useState(() => loadPreferences(systemScheme !== "light"));
  const persist = useCallback((next: MobileThemePreferences) => {
    setPreferences(next);
    mmkvStorageAdapter.set(THEME_STORAGE_KEY, JSON.stringify(next));
  }, []);
  const setTheme = useCallback((theme: OrionThemeId) => {
    persist({ ...preferences, theme, followSystem: false });
  }, [persist, preferences]);
  const setReducedMotion = useCallback((reducedMotion: boolean) => {
    persist({ ...preferences, reducedMotion });
  }, [persist, preferences]);
  const setFollowSystem = useCallback((followSystem: boolean) => {
    const theme = followSystem
      ? (systemScheme === "light" ? "projector-silver" : "midnight-premiere")
      : preferences.theme;
    persist({ ...preferences, followSystem, theme });
  }, [persist, preferences, systemScheme]);
  const setCustomAccent = useCallback((value: string | null) => {
    if (value !== null && !/^#[0-9a-f]{6}$/i.test(value)) return false;
    persist({ ...preferences, theme: "custom", followSystem: false, customAccent: value });
    return true;
  }, [persist, preferences]);
  React.useEffect(() => {
    const appearance = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme || "dark");
    });
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") setSystemScheme(Appearance.getColorScheme() || "dark");
    });
    return () => {
      appearance.remove();
      appState.remove();
    };
  }, []);
  React.useEffect(() => {
    if (!preferences.followSystem) return;
    const next = systemScheme === "light" ? "projector-silver" : "midnight-premiere";
    if (preferences.theme !== next) persist({ ...preferences, theme: next });
  }, [preferences, persist, systemScheme]);
  const theme = useMemo(() => {
    const base = THEMES[preferences.theme] || THEMES["midnight-premiere"];
    if (preferences.theme !== "custom" || !preferences.customAccent) return base;
    return { ...base, accent: preferences.customAccent };
  }, [preferences]);

  return (
    <ThemeContext.Provider value={{ theme, preferences, setTheme, setReducedMotion, setFollowSystem, setCustomAccent }}>
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
