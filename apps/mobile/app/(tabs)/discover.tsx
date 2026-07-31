import { View, Text, StyleSheet, TextInput, FlatList, ActivityIndicator, Platform, ScrollView, Pressable, Modal } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { text, backgrounds, radii, spacing, fontSizes, fontFamilies, accent } from '@orion/shared/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { fetchSearch, isAnimeContent, tmdbFetch } from '@orion/shared/api';
import { TmdbMediaItem, TmdbPaginatedResponse } from '@orion/shared/types';
import { MediaCard } from '../../src/components/MediaCard';
import { PersonCard } from '../../src/components/PersonCard';
import { useRouter } from 'expo-router';

// ── Region Presets (mirrored from Desktop discoverRegions.js) ──────────────
const REGION_PRESETS = {
  all: { name: 'Global', countries: '' },
  hollywood: { name: 'Hollywood', countries: 'US|GB|CA|AU|IE|NZ' },
  bollywood: { name: 'Bollywood', countries: 'IN' },
  asian: { name: 'Asian Content', countries: 'KR|JP|CN|TW|HK|TH' },
};

const SUBFILTER_PRESETS = {
  hollywood: [
    { id: 'all', name: 'All Western', countries: 'US|GB|CA|AU|IE|NZ' },
    { id: 'us', name: 'United States', countries: 'US' },
    { id: 'gb', name: 'United Kingdom', countries: 'GB' },
    { id: 'ca', name: 'Canada', countries: 'CA' },
    { id: 'au', name: 'Australia', countries: 'AU' },
  ],
  bollywood: [
    { id: 'all', name: 'All Indian', countries: 'IN' },
    { id: 'hi', name: 'Hindi / Bollywood', countries: 'IN', language: 'hi' },
    { id: 'ta', name: 'Tamil / Kollywood', countries: 'IN', language: 'ta' },
    { id: 'te', name: 'Telugu / Tollywood', countries: 'IN', language: 'te' },
    { id: 'ml', name: 'Malayalam', countries: 'IN', language: 'ml' },
  ],
  asian: [
    { id: 'all', name: 'All Asian', countries: 'KR|JP|CN|TW|HK|TH' },
    { id: 'kr', name: 'K-Content', countries: 'KR' },
    { id: 'jp', name: 'J-Content', countries: 'JP' },
    { id: 'cn', name: 'C-Content', countries: 'CN' },
    { id: 'tw_hk', name: 'HK & Taiwan', countries: 'TW|HK' },
    { id: 'th', name: 'Thai Content', countries: 'TH' },
  ],
};

function getRegionQueryParams(region: string, subfilter: string) {
  if (!region || region === 'all') {
    return { countryParam: '', languageParam: '' };
  }
  const presets = SUBFILTER_PRESETS[region as keyof typeof SUBFILTER_PRESETS] || [];
  const activeSub = presets.find((sf) => sf.id === subfilter) || presets[0];

  if (activeSub) {
    const countries = activeSub.countries || '';
    const language = (activeSub as any).language || '';
    const countryParam = countries ? `&with_origin_country=${countries}` : '';
    const languageParam = language ? `&with_original_language=${language}` : '';
    return { countryParam, languageParam };
  }

  const regPreset = REGION_PRESETS[region as keyof typeof REGION_PRESETS];
  const countries = regPreset?.countries || '';
  const countryParam = countries ? `&with_origin_country=${countries}` : '';
  return { countryParam, languageParam: '' };
}

// ── Genre Data (Refined Dark Glassmorphism with Vector Icons) ──────────────
const MOVIE_GENRES = [
  { id: 28, name: 'Action', icon: 'flash-outline', accent: '#ef4444', colors: ['rgba(239, 68, 68, 0.25)', 'rgba(125, 0, 8, 0.4)'] },
  { id: 12, name: 'Adventure', icon: 'compass-outline', accent: '#f97316', colors: ['rgba(249, 115, 22, 0.25)', 'rgba(139, 69, 0, 0.4)'] },
  { id: 16, name: 'Animation', icon: 'sparkles-outline', accent: '#06b6d4', colors: ['rgba(6, 182, 212, 0.25)', 'rgba(0, 139, 139, 0.4)'] },
  { id: 35, name: 'Comedy', icon: 'happy-outline', accent: '#ec4899', colors: ['rgba(236, 72, 153, 0.25)', 'rgba(199, 21, 133, 0.4)'] },
  { id: 80, name: 'Crime', icon: 'finger-print-outline', accent: '#a855f7', colors: ['rgba(168, 85, 247, 0.25)', 'rgba(49, 0, 98, 0.4)'] },
  { id: 99, name: 'Documentary', icon: 'film-outline', accent: '#10b981', colors: ['rgba(16, 185, 129, 0.25)', 'rgba(30, 94, 58, 0.4)'] },
  { id: 18, name: 'Drama', icon: 'heart-dislike-outline', accent: '#3b82f6', colors: ['rgba(59, 130, 246, 0.25)', 'rgba(32, 78, 122, 0.4)'] },
  { id: 10751, name: 'Family', icon: 'people-outline', accent: '#f472b6', colors: ['rgba(244, 114, 182, 0.25)', 'rgba(219, 112, 147, 0.4)'] },
  { id: 14, name: 'Fantasy', icon: 'planet-outline', accent: '#8b5cf6', colors: ['rgba(139, 92, 246, 0.25)', 'rgba(102, 51, 153, 0.4)'] },
  { id: 36, name: 'History', icon: 'library-outline', accent: '#d97706', colors: ['rgba(217, 119, 6, 0.25)', 'rgba(92, 45, 12, 0.4)'] },
  { id: 27, name: 'Horror', icon: 'skull-outline', accent: '#f43f5e', colors: ['rgba(244, 63, 94, 0.25)', 'rgba(15, 15, 15, 0.5)'] },
  { id: 9648, name: 'Mystery', icon: 'eye-outline', accent: '#64748b', colors: ['rgba(100, 116, 139, 0.25)', 'rgba(71, 80, 88, 0.4)'] },
  { id: 10749, name: 'Romance', icon: 'heart-outline', accent: '#fb7185', colors: ['rgba(251, 113, 133, 0.25)', 'rgba(178, 34, 34, 0.4)'] },
  { id: 878, name: 'Sci-Fi', icon: 'rocket-outline', accent: '#38bdf8', colors: ['rgba(56, 189, 248, 0.25)', 'rgba(0, 0, 139, 0.4)'] },
  { id: 53, name: 'Thriller', icon: 'flame-outline', accent: '#ef4444', colors: ['rgba(239, 68, 68, 0.25)', 'rgba(194, 28, 44, 0.4)'] },
  { id: 10752, name: 'War', icon: 'shield-outline', accent: '#84cc16', colors: ['rgba(132, 204, 22, 0.25)', 'rgba(85, 107, 47, 0.4)'] },
  { id: 37, name: 'Western', icon: 'bonfire-outline', accent: '#b45309', colors: ['rgba(180, 83, 9, 0.25)', 'rgba(139, 90, 43, 0.4)'] },
];

const TV_GENRES = [
  { id: 10759, name: 'Action & Adventure', icon: 'flash-outline', accent: '#ef4444', colors: ['rgba(239, 68, 68, 0.25)', 'rgba(125, 0, 8, 0.4)'] },
  { id: 16, name: 'Animation', icon: 'sparkles-outline', accent: '#06b6d4', colors: ['rgba(6, 182, 212, 0.25)', 'rgba(0, 139, 139, 0.4)'] },
  { id: 35, name: 'Comedy', icon: 'happy-outline', accent: '#ec4899', colors: ['rgba(236, 72, 153, 0.25)', 'rgba(199, 21, 133, 0.4)'] },
  { id: 80, name: 'Crime', icon: 'finger-print-outline', accent: '#a855f7', colors: ['rgba(168, 85, 247, 0.25)', 'rgba(49, 0, 98, 0.4)'] },
  { id: 99, name: 'Documentary', icon: 'film-outline', accent: '#10b981', colors: ['rgba(16, 185, 129, 0.25)', 'rgba(30, 94, 58, 0.4)'] },
  { id: 18, name: 'Drama', icon: 'heart-dislike-outline', accent: '#3b82f6', colors: ['rgba(59, 130, 246, 0.25)', 'rgba(32, 78, 122, 0.4)'] },
  { id: 10751, name: 'Family', icon: 'people-outline', accent: '#f472b6', colors: ['rgba(244, 114, 182, 0.25)', 'rgba(219, 112, 147, 0.4)'] },
  { id: 10762, name: 'Kids', icon: 'shapes-outline', accent: '#f59e0b', colors: ['rgba(245, 158, 11, 0.25)', 'rgba(204, 144, 44, 0.4)'] },
  { id: 9648, name: 'Mystery', icon: 'eye-outline', accent: '#64748b', colors: ['rgba(100, 116, 139, 0.25)', 'rgba(71, 80, 88, 0.4)'] },
  { id: 10765, name: 'Sci-Fi & Fantasy', icon: 'planet-outline', accent: '#38bdf8', colors: ['rgba(56, 189, 248, 0.25)', 'rgba(0, 0, 139, 0.4)'] },
  { id: 10768, name: 'War & Politics', icon: 'shield-outline', accent: '#84cc16', colors: ['rgba(132, 204, 22, 0.25)', 'rgba(59, 77, 32, 0.4)'] },
  { id: 37, name: 'Western', icon: 'bonfire-outline', accent: '#b45309', colors: ['rgba(180, 83, 9, 0.25)', 'rgba(139, 90, 43, 0.4)'] },
];

const MEDIA_FILTERS = [
  { id: 'all', name: 'All' },
  { id: 'movie', name: 'Movies' },
  { id: 'tv', name: 'Series' },
  { id: 'anime', name: 'Anime' },
  { id: 'person', name: 'Constellation' },
];

const TYPE_FILTERS = [
  { id: 'all', name: 'All Types' },
  { id: 'movie', name: 'Movies Only' },
  { id: 'tv', name: 'TV Shows Only' },
];

const SORT_OPTIONS = [
  { id: 'popularity.desc', label: 'Most Popular' },
  { id: 'vote_average.desc', label: 'Top Rated' },
  { id: 'primary_release_date.desc', label: 'Newest Release' },
];

const RATING_OPTIONS = [
  { id: '0', label: 'Rating: Any' },
  { id: '8', label: '★ 8.0 & Above' },
  { id: '7', label: '★ 7.0 & Above' },
  { id: '6', label: '★ 6.0 & Above' },
  { id: '5', label: '★ 5.0 & Above' },
];

const YEAR_OPTIONS = ['', '2026', '2025', '2024', '2023', '2022', '2021', '2020', '2019', '2018', '2017', '2016', '2015'];

export default function DiscoverScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TmdbMediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const router = useRouter();

  // Region and Subfilter states
  const [region, setRegion] = useState<string>('all');
  const [subfilter, setSubfilter] = useState<string>('all');
  const [regionResults, setRegionResults] = useState<TmdbMediaItem[]>([]);
  const [regionLoading, setRegionLoading] = useState(false);

  // Genre & Results browsing state (with state retention)
  const [genreType, setGenreType] = useState<'all' | 'movie' | 'tv'>('movie');
  const [selectedGenre, setSelectedGenre] = useState<{ id: number | 'all'; name: string } | null>(null);
  const [genreResults, setGenreResults] = useState<TmdbMediaItem[]>([]);
  const [genreLoading, setGenreLoading] = useState(false);

  // Filter Bar state
  const [year, setYear] = useState('');
  const [minRating, setMinRating] = useState('0');
  const [sortBy, setSortBy] = useState('popularity.desc');

  // Modal State for Collapsible Dropdowns
  const [activeModal, setActiveModal] = useState<'type' | 'region' | 'subfilter' | 'sort' | 'rating' | 'year' | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  // Calculate dynamic card dimensions
  const COLUMN_COUNT = 3;
  const padding = spacing[4] * 2;
  const gaps = spacing[3] * (COLUMN_COUNT - 1);
  const cardWidth = containerWidth > 0 ? (containerWidth - padding - gaps) / COLUMN_COUNT : 110;
  const cardHeight = cardWidth * 1.5;

  // Genre grid dimensions (2 columns)
  const GENRE_COLS = 2;
  const genreGaps = spacing[3] * (GENRE_COLS - 1);
  const genreCardWidth = containerWidth > 0 ? (containerWidth - padding - genreGaps) / GENRE_COLS : 160;

  const genres = genreType === 'tv' ? TV_GENRES : MOVIE_GENRES;

  // Search debounce
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await fetchSearch(query.trim());
        setResults(data.results || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 600);
    return () => clearTimeout(timeoutId);
  }, [query]);

  // Fetch discover results (supports page 1 reset & multi-page append)
  const fetchDiscoverResults = useCallback(async (pageNum: number = 1) => {
    if (!selectedGenre) return;
    
    if (pageNum === 1) {
      setGenreLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const { countryParam, languageParam } = getRegionQueryParams(region, subfilter);
      const requestTypes = genreType === 'all' ? ['movie', 'tv'] : [genreType];

      const responses = await Promise.all(
        requestTypes.map((mediaType) => {
          const yearParam = year ? (mediaType === 'movie' ? `&primary_release_year=${year}` : `&first_air_date_year=${year}`) : '';
          const ratingParam = minRating !== '0' ? `&vote_average.gte=${minRating}` : '';
          const genreParam = selectedGenre.id && (selectedGenre.id as any) !== 'all' ? `&with_genres=${selectedGenre.id}` : '';
          const mediaSort = sortBy === 'primary_release_date.desc' && mediaType === 'tv' ? 'first_air_date.desc' : sortBy;

          return tmdbFetch<TmdbPaginatedResponse>(
            `/discover/${mediaType}?sort_by=${mediaSort}${genreParam}${countryParam}${languageParam}${yearParam}${ratingParam}&vote_count.gte=20&page=${pageNum}`
          );
        })
      );

      const seen = new Set();
      const merged = responses
        .flatMap((data, index) => (data.results || []).map((item) => ({ ...item, media_type: requestTypes[index] })))
        .filter((item) => item.poster_path)
        .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
        .filter((item) => {
          const key = `${item.media_type}_${item.id}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

      const maxTotalPages = Math.max(...responses.map((data) => data.total_pages || 1));
      setTotalPages(maxTotalPages);
      setPage(pageNum);

      if (pageNum === 1) {
        setGenreResults(merged as any);
      } else {
        setGenreResults((prev: any) => [
          ...prev,
          ...merged.filter((item) => !prev.some((old: any) => old.id === item.id && old.media_type === item.media_type)),
        ] as any);
      }
    } catch (err) {
      console.error('Discover fetch failed:', err);
    } finally {
      setGenreLoading(false);
      setLoadingMore(false);
    }
  }, [selectedGenre, genreType, region, subfilter, year, minRating, sortBy]);

  // Re-fetch whenever filters change for active genre
  useEffect(() => {
    if (selectedGenre) {
      fetchDiscoverResults(1);
    }
  }, [selectedGenre, genreType, region, subfilter, year, minRating, sortBy]);

  // Fetch popular regional content for browse shelf
  useEffect(() => {
    if (region === 'all' || selectedGenre || query.trim().length > 0) {
      setRegionResults([]);
      return;
    }
    let mounted = true;
    setRegionLoading(true);
    const { countryParam, languageParam } = getRegionQueryParams(region, subfilter);
    const requestTypes = genreType === 'all' ? ['movie', 'tv'] : [genreType];

    Promise.all(
      requestTypes.map((mediaType) =>
        tmdbFetch<TmdbPaginatedResponse>(`/discover/${mediaType}?sort_by=popularity.desc${countryParam}${languageParam}&page=1`)
      )
    )
      .then((responses) => {
        if (mounted) {
          const merged = responses
            .flatMap((data, index) => (data.results || []).map((item) => ({ ...item, media_type: requestTypes[index] as 'movie' | 'tv' })))
            .filter((i) => i.poster_path);
          setRegionResults(merged.sort((a, b) => (b.popularity || 0) - (a.popularity || 0)));
        }
      })
      .catch((err) => console.error('Region content fetch failed', err))
      .finally(() => { if (mounted) setRegionLoading(false); });
    return () => { mounted = false; };
  }, [region, subfilter, genreType, selectedGenre, query]);

  const handlePress = useCallback((item: any) => {
    if (item?.media_type === 'person') {
      router.push(`/person/${item.id}`);
    } else {
      const type = item.media_type || (item.name ? 'tv' : 'movie');
      router.push(`/media/${item.id}?type=${type}`);
    }
  }, [router]);

  const handleLoadMore = () => {
    if (page < totalPages && !genreLoading && !loadingMore) {
      fetchDiscoverResults(page + 1);
    }
  };

  const isSearching = query.trim().length > 0;
  const activeRegionName = REGION_PRESETS[region as keyof typeof REGION_PRESETS]?.name;

  return (
    <View style={styles.container} onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
      <LinearGradient
        colors={['#1e0a1a', backgrounds.base, backgrounds.base, backgrounds.base, '#2a2110']}
        locations={[0, 0.3, 0.5, 0.8, 1]}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Header Padding */}
      <View style={{ height: Platform.OS === 'ios' ? 100 : 80 }} />

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={text.muted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search movies, shows, or actors..."
          placeholderTextColor={text.muted}
          value={query}
          onChangeText={(t) => { setQuery(t); if (t.trim()) setSelectedGenre(null); }}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Ionicons 
            name="close-circle" 
            size={20} 
            color={text.secondary} 
            style={styles.clearIcon}
            onPress={() => setQuery('')}
          />
        )}
      </View>

      {isSearching ? (
        /* ── Search Results Mode ── */
        <>
          <View style={styles.filterContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
              {MEDIA_FILTERS.map((filter) => (
                <Pressable
                  key={filter.id}
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
              <ActivityIndicator size="large" color={accent.primary} />
            </View>
          ) : (
            containerWidth > 0 && (
              <FlatList
                data={results.filter(r => {
                  const mt = (r as any).media_type;
                  if (mt !== 'movie' && mt !== 'tv' && mt !== 'person' && !!mt) return false;
                  if (activeFilter === 'all') return true;
                  if (activeFilter === 'anime') return mt !== 'person' && isAnimeContent(r);
                  return mt === activeFilter;
                })}
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
                      <Text style={styles.emptyText}>No results found for "{query}"</Text>
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
              style={({ pressed }) => [styles.backPill, pressed && { opacity: 0.7 }]} 
              onPress={() => { setSelectedGenre(null); setGenreResults([]); setPage(1); }}
            >
              <Ionicons name="chevron-back" size={18} color="#fff" />
              <Text style={styles.backPillText}>Genres</Text>
            </Pressable>
            
            <Text style={styles.genreActiveLabel} numberOfLines={1}>
              {selectedGenre.name}
            </Text>
          </View>

          {/* Sleek Collapsible Dropdown Filter Bar */}
          <View style={styles.filterControlsBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
              
              {/* Type Pill */}
              <Pressable
                style={[styles.dropdownPill, genreType !== 'all' && styles.dropdownPillActive]}
                onPress={() => setActiveModal('type')}
              >
                <Text style={[styles.dropdownPillText, genreType !== 'all' && styles.dropdownPillTextActive]}>
                  Type: {TYPE_FILTERS.find(t => t.id === genreType)?.name.replace(' Only', '')}
                </Text>
                <Ionicons name="chevron-down" size={14} color={genreType !== 'all' ? '#fff' : text.secondary} />
              </Pressable>

              {/* Region Pill */}
              <Pressable
                style={[styles.dropdownPill, region !== 'all' && styles.dropdownPillActive]}
                onPress={() => setActiveModal('region')}
              >
                <Text style={[styles.dropdownPillText, region !== 'all' && styles.dropdownPillTextActive]}>
                  Region: {REGION_PRESETS[region as keyof typeof REGION_PRESETS]?.name}
                </Text>
                <Ionicons name="chevron-down" size={14} color={region !== 'all' ? '#fff' : text.secondary} />
              </Pressable>

              {/* Subfilter Pill (if region !== 'all') */}
              {region !== 'all' && SUBFILTER_PRESETS[region as keyof typeof SUBFILTER_PRESETS] && (
                <Pressable
                  style={[styles.dropdownPill, subfilter !== 'all' && styles.dropdownPillActive]}
                  onPress={() => setActiveModal('subfilter')}
                >
                  <Text style={[styles.dropdownPillText, subfilter !== 'all' && styles.dropdownPillTextActive]}>
                    Sub: {SUBFILTER_PRESETS[region as keyof typeof SUBFILTER_PRESETS].find(s => s.id === subfilter)?.name}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color={subfilter !== 'all' ? '#fff' : text.secondary} />
                </Pressable>
              )}

              {/* Sort Pill */}
              <Pressable
                style={[styles.dropdownPill, sortBy !== 'popularity.desc' && styles.dropdownPillActive]}
                onPress={() => setActiveModal('sort')}
              >
                <Text style={[styles.dropdownPillText, sortBy !== 'popularity.desc' && styles.dropdownPillTextActive]}>
                  Sort: {SORT_OPTIONS.find(s => s.id === sortBy)?.label}
                </Text>
                <Ionicons name="chevron-down" size={14} color={sortBy !== 'popularity.desc' ? '#fff' : text.secondary} />
              </Pressable>

              {/* Rating Pill */}
              <Pressable
                style={[styles.dropdownPill, minRating !== '0' && styles.dropdownPillActive]}
                onPress={() => setActiveModal('rating')}
              >
                <Text style={[styles.dropdownPillText, minRating !== '0' && styles.dropdownPillTextActive]}>
                  {minRating === '0' ? 'Rating: Any' : `★ ${minRating}.0+`}
                </Text>
                <Ionicons name="chevron-down" size={14} color={minRating !== '0' ? '#fff' : text.secondary} />
              </Pressable>

              {/* Year Pill */}
              <Pressable
                style={[styles.dropdownPill, year !== '' && styles.dropdownPillActive]}
                onPress={() => setActiveModal('year')}
              >
                <Text style={[styles.dropdownPillText, year !== '' && styles.dropdownPillTextActive]}>
                  {year ? `Year: ${year}` : 'Year: All'}
                </Text>
                <Ionicons name="chevron-down" size={14} color={year !== '' ? '#fff' : text.secondary} />
              </Pressable>

            </ScrollView>
          </View>

          {genreLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={accent.primary} />
            </View>
          ) : (
            containerWidth > 0 && (
              <FlatList
                data={genreResults}
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
                    <Text style={styles.emptyText}>No titles match the selected filters.</Text>
                  </View>
                }
                ListFooterComponent={
                  <View style={styles.loadMoreFooter}>
                    {page < totalPages && (
                      <Pressable 
                        style={({ pressed }) => [styles.loadMoreButton, pressed && { opacity: 0.8 }]}
                        onPress={handleLoadMore}
                        disabled={loadingMore}
                      >
                        {loadingMore ? (
                          <ActivityIndicator size="small" color="#fff" />
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
          {/* Type Toggle */}
          <View style={styles.typeToggle}>
            {TYPE_FILTERS.map((f) => (
              <Pressable
                key={f.id}
                style={[styles.typePill, genreType === f.id && styles.typePillActive]}
                onPress={() => setGenreType(f.id as any)}
              >
                <Text style={[styles.typePillText, genreType === f.id && styles.typePillTextActive]}>
                  {f.name}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Region Filter Selector */}
          <View style={styles.regionSelectorContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
              {Object.entries(REGION_PRESETS).map(([id, preset]) => (
                <Pressable
                  key={id}
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

          {/* Subfilters horizontal selection */}
          {region !== 'all' && SUBFILTER_PRESETS[region as keyof typeof SUBFILTER_PRESETS] && (
            <View style={styles.subfilterContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subfilterScroll}>
                {SUBFILTER_PRESETS[region as keyof typeof SUBFILTER_PRESETS].map((sf) => (
                  <Pressable
                    key={sf.id}
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

          {/* Popular in Region Shelf */}
          {region !== 'all' && (
            <View style={styles.regionShelf}>
              <View style={styles.regionShelfHeader}>
                <Text style={styles.regionShelfTitle}>
                  Popular in <Text style={{ color: accent.primary }}>{activeRegionName}</Text>
                </Text>
                <Pressable
                  style={({ pressed }) => [styles.browseAllBtn, pressed && { opacity: 0.7 }]}
                  onPress={() => setSelectedGenre({ id: 'all' as any, name: 'All ' + activeRegionName })}
                >
                  <Text style={styles.browseAllBtnText}>Explore All</Text>
                  <Ionicons name="chevron-forward" size={14} color={accent.primary} />
                </Pressable>
              </View>
              {regionLoading ? (
                <ActivityIndicator size="small" color={accent.primary} style={{ marginVertical: 30 }} />
              ) : (
                <FlatList
                  data={regionResults}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: spacing[3], paddingHorizontal: spacing[4] }}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={({ item }) => (
                    <MediaCard item={item} onPress={() => handlePress(item)} />
                  )}
                  ListEmptyComponent={
                    <Text style={styles.emptyRegionText}>No trending titles for this region.</Text>
                  }
                />
              )}
            </View>
          )}

          <Text style={styles.browseTitle}>Browse by Genre</Text>

          {/* Genre Grid */}
          <View style={styles.genreGrid}>
            {genres.map((genre) => (
              <Pressable
                key={genre.id}
                style={({ pressed }) => [{ width: genreCardWidth }, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]}
                onPress={() => setSelectedGenre(genre)}
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

      {/* Sleek Filter Picker BottomSheet Modal */}
      <Modal
        visible={!!activeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveModal(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setActiveModal(null)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {activeModal === 'type' && 'Filter Media Type'}
                {activeModal === 'region' && 'Filter Region'}
                {activeModal === 'subfilter' && 'Filter Sub-Region'}
                {activeModal === 'sort' && 'Sort Titles By'}
                {activeModal === 'rating' && 'Minimum TMDB Rating'}
                {activeModal === 'year' && 'Release Year'}
              </Text>
              <Pressable onPress={() => setActiveModal(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#fff" />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {activeModal === 'type' && TYPE_FILTERS.map((item) => (
                <Pressable
                  key={item.id}
                  style={[styles.modalOption, genreType === item.id && styles.modalOptionActive]}
                  onPress={() => { setGenreType(item.id as any); setActiveModal(null); }}
                >
                  <Text style={[styles.modalOptionText, genreType === item.id && styles.modalOptionTextActive]}>
                    {item.name}
                  </Text>
                  {genreType === item.id && <Ionicons name="checkmark" size={18} color={accent.primary} />}
                </Pressable>
              ))}

              {activeModal === 'region' && Object.entries(REGION_PRESETS).map(([id, preset]) => (
                <Pressable
                  key={id}
                  style={[styles.modalOption, region === id && styles.modalOptionActive]}
                  onPress={() => { setRegion(id); setSubfilter('all'); setActiveModal(null); }}
                >
                  <Text style={[styles.modalOptionText, region === id && styles.modalOptionTextActive]}>
                    {preset.name}
                  </Text>
                  {region === id && <Ionicons name="checkmark" size={18} color={accent.primary} />}
                </Pressable>
              ))}

              {activeModal === 'subfilter' && region !== 'all' && SUBFILTER_PRESETS[region as keyof typeof SUBFILTER_PRESETS]?.map((sf) => (
                <Pressable
                  key={sf.id}
                  style={[styles.modalOption, subfilter === sf.id && styles.modalOptionActive]}
                  onPress={() => { setSubfilter(sf.id); setActiveModal(null); }}
                >
                  <Text style={[styles.modalOptionText, subfilter === sf.id && styles.modalOptionTextActive]}>
                    {sf.name}
                  </Text>
                  {subfilter === sf.id && <Ionicons name="checkmark" size={18} color={accent.primary} />}
                </Pressable>
              ))}

              {activeModal === 'sort' && SORT_OPTIONS.map((item) => (
                <Pressable
                  key={item.id}
                  style={[styles.modalOption, sortBy === item.id && styles.modalOptionActive]}
                  onPress={() => { setSortBy(item.id); setActiveModal(null); }}
                >
                  <Text style={[styles.modalOptionText, sortBy === item.id && styles.modalOptionTextActive]}>
                    {item.label}
                  </Text>
                  {sortBy === item.id && <Ionicons name="checkmark" size={18} color={accent.primary} />}
                </Pressable>
              ))}

              {activeModal === 'rating' && RATING_OPTIONS.map((item) => (
                <Pressable
                  key={item.id}
                  style={[styles.modalOption, minRating === item.id && styles.modalOptionActive]}
                  onPress={() => { setMinRating(item.id); setActiveModal(null); }}
                >
                  <Text style={[styles.modalOptionText, minRating === item.id && styles.modalOptionTextActive]}>
                    {item.label}
                  </Text>
                  {minRating === item.id && <Ionicons name="checkmark" size={18} color={accent.primary} />}
                </Pressable>
              ))}

              {activeModal === 'year' && YEAR_OPTIONS.map((y) => (
                <Pressable
                  key={y || 'all_years'}
                  style={[styles.modalOption, year === y && styles.modalOptionActive]}
                  onPress={() => { setYear(y); setActiveModal(null); }}
                >
                  <Text style={[styles.modalOptionText, year === y && styles.modalOptionTextActive]}>
                    {y ? y : 'Year: All'}
                  </Text>
                  {year === y && <Ionicons name="checkmark" size={18} color={accent.primary} />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: backgrounds.base,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing[4],
    marginBottom: spacing[4],
    backgroundColor: backgrounds.surface,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    height: 46,
    paddingHorizontal: spacing[4],
  },
  searchIcon: {
    marginRight: spacing[2],
  },
  clearIcon: {
    marginLeft: spacing[2],
  },
  searchInput: {
    flex: 1,
    color: text.primary,
    fontSize: fontSizes.md,
    height: '100%',
    fontFamily: fontFamilies.body,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  filterContainer: {
    marginBottom: spacing[4],
  },
  filterScroll: {
    paddingHorizontal: spacing[4],
    gap: spacing[2],
  },
  filterPill: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radii.full,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  filterPillActive: {
    backgroundColor: accent.primary,
    borderColor: accent.primary,
  },
  filterPillText: {
    color: text.primary,
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.body,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  gridContainer: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
  },
  row: {
    justifyContent: 'flex-start',
    gap: spacing[3],
    marginBottom: spacing[6],
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    color: text.secondary,
    fontSize: fontSizes.md,
    fontFamily: fontFamilies.body,
  },

  // ── Type Toggle ──
  typeToggle: {
    flexDirection: 'row',
    paddingHorizontal: spacing[4],
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  typePill: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2],
    borderRadius: radii.full,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  typePillActive: {
    backgroundColor: accent.primary,
    borderColor: accent.primary,
  },
  typePillText: {
    color: text.secondary,
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.heading,
    fontWeight: '600',
  },
  typePillTextActive: {
    color: '#fff',
    fontWeight: '700',
  },

  // ── Region Selector ──
  regionSelectorContainer: {
    marginBottom: spacing[3],
  },
  regionPill: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radii.full,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  regionPillActive: {
    backgroundColor: accent.primary,
    borderColor: accent.primary,
  },
  regionPillText: {
    color: text.secondary,
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.heading,
    fontWeight: '600',
  },
  regionPillTextActive: {
    color: '#fff',
    fontWeight: '700',
  },

  // ── Subfilter selection ──
  subfilterContainer: {
    marginBottom: spacing[5],
  },
  subfilterScroll: {
    paddingHorizontal: spacing[4],
    gap: spacing[2],
  },
  subfilterPill: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: radii.full,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  subfilterPillActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  subfilterPillText: {
    color: text.muted,
    fontSize: fontSizes.xs,
    fontFamily: fontFamilies.body,
    fontWeight: '600',
  },
  subfilterPillTextActive: {
    color: '#fff',
    fontWeight: '700',
  },

  // ── Popular in Region Shelf ──
  regionShelf: {
    marginBottom: spacing[5],
  },
  regionShelfTitle: {
    color: text.primary,
    fontSize: fontSizes.lg,
    fontFamily: fontFamilies.heading,
    fontWeight: '700',
  },
  emptyRegionText: {
    color: text.muted,
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.body,
    fontStyle: 'italic',
    paddingHorizontal: spacing[4],
  },

  // ── Browse Title ──
  browseTitle: {
    color: text.primary,
    fontSize: fontSizes.lg,
    fontFamily: fontFamilies.heading,
    fontWeight: '700',
    paddingHorizontal: spacing[4],
    marginBottom: spacing[4],
  },

  // ── Genre Grid ──
  genreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing[4],
    gap: spacing[3],
  },
  genreCard: {
    height: 76,
    borderRadius: radii.xl,
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
    backgroundColor: '#0f0f18',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  genreCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  genreIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  genreCardText: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
    fontFamily: fontFamilies.heading,
    fontWeight: '800',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // ── Genre Results Header & Filter Bar ──
  genreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    marginBottom: spacing[3],
    gap: spacing[3],
  },
  backPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radii.full,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  backPillText: {
    color: '#fff',
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.heading,
    fontWeight: '600',
  },
  genreActiveLabel: {
    color: accent.primary,
    fontSize: fontSizes.xl,
    fontFamily: fontFamilies.display,
    fontWeight: '900',
    letterSpacing: -0.3,
    flex: 1,
  },
  filterControlsBar: {
    marginBottom: spacing[4],
  },
  dropdownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    gap: 6,
  },
  dropdownPillActive: {
    backgroundColor: accent.primary,
    borderColor: accent.primary,
  },
  dropdownPillText: {
    color: text.secondary,
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.heading,
    fontWeight: '600',
  },
  dropdownPillTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  regionShelfHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    marginBottom: spacing[3],
  },
  browseAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(229, 9, 20, 0.15)',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.3)',
  },
  browseAllBtnText: {
    color: accent.primary,
    fontSize: fontSizes.xs,
    fontFamily: fontFamilies.heading,
    fontWeight: '700',
  },

  // ── Load More Pagination Button ──
  loadMoreFooter: {
    alignItems: 'center',
    marginVertical: spacing[4],
  },
  loadMoreButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  loadMoreButtonText: {
    color: '#fff',
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.heading,
    fontWeight: '700',
  },

  // ── Modal Bottom Sheet Styles ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#14141f',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing[5],
    paddingBottom: Platform.OS === 'ios' ? 40 : spacing[6],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignSelf: 'center',
    marginBottom: spacing[3],
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  modalTitle: {
    color: '#fff',
    fontSize: fontSizes.lg,
    fontFamily: fontFamilies.heading,
    fontWeight: '700',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[3.5],
    paddingHorizontal: spacing[3],
    borderRadius: radii.md,
    marginBottom: spacing[1],
  },
  modalOptionActive: {
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
  },
  modalOptionText: {
    color: text.secondary,
    fontSize: fontSizes.md,
    fontFamily: fontFamilies.body,
    fontWeight: '500',
  },
  modalOptionTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
});
