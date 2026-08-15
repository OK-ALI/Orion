import { View, ScrollView, StyleSheet, ActivityIndicator, FlatList, Text, useWindowDimensions } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { spacing, fontFamilies } from '@orion/shared/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { tmdbFetch } from '@orion/shared/api';
import { TmdbMediaItem, TmdbPaginatedResponse } from '@orion/shared/types';
import { HeroBillboard } from '../../src/components/HeroBillboard';
import { MediaCard } from '../../src/components/MediaCard';
import { HomeContinueWatching } from '../../src/features/library/HomeContinueWatching';
import { useOrionTheme } from '../../src/context/ThemeContext';
import { getRailRenderBudget } from '../../src/services/listPerformance';
import { usePerformanceProfile } from '../../src/context/PerformanceContext';

// ── Desktop Replica Section Header ─────────────────────────────────────────
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

// ── Horizontal Media Row ───────────────────────────────────────────────────
function MediaRow({ items, onPress }: { items: TmdbMediaItem[]; onPress: (item: TmdbMediaItem) => void }) {
  const { width } = useWindowDimensions();
  const { resolvedProfile } = usePerformanceProfile();
  const renderBudget = getRailRenderBudget(width, 140 + spacing[4], resolvedProfile);
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

// ── Main Home Screen ───────────────────────────────────────────────────────
export default function HomeScreen() {
  const { theme } = useOrionTheme();
  const [trendingMovies, setTrendingMovies] = useState<TmdbMediaItem[]>([]);
  const [trendingTV, setTrendingTV] = useState<TmdbMediaItem[]>([]);
  const [kDramas, setKDramas] = useState<TmdbMediaItem[]>([]);
  const [topRated, setTopRated] = useState<TmdbMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function loadData() {
      try {
        const [moviesData, tvData, kDramaData, topMovies, topTV] = await Promise.all([
          tmdbFetch<TmdbPaginatedResponse>('/trending/movie/week'),
          tmdbFetch<TmdbPaginatedResponse>('/trending/tv/week'),
          tmdbFetch<TmdbPaginatedResponse>('/discover/tv?with_original_language=ko&with_genres=18&sort_by=popularity.desc&vote_count.gte=80&page=1'),
          tmdbFetch<TmdbPaginatedResponse>('/movie/top_rated?page=1'),
          tmdbFetch<TmdbPaginatedResponse>('/tv/top_rated?page=1'),
        ]);

        if (moviesData?.results) {
          setTrendingMovies(moviesData.results.slice(0, 20).map(i => ({ ...i, media_type: 'movie' as const })));
        }
        if (tvData?.results) {
          setTrendingTV(tvData.results.slice(0, 20).map(i => ({ ...i, media_type: 'tv' as const })));
        }
        if (kDramaData?.results) {
          setKDramas(kDramaData.results.filter(i => i.poster_path || i.backdrop_path).slice(0, 20).map(i => ({ ...i, media_type: 'tv' as const })));
        }

        // Interleave top rated movies and TV
        const topMovieItems = (topMovies?.results || []).slice(0, 8).map(i => ({ ...i, media_type: 'movie' as const }));
        const topTVItems = (topTV?.results || []).slice(0, 8).map(i => ({ ...i, media_type: 'tv' as const }));
        const merged: TmdbMediaItem[] = [];
        const maxLen = Math.max(topMovieItems.length, topTVItems.length);
        for (let i = 0; i < maxLen; i++) {
          if (topMovieItems[i]) merged.push(topMovieItems[i]);
          if (topTVItems[i]) merged.push(topTVItems[i]);
        }
        setTopRated(merged);
      } catch (error) {
        console.error('Failed to fetch home data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const navigateToMedia = (item: TmdbMediaItem) => {
    const type = item.media_type || (item.name ? 'tv' : 'movie');
    router.push(`/media/${item.id}?type=${type}`);
  };

  const navigateToPlayer = (item: TmdbMediaItem) => {
    const type = item.media_type || (item.name ? 'tv' : 'movie');
    const title = type === 'movie' ? item.title : item.name;
    const year = type === 'movie' ? item.release_date?.slice(0, 4) : item.first_air_date?.slice(0, 4);
    router.push({
      pathname: '/player/[id]',
      params: {
        id: item.id, type, title, year,
        seriesTitle: type === 'tv' ? title : undefined,
        posterPath: item.poster_path || undefined,
        backdropPath: item.backdrop_path || undefined,
      },
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  // Combine trending movies and TV for the Hero spotlight (interleaved, top 5)
  const spotlightItems: TmdbMediaItem[] = [];
  const maxSpotlight = Math.max(trendingMovies.length, trendingTV.length);
  for (let i = 0; i < maxSpotlight && spotlightItems.length < 5; i++) {
    if (trendingMovies[i] && spotlightItems.length < 5) spotlightItems.push(trendingMovies[i]);
    if (trendingTV[i] && spotlightItems.length < 5) spotlightItems.push(trendingTV[i]);
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Cinema Starlight Background */}
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
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* ── Swipeable Hero Billboard ── */}
        {spotlightItems.length > 0 && (
          <HeroBillboard
            items={spotlightItems}
            onPress={(item) => navigateToMedia(item)}
            onInfo={(item) => navigateToMedia(item)}
            onPlay={(item) => navigateToPlayer(item)}
          />
        )}

        <HomeContinueWatching />
        
        {/* ── Trending Movies Row ── */}
        {trendingMovies.length > 0 && (
          <View style={styles.section}>
            <SectionTitle title="Trending" highlight="Movies" />
            <MediaRow items={trendingMovies} onPress={navigateToMedia} />
          </View>
        )}

        {/* ── Trending TV Shows Row ── */}
        {trendingTV.length > 0 && (
          <View style={styles.section}>
            <SectionTitle title="Trending" highlight="TV Shows" />
            <MediaRow items={trendingTV} onPress={navigateToMedia} />
          </View>
        )}

        {/* ── K-Dramas Row ── */}
        {kDramas.length > 0 && (
          <View style={styles.section}>
            <SectionTitle title="K-Dramas" highlight="Spotlight" />
            <MediaRow items={kDramas} onPress={navigateToMedia} />
          </View>
        )}

        {/* ── Top Rated Row ── */}
        {topRated.length > 0 && (
          <View style={styles.section}>
            <SectionTitle title="Top Rated" highlight="Masterpieces" />
            <MediaRow items={topRated} onPress={navigateToMedia} />
          </View>
        )}
        
        {/* Bottom padding */}
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
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
