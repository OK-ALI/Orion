import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { WavenArtworkFallback } from '../src/components/artwork/WavenArtworkFallback';
import { WavenExploreIcon } from '../src/components/icons/WavenExploreIcon';
import { WavenPressable } from '../src/components/interaction/WavenPressable';
import { WavenAppShell } from '../src/components/shell/WavenAppShell';
import { WavenSurface } from '../src/components/surfaces/WavenSurface';
import type {
  MusicAlbum,
  MusicDashboardSection,
  MusicEntity,
  MusicTrack,
} from '../src/domain/music';
import { wavenDiscoveryRuntime } from '../src/features/discovery/wavenDiscoveryRuntime';
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
    icon: 'songs' as const,
    label: 'Songs',
  },
  {
    accessibilityLabel: 'Explore artists',
    icon: 'artists' as const,
    label: 'Artists',
  },
  {
    accessibilityLabel: 'Explore albums',
    icon: 'albums' as const,
    label: 'Albums',
  },
] as const;

type HomeDiscoveryStatus = 'loading' | 'ready' | 'empty' | 'error';
type HomeDiscoverySectionType = 'tracks' | 'artists' | 'albums' | 'playlists';

interface HomeDiscoveryGroup {
  type: HomeDiscoverySectionType;
  label:
    | 'Popular Now'
    | 'Discover Now'
    | 'Featured Artists'
    | 'Featured Albums'
    | 'Featured Playlists';
  items: MusicEntity[];
}

const HOME_DISCOVERY_GROUPS: readonly {
  type: Exclude<HomeDiscoverySectionType, 'tracks'>;
  label: HomeDiscoveryGroup['label'];
}[] = [
  { type: 'artists', label: 'Featured Artists' },
  { type: 'albums', label: 'Featured Albums' },
  { type: 'playlists', label: 'Featured Playlists' },
];

const GLOBAL_CHART_SECTION_ID = 'waven-global-top-50';

function entityTitle(item: MusicEntity): string {
  return 'name' in item ? item.name : item.title;
}

function entitySubtitle(
  item: MusicEntity,
  type: HomeDiscoverySectionType,
): string {
  if (type === 'tracks') return (item as MusicTrack).artistName || 'Song';
  if (type === 'artists') return 'Artist';
  if (type === 'playlists') return 'Playlist';
  return (item as MusicAlbum).artistName || 'Album';
}

function collectDiscoveryItems(
  sections: readonly MusicDashboardSection[],
  type: HomeDiscoverySectionType,
  sectionFilter?: (section: MusicDashboardSection) => boolean,
): MusicEntity[] {
  const seen = new Set<string>();
  const items: MusicEntity[] = [];

  for (const section of sections) {
    if (section.type !== type || (sectionFilter && !sectionFilter(section))) continue;
    for (const item of section.items) {
      const key = `${item.source.provider}\0${item.source.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
      if (items.length >= 8) return items;
    }
  }

  return items;
}

function buildDiscoveryGroups(
  sections: readonly MusicDashboardSection[],
): HomeDiscoveryGroup[] {
  const chartTracks = collectDiscoveryItems(
    sections,
    'tracks',
    (section) => section.id === GLOBAL_CHART_SECTION_ID,
  );
  const trackItems =
    chartTracks.length > 0
      ? chartTracks
      : collectDiscoveryItems(sections, 'tracks');

  const groups: HomeDiscoveryGroup[] = [
    {
      type: 'tracks',
      label: chartTracks.length > 0 ? 'Popular Now' : 'Discover Now',
      items: trackItems,
    },
    ...HOME_DISCOVERY_GROUPS.map((group) => ({
      ...group,
      items: collectDiscoveryItems(sections, group.type),
    })),
  ];

  return groups.filter((group) => group.items.length > 0);
}

function WavenHomeDiscoveryArtwork({
  item,
  size,
}: {
  item: MusicEntity;
  size: number;
}) {
  const artworkUrl =
    item.artworkUrl || ('profileImageUrl' in item ? item.profileImageUrl : null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [artworkUrl]);

  if (!artworkUrl || failed) {
    return (
      <WavenArtworkFallback
        accessibilityLabel={`${entityTitle(item)} artwork`}
        seed={`home-discovery-${item.source.provider}-${item.source.id}`}
        size={size}
      />
    );
  }

  return (
    <Image
      accessibilityLabel={`${entityTitle(item)} artwork`}
      onError={() => setFailed(true)}
      resizeMode="cover"
      source={{ uri: artworkUrl }}
      style={[
        styles.discoveryArtwork,
        {
          height: size,
          width: size,
        },
      ]}
    />
  );
}


function WavenSectionTitle({
  leading,
  accent,
  single = false,
  accessibilityLabel,
}: {
  leading: string;
  accent?: string;
  single?: boolean;
  accessibilityLabel?: string;
}) {
  if (single) {
    return (
      <View
        accessibilityLabel={accessibilityLabel || leading}
        accessibilityRole="header"
        style={styles.sectionTitleRow}
      >
        <Text style={styles.sectionTitle}>{leading}</Text>
        <View accessible={false} style={styles.sectionTitleSignal}>
          <View style={[styles.sectionTitleSignalBar, styles.sectionTitleSignalBarShort]} />
          <View style={[styles.sectionTitleSignalBar, styles.sectionTitleSignalBarTall]} />
          <View style={[styles.sectionTitleSignalBar, styles.sectionTitleSignalBarMid]} />
        </View>
      </View>
    );
  }

  return (
    <Text accessibilityLabel={accessibilityLabel} accessibilityRole="header" style={styles.sectionTitle}>
      {leading}
      {accent ? (
        <>
          {' '}
          <Text style={styles.sectionTitleAccent}>{accent}</Text>
        </>
      ) : null}
    </Text>
  );
}

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
  const discoveryArtworkSize = layout.isCompact
    ? 104
    : layout.isTabletLike
      ? 136
      : 116;
  const recentArtworkSize = layout.isCompact ? 68 : 76;
  const discoveryCardWidth = discoveryArtworkSize + 32;
  const discoveryCardMinHeight = discoveryArtworkSize + 70;
  const [discoveryStatus, setDiscoveryStatus] =
    useState<HomeDiscoveryStatus>('loading');
  const [dashboardSections, setDashboardSections] = useState<
    readonly MusicDashboardSection[]
  >([]);
  const [hasDiscoveryDegradation, setHasDiscoveryDegradation] = useState(false);
  const [discoveryRetryNonce, setDiscoveryRetryNonce] = useState(0);
  const discoveryRequestSequence = useRef(0);
  const lastExplicitRefreshNonce = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const sequence = ++discoveryRequestSequence.current;
    const shouldRefresh =
      discoveryRetryNonce > lastExplicitRefreshNonce.current;

    if (shouldRefresh) {
      lastExplicitRefreshNonce.current = discoveryRetryNonce;
    }

    setDiscoveryStatus('loading');
    setHasDiscoveryDegradation(false);

    wavenDiscoveryRuntime
      .getDashboard({ signal: controller.signal, refresh: shouldRefresh })
      .then((response) => {
        if (
          controller.signal.aborted ||
          response.cancelled ||
          sequence !== discoveryRequestSequence.current
        ) {
          return;
        }

        const nextGroups = buildDiscoveryGroups(response.result.sections);
        setDashboardSections(response.result.sections);
        setHasDiscoveryDegradation(response.errors.length > 0);
        setDiscoveryStatus(
          nextGroups.length > 0
            ? 'ready'
            : response.errors.length > 0
              ? 'error'
              : 'empty',
        );
      })
      .catch(() => {
        if (
          controller.signal.aborted ||
          sequence !== discoveryRequestSequence.current
        ) {
          return;
        }

        setDashboardSections([]);
        setHasDiscoveryDegradation(false);
        setDiscoveryStatus('error');
      });

    return () => controller.abort();
  }, [discoveryRetryNonce]);

  const discoveryGroups = useMemo(
    () => buildDiscoveryGroups(dashboardSections),
    [dashboardSections],
  );

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
              <WavenSectionTitle accessibilityLabel="Recently Played" leading="Recently" accent="Played" />
              <Text style={styles.sectionHint}>Your listening trail</Text>
            </View>

            <WavenSurface style={styles.recentState}>
              <View accessible={false} pointerEvents="none" style={styles.shortcutGlassTint} />
              <View accessible={false} pointerEvents="none" style={styles.shortcutGlassInnerEdge} />
              <View accessible={false} style={styles.glassTopHighlight} />
              <WavenArtworkFallback
                accessibilityLabel="Recently played artwork"
                seed="home-recently-played-empty"
                size={recentArtworkSize}
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
              <WavenSectionTitle leading="Explore" single />
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
                    <View accessible={false} pointerEvents="none" style={styles.shortcutGlassTint} />
                    <View accessible={false} pointerEvents="none" style={styles.shortcutGlassInnerEdge} />
                    <View accessible={false} style={styles.cardTopHighlight} />
                    <WavenExploreIcon
                      kind={card.icon}
                      size={exploreArtworkSize}
                    />
                    <Text style={styles.exploreLabel}>{card.label}</Text>
                  </View>
                </WavenPressable>
              ))}
            </View>


            {discoveryStatus === 'loading' ? (
              <WavenSurface style={styles.discoveryState}>
                <View accessible={false} pointerEvents="none" style={styles.shortcutGlassTint} />
                <View accessible={false} pointerEvents="none" style={styles.shortcutGlassInnerEdge} />
                <View accessible={false} style={styles.glassTopHighlight} />
                <Text
                  accessibilityLiveRegion="polite"
                  style={styles.discoveryStateTitle}
                >
                  Loading discovery…
                </Text>
                <View accessible={false} style={styles.discoverySkeletonRow}>
                  <View style={styles.discoverySkeleton} />
                  <View style={styles.discoverySkeleton} />
                  <View style={styles.discoverySkeleton} />
                </View>
              </WavenSurface>
            ) : null}

            {discoveryStatus === 'error' ? (
              <WavenSurface style={styles.discoveryState}>
                <View accessible={false} pointerEvents="none" style={styles.shortcutGlassTint} />
                <View accessible={false} pointerEvents="none" style={styles.shortcutGlassInnerEdge} />
                <View accessible={false} style={styles.glassTopHighlight} />
                <Text
                  accessibilityLiveRegion="polite"
                  style={styles.discoveryStateTitle}
                >
                  Discovery is unavailable right now.
                </Text>
                <Text style={styles.discoveryStateBody}>
                  Try again when you are ready.
                </Text>
                <WavenPressable
                  accessibilityLabel="Retry Home discovery"
                  accessibilityRole="button"
                  onPress={() => setDiscoveryRetryNonce((value) => value + 1)}
                >
                  <View style={styles.discoveryAction}>
                    <Text style={styles.discoveryActionText}>Try Again</Text>
                  </View>
                </WavenPressable>
              </WavenSurface>
            ) : null}

            {discoveryStatus === 'empty' ? (
              <WavenSurface style={styles.discoveryState}>
                <View accessible={false} pointerEvents="none" style={styles.shortcutGlassTint} />
                <View accessible={false} pointerEvents="none" style={styles.shortcutGlassInnerEdge} />
                <View accessible={false} style={styles.glassTopHighlight} />
                <Text style={styles.discoveryStateTitle}>
                  Nothing to explore right now.
                </Text>
                <Text style={styles.discoveryStateBody}>
                  Try again to refresh Home discovery.
                </Text>
                <WavenPressable
                  accessibilityLabel="Retry empty Home discovery"
                  accessibilityRole="button"
                  onPress={() => setDiscoveryRetryNonce((value) => value + 1)}
                >
                  <View style={styles.discoveryAction}>
                    <Text style={styles.discoveryActionText}>Try Again</Text>
                  </View>
                </WavenPressable>
              </WavenSurface>
            ) : null}

            {discoveryStatus === 'ready' ? (
              <View style={styles.discoveryStack}>
                {hasDiscoveryDegradation ? (
                  <View style={styles.discoveryNoticeRow}>
                    <Text
                      accessibilityLiveRegion="polite"
                      style={styles.discoveryNotice}
                    >
                      Some discovery shelves are temporarily unavailable.
                    </Text>
                    <WavenPressable
                      accessibilityLabel="Refresh Home discovery"
                      accessibilityRole="button"
                      onPress={() => setDiscoveryRetryNonce((value) => value + 1)}
                    >
                      <View style={styles.discoveryNoticeAction}>
                        <Text style={styles.discoveryNoticeActionText}>Refresh</Text>
                      </View>
                    </WavenPressable>
                  </View>
                ) : null}

                {discoveryGroups.map((group) => (
                  <View key={group.type} style={styles.discoveryGroup}>
                    <WavenSectionTitle
                      leading={group.label.split(' ')[0]}
                      accent={group.label.split(' ').slice(1).join(' ')}
                    />
                    <ScrollView
                      contentContainerStyle={[
                        styles.discoveryRow,
                        { paddingRight: Math.round(discoveryCardWidth * 0.5) },
                      ]}
                      decelerationRate="fast"
                      horizontal
                      nestedScrollEnabled
                      showsHorizontalScrollIndicator={false}
                      snapToAlignment="start"
                      snapToInterval={discoveryCardWidth + 10}
                    >
                      {group.items.map((item) => (
                        <View
                          accessibilityLabel={`${entityTitle(item)}, ${entitySubtitle(item, group.type)}`}
                          accessible
                          key={`${item.source.provider}:${item.source.id}`}
                          style={[
                            styles.discoveryCard,
                            {
                              minHeight: discoveryCardMinHeight,
                              width: discoveryCardWidth,
                            },
                          ]}
                        >
                          <View accessible={false} pointerEvents="none" style={styles.mediaGlassTint} />
                          <View accessible={false} pointerEvents="none" style={styles.mediaGlassInnerEdge} />
                          <View accessible={false} style={styles.cardTopHighlight} />
                          <View
                            style={[
                              styles.discoveryCardContent,
                              { width: discoveryArtworkSize },
                            ]}
                          >
                            <WavenHomeDiscoveryArtwork
                              item={item}
                              size={discoveryArtworkSize}
                            />
                            <View style={styles.discoveryMeta}>
                              <Text numberOfLines={2} style={styles.discoveryTitle}>
                                {entityTitle(item)}
                              </Text>
                              <Text numberOfLines={1} style={styles.discoverySubtitle}>
                                {entitySubtitle(item, group.type)}
                              </Text>
                            </View>
                          </View>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          <View style={styles.section}>
            <WavenSectionTitle leading="Your" accent="Music" />

            <WavenPressable
              accessibilityLabel="Open Library"
              accessibilityRole="button"
              onPress={() => router.navigate('/library')}
            >
              <View style={styles.libraryShortcut}>
                <View accessible={false} pointerEvents="none" style={styles.shortcutGlassTint} />
                <View accessible={false} pointerEvents="none" style={styles.shortcutGlassInnerEdge} />
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
    backgroundColor: 'rgba(235, 242, 247, 0.075)',
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
  sectionTitleAccent: {
    color: wavenColors.interactionBlue,
  },
  sectionTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  sectionTitleSignal: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 2,
    height: 13,
  },
  sectionTitleSignalBar: {
    backgroundColor: wavenColors.interactionBlue,
    borderRadius: 999,
    width: 2.5,
  },
  sectionTitleSignalBarShort: {
    height: 6,
  },
  sectionTitleSignalBarTall: {
    height: 12,
  },
  sectionTitleSignalBarMid: {
    height: 9,
  },
  sectionHint: {
    color: wavenColors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  recentState: {
    alignItems: 'center',
    backgroundColor: 'rgba(11, 18, 25, 0.52)',
    borderColor: 'rgba(214, 224, 232, 0.145)',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    overflow: 'hidden',
    padding: 10,
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
    alignItems: 'center',
    backgroundColor: 'rgba(11, 18, 25, 0.52)',
    borderColor: 'rgba(214, 224, 232, 0.145)',
    borderRadius: wavenRadii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 9,
    position: 'relative',
  },
  exploreLabel: {
    color: wavenColors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  discoveryState: {
    backgroundColor: 'rgba(10, 17, 24, 0.46)',
    borderColor: 'rgba(214, 224, 232, 0.125)',
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
    overflow: 'hidden',
    padding: 14,
    position: 'relative',
  },
  discoveryStateTitle: {
    color: wavenColors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  discoveryStateBody: {
    color: wavenColors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  discoverySkeletonRow: {
    flexDirection: 'row',
    gap: 9,
  },
  discoverySkeleton: {
    backgroundColor: 'rgba(217, 226, 234, 0.055)',
    borderColor: 'rgba(217, 226, 234, 0.08)',
    borderRadius: wavenRadii.md,
    borderWidth: StyleSheet.hairlineWidth,
    height: 54,
    flex: 1,
  },
  discoveryAction: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: wavenColors.canvas,
    borderColor: 'rgba(93, 187, 237, 0.2)',
    borderRadius: wavenRadii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  discoveryActionText: {
    color: wavenColors.textPrimary,
    fontSize: wavenTypography.label.fontSize,
    fontWeight: wavenTypography.label.fontWeight,
  },
  discoveryStack: {
    gap: 22,
  },
  discoveryNoticeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  discoveryNotice: {
    color: wavenColors.textMuted,
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },
  discoveryNoticeAction: {
    alignItems: 'center',
    backgroundColor: 'rgba(8, 15, 21, 0.72)',
    borderColor: 'rgba(93, 187, 237, 0.22)',
    borderRadius: wavenRadii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 14,
  },
  discoveryNoticeActionText: {
    color: wavenColors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  discoveryGroup: {
    gap: 11,
  },
  discoveryRow: {
    gap: 10,
  },
  discoveryCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(10, 17, 24, 0.43)',
    borderColor: 'rgba(214, 224, 232, 0.105)',
    borderRadius: wavenRadii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    paddingHorizontal: 0,
    paddingVertical: 8,
    position: 'relative',
  },
  cardTopHighlight: {
    backgroundColor: 'rgba(235, 242, 247, 0.075)',
    height: StyleSheet.hairlineWidth,
    left: 12,
    position: 'absolute',
    right: 12,
    top: 0,
  },
  shortcutGlassTint: {
    backgroundColor: 'rgba(38, 153, 223, 0.018)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  shortcutGlassInnerEdge: {
    borderColor: 'rgba(235, 242, 247, 0.045)',
    borderRadius: wavenRadii.lg - 1,
    borderWidth: StyleSheet.hairlineWidth,
    bottom: 1,
    left: 1,
    position: 'absolute',
    right: 1,
    top: 1,
  },
  mediaGlassTint: {
    backgroundColor: 'rgba(38, 153, 223, 0.012)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  mediaGlassInnerEdge: {
    borderColor: 'rgba(93, 187, 237, 0.045)',
    borderRadius: wavenRadii.lg - 1,
    borderWidth: StyleSheet.hairlineWidth,
    bottom: 1,
    left: 1,
    position: 'absolute',
    right: 1,
    top: 1,
  },
  discoveryCardContent: {
    alignSelf: 'center',
    gap: 7,
  },
  discoveryArtwork: {
    borderColor: 'rgba(214, 224, 232, 0.1)',
    borderRadius: wavenRadii.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  discoveryMeta: {
    alignSelf: 'stretch',
    gap: 2,
    paddingBottom: 1,
  },
  discoveryTitle: {
    color: wavenColors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    minHeight: 30,
  },
  discoverySubtitle: {
    color: wavenColors.textMuted,
    fontSize: 10,
    lineHeight: 14,
    minHeight: 14,
  },
  libraryShortcut: {
    alignItems: 'center',
    backgroundColor: 'rgba(11, 18, 25, 0.5)',
    borderColor: 'rgba(214, 224, 232, 0.14)',
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
