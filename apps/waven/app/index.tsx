import { useRouter } from 'expo-router';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { WavenArtworkFallback } from '../src/components/artwork/WavenArtworkFallback';
import { WavenPressable } from '../src/components/interaction/WavenPressable';
import { WavenAppShell } from '../src/components/shell/WavenAppShell';
import { WavenSurface } from '../src/components/surfaces/WavenSurface';
import { useWavenLayout } from '../src/hooks/useWavenLayout';
import {
  wavenColors,
  wavenRadii,
  wavenSpacing,
  wavenTypography,
} from '../src/theme/tokens';

const EXPLORE_CARDS = [
  {
    accessibilityLabel: 'Explore songs',
    label: 'Songs',
    seed: 'home-explore-songs',
  },
  {
    accessibilityLabel: 'Explore artists',
    label: 'Artists',
    seed: 'home-explore-artists',
  },
  {
    accessibilityLabel: 'Explore albums',
    label: 'Albums',
    seed: 'home-explore-albums',
  },
] as const;

export default function WavenHomeScreen() {
  const router = useRouter();
  const layout = useWavenLayout();
  const { fontScale } = useWindowDimensions();
  const stackSectionHeaders = fontScale >= 1.45;

  const heroArtworkSize = layout.isCompact
    ? 150
    : layout.isTabletLike
      ? 202
      : 172;

  const exploreArtworkSize = layout.isCompact ? 84 : 96;

  return (
    <WavenAppShell brandTagline>
      <View style={styles.page}>
        <View style={styles.homeBody}>
          <WavenPressable
            accessibilityLabel="Explore music"
            accessibilityRole="button"
            onPress={() => router.navigate('/search')}
          >
            <WavenSurface
              style={[
                styles.hero,
                layout.isTabletLike ? styles.heroTablet : styles.heroPhone,
              ]}
            >
              <View accessible={false} style={styles.glassTopHighlight} />

              <View
                style={[
                  styles.heroVisual,
                  {
                    height: heroArtworkSize + 30,
                    width: heroArtworkSize + 44,
                  },
                ]}
              >
                <View
                  accessible={false}
                  style={[
                    styles.stackLayer,
                    styles.stackLayerBack,
                    {
                      height: heroArtworkSize - 10,
                      width: heroArtworkSize - 10,
                    },
                  ]}
                />
                <View
                  accessible={false}
                  style={[
                    styles.stackLayer,
                    styles.stackLayerMiddle,
                    {
                      height: heroArtworkSize - 4,
                      width: heroArtworkSize - 4,
                    },
                  ]}
                />
                <View style={styles.heroArtwork}>
                  <WavenArtworkFallback
                    accessibilityLabel="WAVEN sound artwork"
                    seed="home-reference-02-feature"
                    size={heroArtworkSize}
                  />
                </View>
                <View style={styles.heroBadge}>
                  <View accessible={false} style={styles.heroBadgeDot} />
                  <Text style={styles.heroBadgeText}>START HERE</Text>
                </View>
              </View>

              <View style={styles.heroCopy}>
                <Text style={styles.eyebrow}>YOUR NEXT PLAY</Text>
                <Text accessibilityRole="header" style={styles.heroTitle}>
                  Find your <Text style={styles.heroTitleAccent}>sound.</Text>
                </Text>
                <Text style={styles.heroBody}>
                  Songs, artists, albums and playlists are one tap away.
                </Text>

                <View style={styles.heroAction}>
                  <Text style={styles.heroActionText}>Explore Music</Text>
                  <Text accessible={false} style={styles.heroActionArrow}>›</Text>
                </View>
              </View>
            </WavenSurface>
          </WavenPressable>

          <View style={styles.section}>
            <View
              style={[
                styles.sectionHeader,
                stackSectionHeaders ? styles.sectionHeaderStacked : null,
              ]}
            >
              <Text accessibilityRole="header" style={styles.sectionTitle}>Recently Played</Text>
              <Text style={styles.sectionHint}>Your listening trail</Text>
            </View>

            <WavenSurface style={styles.recentState}>
              <View accessible={false} style={styles.glassTopHighlight} />
              <WavenArtworkFallback
                accessibilityLabel="Recently played artwork"
                seed="home-recently-played-empty"
                size={64}
              />
              <View style={styles.recentCopy}>
                <Text style={styles.recentTitle}>Your first plays will collect here.</Text>
                <Text style={styles.recentBody}>
                  Start a track and Home will turn into your listening history.
                </Text>
              </View>
            </WavenSurface>
          </View>

          <View style={styles.section}>
            <View
              style={[
                styles.sectionHeader,
                stackSectionHeaders ? styles.sectionHeaderStacked : null,
              ]}
            >
              <Text accessibilityRole="header" style={styles.sectionTitle}>Explore</Text>
              <Text style={styles.sectionHint}>Choose a direction</Text>
            </View>

            <View style={styles.exploreRow}>
              {EXPLORE_CARDS.map((card) => (
                <WavenPressable
                  accessibilityLabel={card.accessibilityLabel}
                  accessibilityRole="button"
                  containerStyle={styles.exploreCardPressable}
                  key={card.label}
                  onPress={() => router.navigate('/search')}
                >
                  <View style={styles.exploreCard}>
                    <WavenArtworkFallback
                      accessibilityLabel={`${card.label} artwork`}
                      seed={card.seed}
                      size={exploreArtworkSize}
                    />
                    <Text style={styles.exploreLabel}>{card.label}</Text>
                  </View>
                </WavenPressable>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Your Music</Text>

            <WavenPressable
              accessibilityLabel="Open Library"
              accessibilityRole="button"
              onPress={() => router.navigate('/library')}
            >
              <View style={styles.libraryShortcut}>
                <View accessible={false} style={styles.glassTopHighlight} />
                <View accessible={false} style={styles.libraryIcon}>
                  <View style={[styles.libraryBar, { height: 13 }]} />
                  <View style={[styles.libraryBar, { height: 20 }]} />
                  <View style={[styles.libraryBar, { height: 16 }]} />
                </View>

                <View style={styles.libraryShortcutCopy}>
                  <Text style={styles.libraryShortcutTitle}>Open Your Library</Text>
                  <Text style={styles.libraryShortcutBody}>
                    Albums, artists, playlists and liked music.
                  </Text>
                </View>

                <Text accessible={false} style={styles.shortcutArrow}>›</Text>
              </View>
            </WavenPressable>
          </View>
        </View>
      </View>
    </WavenAppShell>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  homeBody: {
    gap: wavenSpacing.xl,
    paddingBottom: wavenSpacing.sm,
    paddingTop: 4,
  },
  hero: {
    backgroundColor: 'rgba(5, 10, 15, 0.5)',
    borderColor: 'rgba(214, 224, 232, 0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    padding: wavenSpacing.md,
    position: 'relative',
  },
  glassTopHighlight: {
    backgroundColor: 'rgba(235, 242, 247, 0.055)',
    height: StyleSheet.hairlineWidth,
    left: 18,
    position: 'absolute',
    right: 18,
    top: 0,
  },
  heroPhone: {
    alignItems: 'center',
    gap: wavenSpacing.md,
  },
  heroTablet: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: wavenSpacing.xl,
  },
  heroVisual: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  stackLayer: {
    borderRadius: wavenRadii.xl,
    position: 'absolute',
  },
  stackLayerBack: {
    backgroundColor: 'rgba(38, 153, 223, 0.055)',
    borderColor: 'rgba(107, 194, 240, 0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    right: 0,
    top: 6,
    transform: [{ rotate: '5deg' }],
  },
  stackLayerMiddle: {
    backgroundColor: 'rgba(216, 224, 231, 0.028)',
    borderColor: 'rgba(215, 225, 233, 0.09)',
    borderWidth: StyleSheet.hairlineWidth,
    left: 4,
    top: 15,
    transform: [{ rotate: '-4deg' }],
  },
  heroArtwork: {
    borderColor: 'rgba(220, 229, 236, 0.14)',
    borderRadius: wavenRadii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  heroBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(8, 15, 21, 0.68)',
    borderColor: 'rgba(98, 188, 236, 0.22)',
    borderRadius: wavenRadii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    bottom: 2,
    flexDirection: 'row',
    paddingHorizontal: 11,
    paddingVertical: 7,
    position: 'absolute',
  },
  heroBadgeDot: {
    backgroundColor: wavenColors.interactionBlue,
    borderRadius: 999,
    height: 6,
    marginRight: 7,
    width: 6,
  },
  heroBadgeText: {
    color: wavenColors.textSecondary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  heroCopy: {
    alignItems: 'center',
    flex: 1,
    maxWidth: 420,
  },
  eyebrow: {
    color: wavenColors.interactionBlue,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.45,
  },
  heroTitle: {
    color: wavenColors.textSecondary,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
    marginTop: 7,
    textAlign: 'center',
  },
  heroTitleAccent: {
    color: wavenColors.interactionBlue,
  },
  heroBody: {
    color: wavenColors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    maxWidth: 300,
    textAlign: 'center',
  },
  heroAction: {
    alignItems: 'center',
    backgroundColor: wavenColors.canvas,
    borderColor: 'rgba(93, 187, 237, 0.2)',
    borderRadius: wavenRadii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    marginTop: 12,
    minHeight: 42,
    paddingHorizontal: 17,
  },
  heroActionText: {
    color: wavenColors.textPrimary,
    fontSize: wavenTypography.label.fontSize,
    fontWeight: wavenTypography.label.fontWeight,
  },
  heroActionArrow: {
    color: wavenColors.interactionBlue,
    fontSize: 21,
    lineHeight: 21,
    marginLeft: 9,
    marginTop: -2,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  sectionHeaderStacked: {
    alignItems: 'flex-start',
    flexDirection: 'column',
    gap: 2,
  },
  sectionTitle: {
    color: wavenColors.textPrimary,
    fontSize: wavenTypography.section.fontSize,
    fontWeight: wavenTypography.section.fontWeight,
    lineHeight: wavenTypography.section.lineHeight,
  },
  sectionHint: {
    color: wavenColors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  recentState: {
    alignItems: 'center',
    backgroundColor: 'rgba(6, 12, 18, 0.44)',
    borderColor: 'rgba(214, 224, 232, 0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 14,
    overflow: 'hidden',
    padding: 12,
    position: 'relative',
  },
  recentCopy: {
    flex: 1,
  },
  recentTitle: {
    color: wavenColors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  recentBody: {
    color: wavenColors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  exploreRow: {
    flexDirection: 'row',
    gap: 10,
  },
  exploreCardPressable: {
    flex: 1,
  },
  exploreCard: {
    gap: 9,
  },
  exploreLabel: {
    color: wavenColors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  libraryShortcut: {
    alignItems: 'center',
    backgroundColor: 'rgba(8, 15, 21, 0.46)',
    borderColor: 'rgba(214, 224, 232, 0.1)',
    borderRadius: wavenRadii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 70,
    overflow: 'hidden',
    paddingHorizontal: wavenSpacing.md,
    paddingVertical: 12,
  },
  libraryIcon: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 3,
    justifyContent: 'center',
    marginRight: 14,
    width: 28,
  },
  libraryBar: {
    backgroundColor: wavenColors.interactionBlue,
    borderRadius: 2,
    width: 4,
  },
  libraryShortcutCopy: {
    flex: 1,
  },
  libraryShortcutTitle: {
    color: wavenColors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  libraryShortcutBody: {
    color: wavenColors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  shortcutArrow: {
    color: wavenColors.textMuted,
    fontSize: 24,
    marginLeft: 10,
  },
});
