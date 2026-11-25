import { WavenHomeMaterialContent } from '../src/theme/homeMaterialPreview';
import { useRouter } from 'expo-router';
import { useWavenConnectivity } from '../src/infrastructure/connectivity/connectivityHooks';
import { offlineMetadata } from '../src/infrastructure/connectivity/offlineMetadata';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalLibrary } from '../src/features/library/libraryRuntime';
import { WavenLibraryHeroArtwork, WavenLibraryRow } from '../src/components/library/WavenLibraryControls';
import { trackPlayback } from '../src/features/playback/trackPlaybackRuntime';
import {
  Image,
  FlatList,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { WavenText as Text } from '../src/components/typography/WavenText';
import { WavenArtworkFallback } from '../src/components/artwork/WavenArtworkFallback';
import { wavenArtworkLeaseKey } from '../src/features/artwork/wavenArtworkLifecycle';
import { WavenPressable } from '../src/components/interaction/WavenPressable';
import { WavenEntityRevealAnchor } from '../src/components/navigation/WavenEntityRevealAnchor';
import { WavenAppShell } from '../src/components/shell/WavenAppShell';
import { wavenMediaRailWindow } from '../src/components/shell/wavenMediaRailWindow';
import { WavenSurface } from '../src/components/surfaces/WavenSurface';
import { WavenSectionTitle } from '../src/components/typography/WavenSectionTitle';
import type {
  MusicAlbum,
  MusicArtist,
  MusicDashboardSection,
  MusicEntity,
  MusicTrack,
} from '../src/domain/music';
import {
  albumDetailRoute,
  artistDetailRoute,
} from '../src/features/discovery/detailNavigation';
import { wavenDiscoveryRuntime } from '../src/features/discovery/wavenDiscoveryRuntime';
import {
  normalizeWavenCanonicalMediaText,
  readWavenPresentation,
  seedWavenPresentation,
  wavenEntityArtworkUrl,
} from '../src/features/discovery/wavenCanonicalPresentation';
import { primeWavenAlbumDetail, primeWavenArtistDetail } from '../src/features/discovery/wavenDetailPrefetch';
import {
  beginWavenEntityReveal,
  wavenEntityRevealKey,
  wavenReleaseRevealKind,
} from '../src/features/navigation/wavenEntityReveal';
import { useWavenArtworkLease } from '../src/hooks/useWavenArtworkLease';
import { useWavenLayout } from '../src/hooks/useWavenLayout';
import { useWavenReducedMotion } from '../src/hooks/useWavenReducedMotion';
import {
  wavenColors,
  wavenFonts,
  wavenRadii,
  wavenSpacing,
  wavenTypography,
} from '../src/theme/tokens';

type HomeDiscoveryStatus = 'loading' | 'ready' | 'empty' | 'error';
type HomeDiscoverySectionType = 'tracks' | 'artists' | 'albums' | 'playlists';

interface HomeDiscoveryEntry {
  type: HomeDiscoverySectionType;
  item: MusicEntity;
}

interface HomeDiscoveryGroup {
  label: 'Trending Now' | 'New Releases';
  items: HomeDiscoveryEntry[];
}

const GLOBAL_CHART_SECTION_ID = 'waven-global-top-50';
const NEW_RELEASE_ALBUM_TARGET = 10;
const HOME_DISCOVERY_LIMIT = 16;

function HomeDiscoverySeparator() {
  return <View style={styles.discoveryRailSeparator} />;
}

function entityTitle(item: MusicEntity): string {
  return 'name' in item ? item.name : item.title;
}

function presentationKindForHomeType(type: HomeDiscoverySectionType) {
  return type === 'tracks' ? 'track' : type === 'artists' ? 'artist' : type === 'albums' ? 'album' : 'playlist';
}

function entityArtworkUrl(item: MusicEntity, type: HomeDiscoverySectionType): string | null {
  return wavenEntityArtworkUrl(readWavenPresentation(item, presentationKindForHomeType(type)));
}

function normalizeReleaseFingerprintText(value: unknown): string {
  return normalizeWavenCanonicalMediaText(value);
}

function releaseFingerprint(item: MusicEntity): string {
  if ('name' in item) {
    return `artist\0${normalizeReleaseFingerprintText(item.name)}`;
  }
  const artist =
    'artistName' in item ? normalizeReleaseFingerprintText(item.artistName) : '';
  return `${normalizeReleaseFingerprintText(item.title)}\0${artist}`;
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

function detailRouteForHomeItem(
  item: MusicEntity,
  type: HomeDiscoverySectionType,
) {
  if (type === 'artists') {
    return artistDetailRoute(item as MusicArtist);
  }
  if (type === 'albums') {
    return albumDetailRoute(item as MusicAlbum);
  }
  return null;
}

function collectDiscoveryItems(
  sections: readonly MusicDashboardSection[],
  type: HomeDiscoverySectionType,
  sectionFilter?: (section: MusicDashboardSection) => boolean,
  limit = HOME_DISCOVERY_LIMIT,
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
      if (items.length >= limit) return items;
    }
  }

  return items;
}

export function buildDiscoveryGroups(
  trendingSections: readonly MusicDashboardSection[],
  newReleaseSections: readonly MusicDashboardSection[],
): HomeDiscoveryGroup[] {
  const groups: HomeDiscoveryGroup[] = [];
  const chartTracks = collectDiscoveryItems(
    trendingSections,
    'tracks',
    (section) => section.id === GLOBAL_CHART_SECTION_ID,
  );
  const trendingKeys = new Set(chartTracks.map(releaseFingerprint));

  if (chartTracks.length > 0) {
    groups.push({
      label: 'Trending Now',
      items: chartTracks.map((item) => ({ type: 'tracks', item })),
    });
  }

  const releaseEntries: HomeDiscoveryEntry[] = [];
  const releaseKeys = new Set<string>();
  const releaseAlbums = collectDiscoveryItems(newReleaseSections, 'albums');
  const releaseTracks = collectDiscoveryItems(newReleaseSections, 'tracks');

  const appendRelease = (
    type: HomeDiscoverySectionType,
    item: MusicEntity,
  ) => {
    const key = releaseFingerprint(item);
    if (!key.replace('\0', '').trim()) return;
    if (trendingKeys.has(key) || releaseKeys.has(key)) return;
    releaseKeys.add(key);
    releaseEntries.push({ type, item });
  };

  for (const album of releaseAlbums.slice(0, NEW_RELEASE_ALBUM_TARGET)) {
    appendRelease('albums', album);
  }
  for (const track of releaseTracks) {
    if (releaseEntries.length >= HOME_DISCOVERY_LIMIT) break;
    appendRelease('tracks', track);
  }
  for (const album of releaseAlbums.slice(NEW_RELEASE_ALBUM_TARGET)) {
    if (releaseEntries.length >= HOME_DISCOVERY_LIMIT) break;
    appendRelease('albums', album);
  }

  // Prefer distinct cards, but never erase the entire truthful release shelf
  // merely because the same current music is also charting.
  if (!releaseEntries.length) {
    for (const [type, items] of [['albums', releaseAlbums], ['tracks', releaseTracks]] as const) {
      for (const item of items) {
        const key = releaseFingerprint(item);
        if (!key.replace('\0','').trim() || releaseKeys.has(key)) continue;
        releaseKeys.add(key); releaseEntries.push({type,item});
      }
    }
  }

  if (releaseEntries.length > 0) {
    groups.push({
      label: 'New Releases',
      items: releaseEntries.slice(0, HOME_DISCOVERY_LIMIT),
    });
  }

  return groups;
}

function WavenHomeDiscoveryArtwork({
  circular = false,
  item,
  size,
  type,
}: {
  circular?: boolean;
  item: MusicEntity;
  size: number;
  type: HomeDiscoverySectionType;
}) {
  const artworkUrl = entityArtworkUrl(item, type);
  const borderRadius = circular ? size / 2 : wavenRadii.md;
  const artworkLease = useWavenArtworkLease({
    leaseKey: wavenArtworkLeaseKey(
      presentationKindForHomeType(type),
      item.source.provider,
      item.source.id,
    ),
    sourceKey: artworkUrl,
  });

  return (
    <View
      style={[
        styles.discoveryArtworkClip,
        {
          borderRadius,
          height: size,
          width: size,
        },
      ]}
    >
      {artworkLease.showFallback ? (
        <WavenArtworkFallback
          accessibilityLabel={`${entityTitle(item)} artwork`}
          seed={`home-discovery-${item.source.provider}-${item.source.id}`}
          size={size}
        />
      ) : null}
      {artworkLease.backupSourceKey ? (
        <Image
          accessible={false}
          resizeMethod="resize"
          resizeMode="cover"
          source={{ uri: artworkLease.backupSourceKey }}
          style={[
            styles.discoveryArtwork,
            {
              borderRadius,
              height: size,
              left: 0,
              position: 'absolute',
              top: 0,
              width: size,
            },
          ]}
        />
      ) : null}
      {artworkUrl ? (
        <Image
          accessibilityLabel={`${entityTitle(item)} artwork`}
          key={artworkLease.imageKey}
          onError={artworkLease.onError}
          onLoad={artworkLease.onLoad}
          resizeMethod="resize"
          resizeMode="cover"
          source={{ uri: artworkUrl }}
          style={[
            styles.discoveryArtwork,
            {
              borderRadius,
              height: size,
              left: 0,
              position: 'absolute',
              top: 0,
              width: size,
            },
          ]}
        />
      ) : null}
    </View>
  );
}


export default function WavenHomeScreen() {
  const connection = useWavenConnectivity();
  const library = useLocalLibrary();
  const latestPlay = library.state.history[0]?.track;
  const router = useRouter();
  const layout = useWavenLayout();
  const reducedMotion = useWavenReducedMotion();
  const { fontScale } = useWindowDimensions();
  const stackSectionHeaders = fontScale >= 1.45;

  const heroArtworkSize = layout.isCompact
    ? 150
    : layout.isTabletLike
      ? 202
      : 172;

  const discoveryArtworkSize = layout.isCompact
    ? 104
    : layout.isTabletLike
      ? 136
      : 116;
  const recentArtworkSize = layout.isCompact ? 68 : 76;
  const discoveryCardWidth = discoveryArtworkSize + 32;
  const discoveryMediaArtworkSize = discoveryCardWidth;
  const discoveryCardMinHeight = discoveryMediaArtworkSize + 56;
  const initialTrendingSnapshot = useRef(
    wavenDiscoveryRuntime.getSearchGlobalChartsSessionSnapshot(),
  ).current;
  const initialNewReleasesSnapshot = useRef(
    wavenDiscoveryRuntime.getSearchNewReleasesSessionSnapshot(),
  ).current;
  const initialDiscoveryGroups = buildDiscoveryGroups(
    initialTrendingSnapshot?.result.sections ?? [],
    initialNewReleasesSnapshot?.result.sections ?? [],
  );
  const initialDiscoveryErrors = [
    ...(initialTrendingSnapshot?.errors ?? []),
    ...(initialNewReleasesSnapshot?.errors ?? []),
  ];
  const [discoveryStatus, setDiscoveryStatus] = useState<HomeDiscoveryStatus>(() =>
    initialDiscoveryGroups.length > 0
      ? 'ready'
      : initialTrendingSnapshot && initialNewReleasesSnapshot
        ? initialDiscoveryErrors.length > 0
          ? 'error'
          : 'empty'
        : 'loading',
  );
  const [trendingSections, setTrendingSections] = useState<
    readonly MusicDashboardSection[]
  >(() => initialTrendingSnapshot?.result.sections ?? []);
  const [newReleaseSections, setNewReleaseSections] = useState<
    readonly MusicDashboardSection[]
  >(() => initialNewReleasesSnapshot?.result.sections ?? []);
  const [shelfFailures, setShelfFailures] = useState<readonly string[]>(() => [
    ...(initialTrendingSnapshot?.errors.length ? ['home-charts'] : []),
    ...(initialNewReleasesSnapshot?.errors.length ? ['home-releases'] : []),
  ]);
  const hasDiscoveryDegradation = shelfFailures.length > 0;
  const [discoveryRetryNonce, setDiscoveryRetryNonce] = useState(0);
  const [releaseNotice, setReleaseNotice] = useState<string | null>(null);
  const discoveryRequestSequence = useRef(0);
  const lastExplicitRefreshNonce = useRef(0);

  useEffect(() => wavenDiscoveryRuntime.subscribeDiscovery(key => {
    // Fill a missing shelf after background recovery; established visible rails
    // retain their accepted session ordering until an explicit refresh.
    const releases = wavenDiscoveryRuntime.getSearchNewReleasesSessionSnapshot();
    const charts = wavenDiscoveryRuntime.getSearchGlobalChartsSessionSnapshot();
    if (key === 'home-releases' && releases && !releases.errors.length) {
      setShelfFailures(current => current.filter(value => value !== key));
      setReleaseNotice(releases.result.sections.length ? null : 'No verified new releases are available right now.');
      setNewReleaseSections(current => current.length ? current : releases.result.sections);
      setDiscoveryStatus(current => releases.result.sections.length ? 'ready' : current === 'error' ? 'empty' : current);
    }
    if (key === 'home-charts' && charts?.result.sections.length) {
      setShelfFailures(current => current.filter(value => value !== key));
      setTrendingSections(current => current.length ? current : charts.result.sections);
      setDiscoveryStatus('ready');
    }
  }), []);

  useEffect(() => {
    const controller = new AbortController();
    const sequence = ++discoveryRequestSequence.current;
    const shouldRefresh =
      discoveryRetryNonce > lastExplicitRefreshNonce.current ||
      (connection.remoteReady && Object.values(wavenDiscoveryRuntime.getDiscoveryFreshnessHints()).some(Boolean));

    if (shouldRefresh) {
      lastExplicitRefreshNonce.current = discoveryRetryNonce;
    }

    const cachedTrending =
      wavenDiscoveryRuntime.getSearchGlobalChartsSessionSnapshot();
    const cachedNewReleases =
      wavenDiscoveryRuntime.getSearchNewReleasesSessionSnapshot();

    const cachedGroups = buildDiscoveryGroups(
      cachedTrending?.result.sections ?? [],
      cachedNewReleases?.result.sections ?? [],
    );
    const cachedErrors = [
      ...(cachedTrending?.errors ?? []),
      ...(cachedNewReleases?.errors ?? []),
    ];

    if (!connection.remoteReady) {
      offlineMetadata.enqueue('home-charts');
      offlineMetadata.enqueue('home-releases');
      if (cachedGroups.length > 0) {
        setTrendingSections(cachedTrending?.result.sections ?? []);
        setNewReleaseSections(cachedNewReleases?.result.sections ?? []);
        setDiscoveryStatus('ready');
      } else setDiscoveryStatus('error');
      return () => controller.abort();
    }

    if (!shouldRefresh && cachedGroups.length > 0) {
      setTrendingSections(cachedTrending?.result.sections ?? []);
      setNewReleaseSections(cachedNewReleases?.result.sections ?? []);
      setShelfFailures([
        ...(cachedTrending?.errors.length ? ['home-charts'] : []),
        ...(cachedNewReleases?.errors.length ? ['home-releases'] : []),
      ]);
      setDiscoveryStatus('ready');

      if (cachedTrending && cachedNewReleases) {
        return () => controller.abort();
      }
    } else {
      setDiscoveryStatus('loading');
      setShelfFailures([]);
    }

    Promise.allSettled([
      wavenDiscoveryRuntime.getSearchGlobalCharts({
        signal: controller.signal,
        refresh: shouldRefresh,
      }),
      wavenDiscoveryRuntime.getSearchNewReleases({
        signal: controller.signal,
        refresh: shouldRefresh,
      }),
    ]).then(([trendingResult, newReleasesResult]) => {
      if (
        controller.signal.aborted ||
        sequence !== discoveryRequestSequence.current
      ) {
        return;
      }

      const trendingResponse =
        trendingResult.status === 'fulfilled' && !trendingResult.value.cancelled
          ? trendingResult.value
          : null;
      const newReleasesResponse =
        newReleasesResult.status === 'fulfilled' && !newReleasesResult.value.cancelled
          ? newReleasesResult.value
          : null;

      const nextTrendingSections = trendingResponse?.result.sections.length ? trendingResponse.result.sections
        : wavenDiscoveryRuntime.getSearchGlobalChartsSessionSnapshot()?.result.sections ?? [];
      const nextNewReleaseSections = newReleasesResponse?.result.sections.length ? newReleasesResponse.result.sections
        : wavenDiscoveryRuntime.getSearchNewReleasesSessionSnapshot()?.result.sections ?? [];
      const nextErrors = [
        ...(trendingResponse?.errors ??
          (trendingResult.status === 'rejected'
            ? ['Trending is unavailable right now.']
            : [])),
        ...(newReleasesResponse?.errors ??
          (newReleasesResult.status === 'rejected'
            ? ['New releases are unavailable right now.']
            : [])),
      ];
      const nextGroups = buildDiscoveryGroups(
        nextTrendingSections,
        nextNewReleaseSections,
      );
      setReleaseNotice(newReleasesResponse?.errors.length
        ? 'New Releases could not refresh. Previously saved music stays available.'
        : nextNewReleaseSections.length ? null : 'No verified new releases are available right now.');

      setTrendingSections(nextTrendingSections);
      setNewReleaseSections(nextNewReleaseSections);
      setShelfFailures([
        ...(trendingResponse?.errors.length || trendingResult.status === 'rejected' ? ['home-charts'] : []),
        ...(newReleasesResponse?.errors.length || newReleasesResult.status === 'rejected' ? ['home-releases'] : []),
      ]);
      setDiscoveryStatus(
        nextGroups.length > 0
          ? 'ready'
          : nextErrors.length > 0
            ? 'error'
            : 'empty',
      );
    });

    return () => controller.abort();
  }, [discoveryRetryNonce, connection.remoteReady, connection.recoveryEpoch]);

  const discoveryGroups = useMemo(
    () => buildDiscoveryGroups(trendingSections, newReleaseSections),
    [newReleaseSections, trendingSections],
  );

  return (
    <WavenAppShell brandTagline>
      <WavenHomeMaterialContent base={styles} render={(styles) => (
      <View style={styles.page}>
        <View style={styles.homeBody}>
          <WavenPressable
            accessibilityLabel={latestPlay ? `Replay ${latestPlay.title}` : 'Explore music'}
            accessibilityRole="button"
            onPress={() => latestPlay ? void trackPlayback.play(latestPlay) : router.navigate('/search')}
          >
            <WavenSurface
              style={[
                styles.hero,
                layout.isTabletLike ? styles.heroTablet : styles.heroPhone,
              ]}
            >

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
                  {latestPlay ? <WavenLibraryHeroArtwork track={latestPlay} size={heroArtworkSize} /> : <WavenArtworkFallback
                    accessibilityLabel="WAVEN sound artwork"
                    seed="home-reference-02-feature"
                    size={heroArtworkSize}
                  />}
                </View>
                <View style={styles.heroBadge}>
                  <View accessible={false} style={styles.heroBadgeDot} />
                  <Text style={styles.heroBadgeText}>{latestPlay ? 'LAST PLAYED' : 'START HERE'}</Text>
                </View>
              </View>

              <View style={styles.heroCopy}>
                <Text style={styles.eyebrow}>{latestPlay ? 'YOUR LATEST PLAY' : 'YOUR NEXT PLAY'}</Text>
                <Text accessibilityRole="header" style={styles.heroTitle}>
                  {latestPlay ? latestPlay.title : <>Find Your <Text style={styles.heroTitleAccent}>Sound.</Text></>}
                </Text>
                <Text style={styles.heroBody}>
                  {latestPlay ? latestPlay.artistName : 'Songs, artists, albums and playlists are one tap away.'}
                </Text>

                <View style={styles.heroAction}>
                  <Text style={styles.heroActionText}>{latestPlay ? 'Replay Song' : 'Explore Music'}</Text>
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

            {library.state.history.length ? <View>
              {library.state.history.slice(0, 5).map(entry => <WavenLibraryRow key={entry.key} kind="track" entity={entry.track} />)}
            </View> : <WavenSurface style={styles.recentState}>
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
            </WavenSurface>}
          </View>

          <View style={styles.section}>
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
                      {shelfFailures.length > 1 ? 'Discovery is refreshing.' : shelfFailures[0] === 'home-releases' ? 'New Releases will retry automatically.' : 'Trending will retry automatically.'}
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
                  <View key={group.label} style={styles.discoveryGroup}>
                    <WavenSectionTitle
                      leading={group.label.split(' ')[0]}
                      accent={group.label.split(' ').slice(1).join(' ')}
                    />
                    <FlatList
                      {...wavenMediaRailWindow(discoveryCardWidth, Math.min(layout.width - 2 * layout.gutter, layout.contentMaxWidth), 10)}
                      data={group.items}
                      keyExtractor={({ item }) => `${item.source.provider}:${item.source.id}`}
                      ItemSeparatorComponent={HomeDiscoverySeparator}
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
                      renderItem={({ item: { item, type } }) => {
                        const detailRoute = detailRouteForHomeItem(item, type);
                        const isArtist = type === 'artists';
                        const sourceBorderRadius = isArtist
                          ? discoveryMediaArtworkSize / 2
                          : wavenRadii.md;
                        const card = (
                          <View
                            style={[
                              styles.discoveryCard,
                              {
                                minHeight: discoveryCardMinHeight,
                                width: discoveryCardWidth,
                              },
                            ]}
                          >
                            <View
                              style={[
                                styles.discoveryCardContent,
                                { width: discoveryCardWidth },
                              ]}
                            >
                              {detailRoute ? (
                                <WavenEntityRevealAnchor
                                  borderRadius={sourceBorderRadius}
                                  entityKey={wavenEntityRevealKey(
                                    isArtist ? 'artist' : 'album',
                                    item.source.provider,
                                    item.source.id,
                                  )}
                                  role="origin"
                                  style={{
                                    height: discoveryMediaArtworkSize,
                                    width: discoveryMediaArtworkSize,
                                  }}
                                >
                                  <WavenHomeDiscoveryArtwork
                                    circular={isArtist}
                                    item={item}
                                    size={discoveryMediaArtworkSize}
                                    type={type}
                                  />
                                </WavenEntityRevealAnchor>
                              ) : (
                                <WavenHomeDiscoveryArtwork
                                  circular={isArtist}
                                  item={item}
                                  size={discoveryMediaArtworkSize}
                                  type={type}
                                />
                              )}
                              <View
                                style={[
                                  styles.discoveryMeta,
                                  isArtist ? styles.discoveryArtistMeta : null,
                                ]}
                              >
                                <Text
                                  numberOfLines={2}
                                  style={[
                                    styles.discoveryTitle,
                                    isArtist ? styles.discoveryArtistText : null,
                                  ]}
                                >
                                  {entityTitle(item)}
                                </Text>
                                <Text
                                  numberOfLines={1}
                                  style={[
                                    styles.discoverySubtitle,
                                    isArtist ? styles.discoveryArtistText : null,
                                  ]}
                                >
                                  {entitySubtitle(item, type)}
                                </Text>
                              </View>
                            </View>
                          </View>
                        );

                        if (!detailRoute) {
                          return (
                            <View
                              accessibilityLabel={`${entityTitle(item)}, ${entitySubtitle(item, type)}`}
                              accessible
                              key={`${item.source.provider}:${item.source.id}`}
                            >
                              {card}
                            </View>
                          );
                        }

                        return (
                          <WavenPressable
                            accessibilityLabel={`Open ${entityTitle(item)} ${type === 'artists' ? 'artist' : 'album'} details`}
                            accessibilityRole="button"
                            key={`${item.source.provider}:${item.source.id}`}
                            onPress={() => {
                              const open = async () => {
                                if (type === 'artists') {
                                  void primeWavenArtistDetail(item as MusicArtist);
                                } else if (type === 'albums') {
                                  void primeWavenAlbumDetail(item as MusicAlbum);
                                }
                                const presented = seedWavenPresentation(item, presentationKindForHomeType(type));
                                const started = await beginWavenEntityReveal(
                                  {
                                    artworkUrl: entityArtworkUrl(presented, type),
                                    entityKey: wavenEntityRevealKey(
                                      type === 'artists' ? 'artist' : 'album',
                                      presented.source.provider,
                                      presented.source.id,
                                    ),
                                    kind: type === 'artists'
                                      ? 'artist'
                                      : wavenReleaseRevealKind((presented as MusicAlbum).primaryType),
                                    title: entityTitle(presented),
                                  },
                                  () => router.push(detailRoute),
                                  { animate: !reducedMotion },
                                );
                                if (started) return;
                                router.push(detailRoute);
                              };
                              void open();
                            }}
                          >
                            {card}
                          </WavenPressable>
                        );
                      }}
                    />
                  </View>
                ))}
                {releaseNotice && !discoveryGroups.some(group => group.label === 'New Releases') ? (
                  <WavenSurface style={styles.discoveryState}>
                    <WavenSectionTitle leading="New" accent="Releases" />
                    <Text accessibilityLiveRegion="polite" style={styles.discoveryStateBody}>{releaseNotice}</Text>
                    <WavenPressable accessibilityRole="button" accessibilityLabel="Retry New Releases" onPress={() => setDiscoveryRetryNonce(value => value + 1)}>
                      <View style={styles.discoveryAction}><Text style={styles.discoveryActionText}>Try Again</Text></View>
                    </WavenPressable>
                  </WavenSurface>
                ) : null}
              </View>
            ) : null}
          </View>

        </View>
      </View>
      )} />
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
    backgroundColor: 'transparent',
    borderColor: 'transparent',
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
    fontFamily: wavenFonts.extraBold,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.45,
  },
  heroTitle: {
    color: wavenColors.textSecondary,
    fontFamily: wavenFonts.headingExtraBold,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
    marginTop: 7,
    textAlign: 'center',
  },
  heroTitleAccent: {
    color: wavenColors.interactionBlue,
    fontFamily: wavenFonts.headingExtraBold,
    fontSize: 28,
    fontWeight: '800',
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
  discoveryRow: {},
  discoveryRailSeparator: { width: 10 },
  discoveryCard: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 0,
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
  discoveryCardContent: {
    alignSelf: 'center',
    gap: 8,
  },
  discoveryArtwork: {
    borderColor: 'rgba(214, 224, 232, 0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  discoveryArtworkClip: {
    overflow: 'hidden',
  },
  discoveryMeta: {
    alignSelf: 'stretch',
    gap: 2,
    paddingBottom: 1,
  },
  discoveryArtistMeta: {
    alignItems: 'center',
  },
  discoveryArtistText: {
    textAlign: 'center',
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
