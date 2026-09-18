import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';
import { wavenColors } from '../../theme/tokens';

export const WAVEN_DETAIL_HERO_BLUR_OVERFLOW = 40;
export const WAVEN_DETAIL_HERO_BLUR_OPACITY = 0.5;
export const WAVEN_DETAIL_HERO_BLUR_SCALE = 1.15;
export const WAVEN_DETAIL_HERO_SHARP_OPACITY = 1;
export const WAVEN_DETAIL_HERO_COPY_MAX_WIDTH = 620;
export const WAVEN_DETAIL_HERO_SUBTITLE_SLOT_HEIGHT = 30;

export function wavenDetailHeroCopyBottom(kind: 'Artist' | 'Album'): number {
  return kind === 'Artist' ? 38 : 34;
}

export const wavenDetailHeroCopyStyles = StyleSheet.create({
  kindLabel: {
    color: wavenColors.interactionBlue,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2.2,
  },
  heroTitle: {
    color: wavenColors.textPrimary,
    fontSize: 38,
    fontWeight: '800',
    lineHeight: 43,
    marginTop: 7,
    textAlign: 'left',
  },
  artistHeroTitle: {
    fontSize: 44,
    lineHeight: 49,
  },
  heroSubtitleSlot: {
    height: WAVEN_DETAIL_HERO_SUBTITLE_SLOT_HEIGHT,
    justifyContent: 'flex-start',
    marginTop: 8,
    overflow: 'hidden',
  },
  heroSubtitle: {
    color: 'rgba(231,236,241,0.82)',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    textAlign: 'left',
  },
});

export function WavenDetailHeroGradients() {
  return (
    <>
      <LinearGradient
        colors={[
          'rgba(0,0,0,0.06)',
          'rgba(0,0,0,0.05)',
          'rgba(0,4,8,0.36)',
          'rgba(0,3,7,0.82)',
          'rgba(0,0,0,0.98)',
        ]}
        end={{ x: 0.5, y: 1 }}
        locations={[0, 0.36, 0.61, 0.82, 1]}
        start={{ x: 0.5, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[
          'rgba(34,146,218,0.16)',
          'rgba(9,53,86,0.04)',
          'rgba(0,0,0,0)',
        ]}
        end={{ x: 0.92, y: 0.7 }}
        start={{ x: 0.02, y: 0.08 }}
        style={StyleSheet.absoluteFill}
      />
    </>
  );
}
