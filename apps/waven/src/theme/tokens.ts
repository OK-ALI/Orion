export const wavenColors = {
  black: '#000000',
  surface: '#080B0F',
  elevatedSurface: '#11161C',
  blue: '#1679BC',
  activeBlue: '#2699DF',
  skyBlue: '#55B9ED',
  deepBlue: '#07518B',
  silver: '#C5CAD1',
  coolWhite: '#F2F4F7',
  steelGray: '#929AA5',
  mutedGray: '#626A74',

  // Phase 5 semantic aliases. Keep the original keys above stable for
  // accepted Phase 2/4 validation tooling while product UI migrates to
  // intent-based names.
  canvas: '#000000',
  surfaceSoft: '#080B0F',
  surfaceRaised: '#11161C',
  brandBlue: '#2699DF',
  interactionBlue: '#2699DF',
  textPrimary: '#F2F4F7',
  textSecondary: '#C5CAD1',
  textMuted: '#929AA5',
  borderSubtle: 'rgba(197, 202, 209, 0.14)',
  borderStrong: 'rgba(197, 202, 209, 0.24)',
  blueWash: 'rgba(38, 153, 223, 0.12)',
  blueGlow: 'rgba(38, 153, 223, 0.20)',
  blueEdge: 'rgba(38, 153, 223, 0.34)',
  navGlass: 'rgba(8, 11, 15, 0.94)',
  glassSoft: 'rgba(17, 22, 28, 0.76)',
  scrim: 'rgba(0, 0, 0, 0.72)',
} as const;


export const wavenFonts = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semiBold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extraBold: 'Manrope_800ExtraBold',
  wordmarkDisplay: 'BebasNeue_400Regular',
  headingBold: 'Sora_700Bold',
  headingExtraBold: 'Sora_800ExtraBold',
} as const;

export const wavenSpacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const wavenRadii = {
  xs: 8,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 30,
  pill: 999,
} as const;

export const wavenTypography = {
  wordmark: {
    fontFamily: wavenFonts.wordmarkDisplay,
    fontSize: 30,
    fontWeight: '400' as const,
    letterSpacing: 6.2,
  },
  display: {
    fontFamily: wavenFonts.headingExtraBold,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800' as const,
  },
  title: {
    fontFamily: wavenFonts.headingExtraBold,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800' as const,
  },
  section: {
    fontFamily: wavenFonts.headingBold,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700' as const,
  },
  body: {
    fontFamily: wavenFonts.regular,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400' as const,
  },
  label: {
    fontFamily: wavenFonts.bold,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700' as const,
  },
  caption: {
    fontFamily: wavenFonts.semiBold,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600' as const,
  },
} as const;

export const wavenLayout = {
  compactWidth: 360,
  roomyWidth: 430,
  tabletWidth: 700,
  contentMaxWidth: 760,
  navMaxWidth: 560,
  navCompactMaxWidth: 430,
  gutterCompact: 16,
  gutter: 20,
  gutterRoomy: 24,
  gutterTablet: 32,
  minimumTouchTarget: 48,
  bottomNavBaseHeight: 58,
  artworkHeroCompact: 92,
  artworkHero: 108,
} as const;

export const wavenMotion = {
  pressInMs: 90,
  pressOutMs: 140,
  quickMs: 160,
  standardMs: 240,
  deliberateMs: 360,
  pressedScale: 0.97,
} as const;

/** Semantic motion contract: a future theme can supply a different rhythm. */
export interface LivingWaveMotionTokens {
  cycleMs: number;
  barWidth: number;
  barHeight: number;
  barGap: number;
  scales: readonly [number, number, number, number];
}
export const wavenLivingWaveMotion: LivingWaveMotionTokens = {
  cycleMs: 1_320,
  barWidth: 3,
  barHeight: 18,
  barGap: wavenSpacing.xxs,
  scales: [0.35, 0.8, 0.5, 1],
};
