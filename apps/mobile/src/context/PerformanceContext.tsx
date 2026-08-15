import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import * as Device from 'expo-device';
import { mmkvStorageAdapter } from '../services/storageAdapter';
import {
  type PerformanceProfileId,
  type PerformanceProfileSelection,
  resolveAutomaticPerformanceProfile,
} from '../services/performanceProfiles';

const PERFORMANCE_STORAGE_KEY = 'mobilePerformancePreferencesV1';

interface MobilePerformancePreferences {
  schemaVersion: 1;
  selection: PerformanceProfileSelection;
}

interface PerformanceContextValue {
  selection: PerformanceProfileSelection;
  automaticProfile: PerformanceProfileId;
  resolvedProfile: PerformanceProfileId;
  setSelection: (selection: PerformanceProfileSelection) => void;
}

const VALID_SELECTIONS = new Set<PerformanceProfileSelection>([
  'automatic',
  'efficiency',
  'balanced',
  'quality',
]);

function loadPreferences(): MobilePerformancePreferences {
  try {
    const parsed = JSON.parse(mmkvStorageAdapter.get(PERFORMANCE_STORAGE_KEY) || '{}');
    if (parsed?.schemaVersion === 1 && VALID_SELECTIONS.has(parsed.selection)) {
      return parsed as MobilePerformancePreferences;
    }
  } catch {}
  return { schemaVersion: 1, selection: 'automatic' };
}

const PerformanceContext = createContext<PerformanceContextValue | null>(null);

export function PerformanceProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<MobilePerformancePreferences>(loadPreferences);

  // expo-device exposes stable device constants. Resolve them once for this
  // provider session so Automatic never flaps while the user is browsing.
  const automaticProfile = useMemo(() => resolveAutomaticPerformanceProfile({
    totalMemoryBytes: Device.totalMemory ?? null,
    deviceYearClass: Device.deviceYearClass ?? null,
  }), []);

  const resolvedProfile = preferences.selection === 'automatic'
    ? automaticProfile
    : preferences.selection;

  const setSelection = useCallback((selection: PerformanceProfileSelection) => {
    if (!VALID_SELECTIONS.has(selection)) return;
    const next: MobilePerformancePreferences = { schemaVersion: 1, selection };
    setPreferences(next);
    mmkvStorageAdapter.set(PERFORMANCE_STORAGE_KEY, JSON.stringify(next));
  }, []);

  const value = useMemo<PerformanceContextValue>(() => ({
    selection: preferences.selection,
    automaticProfile,
    resolvedProfile,
    setSelection,
  }), [automaticProfile, preferences.selection, resolvedProfile, setSelection]);

  return <PerformanceContext.Provider value={value}>{children}</PerformanceContext.Provider>;
}

export function usePerformanceProfile() {
  const value = useContext(PerformanceContext);
  if (!value) throw new Error('usePerformanceProfile must be used within PerformanceProvider');
  return value;
}
