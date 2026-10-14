import { useEffect, useMemo, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing } from '@orion/shared/tokens';
import { useOrionTheme } from '../../context/ThemeContext';
import { createDiscoverStyles } from '../discover/discoverStyles';
import { DiscoverFilterModal } from '../discover/DiscoverFilterModal';
import { MOBILE_LIBRARY_SORT_OPTIONS, MOBILE_LIBRARY_SORT_SHORT_LABELS, type MobileLibrarySort } from '../library/librarySort';
import { GLIMPSE_FILTER_CATEGORIES, defaultGlimpseFilters, glimpseFilterOptions, selectedGlimpseFilter, updateGlimpseFilter,
  type GlimpseFilters, type GlimpseFilterCategory } from './glimpseBrowse';

export function GlimpseControls({ query, onQuery, sort, onSort, filters, onFilters, onOcclusion, onExpanded, unavailable, localSearch = false }: {
  localSearch?: boolean; query: string; onQuery: (query: string) => void; sort: MobileLibrarySort; onSort: () => void;
  filters: GlimpseFilters; onFilters: (filters: GlimpseFilters) => void; onOcclusion: (blocked: boolean) => void; onExpanded?: (expanded: boolean) => void; unavailable: boolean;
}) {
  const { theme } = useOrionTheme();
  const discover = useMemo(() => createDiscoverStyles(theme), [theme]);
  const [searchVisible, setSearchVisible] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [category, setCategory] = useState<GlimpseFilterCategory | null>(null);
  useEffect(() => { onOcclusion(searchFocused || category !== null); }, [searchFocused, category, onOcclusion]);
  useEffect(() => { onExpanded?.(searchVisible || filtersVisible); }, [searchVisible, filtersVisible, onExpanded]);
  const currentSort = MOBILE_LIBRARY_SORT_OPTIONS.find(option => option.id === sort)!;
  const close = () => { setCategory(null); setFiltersVisible(false); };
  return <View style={styles.container}>
    <View style={styles.toolbar}>
      <Pressable accessibilityRole="button" accessibilityLabel={'Sort Glimpse: ' + currentSort.label}
        accessibilityHint="Opens Glimpse sort options" disabled={unavailable} accessibilityState={{ disabled: unavailable }} onPress={onSort}
        style={[styles.sort, { backgroundColor: theme.background, borderColor: theme.border, opacity: unavailable ? 0.5 : 1 }]}>
        <Ionicons name="swap-vertical-outline" size={16} color={theme.accent} />
        <Text numberOfLines={1} style={[styles.sortLabel, { color: theme.text }]}>{MOBILE_LIBRARY_SORT_SHORT_LABELS[sort]}</Text>
        <Ionicons name="chevron-down" size={14} color={theme.textSecondary} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={filtersVisible ? 'Close Glimpse filters' : 'Filter Glimpse clips'}
        accessibilityState={{ expanded: filtersVisible }} onPress={() => { if (filtersVisible) close(); else { setFiltersVisible(true); } }}
        style={[styles.tool, { borderColor: theme.border, backgroundColor: filtersVisible ? theme.accentSoft : theme.background }]}>
        <Ionicons name="options-outline" size={18} color={theme.text} /><Text style={{ color: theme.text }}>Filters</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={searchVisible ? 'Close Glimpse search' : 'Search Glimpse clips'}
        onPress={() => { setSearchVisible(value => !value); Keyboard.dismiss(); setSearchFocused(false); }} style={styles.icon}>
        <Ionicons name={searchVisible ? 'close-outline' : 'search-outline'} size={22} color={theme.accent} />
      </Pressable>
    </View>
    {searchVisible && <View style={[discover.searchContainer, { marginHorizontal: 0, marginBottom: 0 }]}>
      <Ionicons name="search-outline" size={18} color={theme.textMuted} style={discover.searchIcon} />
      <TextInput accessibilityLabel={localSearch ? "Search your liked clips" : "Search movies, series or anime"} placeholder={localSearch ? "Search your liked clips…" : "Search movies, series or anime…"} placeholderTextColor={theme.textMuted}
        style={discover.searchInput} value={query} maxLength={120} onChangeText={onQuery}
        onFocus={() => { onOcclusion(true); setSearchFocused(true); }} onBlur={() => setSearchFocused(false)} returnKeyType="search"
        onSubmitEditing={() => { Keyboard.dismiss(); setSearchFocused(false); }} />
      {!!query && <Pressable accessibilityRole="button" accessibilityLabel="Clear Glimpse search" onPress={() => onQuery('')} style={styles.icon}>
        <Ionicons name="close-circle" size={18} color={theme.textMuted} />
      </Pressable>}
    </View>}
    {!searchVisible && !!query && <Pressable accessibilityRole="button" accessibilityLabel="Clear Glimpse search" onPress={() => onQuery('')} style={{ minHeight: 44, justifyContent: 'center' }}>
      <Text style={{ color: theme.textSecondary, paddingBottom: 6 }}>Search: {query} · Clear</Text>
    </Pressable>}
    {filtersVisible && <View style={styles.filters}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail}>
        {GLIMPSE_FILTER_CATEGORIES.filter(item => item.id !== 'subfilter' || filters.region !== 'all').map(item => {
          const value = selectedGlimpseFilter(filters, item.id);
          const selected = value !== (item.id === 'subfilter' ? 'all' : selectedGlimpseFilter(defaultGlimpseFilters(), item.id));
          const label = selected ? glimpseFilterOptions(item.id, filters).find(option => option.id === value)?.label || item.label : item.label;
          return <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={'Glimpse filter: ' + item.label}
            accessibilityValue={{ text: label }} accessibilityState={{ selected }}
            style={[styles.tool, { borderColor: selected ? theme.accent : theme.border, backgroundColor: selected ? theme.accentSoft : theme.surface }]}
            onPress={() => { onOcclusion(true); setCategory(item.id); }}>
            <Text style={{ color: selected ? theme.accent : theme.text }}>{label}</Text><Ionicons name="chevron-down" size={12} color={selected ? theme.accent : theme.textMuted} />
          </Pressable>;
        })}
        <Pressable accessibilityRole="button" accessibilityLabel="Clear Glimpse filters" style={styles.tool} onPress={() => onFilters(defaultGlimpseFilters())}>
          <Text style={{ color: theme.accent }}>Clear filters</Text>
        </Pressable>
      </ScrollView>
      <Text style={[styles.note, { color: theme.textMuted }]}>Find clips by type, genre, region, year or rating.</Text>
    </View>}
    {!!category && <DiscoverFilterModal theme={theme} visible title={GLIMPSE_FILTER_CATEGORIES.find(item => item.id === category)!.label}
      options={glimpseFilterOptions(category, filters)} selected={selectedGlimpseFilter(filters, category)}
      onSelect={value => onFilters(updateGlimpseFilter(filters, category, value))} onClose={() => setCategory(null)} />}
  </View>;
}
const styles = StyleSheet.create({
  container: { gap: spacing[2], marginBottom: spacing[3] }, toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing[2] },
  sort: { flex: 1, minWidth: 120, minHeight: 44, borderWidth: 1, borderRadius: 21, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  sortLabel: { minWidth: 0, flexShrink: 1, fontSize: 12, fontWeight: '800' },
  tool: { minHeight: 44, borderWidth: 1, borderRadius: 22, paddingHorizontal: spacing[3], flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[1] },
  icon: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, filters: { gap: spacing[1] },
  filterRail: { gap: spacing[2] }, note: { fontSize: 11, paddingTop: spacing[1], paddingBottom: spacing[1] },
});