import {
  createContext,
  useContext,
  useMemo,
} from 'react';

import {
  mixHomeMaterialColor,
  normalizeHomeMaterialProgress,
} from './homeMaterialPreview';

import {
  resolveWavenMaterial,
  wavenMaterialGeometry,
} from './adaptiveMaterials';

/**
 * Development-only presentation context for persistent chrome.
 * No independent animation or playback ownership.
 */
export const WavenPreviewChromeContext =
  createContext<number | null>(null);

type StyleMap = Record<string, object>;

export interface MiniPlayerAppearance<T extends StyleMap> {
  styles: T;
  highlight: readonly [string, string] | null;
}

export function resolvePreviewMiniPlayerAppearance<T extends StyleMap>(
  base: T,
  progress: number | null,
): MiniPlayerAppearance<T> {
  if (progress === null) {
    return { styles: base, highlight: null };
  }

  const p = normalizeHomeMaterialProgress(progress);

  const day = resolveWavenMaterial(
    'hikari', 'floating', 'translucent',
  );

  const night = resolveWavenMaterial(
    'hikari-night', 'floating', 'translucent',
  );

  const mix = (a: string, b: string) =>
    mixHomeMaterialColor(a, b, p);

  const primary = mix(day.text, night.text);
  const secondary = mix(day.secondaryText, night.secondaryText);
  const accent = mix(day.accent, night.accent);
  const edge = mix(day.edge, night.edge);

  const surface = mix(day.background, night.background);

  const overrides: StyleMap = {
    panel: {
      backgroundColor: surface,
      borderColor: 'transparent',
      borderRadius: wavenMaterialGeometry.floating,
    },

    topHighlight: {
      backgroundColor: 'transparent',
      height: 36,
      left: 0,
      right: 0,
    },

    artworkFrame: {
      borderColor: edge,
    },

    title: { color: primary },
    artist: { color: secondary },
    artistAttention: { color: primary },

    control: {
      backgroundColor: mix(
        'rgba(255,255,255,0.84)',
        'rgba(19,43,70,0.84)',
      ),
      borderColor: edge,
    },

    playIcon: {
      borderLeftColor: accent,
    },

    pauseBar: {
      backgroundColor: accent,
    },

    waveBarRemaining: {
      backgroundColor: secondary,
    },

    waveBarPlayed: {
      backgroundColor: accent,
    },

    bufferingSignal: {
      backgroundColor: accent,
    },
  };

  const styles: StyleMap = { ...base };

  for (const [key, override] of Object.entries(overrides)) {
    if (Object.prototype.hasOwnProperty.call(base, key)) {
      styles[key] = { ...base[key], ...override };
    }
  }

  return {
    styles: styles as T,
    highlight: [
      mix(
        'rgba(255,255,255,0.52)',
        'rgba(116,184,230,0.12)',
      ),
      mix(day.transparent, night.transparent),
    ],
  };
}

export function useMiniPlayerPreviewAppearance<T extends StyleMap>(
  base: T,
): MiniPlayerAppearance<T> {
  const progress = useContext(WavenPreviewChromeContext);

  return useMemo(
    () => resolvePreviewMiniPlayerAppearance(base, progress),
    [base, progress],
  );
}

/**
 * Seamless root backing shared by Home's lower atmosphere
 * and the persistent playback/navigation region.
 */
export function resolvePreviewChromeBacking(progress: number | null) {
  if (progress === null) return null;

  const p = normalizeHomeMaterialProgress(progress);

  const day = resolveWavenMaterial('hikari', 'panel', 'solid');
  const night = resolveWavenMaterial('hikari-night', 'panel', 'solid');

  const base = mixHomeMaterialColor(day.base, night.base, p);

  // Preserve the surface hue while removing its opacity.
  const transparent = mixHomeMaterialColor(
    base, 'transparent', 0.99999,
  );

  return {
    base,
    fade: [transparent, base] as readonly [string, string],
  };
}

export function usePreviewChromeBacking() {
  const progress = useContext(WavenPreviewChromeContext);

  return useMemo(
    () => resolvePreviewChromeBacking(progress),
    [progress],
  );
}

export interface NavigationAppearance<T extends StyleMap> {
  styles: T;
  activeTone: string | null;
  inactiveTone: string | null;
  highlight: readonly [string, string] | null;
}

export function resolvePreviewNavigationAppearance<T extends StyleMap>(
  base: T,
  progress: number | null,
): NavigationAppearance<T> {
  if (progress === null) {
    return {
      styles: base,
      activeTone: null,
      inactiveTone: null,
      highlight: null,
    };
  }

  const p = normalizeHomeMaterialProgress(progress);

  const day = resolveWavenMaterial(
    'hikari', 'navigation', 'translucent',
  );

  const night = resolveWavenMaterial(
    'hikari-night', 'navigation', 'translucent',
  );

  const mix = (a: string, b: string) =>
    mixHomeMaterialColor(a, b, p);

  const activeTone = mix(day.accent, night.accent);
  const inactiveTone = mix(day.secondaryText, night.secondaryText);

  const overrides: StyleMap = {
    inner: {
      backgroundColor: mix(day.background, night.background),
      borderColor: 'transparent',
    },

    selectionPill: {
      backgroundColor: mix(
        'rgba(202,232,249,0.90)',
        'rgba(27,65,101,0.90)',
      ),
      borderColor: mix(
        'rgba(7,95,159,0.14)',
        'rgba(116,210,255,0.20)',
      ),
    },

    labelActive: {
      color: mix(day.text, night.text),
    },
  };

  const styles: StyleMap = { ...base };

  for (const [key, override] of Object.entries(overrides)) {
    if (Object.prototype.hasOwnProperty.call(base, key)) {
      styles[key] = { ...base[key], ...override };
    }
  }

  const surface = mix(day.base, night.base);

  return {
    styles: styles as T,
    activeTone,
    inactiveTone,
    highlight: [
      mix(
        'rgba(255,255,255,0.62)',
        'rgba(116,184,230,0.13)',
      ),
      mixHomeMaterialColor(surface, 'transparent', 0.99999),
    ],
  };
}

export function usePreviewNavigationAppearance<T extends StyleMap>(
  base: T,
): NavigationAppearance<T> {
  const progress = useContext(WavenPreviewChromeContext);

  return useMemo(
    () => resolvePreviewNavigationAppearance(base, progress),
    [base, progress],
  );
}
