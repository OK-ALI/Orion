import { Animated, View, Text, StyleSheet, TextInput, FlatList, ActivityIndicator, ScrollView, Pressable } from 'react-native';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { spacing } from '@orion/shared/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { tmdbFetch } from '@orion/shared/api';
import { TmdbMediaItem, TmdbPaginatedResponse } from '@orion/shared/types';
import { MediaCard } from '../../components/MediaCard';
import { PersonCard } from '../../components/PersonCard';
import { MobilePageHeader } from '../../components/MobilePageHeader';
import { useOrionTheme } from '../../context/ThemeContext';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  DISCOVER_FEEDS,
  getDiscoverReleaseDateParams,
  getRegionQueryParams,
  MEDIA_FILTERS,
  MOVIE_GENRES,
  RATING_OPTIONS,
  REGION_PRESETS,
  RELEASE_WINDOW_OPTIONS,
  SORT_OPTIONS,
  SUBFILTER_PRESETS,
  TRENDING_WINDOW_OPTIONS,
  TV_GENRES,
  TYPE_FILTERS,
  YEAR_OPTIONS,
  type DiscoverFeedId,
} from './discoverCatalog';
import { createDiscoverStyles } from './discoverStyles';
import { useResponsiveLayout } from '../../services/responsive';
import { getGridRenderBudget, getRailRenderBudget } from '../../services/listPerformance';
import { usePerformanceProfile } from '../../context/PerformanceContext';
import { getDiscoverUnavailableCopy, useDiscoverRemoteGate } from './useDiscoverRemoteGate';
import { useDiscoverSearchResults } from './useDiscoverSearchResults';
import { useDiscoverRegionResults } from './useDiscoverRegionResults';
import { CinemaPortals } from './CinemaPortals';
import { DiscoverFilterModal } from './DiscoverFilterModal';
import { PROVIDER_HUBS, WORLD_HUBS, hubQueryParams, hubTitleSearch, hubTitleSearchMatches, inferWatchRegion, type ProviderCatalog, type SelectedHub } from './discoveryHubs';

export default function DiscoverScreen() {
  const { theme, preferences } = useOrionTheme();
  const { resolvedProfile } = usePerformanceProfile();
  const styles = useMemo(() => createDiscoverStyles(theme), [theme]);
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const searchArrival = useRef(new Animated.Value(1)).current;
  const params = useLocalSearchParams<{ focusSearch?: string; exploreIntent?: string; feed?: string; mediaType?: string; region?: string; subfilter?: string; sort?: string; label?: string; window?: string; genreId?: string }>();
  const [containerWidth, setContainerWidth] = useState(0);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [activeFeed, setActiveFeed] = useState<DiscoverFeedId>('browse');
  const [feedWindow, setFeedWindow] = useState('30');
  const router = useRouter();
  const [region, setRegion] = useState<string>('all');
  const [subfilter, setSubfilter] = useState<string>('all');
  const [genreType, setGenreType] = useState<'all' | 'movie' | 'tv'>('movie');
  const [selectedGenre, setSelectedGenre] = useState<{ id: number | 'all'; name: string } | null>(null);
  const [selectedHub, setSelectedHub] = useState<SelectedHub>(null);
  const [hubFilter, setHubFilter] = useState('all');
  const [watchRegion, setWatchRegion] = useState(inferWatchRegion);
  const [providerCatalog, setProviderCatalog] = useState<ProviderCatalog | null>(null);
  const [providerStatus, setProviderStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [genreResults, setGenreResults] = useState<TmdbMediaItem[]>([]);
  const [genreLoading, setGenreLoading] = useState(false);
  const [year, setYear] = useState('');
  const [minRating, setMinRating] = useState('0');
  const [sortBy, setSortBy] = useState('popularity.desc');
  const [activeModal, setActiveModal] = useState<'type' | 'region' | 'subfilter' | 'sort' | 'rating' | 'year' | 'window' | 'watchRegion' | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const { network, refreshKey, generationRef, remoteReadyRef } = useDiscoverRemoteGate();

  const { filteredSearchResults, loading, searchSucceeded } = useDiscoverSearchResults({
    query, activeFilter, refreshKey, generationRef, remoteReadyRef,
  });
  const { regionResults, regionLoading, regionSucceeded } = useDiscoverRegionResults({
    region, subfilter, genreType, refreshKey, generationRef, remoteReadyRef,
    enabled: region !== 'all' && !selectedGenre && !query.trim(),
  });
  const genreRequestRef = useRef(0);
  const genreRequestPendingRef = useRef(false);
  const genreViewKey = JSON.stringify([selectedGenre?.id, selectedHub?.kind, selectedHub?.id, hubFilter, watchRegion, providerCatalog?.region, providerStatus, activeFeed, feedWindow, genreType, region, subfilter, year, minRating, sortBy, refreshKey]);
  const [genreOutcome, setGenreOutcome] = useState<{ key: string; status: 'success' | 'error' } | null>(null);
  const { isPhone, isTablet, isLandscape } = useResponsiveLayout();
  const COLUMN_COUNT = isPhone
    ? (isLandscape ? 4 : containerWidth >= 390 ? 3 : 2)
    : containerWidth >= 900 ? 6 : isTablet ? 5 : 3;
  const padding = spacing[4] * 2;
  const gaps = spacing[3] * (COLUMN_COUNT - 1);
  const cardWidth = containerWidth > 0 ? (containerWidth - padding - gaps) / COLUMN_COUNT : 110;
  const cardHeight = cardWidth * 1.5;
  const GENRE_COLS = 2;
  const genreGaps = spacing[3] * (GENRE_COLS - 1);
  const genreCardWidth = containerWidth > 0 ? (containerWidth - padding - genreGaps) / GENRE_COLS : 160;
  const genres = genreType === 'tv' ? TV_GENRES : MOVIE_GENRES;
  const gridRenderBudget = useMemo(() => getGridRenderBudget(COLUMN_COUNT, resolvedProfile), [COLUMN_COUNT, resolvedProfile]);
  const regionRailRenderBudget = useMemo(
    () => getRailRenderBudget(containerWidth, 140 + spacing[4] + spacing[3], resolvedProfile),
    [containerWidth, resolvedProfile],
  );
  useEffect(() => {
    if (selectedHub?.kind !== 'provider' || !network.remoteReady || providerCatalog?.region === watchRegion) return;
    let active = true;
    const generation = generationRef.current;
    setProviderStatus('loading');
    Promise.all(['movie', 'tv'].map((kind) => tmdbFetch<{ results: ProviderCatalog['movie'] }>(`/watch/providers/${kind}?watch_region=${watchRegion}`)))
      .then(([movie, tv]) => {
        if (!active || generation !== generationRef.current || !remoteReadyRef.current) return;
        setProviderCatalog({ region: watchRegion, movie: movie.results || [], tv: tv.results || [] });
        setProviderStatus('ready');
      })
      .catch(() => { if (active && generation === generationRef.current) setProviderStatus('error'); });
    return () => { active = false; };
  }, [selectedHub?.kind, watchRegion, network.remoteReady, refreshKey, providerCatalog?.region, generationRef, remoteReadyRef]);

  const searchArrivalStyle = {
    opacity: searchArrival.interpolate({ inputRange: [0, 1], outputRange: [0.84, 1] }),
    transform: [{ scale: searchArrival.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) }],
  };

  useEffect(() => {
    const request = Number(params.focusSearch || 0);
    if (!Number.isFinite(request) || request <= 0) return;
    setSelectedGenre(null);
    setSelectedHub(null);
    setGenreResults([]);
    searchArrival.setValue(preferences.reducedMotion ? 1 : 0);
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      if (!preferences.reducedMotion) {
        Animated.timing(searchArrival, { toValue: 1, duration: 190, useNativeDriver: true }).start();
      }
      router.setParams({ focusSearch: '0' });
    });
  }, [params.focusSearch, preferences.reducedMotion, router, searchArrival]);

  useEffect(() => {
    const request = Number(params.exploreIntent || 0);
    if (!Number.isFinite(request) || request <= 0) return;
    const feed = DISCOVER_FEEDS.some((item) => item.id === params.feed) ? params.feed as DiscoverFeedId : 'browse';
    const mediaType = params.mediaType === 'movie' || params.mediaType === 'tv' || params.mediaType === 'all' ? params.mediaType : 'all';
    const nextRegion = params.region && REGION_PRESETS[params.region as keyof typeof REGION_PRESETS] ? params.region : 'all';
    setQuery(''); setActiveFeed(feed); setGenreType(mediaType); setRegion(nextRegion); setSubfilter(params.subfilter || 'all');
    setSelectedHub(null);
    setSortBy(params.sort || 'popularity.desc'); setFeedWindow(params.window || (feed === 'trending' ? 'week' : '30'));
    const requestedGenre = Number(params.genreId);
    setSelectedGenre({ id: Number.isFinite(requestedGenre) && requestedGenre > 0 ? requestedGenre : 'all', name: params.label || DISCOVER_FEEDS.find((item) => item.id === feed)?.name || 'Explore' });
    setGenreResults([]); setPage(1);
    router.setParams({ exploreIntent: '0', feed: '', mediaType: '', region: '', subfilter: '', sort: '', label: '', window: '', genreId: '' });
  }, [params.exploreIntent]);

  const fetchDiscoverResults = useCallback(async (pageNum: number = 1) => {
    if (!selectedGenre || (pageNum > 1 && genreRequestPendingRef.current)) return;

    if (!remoteReadyRef.current) {
      if (pageNum === 1) setGenreResults([]);
      setGenreLoading(false);
      setLoadingMore(false);
      return;
    }
    if (selectedHub?.kind === 'provider' && providerStatus === 'error') {
      genreRequestRef.current += 1;
      setGenreResults([]);
      setTotalPages(1);
      setGenreOutcome({ key: genreViewKey, status: 'error' });
      setGenreLoading(false);
      return;
    }
    if (selectedHub?.kind === 'provider' && (providerStatus === 'loading' || providerStatus === 'idle' || providerCatalog?.region !== watchRegion)) return;
    if (selectedHub?.kind === 'provider' && (genreType === 'all' ? ['movie', 'tv'] : [genreType]).every((kind) =>
      hubQueryParams(selectedHub, hubFilter, kind as 'movie' | 'tv', providerCatalog) === null)) {
      genreRequestRef.current += 1;
      setGenreResults([]);
      setPage(1);
      setTotalPages(1);
      setGenreOutcome({ key: genreViewKey, status: 'success' });
      setGenreLoading(false);
      return;
    }

    const generation = generationRef.current;
    const request = ++genreRequestRef.current;
    const isCurrent = () => request === genreRequestRef.current &&
      generation === generationRef.current && remoteReadyRef.current;
    genreRequestPendingRef.current = true;
    if (pageNum === 1) {
      setGenreOutcome(null);
      setGenreResults([]);
      setPage(1);
      setTotalPages(1);
      setLoadingMore(false);
      setGenreLoading(true);
    } else {
      setLoadingMore(true);
    }
    try {
      const { countryParam, languageParam } = getRegionQueryParams(region, subfilter);
      const requestTypes = genreType === 'all' ? ['movie', 'tv'] : [genreType];
      const responses = await Promise.all(requestTypes.map((mediaType) => {
        if (activeFeed === 'trending') return tmdbFetch<TmdbPaginatedResponse>(`/trending/${mediaType}/${feedWindow === 'day' ? 'day' : 'week'}?page=${pageNum}`);
        if (activeFeed === 'top-rated') return tmdbFetch<TmdbPaginatedResponse>(`/${mediaType}/top_rated?page=${pageNum}`);
        const titleSearch = hubTitleSearch(selectedHub, hubFilter, mediaType as 'movie' | 'tv');
        if (titleSearch) {
          const searchYear = year ? mediaType === 'movie' ? `&year=${year}` : `&first_air_date_year=${year}` : '';
          return tmdbFetch<TmdbPaginatedResponse>(`/search/${mediaType}?query=${encodeURIComponent(titleSearch)}${searchYear}&page=${pageNum}`);
        }
        const yearParam = activeFeed === 'browse' && year ? (mediaType === 'movie' ? `&primary_release_year=${year}` : `&first_air_date_year=${year}`) : '';
        const ratingParam = minRating !== '0' ? `&vote_average.gte=${minRating}` : '';
        const genreParam = !selectedHub && selectedGenre.id && (selectedGenre.id as any) !== 'all' ? `&with_genres=${selectedGenre.id}` : '';
        const hubParam = hubQueryParams(selectedHub, hubFilter, mediaType as 'movie' | 'tv', providerCatalog);
        if (hubParam === null) return Promise.resolve({ page: pageNum, results: [], total_pages: 1, total_results: 0 } as TmdbPaginatedResponse);
        const mediaSort = sortBy === 'primary_release_date.desc' && mediaType === 'tv' ? 'first_air_date.desc' : sortBy;
        const dateParam = getDiscoverReleaseDateParams(activeFeed, mediaType as 'movie' | 'tv', feedWindow);
        const voteCountParam = activeFeed === 'upcoming'
          ? ''
          : activeFeed === 'new-releases'
            ? `&vote_count.gte=${mediaType === 'tv' ? 10 : 20}`
            : '&vote_count.gte=20';
        return tmdbFetch<TmdbPaginatedResponse>(`/discover/${mediaType}?sort_by=${mediaSort}${genreParam}${hubParam}${countryParam}${languageParam}${yearParam}${ratingParam}${dateParam}${voteCountParam}&page=${pageNum}`);
      }));
      if (!isCurrent()) return;

      const seen = new Set();
      const taggedResponses = responses.map((data, index) =>
        (data.results || [])
          .filter((item) => !hubTitleSearch(selectedHub, hubFilter, requestTypes[index] as 'movie' | 'tv') ||
            (hubTitleSearchMatches(selectedHub, hubFilter, requestTypes[index] as 'movie' | 'tv', item) && (item.vote_count || 0) >= 20 && (item.vote_average || 0) >= Number(minRating)))
          .map((item) => ({ ...item, media_type: requestTypes[index] })),
      );
      const sourceItems = activeFeed === 'top-rated' && taggedResponses.length > 1
        ? Array.from({ length: Math.max(...taggedResponses.map((items) => items.length)) }, (_, index) =>
            taggedResponses.flatMap((items) => items[index] ? [items[index]] : []),
          ).flat()
        : taggedResponses.flat().sort((a, b) => {
            if (activeFeed === 'top-rated') return 0;
            if (sortBy === 'vote_average.desc') return (b.vote_average || 0) - (a.vote_average || 0);
            if (sortBy === 'primary_release_date.desc') {
              return String(b.release_date || b.first_air_date || '').localeCompare(String(a.release_date || a.first_air_date || ''));
            }
            return (b.popularity || 0) - (a.popularity || 0);
          });
      const merged = sourceItems
        .filter((item) => item.poster_path)
        .filter((item) => {
          const key = `${item.media_type}_${item.id}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      const maxTotalPages = Math.max(...responses.map((data) => data.total_pages || 1));
      setGenreOutcome({ key: genreViewKey, status: 'success' });
      setTotalPages(maxTotalPages);
      setPage(pageNum);
      if (pageNum === 1) {
        setGenreResults(merged as any);
      } else {
        setGenreResults((prev: any) => {
          const existingKeys = new Set(
            prev.map((item: any) => `${item.media_type}_${item.id}`)
          );
          const additions = merged.filter((item) => {
            const key = `${item.media_type}_${item.id}`;
            if (existingKeys.has(key)) return false;
            existingKeys.add(key);
            return true;
          });
          const combined = [...prev, ...additions] as any[];
          if (hubTitleSearch(selectedHub, hubFilter, 'movie') || hubTitleSearch(selectedHub, hubFilter, 'tv')) {
            combined.sort((a, b) => sortBy === 'vote_average.desc'
              ? (b.vote_average || 0) - (a.vote_average || 0)
              : sortBy === 'primary_release_date.desc'
                ? String(b.release_date || b.first_air_date || '').localeCompare(String(a.release_date || a.first_air_date || ''))
                : (b.popularity || 0) - (a.popularity || 0));
          }
          return combined as any;
        });
      }
    } catch (err) {
      if (isCurrent()) {
        console.error('Discover fetch failed:', err);
        if (pageNum === 1) setGenreOutcome({ key: genreViewKey, status: 'error' });
      }
    } finally {
      if (isCurrent()) {
        genreRequestPendingRef.current = false;
        setGenreLoading(false);
        setLoadingMore(false);
      }
    }
  }, [selectedGenre, selectedHub, hubFilter, providerCatalog, providerStatus, watchRegion, activeFeed, feedWindow, genreType, region, subfilter, year, minRating, sortBy, genreViewKey, generationRef, remoteReadyRef]);
  useEffect(() => {
    if (selectedGenre) void fetchDiscoverResults(1);
    return () => {
      genreRequestRef.current += 1;
      genreRequestPendingRef.current = false;
    };
  }, [selectedGenre, fetchDiscoverResults]);

  const handlePress = useCallback((item: any) => {
    if (item?.media_type === 'person') {
      router.push(`/person/${item.id}`);
    } else {
      const type = item.media_type || (item.name ? 'tv' : 'movie');
      router.push(`/media/${item.id}?type=${type}`);
    }
  }, [router]);
  const handleLoadMore = () => {
    if (
      page < totalPages &&
      !genreLoading &&
      !loadingMore &&
      remoteReadyRef.current &&
      genreOutcome?.key === genreViewKey &&
      genreOutcome.status === 'success'
    ) {
      fetchDiscoverResults(page + 1);
    }
  };
  const isSearching = query.trim().length > 0;
  const activeRegionName = REGION_PRESETS[region as keyof typeof REGION_PRESETS]?.name;
  const activeWorld = selectedHub?.kind === 'world' ? WORLD_HUBS.find((world) => world.id === selectedHub.id) : null;
  const providerUnavailable = selectedHub?.kind === 'provider' && providerCatalog?.region === watchRegion &&
    (genreType === 'all' ? ['movie', 'tv'] : [genreType]).every((kind) =>
      hubQueryParams(selectedHub, hubFilter, kind as 'movie' | 'tv', providerCatalog) === null);
  const selectHub = (hub: NonNullable<SelectedHub>) => {
    const item = hub.kind === 'world' ? WORLD_HUBS.find((world) => world.id === hub.id) : undefined;
    setQuery('');
    setActiveFeed('browse');
    setSelectedHub(hub);
    setHubFilter(item?.filters[0]?.id || 'all');
    if (hub.kind === 'world' && hub.id === 'starwars') setGenreType('movie');
    setSelectedGenre({ id: 'all', name: item?.name || PROVIDER_HUBS.find((provider) => provider.id === hub.id)?.name || hub.id });
  };
  const modalOptions = activeModal === 'type' ? TYPE_FILTERS.map((item) => ({ id: item.id, label: item.name }))
    : activeModal === 'region' ? Object.entries(REGION_PRESETS).map(([id, item]) => ({ id, label: item.name }))
    : activeModal === 'subfilter' ? (SUBFILTER_PRESETS[region as keyof typeof SUBFILTER_PRESETS] || []).map((item) => ({ id: item.id, label: item.name }))
    : activeModal === 'sort' ? SORT_OPTIONS.map((item) => ({ id: item.id, label: item.label }))
    : activeModal === 'rating' ? RATING_OPTIONS.map((item) => ({ id: item.id, label: item.label }))
    : activeModal === 'year' ? YEAR_OPTIONS.map((item) => ({ id: item, label: item || 'Year: All' }))
    : activeModal === 'window' ? (activeFeed === 'trending' ? TRENDING_WINDOW_OPTIONS : RELEASE_WINDOW_OPTIONS).map((item) => ({ id: item.id, label: item.label }))
    : activeModal === 'watchRegion' ? [...new Set([watchRegion, 'US', 'GB', 'PK', 'IN', 'CA', 'AU', 'DE', 'FR', 'JP', 'KR', 'AE'])].map((id) => ({ id, label: id }))
    : [];
  const modalTitle = activeModal === 'type' ? 'Filter Media Type'
    : activeModal === 'region' ? 'Filter Region'
    : activeModal === 'subfilter' ? 'Filter Sub-Region'
    : activeModal === 'sort' ? 'Sort Titles By'
    : activeModal === 'rating' ? 'Minimum TMDB Rating'
    : activeModal === 'year' ? 'Release Year'
    : activeModal === 'window' ? activeFeed === 'trending' ? 'Trending period' : activeFeed === 'upcoming' ? 'Arriving within' : 'Released within'
    : 'Streaming Realm region';
  const modalSelected = activeModal === 'type' ? genreType : activeModal === 'region' ? region
    : activeModal === 'subfilter' ? subfilter : activeModal === 'sort' ? sortBy
    : activeModal === 'rating' ? minRating : activeModal === 'year' ? year
    : activeModal === 'window' ? feedWindow : watchRegion;
  const selectModalOption = (value: string) => {
    if (activeModal === 'type') setGenreType(value as typeof genreType);
    else if (activeModal === 'region') { setRegion(value); setSubfilter('all'); }
    else if (activeModal === 'subfilter') setSubfilter(value);
    else if (activeModal === 'sort') setSortBy(value);
    else if (activeModal === 'rating') setMinRating(value);
    else if (activeModal === 'year') setYear(value);
    else if (activeModal === 'window') setFeedWindow(value);
    else if (activeModal === 'watchRegion') setWatchRegion(value);
  };
  return (
    <View style={styles.container} onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
      <LinearGradient
        colors={[theme.accentSoft, theme.background, theme.background, theme.background, theme.surface]}
        locations={[0, 0.3, 0.5, 0.8, 1]}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <MobilePageHeader
        eyebrow="EXPLORE"
        title="Discover"
        subtitle="Search, filter and explore every corner of Orion."
        reserveFloatingTriggerInLandscape
      />
      <Animated.View
        style={[
          styles.searchContainer,
          searchFocused && styles.searchContainerFocused,
          searchFocused && { borderColor: theme.accent, shadowColor: theme.accent },
          searchArrivalStyle,
        ]}
      >
        <View accessible={false} importantForAccessibility="no">
          <Ionicons name="search" size={20} color={searchFocused ? theme.accent : theme.textMuted} style={styles.searchIcon} />
        </View>
        <TextInput
          ref={searchInputRef}
          accessibilityLabel="Search Orion"
          accessibilityHint="Search movies, shows, or people"
          style={styles.searchInput}
          placeholder="Search movies, shows, or actors..."
          placeholderTextColor={theme.textMuted}
          value={query}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          onChangeText={(t) => { setQuery(t); if (t.trim()) { setSelectedGenre(null); setSelectedHub(null); } }}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={4}
            style={styles.clearButton}
            onPress={() => { setQuery(''); searchInputRef.current?.focus(); }}
          >
            <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
          </Pressable>
        )}
      </Animated.View>
      {isSearching ? (
        /* ── Search Results Mode ── */
        <>
          <View style={styles.filterContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
              {MEDIA_FILTERS.map((filter) => (
                <Pressable
                  key={filter.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter search results by ${filter.name}`}
                  accessibilityState={{ selected: activeFilter === filter.id }}
                  style={[styles.filterPill, activeFilter === filter.id && styles.filterPillActive]}
                  onPress={() => setActiveFilter(filter.id)}
                >
                  <Text style={[styles.filterPillText, activeFilter === filter.id && styles.filterPillTextActive]}>
                    {filter.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={theme.accent} />
            </View>
          ) : (
            containerWidth > 0 && (
              <FlatList
                key={`search-${COLUMN_COUNT}`}
                data={filteredSearchResults}
                initialNumToRender={gridRenderBudget.initialNumToRender}
                maxToRenderPerBatch={gridRenderBudget.maxToRenderPerBatch}
                windowSize={gridRenderBudget.windowSize}
                keyExtractor={(item) => item.id.toString()}
                numColumns={COLUMN_COUNT}
                contentContainerStyle={styles.gridContainer}
                columnWrapperStyle={styles.row}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  if ((item as any).media_type === 'person') {
                    return (
                      <PersonCard 
                        item={item} 
                        width={cardWidth} 
                        height={cardHeight} 
                        style={{ marginRight: 0 }}
                        onPress={() => handlePress(item)} 
                      />
                    );
                  }
                  return (
                    <MediaCard 
                      item={item} 
                      width={cardWidth} 
                      height={cardHeight} 
                      style={{ marginRight: 0 }}
                      onPress={() => handlePress(item)} 
                    />
                  );
                }}
                ListEmptyComponent={
                  query.trim() ? (
                    <View style={styles.centered}>
                      <Text style={styles.emptyText}>
                        {network.remoteReady
                          ? (searchSucceeded ? `No results found for "${query}"` : 'Cinema results could not be loaded. Please try again.')
                          : getDiscoverUnavailableCopy(network.productState)}
                      </Text>
                    </View>
                  ) : null
                }
                ListFooterComponent={<View style={{ height: 120 }} />}
              />
            )
          )}
        </>
      ) : selectedGenre ? (
        /* ── Genre & Explore All Results Mode ── */
        <>
          <View style={styles.genreHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={selectedHub ? 'Back to Discover' : activeFeed === 'browse' ? 'Back to genres' : 'Back to Discover'}
              style={({ pressed }) => [styles.backPill, pressed && { opacity: 0.7 }]}
              onPress={() => { setSelectedGenre(null); setSelectedHub(null); setGenreResults([]); setPage(1); if (activeFeed !== 'browse') setActiveFeed('browse'); }}
            >
              <Ionicons name="chevron-back" size={18} color={theme.text} />
              <Text style={styles.backPillText}>{selectedHub ? 'Discover' : activeFeed === 'browse' ? 'Genres' : 'Discover'}</Text>
            </Pressable>
            <Text style={styles.genreActiveLabel} numberOfLines={1}>
              {selectedGenre.name}
            </Text>
          </View>
          {activeWorld && (
            <View style={styles.worldFacetRail}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                {activeWorld.filters.map((facet) => (
                  <Pressable key={facet.id} accessibilityRole="button" accessibilityLabel={`Filter ${facet.name}`}
                    accessibilityState={{ selected: hubFilter === facet.id }}
                    onPress={() => {
                      setHubFilter(facet.id);
                      if (activeWorld.id === 'starwars') {
                        if (facet.id === 'movies') setGenreType('movie');
                        if (facet.id === 'series') setGenreType('tv');
                        if (facet.id === 'animation') setGenreType('all');
                      }
                    }}
                    style={[styles.filterPill, hubFilter === facet.id && styles.filterPillActive]}>
                    <Text numberOfLines={1} style={[styles.filterPillText, hubFilter === facet.id && styles.filterPillTextActive]}>{facet.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
          <View style={styles.filterControlsBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
              {selectedHub?.kind === 'provider' && (
                <Pressable accessibilityRole="button" accessibilityLabel={`Streaming Realm region, ${watchRegion}`}
                  style={[styles.dropdownPill, styles.dropdownPillActive]} onPress={() => setActiveModal('watchRegion')}>
                  <Text style={[styles.dropdownPillText, styles.dropdownPillTextActive]}>Availability: {watchRegion}</Text>
                  <Ionicons name="chevron-down" size={14} color={theme.onAccent} />
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Media type filter, ${TYPE_FILTERS.find(t => t.id === genreType)?.name}`}
                style={[styles.dropdownPill, genreType !== 'all' && styles.dropdownPillActive]}
                onPress={() => setActiveModal('type')}
              >
                <Text style={[styles.dropdownPillText, genreType !== 'all' && styles.dropdownPillTextActive]}>
                  Type: {TYPE_FILTERS.find(t => t.id === genreType)?.name.replace(' Only', '')}
                </Text>
                <Ionicons name="chevron-down" size={14} color={genreType !== 'all' ? theme.onAccent : theme.textSecondary} />
              </Pressable>
              {activeFeed !== 'trending' && activeFeed !== 'top-rated' && (<>
                <Pressable accessibilityRole="button" accessibilityLabel={`Region filter, ${REGION_PRESETS[region as keyof typeof REGION_PRESETS]?.name}`} style={[styles.dropdownPill, region !== 'all' && styles.dropdownPillActive]} onPress={() => setActiveModal('region')}>
                  <Text style={[styles.dropdownPillText, region !== 'all' && styles.dropdownPillTextActive]}>Region: {REGION_PRESETS[region as keyof typeof REGION_PRESETS]?.name}</Text>
                  <Ionicons name="chevron-down" size={14} color={region !== 'all' ? theme.onAccent : theme.textSecondary} />
                </Pressable>
                {region !== 'all' && SUBFILTER_PRESETS[region as keyof typeof SUBFILTER_PRESETS] && (
                  <Pressable accessibilityRole="button" accessibilityLabel="Sub-region filter" style={[styles.dropdownPill, subfilter !== 'all' && styles.dropdownPillActive]} onPress={() => setActiveModal('subfilter')}>
                    <Text style={[styles.dropdownPillText, subfilter !== 'all' && styles.dropdownPillTextActive]}>Sub: {SUBFILTER_PRESETS[region as keyof typeof SUBFILTER_PRESETS].find(s => s.id === subfilter)?.name}</Text>
                    <Ionicons name="chevron-down" size={14} color={subfilter !== 'all' ? theme.onAccent : theme.textSecondary} />
                  </Pressable>
                )}
                <Pressable accessibilityRole="button" accessibilityLabel={`Sort titles by ${SORT_OPTIONS.find(s => s.id === sortBy)?.label}`} style={[styles.dropdownPill, sortBy !== 'popularity.desc' && styles.dropdownPillActive]} onPress={() => setActiveModal('sort')}>
                  <Text style={[styles.dropdownPillText, sortBy !== 'popularity.desc' && styles.dropdownPillTextActive]}>Sort: {SORT_OPTIONS.find(s => s.id === sortBy)?.label}</Text>
                  <Ionicons name="chevron-down" size={14} color={sortBy !== 'popularity.desc' ? theme.onAccent : theme.textSecondary} />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={minRating === '0' ? 'Minimum rating, any' : `Minimum rating, ${minRating} and above`} style={[styles.dropdownPill, minRating !== '0' && styles.dropdownPillActive]} onPress={() => setActiveModal('rating')}>
                  <Text style={[styles.dropdownPillText, minRating !== '0' && styles.dropdownPillTextActive]}>{minRating === '0' ? 'Rating: Any' : `★ ${minRating}.0+`}</Text>
                  <Ionicons name="chevron-down" size={14} color={minRating !== '0' ? theme.onAccent : theme.textSecondary} />
                </Pressable>
              </>)}
              {activeFeed === 'browse' ? (
                <Pressable accessibilityRole="button" accessibilityLabel={year ? `Release year, ${year}` : 'Release year, all'} style={[styles.dropdownPill, year !== '' && styles.dropdownPillActive]} onPress={() => setActiveModal('year')}>
                  <Text style={[styles.dropdownPillText, year !== '' && styles.dropdownPillTextActive]}>{year ? `Year: ${year}` : 'Year: All'}</Text>
                  <Ionicons name="chevron-down" size={14} color={year !== '' ? theme.onAccent : theme.textSecondary} />
                </Pressable>
              ) : activeFeed !== 'top-rated' ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Time window filter" style={[styles.dropdownPill, styles.dropdownPillActive]} onPress={() => setActiveModal('window')}>
                  <Text style={[styles.dropdownPillText, styles.dropdownPillTextActive]}>
                    {activeFeed === 'trending' ? TRENDING_WINDOW_OPTIONS.find(item => item.id === feedWindow)?.label : `${RELEASE_WINDOW_OPTIONS.find(item => item.id === feedWindow)?.label || '30 Days'}`}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color={theme.onAccent} />
                </Pressable>
              ) : null}
            </ScrollView>
          </View>
          {network.remoteReady && (genreLoading || genreOutcome?.key !== genreViewKey) ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={theme.accent} />
            </View>
          ) : (
            containerWidth > 0 && (
              <FlatList
                key={`genre-${COLUMN_COUNT}`}
                data={network.remoteReady ? genreResults : []}
                initialNumToRender={gridRenderBudget.initialNumToRender}
                maxToRenderPerBatch={gridRenderBudget.maxToRenderPerBatch}
                windowSize={gridRenderBudget.windowSize}
                keyExtractor={(item, idx) => `${item.id}_${item.media_type}_${idx}`}
                numColumns={COLUMN_COUNT}
                contentContainerStyle={styles.gridContainer}
                columnWrapperStyle={styles.row}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <MediaCard 
                    item={item} 
                    width={cardWidth} 
                    height={cardHeight} 
                    style={{ marginRight: 0 }}
                    onPress={() => handlePress(item)} 
                  />
                )}
                ListEmptyComponent={
                  <View style={styles.centered}>
                    <Text style={styles.emptyText}>
                      {network.remoteReady
                        ? (genreOutcome?.status === 'success'
                          ? providerUnavailable ? `This Streaming Realm is not listed in ${watchRegion} for the selected media type.` : 'No titles match the selected filters.'
                          : 'Cinema results could not be loaded. Please try again.')
                        : getDiscoverUnavailableCopy(network.productState)}
                    </Text>
                  </View>
                }
                ListFooterComponent={
                  <View style={styles.loadMoreFooter}>
                    {page < totalPages && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Load more titles"
                        style={({ pressed }) => [styles.loadMoreButton, pressed && { opacity: 0.8 }]}
                        onPress={handleLoadMore}
                        disabled={loadingMore || !network.remoteReady}
                      >
                        {loadingMore ? (
                          <ActivityIndicator size="small" color={theme.onAccent} />
                        ) : (
                          <Text style={styles.loadMoreButtonText}>Load More</Text>
                        )}
                      </Pressable>
                    )}
                    <View style={{ height: 120 }} />
                  </View>
                }
              />
            )
          )}
        </>
      ) : (
        /* ── Genre Grid Browse Mode ── */
        <ScrollView showsVerticalScrollIndicator={false}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeToggleScroller} contentContainerStyle={styles.typeToggleScroll}>
            {DISCOVER_FEEDS.map((feed) => (
              <Pressable key={feed.id} accessibilityRole="button" accessibilityState={{ selected: activeFeed === feed.id }}
                style={[styles.typePill, activeFeed === feed.id && styles.typePillActive]}
                onPress={() => {
                  if (feed.id === 'browse') { setActiveFeed('browse'); setSelectedGenre(null); setSelectedHub(null); return; }
                  setActiveFeed(feed.id); setFeedWindow(feed.id === 'trending' ? 'week' : '30'); setGenreType('all'); setRegion('all'); setSubfilter('all'); setSortBy('popularity.desc');
                  setSelectedHub(null);
                  setSelectedGenre({ id: 'all', name: feed.name }); setGenreResults([]); setPage(1);
                }}
              >
                <Text style={[styles.typePillText, activeFeed === feed.id && styles.typePillTextActive]}>{feed.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeToggleScroller} contentContainerStyle={styles.typeToggleScroll}>
            {TYPE_FILTERS.map((f) => (
              <Pressable
                key={f.id}
                accessibilityRole="button"
                accessibilityLabel={`Browse ${f.name}`}
                accessibilityState={{ selected: genreType === f.id }}
                style={[styles.typePill, genreType === f.id && styles.typePillActive]}
                onPress={() => setGenreType(f.id as any)}
              >
                <Text style={[styles.typePillText, genreType === f.id && styles.typePillTextActive]}>
                  {f.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.regionSelectorContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
              {Object.entries(REGION_PRESETS).map(([id, preset]) => (
                <Pressable
                  key={id}
                  accessibilityRole="button"
                  accessibilityLabel={`Region ${preset.name}`}
                  accessibilityState={{ selected: region === id }}
                  style={[styles.regionPill, region === id && styles.regionPillActive]}
                  onPress={() => { setRegion(id); setSubfilter('all'); }}
                >
                  <Text style={[styles.regionPillText, region === id && styles.regionPillTextActive]}>
                    {preset.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          {region !== 'all' && SUBFILTER_PRESETS[region as keyof typeof SUBFILTER_PRESETS] && (
            <View style={styles.subfilterContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subfilterScroll}>
                {SUBFILTER_PRESETS[region as keyof typeof SUBFILTER_PRESETS].map((sf) => (
                  <Pressable
                    key={sf.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Sub-region ${sf.name}`}
                    accessibilityState={{ selected: subfilter === sf.id }}
                    style={[styles.subfilterPill, subfilter === sf.id && styles.subfilterPillActive]}
                    onPress={() => setSubfilter(sf.id)}
                  >
                    <Text style={[styles.subfilterPillText, subfilter === sf.id && styles.subfilterPillTextActive]}>
                      {sf.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
          <CinemaPortals theme={theme} width={containerWidth} onSelect={selectHub} />
          {region !== 'all' && (
            <View style={styles.regionShelf}>
              <View style={styles.regionShelfHeader}>
                <Text style={styles.regionShelfTitle}>
                  Popular in <Text style={{ color: theme.accent }}>{activeRegionName}</Text>
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Explore all titles in ${activeRegionName}`}
                  style={({ pressed }) => [styles.browseAllBtn, pressed && { opacity: 0.7 }]}
                  onPress={() => { setSelectedHub(null); setSelectedGenre({ id: 'all' as any, name: 'All ' + activeRegionName }); }}
                >
                  <Text style={styles.browseAllBtnText}>Explore All</Text>
                  <Ionicons name="chevron-forward" size={14} color={theme.accent} />
                </Pressable>
              </View>
              {regionLoading ? (
                <ActivityIndicator size="small" color={theme.accent} style={{ marginVertical: 30 }} />
              ) : (
                <FlatList
                  data={regionResults}
                  horizontal
                  initialNumToRender={regionRailRenderBudget.initialNumToRender}
                  maxToRenderPerBatch={regionRailRenderBudget.maxToRenderPerBatch}
                  windowSize={regionRailRenderBudget.windowSize}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: spacing[3], paddingHorizontal: spacing[4] }}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={({ item }) => (
                    <MediaCard item={item} onPress={() => handlePress(item)} />
                  )}
                  ListEmptyComponent={
                    <Text style={styles.emptyRegionText}>
                      {network.remoteReady
                        ? (regionSucceeded ? 'No trending titles for this region.' : 'Cinema results could not be loaded. Please try again.')
                        : getDiscoverUnavailableCopy(network.productState)}
                    </Text>
                  }
                />
              )}
            </View>
          )}
          <Text style={styles.browseTitle}>Browse by Genre</Text>
          <View style={styles.genreGrid}>
            {genres.map((genre) => (
              <Pressable
                key={genre.id}
                accessibilityRole="button"
                accessibilityLabel={`Browse ${genre.name}`}
                style={({ pressed }) => [{ width: genreCardWidth }, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]}
                onPress={() => { setSelectedHub(null); setSelectedGenre(genre); }}
              >
                <LinearGradient
                  colors={genre.colors as [string, string]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.genreCard, { borderColor: `${genre.accent}45` }]}
                >
                  <View style={styles.genreCardInner}>
                    <View style={[styles.genreIconBadge, { backgroundColor: `${genre.accent}20`, borderColor: `${genre.accent}50` }]}>
                      <Ionicons name={(genre as any).icon || 'film-outline'} size={18} color={genre.accent} />
                    </View>
                    <Text style={styles.genreCardText} numberOfLines={1}>{genre.name}</Text>
                  </View>
                </LinearGradient>
              </Pressable>
            ))}
          </View>
          <View style={{ height: 120 }} />
        </ScrollView>
      )}
      <DiscoverFilterModal theme={theme} visible={!!activeModal} title={modalTitle}
        options={modalOptions} selected={modalSelected} onSelect={selectModalOption}
        onClose={() => setActiveModal(null)} />
    </View>
  );
}
