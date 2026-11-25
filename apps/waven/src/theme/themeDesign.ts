import {
  WAVEN_NOIR_COLORS,
  type WavenThemeColors,
  type WavenThemeId,
} from './appearance';

export interface WavenThemeDesign {
  readonly colors: WavenThemeColors;
  readonly onAccent: string;
  readonly environment: 'cinematic' | 'daylight' | 'night-city';
  readonly chapter: string;
  readonly description: string;
  readonly sky: readonly [string, string, string];
  readonly celestial: string;
  readonly distant: string;
  readonly foreground: string;
  readonly detail: string;
  readonly panelEdge: string;
}

const hikari: WavenThemeColors = Object.freeze({
  ...WAVEN_NOIR_COLORS,
  surface: '#F0F7FB',
  elevatedSurface: '#FFFFFF',
  blue: '#075F9F',
  activeBlue: '#075F9F',
  skyBlue: '#1682B9',
  deepBlue: '#064875',
  steelGray: '#4D6474',
  mutedGray: '#526A7A',

  canvas: '#F5FAFD',
  surfaceSoft: '#EAF4FA',
  surfaceRaised: '#FFFFFF',
  brandBlue: '#075F9F',
  interactionBlue: '#075F9F',
  textPrimary: '#142D40',
  textSecondary: '#37556B',
  textMuted: '#4D6474',
  borderSubtle: 'rgba(41,95,132,0.14)',
  borderStrong: 'rgba(41,95,132,0.30)',
  blueWash: 'rgba(7,95,159,0.08)',
  blueGlow: 'rgba(62,181,226,0.18)',
  blueEdge: 'rgba(7,95,159,0.30)',
  navGlass: 'rgba(245,250,253,0.96)',
  glassSoft: 'rgba(255,255,255,0.88)',
  scrim: 'rgba(20,45,64,0.44)',
});

const hikariNight: WavenThemeColors = Object.freeze({
  ...WAVEN_NOIR_COLORS,
  surface: '#0C1B32',
  elevatedSurface: '#152740',
  blue: '#55C8F2',
  activeBlue: '#55C8F2',
  skyBlue: '#91DFFF',
  deepBlue: '#1E67AC',
  steelGray: '#9AB2CC',
  mutedGray: '#9AB2CC',

  canvas: '#071225',
  surfaceSoft: '#0C1B32',
  surfaceRaised: '#152740',
  brandBlue: '#55C8F2',
  interactionBlue: '#55C8F2',
  textPrimary: '#F2F7FF',
  textSecondary: '#C0D5EA',
  textMuted: '#9AB2CC',
  borderSubtle: 'rgba(121,181,226,0.17)',
  borderStrong: 'rgba(121,181,226,0.36)',
  blueWash: 'rgba(85,200,242,0.12)',
  blueGlow: 'rgba(85,200,242,0.20)',
  blueEdge: 'rgba(85,200,242,0.40)',
  navGlass: 'rgba(7,18,37,0.95)',
  glassSoft: 'rgba(21,39,64,0.87)',
  scrim: 'rgba(3,8,18,0.76)',
});

function design(value: WavenThemeDesign): WavenThemeDesign {
  return Object.freeze({
    ...value,
    sky: Object.freeze([...value.sky]) as
      readonly [string, string, string],
  });
}

export const WAVEN_THEME_DESIGNS:
  Readonly<Record<WavenThemeId, WavenThemeDesign>> =
  Object.freeze({
    noir: design({
      colors: WAVEN_NOIR_COLORS,
      onAccent: '#000000',
      environment: 'cinematic',
      chapter: '01 / NOIR',
      description: 'Cinematic silence. Silver and blue.',
      sky: ['#000000', '#07111B', '#000000'],
      celestial: '#D4E8F4',
      distant: '#142432',
      foreground: '#080E15',
      detail: '#2699DF',
      panelEdge: '#526779',
    }),

    hikari: design({
      colors: hikari,
      onAccent: '#FFFFFF',
      environment: 'daylight',
      chapter: '02 / HIKARI',
      description: 'Open skies. Luminous coastal daylight.',
      sky: ['#8CD5F3', '#DBF4FF', '#F5FAFD'],
      celestial: '#FFFDF2',
      distant: '#77AFCE',
      foreground: '#366D91',
      detail: '#E8F7FE',
      panelEdge: '#6598B6',
    }),

    'hikari-night': design({
      colors: hikariNight,
      onAccent: '#071225',
      environment: 'night-city',
      chapter: '03 / HIKARI NIGHT',
      description: 'Electric horizons. A city after dark.',
      sky: ['#08142B', '#193F70', '#0A1C37'],
      celestial: '#D7F3FF',
      distant: '#214467',
      foreground: '#0A162D',
      detail: '#6DD9F8',
      panelEdge: '#498DB8',
    }),
  });

export function getWavenThemeDesign(
  id: WavenThemeId,
): WavenThemeDesign {
  return WAVEN_THEME_DESIGNS[id];
}
