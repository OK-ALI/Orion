/**
 * WAVEN seamless adaptive materials.
 *
 * Presentation only: no storage, playback or platform ownership.
 * Theme identity is supplied by the existing appearance lifecycle.
 * Translucency is explicit; unknown rendering capability uses solid.
 */

export type WavenMaterialTheme =
  | 'noir'
  | 'hikari'
  | 'hikari-night';

export type WavenMaterialRole =
  | 'panel'
  | 'floating'
  | 'navigation'
  | 'sheet';

export type WavenMaterialRendering =
  | 'solid'
  | 'translucent';

export const wavenMaterialGeometry = Object.freeze({
  panel: 24,
  floating: 26,
  navigation: 999,
  sheet: 30,
  artwork: 20,
  control: 999,
  minimumTouchTarget: 48,
});

interface MaterialPalette {
  base: string;
  text: string;
  secondaryText: string;
  accent: string;
  edge: string;
  highlight: string;
}

const palettes: Readonly<Record<
  WavenMaterialTheme,
  Readonly<MaterialPalette>
>> = Object.freeze({
  noir: Object.freeze({
    base: '#10161D',
    text: '#F2F4F7',
    secondaryText: '#C5CAD1',
    accent: '#75CCFF',
    edge: 'rgba(197,202,209,0.10)',
    highlight: 'rgba(255,255,255,0.045)',
  }),
  hikari: Object.freeze({
    base: '#F4FAFF',
    text: '#153247',
    secondaryText: '#3C5266',
    accent: '#075F9F',
    edge: 'rgba(85,131,161,0.14)',
    highlight: 'rgba(255,255,255,0.40)',
  }),
  'hikari-night': Object.freeze({
    base: '#08192C',
    text: '#F2F7FF',
    secondaryText: '#C5D5E8',
    accent: '#74D2FF',
    edge: 'rgba(116,184,230,0.14)',
    highlight: 'rgba(116,184,230,0.065)',
  }),
});

const opacityByRole = Object.freeze({
  panel: 0.90,
  floating: 0.94,
  navigation: 0.95,
  sheet: 0.97,
});

function normalizeTheme(value: unknown): WavenMaterialTheme {
  return value === 'hikari' || value === 'hikari-night'
    ? value
    : 'noir';
}

function normalizeRole(value: unknown): WavenMaterialRole {
  return value === 'floating' ||
    value === 'navigation' ||
    value === 'sheet'
    ? value
    : 'panel';
}

function rgba(hex: string, alpha: number): string {
  const rgb = [1, 3, 5].map(
    offset => parseInt(hex.slice(offset, offset + 2), 16),
  );

  return `rgba(${rgb.join(',')},${alpha})`;
}

export interface WavenMaterial {
  readonly theme: WavenMaterialTheme;
  readonly role: WavenMaterialRole;
  readonly rendering: WavenMaterialRendering;
  readonly base: string;
  readonly background: string;
  readonly opacity: number;
  readonly transparent: string;
  readonly text: string;
  readonly secondaryText: string;
  readonly accent: string;
  readonly edge: string;
  readonly highlight: string;
  readonly radius: number;
}

export function resolveWavenMaterial(
  theme: WavenMaterialTheme,
  role: WavenMaterialRole,
  rendering: WavenMaterialRendering = 'solid',
): WavenMaterial {
  const safeTheme = normalizeTheme(theme);
  const safeRole = normalizeRole(role);

  const safeRendering = rendering === 'translucent'
    ? 'translucent'
    : 'solid';

  const palette = palettes[safeTheme];

  const opacity = safeRendering === 'translucent'
    ? opacityByRole[safeRole]
    : 1;

  return Object.freeze({
    theme: safeTheme,
    role: safeRole,
    rendering: safeRendering,
    base: palette.base,
    background: opacity === 1
      ? palette.base
      : rgba(palette.base, opacity),
    opacity,
    transparent: rgba(palette.base, 0),
    text: palette.text,
    secondaryText: palette.secondaryText,
    accent: palette.accent,
    edge: palette.edge,
    highlight: palette.highlight,
    radius: wavenMaterialGeometry[safeRole],
  });
}