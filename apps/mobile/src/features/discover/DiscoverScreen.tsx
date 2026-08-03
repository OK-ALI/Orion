import { View, Text, StyleSheet, TextInput, FlatList, ActivityIndicator, ScrollView, Pressable, Modal } from 'react-native';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { spacing } from '@orion/shared/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { fetchSearch, isAnimeContent, tmdbFetch } from '@orion/shared/api';
import { TmdbMediaItem, TmdbPaginatedResponse } from '@orion/shared/types';
import { MediaCard } from '../../components/MediaCard';
import { PersonCard } from '../../components/PersonCard';
import { MobilePageHeader } from '../../components/MobilePageHeader';
import { useOrionTheme } from '../../context/ThemeContext';
import { useRouter } from 'expo-router';
import {
  getRegionQueryParams,
  MEDIA_FILTERS,
  MOVIE_GENRES,
  RATING_OPTIONS,
  REGION_PRESETS,
  SORT_OPTIONS,
  SUBFILTER_PRESETS,
  TV_GENRES,
  TYPE_FILTERS,
  YEAR_OPTIONS,
} from './discoverCatalog';
import { createDiscoverStyles } from './discoverStyles';

export default function DiscoverScreen() {
  const { theme } = useOrionTheme();
  const styles = useMemo(() => createDiscoverStyles(theme), [theme]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TmdbMediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const router = useRouter();
  const [region, setRegion] = useState<string>('all');
  const [subfilter, setSubfilter] = useState<string>('all');
  const [regionResults, setRegionResults] = useState<TmdbMediaItem[]>([]);
  const [regionLoading, setRegionLoading] = useState(false);
  const [genreType, setGenreType] = useState<'all' | 'movie' | 'tv'>('movie');
  const [selectedGenre, setSelectedGenre] = useState<{ id: number | 'all'; name: string } | null>(null);
  const [genreResults, setGenreResults] = useState<TmdbMediaItem[]>([]);
  const [genreLoading, setGenreLoading] = useState(false);
  const [year, setYear] = useState('');
  const [minRating, setMinRating] = useState('0');
  const [sortBy, setSortBy] = useState('popularity.desc');
  const [activeModal, setActiveModal] = useState<'type' | 'region' | 'subfilter' | 'sort' | 'rating' | 'year' | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const COLUMN_COUNT = containerWidth >= 900 ? 6 : containerWidth >= 600 ? 5 : containerWidth >= 390 ? 3 : 2;
  const padding = spacing[4] * 2;
  const gaps = spacing[3] * (COLUMN_COUNT - 1);
  const cardWidth = containerWidth > 0 ? (containerWidth - padding - gaps) / COLUMN_COUNT : 110;
  const cardHeight = cardWidth * 1.5;
  const GENRE_COLS = 2;
  const genreGaps = spacing[3] * (GENRE_COLS - 1);
  const genreCardWidth = containerWidth > 0 ? (containerWidth - padding - genreGaps) / GENRE_COLS : 160;
  const genres = genreType === 'tv' ? TV_GENRES : MOVIE_GENRES;
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
  useEffect(() => {
    if (selectedGenre) {
      fetchDiscoverResults(1);
    }
  }, [selectedGenre, genreType, region, subfilter, year, minRating, sortBy]);
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
        colors={[theme.accentSoft, theme.background, theme.background, theme.background, theme.surface]}
        locations={[0, 0.3, 0.5, 0.8, 1]}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <MobilePageHeader eyebrow="EXPLORE" title="Discover" subtitle="Search, filter and explore every corner of Orion." />
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={theme.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search movies, shows, or actors..."
          placeholderTextColor={theme.textMuted}
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
            color={theme.textSecondary}
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
              <ActivityIndicator size="large" color={theme.accent} />
            </View>
          ) : (
            containerWidth > 0 && (
              <FlatList
                key={`search-${COLUMN_COUNT}`}
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
              <Ionicons name="chevron-back" size={18} color={theme.text} />
              <Text style={styles.backPillText}>Genres</Text>
            </Pressable>
            <Text style={styles.genreActiveLabel} numberOfLines={1}>
              {selectedGenre.name}
            </Text>
          </View>
          <View style={styles.filterControlsBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
              <Pressable
                style={[styles.dropdownPill, genreType !== 'all' && styles.dropdownPillActive]}
                onPress={() => setActiveModal('type')}
              >
                <Text style={[styles.dropdownPillText, genreType !== 'all' && styles.dropdownPillTextActive]}>
                  Type: {TYPE_FILTERS.find(t => t.id === genreType)?.name.replace(' Only', '')}
                </Text>
                <Ionicons name="chevron-down" size={14} color={genreType !== 'all' ? theme.onAccent : theme.textSecondary} />
              </Pressable>
              <Pressable
                style={[styles.dropdownPill, region !== 'all' && styles.dropdownPillActive]}
                onPress={() => setActiveModal('region')}
              >
                <Text style={[styles.dropdownPillText, region !== 'all' && styles.dropdownPillTextActive]}>
                  Region: {REGION_PRESETS[region as keyof typeof REGION_PRESETS]?.name}
                </Text>
                <Ionicons name="chevron-down" size={14} color={region !== 'all' ? theme.onAccent : theme.textSecondary} />
              </Pressable>
              {region !== 'all' && SUBFILTER_PRESETS[region as keyof typeof SUBFILTER_PRESETS] && (
                <Pressable
                  style={[styles.dropdownPill, subfilter !== 'all' && styles.dropdownPillActive]}
                  onPress={() => setActiveModal('subfilter')}
                >
                  <Text style={[styles.dropdownPillText, subfilter !== 'all' && styles.dropdownPillTextActive]}>
                    Sub: {SUBFILTER_PRESETS[region as keyof typeof SUBFILTER_PRESETS].find(s => s.id === subfilter)?.name}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color={subfilter !== 'all' ? theme.onAccent : theme.textSecondary} />
                </Pressable>
              )}
              <Pressable
                style={[styles.dropdownPill, sortBy !== 'popularity.desc' && styles.dropdownPillActive]}
                onPress={() => setActiveModal('sort')}
              >
                <Text style={[styles.dropdownPillText, sortBy !== 'popularity.desc' && styles.dropdownPillTextActive]}>
                  Sort: {SORT_OPTIONS.find(s => s.id === sortBy)?.label}
                </Text>
                <Ionicons name="chevron-down" size={14} color={sortBy !== 'popularity.desc' ? theme.onAccent : theme.textSecondary} />
              </Pressable>
              <Pressable
                style={[styles.dropdownPill, minRating !== '0' && styles.dropdownPillActive]}
                onPress={() => setActiveModal('rating')}
              >
                <Text style={[styles.dropdownPillText, minRating !== '0' && styles.dropdownPillTextActive]}>
                  {minRating === '0' ? 'Rating: Any' : `★ ${minRating}.0+`}
                </Text>
                <Ionicons name="chevron-down" size={14} color={minRating !== '0' ? theme.onAccent : theme.textSecondary} />
              </Pressable>
              <Pressable
                style={[styles.dropdownPill, year !== '' && styles.dropdownPillActive]}
                onPress={() => setActiveModal('year')}
              >
                <Text style={[styles.dropdownPillText, year !== '' && styles.dropdownPillTextActive]}>
                  {year ? `Year: ${year}` : 'Year: All'}
                </Text>
                <Ionicons name="chevron-down" size={14} color={year !== '' ? theme.onAccent : theme.textSecondary} />
              </Pressable>
            </ScrollView>
          </View>
          {genreLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={theme.accent} />
            </View>
          ) : (
            containerWidth > 0 && (
              <FlatList
                key={`genre-${COLUMN_COUNT}`}
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
          {region !== 'all' && (
            <View style={styles.regionShelf}>
              <View style={styles.regionShelfHeader}>
                <Text style={styles.regionShelfTitle}>
                  Popular in <Text style={{ color: theme.accent }}>{activeRegionName}</Text>
                </Text>
                <Pressable
                  style={({ pressed }) => [styles.browseAllBtn, pressed && { opacity: 0.7 }]}
                  onPress={() => setSelectedGenre({ id: 'all' as any, name: 'All ' + activeRegionName })}
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
                <Ionicons name="close" size={20} color={theme.text} />
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
                  {genreType === item.id && <Ionicons name="checkmark" size={18} color={theme.accent} />}
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
                  {region === id && <Ionicons name="checkmark" size={18} color={theme.accent} />}
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
                  {subfilter === sf.id && <Ionicons name="checkmark" size={18} color={theme.accent} />}
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
                  {sortBy === item.id && <Ionicons name="checkmark" size={18} color={theme.accent} />}
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
                  {minRating === item.id && <Ionicons name="checkmark" size={18} color={theme.accent} />}
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
                  {year === y && <Ionicons name="checkmark" size={18} color={theme.accent} />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
