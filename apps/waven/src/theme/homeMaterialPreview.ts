import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';

import {
  resolveWavenMaterial,
  wavenMaterialGeometry,
} from './adaptiveMaterials';

export type HomeMaterialTheme = 'hikari' | 'hikari-night';

export type HomeMaterialScope =
  | 'home'
  | 'wordmark'
  | 'section'
  | 'connection'
  | 'library';

export const WavenHomeMaterialContext =
  createContext<HomeMaterialTheme | number | null>(null);

type StyleMap = Record<string, object>;

function resolveEndpointHomeMaterialStyles<T extends StyleMap>(
  base: T,
  scope: HomeMaterialScope,
  theme: HomeMaterialTheme | null,
): T {
  // Normal NOIR and every route outside the preview keep their
  // original style object and appearance.
  if (!theme) return base;

  const panel = resolveWavenMaterial(theme, 'panel', 'translucent');
  const floating = resolveWavenMaterial(theme, 'floating', 'translucent');
  const sheet = resolveWavenMaterial(theme, 'sheet', 'solid');

  const light = theme === 'hikari';

  const primary = { color: panel.text };
  const secondary = { color: panel.secondaryText };
  const accent = { color: panel.accent };

  const material = {
    backgroundColor: panel.background,
    borderColor: 'transparent',
    borderRadius: panel.radius,
  };

  const pill = {
    backgroundColor: floating.background,
    borderColor: floating.edge,
    borderRadius: wavenMaterialGeometry.control,
  };

  const overrides: Record<HomeMaterialScope, StyleMap> = {
    home: {
      stackLayerBack: {
        backgroundColor: light
          ? 'rgba(230,247,255,0.40)'
          : 'rgba(48,115,175,0.20)',
        borderColor: panel.edge,
      },
      stackLayerMiddle: {
        backgroundColor: light
          ? 'rgba(255,255,255,0.38)'
          : 'rgba(121,181,226,0.10)',
        borderColor: panel.edge,
      },
      heroArtwork: { borderColor: panel.edge },
      heroBadge: pill,
      heroBadgeDot: { backgroundColor: panel.accent },
      heroBadgeText: primary,
      eyebrow: accent,
      heroTitle: primary,
      heroTitleAccent: accent,
      heroBody: secondary,
      heroAction: pill,
      heroActionText: primary,
      heroActionArrow: accent,
      sectionHint: secondary,
      recentState: material,
      recentTitle: primary,
      recentBody: secondary,
      discoveryState: material,
      discoveryStateTitle: primary,
      discoveryStateBody: secondary,
      discoveryAction: pill,
      discoveryActionText: primary,
      discoveryNotice: secondary,
      discoveryNoticeAction: pill,
      discoveryNoticeActionText: primary,
      discoveryTitle: primary,
      discoverySubtitle: secondary,
      discoverySkeleton: {
        backgroundColor: panel.edge,
        borderColor: 'transparent',
      },
      shortcutGlassTint: { backgroundColor: 'transparent' },
      shortcutGlassInnerEdge: { borderColor: 'transparent' },
      glassTopHighlight: { backgroundColor: 'transparent' },
    },

    // Branding remains over the sky, not over the lower pearl material.
    wordmark: {
      wordmark: { color: '#FFFFFF' },
      accent: { color: '#C4EAFF' },
    },

    section: {
      title: primary,
      accent,
    },

    connection: {
      panel: {
        ...material,
        backgroundColor: floating.background,
        paddingHorizontal: 12,
        paddingVertical: 4,
      },
      title: primary,
      message: secondary,
      actionText: accent,
    },

    library: {
      rowTitle: primary,
      subtitle: secondary,
      moreText: accent,
      button: {
        ...pill,
        borderRadius: 18,
      },
      buttonText: primary,
      title: primary,
      notice: secondary,
      dialog: {
        backgroundColor: sheet.base,
        borderColor: sheet.edge,
        borderRadius: sheet.radius,
      },
      input: {
        color: panel.text,
        borderColor: panel.edge,
        borderRadius: 18,
      },
    },
  };

  const result: StyleMap = { ...base };

  for (const [key, override] of Object.entries(overrides[scope])) {
    if (Object.prototype.hasOwnProperty.call(base, key)) {
      result[key] = { ...base[key], ...override };
    }
  }

  return result as T;
}


export function normalizeHomeMaterialProgress(value: number): number {
  return Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : 0;
}

type Channels = readonly [number, number, number, number];

function readMaterialColor(value: string): Channels | null {
  if (value === 'transparent') return [0, 0, 0, 0];

  if (/^#[0-9a-f]{6}$/i.test(value)) {
    return [
      parseInt(value.slice(1, 3), 16),
      parseInt(value.slice(3, 5), 16),
      parseInt(value.slice(5, 7), 16),
      1,
    ];
  }

  const rgba = value.match(/^rgba\(([^)]+)\)$/);

  if (!rgba) return null;

  const values = rgba[1].split(',').map(Number);

  if (
    values.length !== 4 ||
    !values.every(Number.isFinite)
  ) return null;

  return [values[0], values[1], values[2], values[3]];
}

export function mixHomeMaterialColor(
  from: string,
  to: string,
  progress: number,
): string {
  const p = normalizeHomeMaterialProgress(progress);

  if (p === 0 || from === to) return from;
  if (p === 1) return to;

  const a = readMaterialColor(from);
  const b = readMaterialColor(to);

  if (!a || !b) return p < 0.5 ? from : to;

  // Preserve the actual surface hue at transparent boundaries.
  const left = a[3] === 0 ? b : a;
  const right = b[3] === 0 ? a : b;

  const channels = [0, 1, 2].map(index =>
    Math.round(left[index] + (right[index] - left[index]) * p),
  );

  const alpha = a[3] + (b[3] - a[3]) * p;

  return 'rgba(' +
    channels.join(',') +
    ',' + alpha.toFixed(3) + ')';
}

export function resolveHomeMaterialStyles<T extends StyleMap>(
  base: T,
  scope: HomeMaterialScope,
  theme: HomeMaterialTheme | number | null,
): T {
  if (typeof theme !== 'number') {
    return resolveEndpointHomeMaterialStyles(base, scope, theme);
  }

  const p = normalizeHomeMaterialProgress(theme);

  const day = resolveEndpointHomeMaterialStyles(
    base, scope, 'hikari',
  );

  if (p === 0) return day;

  const night = resolveEndpointHomeMaterialStyles(
    base, scope, 'hikari-night',
  );

  if (p === 1) return night;

  const result: StyleMap = { ...base };

  const colorKeys = new Set([
    'color',
    'backgroundColor',
    'borderColor',
  ]);

  for (const key of Object.keys(base)) {
    const a = day[key] as Record<string, unknown>;
    const b = night[key] as Record<string, unknown>;

    if (a === b) continue;

    const style = { ...a };

    for (const property of Object.keys(b)) {
      const from = a[property];
      const to = b[property];

      if (
        colorKeys.has(property) &&
        typeof from === 'string' &&
        typeof to === 'string'
      ) {
        style[property] = mixHomeMaterialColor(from, to, p);
      } else if (from !== to) {
        style[property] = p < 0.5 ? from : to;
      }
    }

    result[key] = style;
  }

  return result as T;
}

/**
 * Lower content atmosphere.
 * Use a lighter veil than D1 to retain more scenery.
 * All values remain deterministic under transition reversal.
 */
export function resolveHomePageMaterial(progress: number) {
  const p = normalizeHomeMaterialProgress(progress);

  return {
    background: mixHomeMaterialColor(
      'rgba(244,250,255,0.84)',
      'rgba(8,25,44,0.88)',
      p,
    ),

    transparent: mixHomeMaterialColor(
      'rgba(244,250,255,0)',
      'rgba(8,25,44,0)',
      p,
    ),
  };
}

export function useWavenHomeStyles<T extends StyleMap>(
  base: T,
  scope: HomeMaterialScope,
): T {
  const theme = useContext(WavenHomeMaterialContext);

  return useMemo(
    () => resolveHomeMaterialStyles(base, scope, theme),
    [base, scope, theme],
  );
}

export function WavenHomeMaterialContent<T extends StyleMap>({
  base,
  render,
}: {
  base: T;
  render: (styles: T) => ReactNode;
}) {
  return render(useWavenHomeStyles(base, 'home'));
}