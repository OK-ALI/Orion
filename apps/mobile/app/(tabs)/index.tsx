import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { spacing, fontFamilies } from '@orion/shared/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { tmdbFetch } from '@orion/shared/api';
import { TmdbMediaItem, TmdbPaginatedResponse } from '@orion/shared/types';
import { HeroBillboard } from '../../src/components/HeroBillboard';
import { HomeConnectionPanel } from '../../src/components/HomeConnectionPanel';
import { MediaCard } from '../../src/components/MediaCard';
import { HomeContinueWatching } from '../../src/features/library/HomeContinueWatching';
import { useOrionTheme } from '../../src/context/ThemeContext';
import { useNetworkStatus } from '../../src/context/NetworkContext';
import { useRemoteRecoveryEffect } from '../../src/context/useRemoteRecoveryEffect';
import { getRailRenderBudget } from '../../src/services/listPerformance';
import { usePerformanceProfile } from '../../src/context/PerformanceContext';

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

function MediaRow({
  items,
  onPress,
}: {
  items: TmdbMediaItem[];
  onPress: (item: TmdbMediaItem) => void;
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
        <MediaCard
          item={item}
          onPress={() => onPress(item)}
        />
      )}
    />
  );
}

export default function HomeScreen() {
  const { theme } = useOrionTheme();
  const router = useRouter();
  const network = useNetworkStatus();

  const [trendingMovies, setTrendingMovies] = useState<TmdbMediaItem[]>([]);
  const [trendingTV, setTrendingTV] = useState<TmdbMediaItem[]>([]);
  const [kDramas, setKDramas] = useState<TmdbMediaItem[]>([]);
  const [topRated, setTopRated] = useState<TmdbMediaItem[]>([]);
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
      const [
        moviesData,
        tvData,
        kDramaData,
        topMovies,
        topTV,
      ] = await Promise.all([
        tmdbFetch<TmdbPaginatedResponse>('/trending/movie/week'),
        tmdbFetch<TmdbPaginatedResponse>('/trending/tv/week'),
        tmdbFetch<TmdbPaginatedResponse>(
          '/discover/tv?with_original_language=ko&with_genres=18&sort_by=popularity.desc&vote_count.gte=80&page=1',
        ),
        tmdbFetch<TmdbPaginatedResponse>('/movie/top_rated?page=1'),
        tmdbFetch<TmdbPaginatedResponse>('/tv/top_rated?page=1'),
      ]);

      if (
        generation !== remoteLoadGenerationRef.current ||
        !remoteReadyRef.current
      ) {
        return;
      }

      setTrendingMovies(
        (moviesData?.results || [])
          .slice(0, 20)
          .map((item) => ({
            ...item,
            media_type: 'movie' as const,
          })),
      );

      setTrendingTV(
        (tvData?.results || [])
          .slice(0, 20)
          .map((item) => ({
            ...item,
            media_type: 'tv' as const,
          })),
      );

      setKDramas(
        (kDramaData?.results || [])
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

      const topMovieItems =
        (topMovies?.results || [])
          .slice(0, 8)
          .map((item) => ({
            ...item,
            media_type: 'movie' as const,
          }));

      const topTVItems =
        (topTV?.results || [])
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
    } catch (error) {
      if (
        generation !== remoteLoadGenerationRef.current ||
        !remoteReadyRef.current
      ) {
        return;
      }

      console.error(
        'Failed to fetch home data:',
        error,
      );

      setRemoteError(
        'Cinema content could not refresh.',
      );
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

  const showRemoteCatalog =
    network.remoteReady;

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
        {showRemoteCatalog &&
          spotlightItems.length > 0 && (
            <HeroBillboard
              items={spotlightItems}
              onPress={navigateToMedia}
              onInfo={navigateToMedia}
              onPlay={navigateToPlayer}
            />
          )}

        <HomeContinueWatching />

        <HomeConnectionPanel
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

        {showRemoteCatalog &&
          trendingMovies.length > 0 && (
            <View style={styles.section}>
              <SectionTitle
                title="Trending"
                highlight="Movies"
              />
              <MediaRow
                items={trendingMovies}
                onPress={navigateToMedia}
              />
            </View>
          )}

        {showRemoteCatalog &&
          trendingTV.length > 0 && (
            <View style={styles.section}>
              <SectionTitle
                title="Trending"
                highlight="TV Shows"
              />
              <MediaRow
                items={trendingTV}
                onPress={navigateToMedia}
              />
            </View>
          )}

        {showRemoteCatalog &&
          kDramas.length > 0 && (
            <View style={styles.section}>
              <SectionTitle
                title="K-Dramas"
                highlight="Spotlight"
              />
              <MediaRow
                items={kDramas}
                onPress={navigateToMedia}
              />
            </View>
          )}

        {showRemoteCatalog &&
          topRated.length > 0 && (
            <View style={styles.section}>
              <SectionTitle
                title="Top Rated"
                highlight="Masterpieces"
              />
              <MediaRow
                items={topRated}
                onPress={navigateToMedia}
              />
            </View>
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
  rowContent: {
    paddingHorizontal: spacing[5],
    gap: spacing[3],
  },

});