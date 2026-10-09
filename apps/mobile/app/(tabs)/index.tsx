import {
  FlatList,
  ScrollView,
  StyleSheet,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { spacing, fontFamilies, radii } from '@orion/shared/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { tmdbFetch } from '@orion/shared/api';
import { TmdbMediaItem, TmdbPaginatedResponse } from '@orion/shared/types';
import { HeroBillboard } from '../../src/components/HeroBillboard';
import { HomeConnectionPanel } from '../../src/components/HomeConnectionPanel';
import { MobilePageHeader } from '../../src/components/MobilePageHeader';
import { HomeCatalogPlaceholder } from '../../src/features/home/HomeCatalogPlaceholder';
import { HomeLocalLibrary } from '../../src/features/home/HomeLocalLibrary';
import { MediaCard } from '../../src/components/MediaCard';
import { HomeContinueWatching } from '../../src/features/library/HomeContinueWatching';
import { useOrionTheme } from '../../src/context/ThemeContext';
import { useNetworkStatus } from '../../src/context/NetworkContext';
import { useRemoteRecoveryEffect } from '../../src/context/useRemoteRecoveryEffect';
import { getRailRenderBudget } from '../../src/services/listPerformance';
import { usePerformanceProfile } from '../../src/context/PerformanceContext';
import { useHomeLayoutPreferences, type HomeRailId } from '../../src/features/home/homeLayoutPreferences';

function SectionTitle({ title, highlight }: { title: string; highlight: string }) {
  const { theme } = useOrionTheme();

  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        {title} <Text style={{ color: theme.accent }}>{highlight}</Text>
      </Text>
    </View>
  );
}

function ExploreMoreCard({ onPress, label = 'Explore more' }: { onPress: () => void; label?: string }) {
  const { theme } = useOrionTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => [styles.exploreCard, { borderColor: theme.border, backgroundColor: theme.surface }, pressed && { opacity: 0.82, transform: [{ scale: 0.97 }] }]}>
      <View style={[styles.exploreIcon, { backgroundColor: theme.accentSoft }]}>
        <Ionicons name="arrow-forward" size={22} color={theme.accent} />
      </View>
      <Text style={[styles.exploreTitle, { color: theme.text }]}>Explore more</Text>
      <Text style={[styles.exploreHint, { color: theme.textSecondary }]}>Open in Discover</Text>
    </Pressable>
  );
}

function MediaRow({
  items,
  onPress,
  onExploreMore,
  exploreLabel,
}: {
  items: TmdbMediaItem[];
  onPress: (item: TmdbMediaItem) => void;
  onExploreMore?: () => void;
  exploreLabel?: string;
}) {
  const { width } = useWindowDimensions();
  const { resolvedProfile } = usePerformanceProfile();
  const renderBudget = getRailRenderBudget(
    width,
    140 + spacing[4],
    resolvedProfile,
  );

  if (!items || items.length === 0) return null;

  return (
    <FlatList
      data={items}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rowContent}
      keyExtractor={(item, index) => `${item.id}_${index}`}
      initialNumToRender={renderBudget.initialNumToRender}
      maxToRenderPerBatch={renderBudget.maxToRenderPerBatch}
      windowSize={renderBudget.windowSize}
      renderItem={({ item }) => (
        <MediaCard item={item} onPress={() => onPress(item)} />
      )}
      ListFooterComponent={onExploreMore ? <ExploreMoreCard onPress={onExploreMore} label={exploreLabel} /> : null}
    />
  );
}

function homeDateKey(offsetDays: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function mergeHomeMedia(movieResult: PromiseSettledResult<TmdbPaginatedResponse>, tvResult: PromiseSettledResult<TmdbPaginatedResponse>): TmdbMediaItem[] {
  const movies = movieResult.status === 'fulfilled' ? (movieResult.value?.results || []).map((item) => ({ ...item, media_type: 'movie' as const })) : [];
  const shows = tvResult.status === 'fulfilled' ? (tvResult.value?.results || []).map((item) => ({ ...item, media_type: 'tv' as const })) : [];
  return [...movies, ...shows].filter((item) => item.poster_path || item.backdrop_path).sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, 20);
}

export default function HomeScreen() {
  const { theme } = useOrionTheme();
  const router = useRouter();
  const network = useNetworkStatus();
  const homeLayout = useHomeLayoutPreferences();

  const [trendingMovies, setTrendingMovies] = useState<TmdbMediaItem[]>([]);
  const [trendingTV, setTrendingTV] = useState<TmdbMediaItem[]>([]);
  const [kDramas, setKDramas] = useState<TmdbMediaItem[]>([]);
  const [topRated, setTopRated] = useState<TmdbMediaItem[]>([]);
  const [newReleases, setNewReleases] = useState<TmdbMediaItem[]>([]);
  const [upcoming, setUpcoming] = useState<TmdbMediaItem[]>([]);
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);

  const remoteLoadGenerationRef = useRef(0);
  const remoteReadyRef = useRef(network.remoteReady);
  const mountedRecoveryEpochRef = useRef(network.recoveryEpoch);
  const initialRemoteLoadStartedRef = useRef(false);

  remoteReadyRef.current = network.remoteReady;

  const loadRemoteHome = useCallback(async () => {
    if (!remoteReadyRef.current) {
      return;
    }

    const generation =
      ++remoteLoadGenerationRef.current;

    setLoadingRemote(true);
    setRemoteError(null);

    try {
      const today = homeDateKey(0);
      const recent = homeDateKey(-30);
      const tomorrow = homeDateKey(1);
      const soon = homeDateKey(90);
      const [
        moviesData, tvData, kDramaData, topMovies, topTV, newMovies, newTV, upcomingMovies, upcomingTV,
      ] = await Promise.allSettled([
        tmdbFetch<TmdbPaginatedResponse>('/trending/movie/week'),
        tmdbFetch<TmdbPaginatedResponse>('/trending/tv/week'),
        tmdbFetch<TmdbPaginatedResponse>('/discover/tv?with_original_language=ko&with_genres=18&sort_by=popularity.desc&vote_count.gte=80&page=1'),
        tmdbFetch<TmdbPaginatedResponse>('/movie/top_rated?page=1'),
        tmdbFetch<TmdbPaginatedResponse>('/tv/top_rated?page=1'),
        tmdbFetch<TmdbPaginatedResponse>(`/discover/movie?sort_by=popularity.desc&include_adult=false&primary_release_date.gte=${recent}&primary_release_date.lte=${today}&vote_count.gte=20&page=1`),
        tmdbFetch<TmdbPaginatedResponse>(`/discover/tv?sort_by=popularity.desc&include_adult=false&first_air_date.gte=${recent}&first_air_date.lte=${today}&vote_count.gte=10&page=1`),
        tmdbFetch<TmdbPaginatedResponse>(`/discover/movie?sort_by=popularity.desc&include_adult=false&primary_release_date.gte=${tomorrow}&primary_release_date.lte=${soon}&page=1`),
        tmdbFetch<TmdbPaginatedResponse>(`/discover/tv?sort_by=popularity.desc&include_adult=false&first_air_date.gte=${tomorrow}&first_air_date.lte=${soon}&page=1`),
      ]);

      if (
        generation !== remoteLoadGenerationRef.current ||
        !remoteReadyRef.current
      ) {
        return;
      }

      // Failed sections retain their previous data; only fulfilled inputs commit.
      if (moviesData.status === 'fulfilled') {
        setTrendingMovies(
          (moviesData.value?.results || [])
            .slice(0, 20)
            .map((item) => ({
              ...item,
              media_type: 'movie' as const,
            })),
        );
      }

      if (tvData.status === 'fulfilled') {
        setTrendingTV(
          (tvData.value?.results || [])
            .slice(0, 20)
            .map((item) => ({
              ...item,
              media_type: 'tv' as const,
            })),
        );
      }

      if (kDramaData.status === 'fulfilled') {
        setKDramas(
          (kDramaData.value?.results || [])
            .filter(
              (item) =>
                item.poster_path ||
                item.backdrop_path,
            )
            .slice(0, 20)
            .map((item) => ({
              ...item,
              media_type: 'tv' as const,
            })),
        );
      }

      if (topMovies.status === 'fulfilled' || topTV.status === 'fulfilled') {
        const topMovieItems =
          (topMovies.status === 'fulfilled' ? topMovies.value?.results || [] : [])
            .slice(0, 8)
            .map((item) => ({
              ...item,
              media_type: 'movie' as const,
            }));

        const topTVItems =
          (topTV.status === 'fulfilled' ? topTV.value?.results || [] : [])
            .slice(0, 8)
            .map((item) => ({
              ...item,
              media_type: 'tv' as const,
            }));

        const merged: TmdbMediaItem[] = [];
        const maxLen =
          Math.max(
            topMovieItems.length,
            topTVItems.length,
          );

        for (let index = 0; index < maxLen; index += 1) {
          if (topMovieItems[index]) {
            merged.push(topMovieItems[index]);
          }

          if (topTVItems[index]) {
            merged.push(topTVItems[index]);
          }
        }

        setTopRated(merged);
      }

      if (newMovies.status === 'fulfilled' || newTV.status === 'fulfilled') setNewReleases(mergeHomeMedia(newMovies, newTV));
      if (upcomingMovies.status === 'fulfilled' || upcomingTV.status === 'fulfilled') setUpcoming(mergeHomeMedia(upcomingMovies, upcomingTV));

      if (
        [moviesData, tvData, kDramaData, topMovies, topTV, newMovies, newTV, upcomingMovies, upcomingTV]
          .every((result) => result.status === 'rejected')
      ) {
        setRemoteError('Cinema content could not refresh.');
      }
    } finally {
      if (
        generation === remoteLoadGenerationRef.current &&
        remoteReadyRef.current
      ) {
        setLoadingRemote(false);
      }
    }
  }, []);

  useEffect(() => {
    if (network.remoteReady) {
      return;
    }

    remoteLoadGenerationRef.current += 1;
    setLoadingRemote(false);
  }, [network.remoteReady]);

  useEffect(() => {
    if (
      !network.remoteReady ||
      network.recoveryEpoch !== mountedRecoveryEpochRef.current ||
      initialRemoteLoadStartedRef.current
    ) {
      return;
    }

    initialRemoteLoadStartedRef.current = true;
    void loadRemoteHome();
  }, [
    loadRemoteHome,
    network.recoveryEpoch,
    network.remoteReady,
  ]);

  useRemoteRecoveryEffect(() => {
    initialRemoteLoadStartedRef.current = true;
    return loadRemoteHome();
  });

  const navigateToMedia = (item: TmdbMediaItem) => {
    const type =
      item.media_type ||
      (item.name ? 'tv' : 'movie');

    router.push(
      `/media/${item.id}?type=${type}`,
    );
  };

  const navigateToPlayer = (item: TmdbMediaItem) => {
    const type =
      item.media_type ||
      (item.name ? 'tv' : 'movie');

    const title =
      type === 'movie'
        ? item.title
        : item.name;

    const year =
      type === 'movie'
        ? item.release_date?.slice(0, 4)
        : item.first_air_date?.slice(0, 4);

    router.push({
      pathname: '/player/[id]',
      params: {
        id: item.id,
        type,
        title,
        year,
        seriesTitle:
          type === 'tv'
            ? title
            : undefined,
        posterPath:
          item.poster_path ||
          undefined,
        backdropPath:
          item.backdrop_path ||
          undefined,
      },
    });
  };

  const exploreDiscover = (params: Record<string, string>) => {
    router.push({ pathname: '/discover', params: { exploreIntent: String(Date.now()), ...params } } as any);
  };

  const spotlightItems: TmdbMediaItem[] = [];
  const maxSpotlight =
    Math.max(
      trendingMovies.length,
      trendingTV.length,
    );

  for (
    let index = 0;
    index < maxSpotlight &&
    spotlightItems.length < 5;
    index += 1
  ) {
    if (
      trendingMovies[index] &&
      spotlightItems.length < 5
    ) {
      spotlightItems.push(
        trendingMovies[index],
      );
    }

    if (
      trendingTV[index] &&
      spotlightItems.length < 5
    ) {
      spotlightItems.push(
        trendingTV[index],
      );
    }
  }

  const offlineHome = network.productState === 'offline';
  const hasRemoteContent = [trendingMovies, trendingTV, kDramas, topRated, newReleases, upcoming]
    .some((items) => items.length > 0);
  // Rendering retained data never grants permission to start remote requests.
  const showRemoteCatalog = !offlineHome && (network.remoteReady || hasRemoteContent);
  const showHero = showRemoteCatalog && spotlightItems.length > 0;
  const waitingForCatalog = !offlineHome && !hasRemoteContent && !remoteError &&
    (loadingRemote || network.productState === 'checking' || network.productState === 'reconnecting');
  const showLocalLibrary = offlineHome || !network.remoteReady || !hasRemoteContent;
  const connectionPanel = (
    <HomeConnectionPanel
      compact={!offlineHome}
      initialLoad={!hasRemoteContent}
      state={network.productState}
      loading={loadingRemote}
      error={remoteError}
      onRetry={() => {
        void loadRemoteHome();
      }}
      onOpenDownloads={() => {
        router.push('/(tabs)/downloads');
      }}
      onOpenLibrary={() => {
        router.push('/(tabs)/library');
      }}
    />
  );

  const visibleRailOrder = homeLayout.order.filter((railId) => !homeLayout.hidden.includes(railId));
  const connectionAnchorIndex = offlineHome ? 0 : Math.max(0, visibleRailOrder.indexOf('continue-watching') + 1);

  const renderHomeRail = (railId: HomeRailId) => {
    if (railId === 'continue-watching') {
      return <HomeContinueWatching key={railId} presentation={offlineHome ? 'offline-compact' : undefined} />;
    }
    if (!showRemoteCatalog) return null;
    if (railId === 'trending-movies' && trendingMovies.length > 0) {
      return (
        <View key={railId} style={styles.section}>
          <SectionTitle title="Trending" highlight="Movies" />
          <MediaRow items={trendingMovies} onPress={navigateToMedia} exploreLabel="Explore more trending movies"
            onExploreMore={network.remoteReady ? () => exploreDiscover({ feed: 'trending', mediaType: 'movie', label: 'Trending Movies', window: 'week' }) : undefined} />
        </View>
      );
    }
    if (railId === 'trending-tv' && trendingTV.length > 0) {
      return (
        <View key={railId} style={styles.section}>
          <SectionTitle title="Trending" highlight="TV Shows" />
          <MediaRow items={trendingTV} onPress={navigateToMedia} exploreLabel="Explore more trending TV shows"
            onExploreMore={network.remoteReady ? () => exploreDiscover({ feed: 'trending', mediaType: 'tv', label: 'Trending TV Shows', window: 'week' }) : undefined} />
        </View>
      );
    }
    if (railId === 'new-releases' && newReleases.length > 0) {
      return (
        <View key={railId} style={styles.section}>
          <SectionTitle title="New" highlight="Releases" />
          <MediaRow items={newReleases} onPress={navigateToMedia} exploreLabel="Explore more new releases"
            onExploreMore={network.remoteReady ? () => exploreDiscover({ feed: 'new-releases', mediaType: 'all', label: 'New Releases', window: '30' }) : undefined} />
        </View>
      );
    }
    if (railId === 'upcoming' && upcoming.length > 0) {
      return (
        <View key={railId} style={styles.section}>
          <SectionTitle title="Coming" highlight="Soon" />
          <MediaRow items={upcoming} onPress={navigateToMedia} exploreLabel="Explore more upcoming titles"
            onExploreMore={network.remoteReady ? () => exploreDiscover({ feed: 'upcoming', mediaType: 'all', label: 'Coming Soon', window: '90' }) : undefined} />
        </View>
      );
    }
    if (railId === 'k-dramas' && kDramas.length > 0) {
      return (
        <View key={railId} style={styles.section}>
          <SectionTitle title="K-Dramas" highlight="Spotlight" />
          <MediaRow items={kDramas} onPress={navigateToMedia} exploreLabel="Explore more K-Dramas"
            onExploreMore={network.remoteReady ? () => exploreDiscover({ feed: 'browse', mediaType: 'tv', region: 'asian', subfilter: 'kr', genreId: '18', sort: 'popularity.desc', label: 'K-Dramas' }) : undefined} />
        </View>
      );
    }
    if (railId === 'top-rated' && topRated.length > 0) {
      return (
        <View key={railId} style={styles.section}>
          <SectionTitle title="Top Rated" highlight="Masterpieces" />
          <MediaRow items={topRated} onPress={navigateToMedia} exploreLabel="Explore more top rated titles"
            onExploreMore={network.remoteReady ? () => exploreDiscover({ feed: 'top-rated', mediaType: 'all', label: 'Top Rated' }) : undefined} />
        </View>
      );
    }
    return null;
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background },
      ]}
    >
      <LinearGradient
        colors={[
          theme.accentSoft,
          theme.background,
          theme.background,
          theme.background,
          theme.surface,
        ]}
        locations={[0, 0.3, 0.5, 0.8, 1]}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {!showHero && !offlineHome && (
          <MobilePageHeader title="Cinema" eyebrow="ORION" compact reserveFloatingTriggerInLandscape />
        )}
        {showHero && (
            <HeroBillboard
              items={spotlightItems}
              onPress={navigateToMedia}
              onInfo={navigateToMedia}
              onPlay={navigateToPlayer}
            />
          )}

        {offlineHome && connectionPanel}

        {homeLayout.hidden.length === homeLayout.order.length ? (
          <>
            {!offlineHome && connectionPanel}
            <View style={[styles.hiddenRailsNotice, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="options-outline" size={20} color={theme.accent} />
              <View style={styles.hiddenRailsCopy}>
                <Text style={[styles.hiddenRailsTitle, { color: theme.text }]}>Your Home sections are hidden</Text>
                <Text style={[styles.hiddenRailsDescription, { color: theme.textSecondary }]}>The featured banner stays available when cinema content is online.</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Customize Home"
                onPress={() => router.push({ pathname: '/(tabs)/settings', params: { section: 'home' } } as any)}
                style={({ pressed }) => [styles.hiddenRailsAction, { backgroundColor: theme.accentSoft, borderColor: theme.accent }, pressed && { opacity: 0.82 }]}
              >
                <Text style={[styles.hiddenRailsActionText, { color: theme.accent }]}>Customize</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            {!offlineHome && visibleRailOrder.slice(0, connectionAnchorIndex).map(renderHomeRail)}
            {!offlineHome && connectionPanel}
            {(offlineHome ? visibleRailOrder : visibleRailOrder.slice(connectionAnchorIndex)).map(renderHomeRail)}
          </>
        )}

        {waitingForCatalog ? (
          <HomeCatalogPlaceholder
            railIds={visibleRailOrder.filter((id) => id !== 'continue-watching')}
            showContinueWatching={visibleRailOrder.includes('continue-watching')}
          />
        ) : showLocalLibrary && (
          <HomeLocalLibrary showContinueWatching={visibleRailOrder.includes('continue-watching')} showActions={!offlineHome} />
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginBottom: spacing[4],
  },
  sectionHeader: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: fontFamilies.display,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  rowContent: { paddingHorizontal: spacing[5], gap: spacing[3] },
  exploreCard: { width: 140, height: 210, marginRight: spacing[4], borderWidth: 1, borderRadius: radii.md, padding: spacing[4], alignItems: 'center', justifyContent: 'center' },
  exploreIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[3] },
  exploreTitle: { fontSize: 15, fontFamily: fontFamilies.heading, fontWeight: '800', textAlign: 'center' },
  exploreHint: { marginTop: spacing[1], fontSize: 11, fontFamily: fontFamilies.body, textAlign: 'center' },
  hiddenRailsNotice: { marginHorizontal: spacing[5], marginTop: spacing[3], borderWidth: 1, borderRadius: radii.xl, padding: spacing[4], flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing[3] },
  hiddenRailsCopy: { flex: 1, minWidth: 0 },
  hiddenRailsTitle: { fontSize: 15, fontFamily: fontFamilies.heading, fontWeight: '800' },
  hiddenRailsDescription: { marginTop: 3, fontSize: 11, lineHeight: 16, fontFamily: fontFamilies.body },
  hiddenRailsAction: { minHeight: 44, borderWidth: 1, borderRadius: radii.full, paddingHorizontal: spacing[4], alignItems: 'center', justifyContent: 'center' },
  hiddenRailsActionText: { fontSize: 12, fontFamily: fontFamilies.heading, fontWeight: '800' },
});