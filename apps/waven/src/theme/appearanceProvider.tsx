import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';
import { useWavenReducedMotion } from '../hooks/useWavenReducedMotion';
import {
  resolveWavenTheme,
  resolveWavenMotion,
  WAVEN_NOIR_COLORS,
  type WavenThemeId,
  type WavenThemeColors,
  type WavenMotionIntensity,
  type WavenSystemAppearance,
} from './appearance';
import type { WavenAppearanceSnapshot } from './appearanceStore';
import { useWavenAppearancePreferences } from './appearanceRuntime';

export interface WavenAppearanceContextValue {
  readonly snapshot: WavenAppearanceSnapshot;
  readonly systemAppearance: WavenSystemAppearance;
  readonly requestedTheme: WavenThemeId;
  readonly renderedTheme: WavenThemeId;
  readonly colors: WavenThemeColors;
  readonly effectiveMotion: WavenMotionIntensity;
}

const AppearanceContext =
  createContext<WavenAppearanceContextValue | null>(null);

export function WavenAppearanceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const snapshot = useWavenAppearancePreferences();
  const nativeScheme = useColorScheme();
  const systemAppearance: WavenSystemAppearance =
    nativeScheme === 'light' || nativeScheme === 'dark'
      ? nativeScheme
      : null;
  const systemReducedMotion = useWavenReducedMotion(true);

  const value = useMemo<WavenAppearanceContextValue>(() => ({
    snapshot,
    systemAppearance,
    requestedTheme: resolveWavenTheme(
      snapshot.preferences,
      systemAppearance,
    ),

    // V8.6.1B resolves intent without activating unfinished themes.
    // All existing product surfaces retain the accepted NOIR palette.
    renderedTheme: 'noir',
    colors: WAVEN_NOIR_COLORS,

    effectiveMotion: resolveWavenMotion(
      snapshot.preferences,
      systemReducedMotion,
    ),
  }), [snapshot, systemAppearance, systemReducedMotion]);

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useWavenAppearance(): WavenAppearanceContextValue {
  const value = useContext(AppearanceContext);

  if (!value) {
    throw new Error('WAVEN_APPEARANCE_PROVIDER_REQUIRED');
  }

  return value;
}
