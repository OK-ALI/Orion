import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WavenArtworkFallback } from '../src/components/artwork/WavenArtworkFallback';
import { WavenPressable } from '../src/components/interaction/WavenPressable';
import { WavenAppShell } from '../src/components/shell/WavenAppShell';
import { WavenAccentTitle } from '../src/components/typography/WavenAccentTitle';
import { useWavenLayout } from '../src/hooks/useWavenLayout';
import {
  wavenColors,
  wavenLayout,
  wavenRadii,
  wavenSpacing,
  wavenTypography,
} from '../src/theme/tokens';

const FILTERS = ['All', 'Songs', 'Albums', 'Artists', 'Playlists'] as const;
type LibraryFilter = (typeof FILTERS)[number];

export default function WavenLibraryScreen() {
  const router = useRouter();
  const layout = useWavenLayout();
  const [filter, setFilter] = useState<LibraryFilter>('All');
  const artworkSize = layout.isCompact ? 72 : 88;

  return (
    <WavenAppShell>
      <View style={styles.page}>
        <View style={styles.heading}>
          <WavenAccentTitle before="Your " accent="Library" />
        </View>

        <View accessibilityLabel="Library filters" style={styles.filterRow}>
          {FILTERS.map((item) => {
            const active = item === filter;
            return (
              <WavenPressable
                accessibilityLabel={`Show ${item.toLowerCase()} in library`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                key={item}
                onPress={() => setFilter(item)}
                style={styles.minimumTouchTarget}
              >
                <View style={[styles.filterChip, active ? styles.filterChipActive : null]}>
                  <Text style={[styles.filterText, active ? styles.filterTextActive : null]}>{item}</Text>
                </View>
              </WavenPressable>
            );
          })}
        </View>

        <View style={styles.emptyStage}>
          <WavenArtworkFallback
            accessibilityLabel="Library artwork"
            seed={`library-${filter}`}
            size={artworkSize}
          />
          <View style={styles.copy}>
            <Text style={styles.emptyTitle}>{filter === 'All' ? 'Your Library Is Quiet' : `No ${filter} Yet`}</Text>
            <Text style={styles.emptyBody}>
              {filter === 'All'
                ? 'Liked music, albums, artists and playlists will gather here.'
                : `${filter} will appear here as your library grows.`}
            </Text>
          </View>
          <WavenPressable
            accessibilityLabel="Find music"
            accessibilityRole="button"
            onPress={() => router.navigate('/search')}
            style={styles.minimumTouchTarget}
          >
            <View style={styles.findMusicAction}>
              <Text style={styles.findMusicText}>Find Music</Text>
            </View>
          </WavenPressable>
        </View>
      </View>
    </WavenAppShell>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  heading: {
    marginBottom: wavenSpacing.lg,
    marginTop: wavenSpacing.md,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  minimumTouchTarget: {
    justifyContent: 'center',
    minHeight: wavenLayout.minimumTouchTarget,
  },
  filterChip: {
    backgroundColor: wavenColors.surfaceSoft,
    borderColor: wavenColors.borderSubtle,
    borderRadius: wavenRadii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 13,
  },
  filterChipActive: {
    backgroundColor: wavenColors.canvas,
    borderColor: wavenColors.blueEdge,
  },
  filterText: {
    color: wavenColors.textMuted,
    fontSize: wavenTypography.caption.fontSize,
    fontWeight: wavenTypography.caption.fontWeight,
  },
  filterTextActive: {
    color: wavenColors.textPrimary,
  },
  emptyStage: {
    alignItems: 'center',
    flex: 1,
    gap: wavenSpacing.md,
    justifyContent: 'center',
    minHeight: 280,
    paddingBottom: wavenSpacing.xl,
    paddingTop: wavenSpacing.lg,
  },
  copy: {
    alignItems: 'center',
    maxWidth: 430,
  },
  emptyTitle: {
    color: wavenColors.textSecondary,
    fontSize: wavenTypography.section.fontSize,
    fontWeight: wavenTypography.section.fontWeight,
    lineHeight: wavenTypography.section.lineHeight,
    textAlign: 'center',
  },
  emptyBody: {
    color: wavenColors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    textAlign: 'center',
  },
  findMusicAction: {
    alignItems: 'center',
    backgroundColor: wavenColors.canvas,
    borderColor: wavenColors.blueEdge,
    borderRadius: wavenRadii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  findMusicText: {
    color: wavenColors.textPrimary,
    fontSize: wavenTypography.label.fontSize,
    fontWeight: wavenTypography.label.fontWeight,
  },
});
