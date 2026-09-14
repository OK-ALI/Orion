import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
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

export default function WavenHomeScreen() {
  const router = useRouter();
  const layout = useWavenLayout();

  return (
    <WavenAppShell brandTagline>
      <View style={styles.page}>
        <View style={styles.homeBody}>
          <WavenSurface
            style={[
              styles.hero,
              layout.isCompact ? styles.heroCompact : styles.heroRegular,
            ]}
          >
            <WavenArtworkFallback
              accessibilityLabel="WAVEN sound artwork"
              seed="home-start-listening"
              size={layout.heroArtworkSize}
            />
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>START LISTENING</Text>
              <Text style={styles.heroMeta}>Songs · Artists · Albums · Playlists</Text>
              <WavenPressable
                accessibilityLabel="Search music"
                accessibilityRole="button"
                containerStyle={styles.heroActionContainer}
                onPress={() => router.replace('/search')}
              >
                <View style={styles.heroAction}>
                  <Text style={styles.heroActionText}>Search Music</Text>
                  <Text accessible={false} style={styles.heroActionArrow}>›</Text>
                </View>
              </WavenPressable>
            </View>
          </WavenSurface>

          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Recently Played</Text>
            <View style={styles.quietState}>
              <View accessible={false} style={styles.quietSignal}>
                <View style={[styles.quietBar, { height: 9 }]} />
                <View style={[styles.quietBar, styles.quietBarActive, { height: 16 }]} />
                <View style={[styles.quietBar, { height: 12 }]} />
              </View>
              <Text style={styles.quietBody}>Your first plays will collect here.</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Your Music</Text>
            <WavenPressable
              accessibilityLabel="Open Library"
              accessibilityRole="button"
              onPress={() => router.replace('/library')}
            >
              <View style={styles.libraryShortcut}>
                <View accessible={false} style={styles.libraryIcon}>
                  <View style={[styles.libraryBar, { height: 13 }]} />
                  <View style={[styles.libraryBar, { height: 18 }]} />
                  <View style={[styles.libraryBar, { height: 10 }]} />
                </View>
                <View style={styles.libraryShortcutCopy}>
                  <Text style={styles.libraryShortcutTitle}>Open Your Library</Text>
                  <Text style={styles.libraryShortcutBody}>Albums, artists, playlists and liked music.</Text>
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
    flex: 1,
    gap: wavenSpacing.xl,
    justifyContent: 'space-between',
    paddingTop: wavenSpacing.md,
  },
  hero: {
    overflow: 'hidden',
    padding: wavenSpacing.lg,
  },
  heroRegular: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: wavenSpacing.lg,
  },
  heroCompact: {
    alignItems: 'flex-start',
    gap: wavenSpacing.md,
  },
  heroCopy: {
    flex: 1,
  },
  eyebrow: {
    color: wavenColors.interactionBlue,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.45,
  },
  heroMeta: {
    color: wavenColors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    marginTop: 8,
  },
  heroActionContainer: {
    alignSelf: 'flex-start',
    marginTop: wavenSpacing.md,
  },
  heroAction: {
    alignItems: 'center',
    backgroundColor: wavenColors.blueWash,
    borderColor: wavenColors.blueEdge,
    borderRadius: wavenRadii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 44,
    paddingHorizontal: 15,
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
  sectionTitle: {
    color: wavenColors.textPrimary,
    fontSize: wavenTypography.section.fontSize,
    fontWeight: wavenTypography.section.fontWeight,
    lineHeight: wavenTypography.section.lineHeight,
  },
  quietState: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 48,
  },
  quietSignal: {
    alignItems: 'center',
    backgroundColor: wavenColors.blueWash,
    borderColor: wavenColors.borderSubtle,
    borderRadius: wavenRadii.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 3,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  quietBar: {
    backgroundColor: wavenColors.textMuted,
    borderRadius: 2,
    width: 3,
  },
  quietBarActive: {
    backgroundColor: wavenColors.interactionBlue,
  },
  quietBody: {
    color: wavenColors.textMuted,
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  libraryShortcut: {
    alignItems: 'center',
    backgroundColor: wavenColors.glassSoft,
    borderColor: wavenColors.borderSubtle,
    borderRadius: wavenRadii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 72,
    paddingHorizontal: wavenSpacing.md,
    paddingVertical: 12,
  },
  libraryIcon: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 3,
    justifyContent: 'center',
    marginRight: 14,
    width: 26,
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
