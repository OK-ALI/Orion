import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { ContinueWatchingEntry } from '@orion/shared/types';
import { useLibrary } from '../../context/LibraryContext';
import { useOrionTheme } from '../../context/ThemeContext';
import { MediaCard } from '../../components/MediaCard';
import { MobilePageHeader } from '../../components/MobilePageHeader';
import { OrionDialog } from '../../components/OrionDialog';
import { ContinueWatchingCard } from './ContinueWatchingCard';
import { HistoryRow } from './HistoryRow';
import { historyEntryKey, selectLatestHistory } from './playbackLibrary';
import { savedItemWatchState } from './watchedState';
import { useResponsiveLayout } from '../../services/responsive';
import { getGridRenderBudget, getStackListRenderBudget } from '../../services/listPerformance';
import { usePerformanceProfile } from '../../context/PerformanceContext';

type LibraryTab = 'saved' | 'continue' | 'history';
type SavedFilter = 'all' | 'unwatched' | 'watched';

export interface LibraryPagerState {
  activeTab: LibraryTab;
  targetTab: LibraryTab | null;
  gestureProgress: number;
  transitioning: boolean;
}

type LibraryDialogState = { type: 'clear' } | { type: 'remove'; historyKey: string } | null;

const SAVED_FILTERS: Array<{ id: SavedFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'unwatched', label: 'Unwatched' },
  { id: 'watched', label: 'Watched' },
];

const TABS: Array<{ id: LibraryTab; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: 'saved', label: 'My List', icon: 'bookmark' },
  { id: 'continue', label: 'Continue', icon: 'play-circle' },
  { id: 'history', label: 'History', icon: 'time' },
];

function validTab(value: string | undefined): LibraryTab {
  return value === 'continue' || value === 'history' ? value : 'saved';
}

function savedItemKey(item: any) {
  return `${item.media_type || 'movie'}_${item.id}`;
}

export default function LibraryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { width, shortestEdge, isLandscape, isTablet } = useResponsiveLayout();
  const { theme, preferences } = useOrionTheme();
  const { resolvedProfile } = usePerformanceProfile();
  const {
    saved, savedOrder, history, progress, watched,
    clearHistory, removeHistoryEntry, removeProgress, markProgressWatched,
    getContinueWatching, enrichPlaybackMetadata,
  } = useLibrary();
  const [activeTab, setActiveTab] = useState<LibraryTab>(() => validTab(params.tab));
  const [savedFilter, setSavedFilter] = useState<SavedFilter>('all');
  const [dialog, setDialog] = useState<LibraryDialogState>(null);

  useEffect(() => setActiveTab(validTab(params.tab)), [params.tab]);

  const savedItems = useMemo(
    () => savedOrder.map((key) => saved[key]).filter(Boolean),
    [saved, savedOrder],
  );
  const savedWatchRows = useMemo(
    () => savedItems.map((item) => ({ item, state: savedItemWatchState(watched, item) })),
    [savedItems, watched],
  );
  const savedFilterCounts = useMemo(() => {
    const watchedCount = savedWatchRows.filter((entry) => entry.state === 'watched').length;
    return {
      all: savedWatchRows.length,
      unwatched: savedWatchRows.length - watchedCount,
      watched: watchedCount,
    } satisfies Record<SavedFilter, number>;
  }, [savedWatchRows]);
  const watchedSavedKeys = useMemo(
    () => new Set(savedWatchRows.filter((entry) => entry.state === 'watched').map((entry) => savedItemKey(entry.item))),
    [savedWatchRows],
  );
  const filteredSavedItems = useMemo(
    () => savedFilter === 'all'
      ? savedItems
      : savedWatchRows.filter((entry) => entry.state === savedFilter).map((entry) => entry.item),
    [savedFilter, savedItems, savedWatchRows],
  );
  const continueItems = useMemo(
    () => getContinueWatching(),
    [getContinueWatching, progress, watched],
  );
  const historyItems = useMemo(() => selectLatestHistory(history), [history]);

  useEffect(() => {
    const keys = new Set<string>();
    continueItems.slice(0, 16).forEach((entry) => {
      const presentation = entry.progress.presentation;
      if (!presentation.posterPath || !presentation.backdropPath) keys.add(entry.key);
    });
    historyItems.slice(0, 16).forEach((entry) => {
      const key = historyEntryKey(entry);
      if (key && progress[key] && (!entry.poster_path || !entry.backdrop_path)) keys.add(key);
    });
    keys.forEach((key) => { enrichPlaybackMetadata(key).catch(() => {}); });
  }, [continueItems, enrichPlaybackMetadata, historyItems, progress]);

  const horizontalPadding = shortestEdge < 360 ? 12 : isTablet ? 32 : 18;
  const columnCount = isTablet
    ? (width >= 900 ? 5 : 4)
    : (isLandscape ? 3 : width >= 390 ? 3 : 2);
  const gridGap = shortestEdge < 360 ? 8 : 12;
  const cardWidth = Math.max(112, (width - horizontalPadding * 2 - gridGap * (columnCount - 1)) / columnCount);
  const savedGridRenderBudget = useMemo(() => getGridRenderBudget(columnCount, resolvedProfile), [columnCount, resolvedProfile]);
  const stackListRenderBudget = useMemo(() => getStackListRenderBudget(resolvedProfile), [resolvedProfile]);

  const openDetails = (id: string | number, mediaType: 'movie' | 'tv') => {
    router.push({ pathname: '/media/[id]', params: { id: String(id), type: mediaType } });
  };

  const resumeProgress = (entry: ContinueWatchingEntry) => {
    const { mediaIdentity, presentation } = entry.progress;
    router.push({
      pathname: '/player/[id]',
      params: {
        id: String(mediaIdentity.id),
        type: mediaIdentity.mediaType,
        title: presentation.episodeTitle || mediaIdentity.title,
        seriesTitle: presentation.seriesTitle || (mediaIdentity.mediaType === 'tv' ? mediaIdentity.title : undefined),
        year: mediaIdentity.year ? String(mediaIdentity.year) : undefined,
        season: mediaIdentity.season ? String(mediaIdentity.season) : undefined,
        episode: mediaIdentity.episode ? String(mediaIdentity.episode) : undefined,
        episodeTitle: presentation.episodeTitle || undefined,
        posterPath: presentation.posterPath || undefined,
        backdropPath: presentation.backdropPath || undefined,
      },
    });
  };

  const resumeHistory = (item: any) => {
    const mediaType = item.media_type === 'tv' ? 'tv' : 'movie';
    router.push({
      pathname: '/player/[id]',
      params: {
        id: String(item.id), type: mediaType,
        title: item.episode_title || item.title || item.name,
        seriesTitle: mediaType === 'tv' ? (item.name || item.title) : undefined,
        year: item.year || undefined,
        season: item.season ? String(item.season) : undefined,
        episode: item.episode ? String(item.episode) : undefined,
        episodeTitle: item.episode_title || undefined,
        posterPath: item.poster_path || undefined,
        backdropPath: item.backdrop_path || undefined,
      },
    });
  };

  const emptyState = (icon: keyof typeof Ionicons.glyphMap, title: string, message: string) => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.surface }]}>
        <Ionicons name={icon} size={30} color={theme.textMuted} />
      </View>
      <Text accessibilityRole="header" style={[styles.emptyTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.emptyMessage, { color: theme.textSecondary }]}>{message}</Text>
    </View>
  );

  const counts: Record<LibraryTab, number> = {
    saved: savedItems.length,
    continue: continueItems.length,
    history: historyItems.length,
  };

  const activeIndex = TABS.findIndex((tab) => tab.id === activeTab);
  const pagerX = useSharedValue(-activeIndex * width);
  const dragOrigin = useSharedValue(-activeIndex * width);
  const changeTab = useCallback((index: number) => {
    const next = TABS[Math.max(0, Math.min(TABS.length - 1, index))].id;
    setActiveTab(next);
    router.setParams({ tab: next });
  }, [router]);

  useEffect(() => {
    pagerX.value = withTiming(-activeIndex * width, { duration: preferences.reducedMotion ? 0 : 210 });
  }, [activeIndex, pagerX, preferences.reducedMotion, width]);

  const pagerGesture = Gesture.Pan()
    .activeOffsetX([-24, 24])
    .failOffsetY([-14, 14])
    .onBegin(() => { dragOrigin.value = -activeIndex * width; })
    .onUpdate((event) => {
      let next = dragOrigin.value + event.translationX;
      const min = -(TABS.length - 1) * width;
      if (next > 0) next *= 0.24;
      if (next < min) next = min + (next - min) * 0.24;
      pagerX.value = next;
    })
    .onEnd((event) => {
      const forward = event.translationX < -width * 0.18 || event.velocityX < -650;
      const backward = event.translationX > width * 0.18 || event.velocityX > 650;
      const target = Math.max(0, Math.min(TABS.length - 1, activeIndex + (forward ? 1 : backward ? -1 : 0)));
      pagerX.value = withTiming(-target * width, { duration: preferences.reducedMotion ? 0 : 210 });
      if (target !== activeIndex) runOnJS(changeTab)(target);
    });
  const pagerStyle = useAnimatedStyle(() => ({ transform: [{ translateX: pagerX.value }] }));

  const historyAction = activeTab === 'history' && historyItems.length > 0 ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Clear watch history"
      onPress={() => setDialog({ type: 'clear' })}
      style={({ pressed }) => [styles.headerAction, { borderColor: theme.border, backgroundColor: theme.surface }, pressed && styles.pressed]}
    >
      <Ionicons name="trash-outline" size={19} color={theme.textSecondary} />
    </Pressable>
  ) : null;

  return (
    <View style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <MobilePageHeader eyebrow="YOUR STORIES" title="Library" subtitle="Your saved stories, verified progress and watch history." trailing={historyAction} />
      <View style={[styles.tabsFrame, styles.tabs, { paddingHorizontal: horizontalPadding }]}>
          {TABS.map((tab, index) => {
            const active = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                accessibilityRole="tab"
                accessibilityLabel={`${tab.label}, ${counts[tab.id]} items`}
                accessibilityHint={`Shows ${tab.label.toLowerCase()} in Library`}
                accessibilityState={{ selected: active }}
                onPress={() => changeTab(index)}
                style={({ pressed }) => [
                  styles.tab,
                  width < 430 && styles.tabCompact,
                  { backgroundColor: active ? theme.accentSoft : theme.surface, borderColor: active ? theme.accent : theme.border },
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name={tab.icon} size={18} color={active ? theme.accent : theme.textSecondary} />
                <Text style={[styles.tabText, { color: active ? theme.text : theme.textSecondary }]}>{tab.label}</Text>
                <Text style={[styles.count, { color: active ? theme.accent : theme.textMuted }]}>{counts[tab.id]}</Text>
              </Pressable>
            );
          })}
      </View>

      <View style={styles.pagerViewport}>
        <GestureDetector gesture={pagerGesture}>
          <Animated.View style={[styles.pagerStrip, { width: width * TABS.length }, pagerStyle]}>
            <View style={[styles.page, { width }]}>
              <FlatList
                key={`saved-${columnCount}`}
                data={filteredSavedItems}
                numColumns={columnCount}
                keyExtractor={savedItemKey}
                initialNumToRender={savedGridRenderBudget.initialNumToRender}
                maxToRenderPerBatch={savedGridRenderBudget.maxToRenderPerBatch}
                windowSize={savedGridRenderBudget.windowSize}
                contentContainerStyle={[styles.listContent, { paddingHorizontal: horizontalPadding }]}
                columnWrapperStyle={{ gap: gridGap }}
                ListHeaderComponent={(
                  <View style={styles.savedFilterFrame}>
                    <View
                      style={[styles.savedFilters, { backgroundColor: theme.surface, borderColor: theme.border }]}
                    >
                      {SAVED_FILTERS.map((filter) => {
                        const active = savedFilter === filter.id;
                        return (
                          <Pressable
                            key={filter.id}
                            accessibilityRole="tab"
                            accessibilityLabel={`${filter.label} My List filter, ${savedFilterCounts[filter.id]} titles`}
                            accessibilityHint={`Shows ${filter.label.toLowerCase()} titles in My List`}
                            accessibilityState={{ selected: active }}
                            onPress={() => {
                              setSavedFilter(filter.id);
                              AccessibilityInfo.announceForAccessibility(`${filter.label} My List filter, ${savedFilterCounts[filter.id]} titles`);
                            }}
                            style={({ pressed }) => [
                              styles.savedFilter,
                              {
                                backgroundColor: active ? theme.accentSoft : 'transparent',
                                borderColor: active ? theme.accent : 'transparent',
                              },
                              pressed && styles.pressed,
                            ]}
                          >
                            <Text style={[styles.savedFilterLabel, { color: active ? theme.text : theme.textSecondary }]}>
                              {filter.label}
                            </Text>
                            <Text style={[styles.savedFilterCount, { color: active ? theme.accent : theme.textMuted }]}>
                              {savedFilterCounts[filter.id]}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )}
                ListEmptyComponent={
                  savedFilter === 'all'
                    ? emptyState('bookmark-outline', 'Your list is ready for its first story', 'Save a movie or series and it will appear here.')
                    : savedFilter === 'watched'
                      ? emptyState('checkmark-circle-outline', 'No watched titles in My List yet', 'Titles move here when Orion can verify they are fully watched.')
                      : emptyState('sparkles-outline', 'Nothing left in Unwatched', 'Every title Orion can evaluate in My List is currently complete.')
                }
                renderItem={({ item }) => (
                  <MediaCard
                    item={item}
                    watched={watchedSavedKeys.has(savedItemKey(item))}
                    width={cardWidth}
                    height={cardWidth * 1.52}
                    style={{ marginRight: 0, marginBottom: 18 }}
                    onPress={() => openDetails(item.id, item.media_type === 'tv' ? 'tv' : 'movie')}
                  />
                )}
              />
            </View>
            <View style={[styles.page, { width }]}>
              <FlatList
                data={continueItems}
                keyExtractor={(entry) => entry.key}
                initialNumToRender={stackListRenderBudget.initialNumToRender}
                maxToRenderPerBatch={stackListRenderBudget.maxToRenderPerBatch}
                windowSize={stackListRenderBudget.windowSize}
                contentContainerStyle={[styles.listContent, styles.continueList, { paddingHorizontal: horizontalPadding }]}
                ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
                ListEmptyComponent={emptyState('play-circle-outline', 'Nothing waiting to resume', 'Verified playback appears here after 30 seconds.')}
                renderItem={({ item }) => (
                  <ContinueWatchingCard
                    entry={item}
                    presentation="library-full"
                    onResume={() => resumeProgress(item)}
                    onOpenDetails={() => openDetails(item.progress.mediaIdentity.id, item.progress.mediaIdentity.mediaType)}
                    onRemove={() => removeProgress(item.key)}
                    onMarkWatched={() => markProgressWatched(item.key)}
                  />
                )}
              />
            </View>
            <View style={[styles.page, { width }]}>
              <FlatList
                data={historyItems}
                keyExtractor={(item) => item._key}
                initialNumToRender={stackListRenderBudget.initialNumToRender}
                maxToRenderPerBatch={stackListRenderBudget.maxToRenderPerBatch}
                windowSize={stackListRenderBudget.windowSize}
                contentContainerStyle={[styles.listContent, styles.historyList, { paddingHorizontal: horizontalPadding }]}
                ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                ListEmptyComponent={emptyState('time-outline', 'No verified watch history', 'Movies and episodes enter History after Orion confirms advancing playback.')}
                renderItem={({ item }) => (
                  <HistoryRow
                    item={item}
                    onResume={() => resumeHistory(item)}
                    onOpenDetails={() => openDetails(item.id, item.media_type === 'tv' ? 'tv' : 'movie')}
                    onRemove={() => setDialog({ type: 'remove', historyKey: item._key })}
                  />
                )}
              />
            </View>
          </Animated.View>
        </GestureDetector>
      </View>

      <OrionDialog
        visible={dialog?.type === 'clear'}
        title="Clear watch history?"
        message="This removes History only. My List, watched state and playback progress stay unchanged."
        icon="trash-outline"
        onDismiss={() => setDialog(null)}
        actions={[
          { label: 'Cancel', role: 'cancel', onPress: () => setDialog(null) },
          { label: 'Clear History', role: 'destructive', onPress: () => { clearHistory(); setDialog(null); } },
        ]}
      />
      <OrionDialog
        visible={dialog?.type === 'remove'}
        title="Remove from History?"
        message="Playback progress and watched state will remain unchanged."
        icon="trash-outline"
        onDismiss={() => setDialog(null)}
        actions={[
          { label: 'Cancel', role: 'cancel', onPress: () => setDialog(null) },
          { label: 'Remove', role: 'destructive', onPress: () => { if (dialog?.type === 'remove') removeHistoryEntry(dialog.historyKey); setDialog(null); } },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  tabsFrame: { paddingBottom: 12 },
  headerAction: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { flex: 1, minHeight: 46, borderWidth: 1, borderRadius: 23, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  tabCompact: { paddingHorizontal: 5, gap: 4 },
  tabText: { fontSize: 14, fontWeight: '700' },
  count: { fontSize: 12, fontWeight: '800', minWidth: 12, textAlign: 'center' },
  pagerViewport: { flex: 1, overflow: 'hidden' },
  pagerStrip: { flex: 1, flexDirection: 'row' },
  page: { flex: 1 },
  listContent: { paddingTop: 12, paddingBottom: 96, flexGrow: 1 },
  savedFilterFrame: { width: '100%', marginBottom: 14 },
  savedFilters: { width: '100%', maxWidth: 620, alignSelf: 'center', minHeight: 48, borderWidth: 1, borderRadius: 24, padding: 3, flexDirection: 'row', gap: 3 },
  savedFilter: { flex: 1, minHeight: 42, borderWidth: 1, borderRadius: 21, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  savedFilterLabel: { fontSize: 13, fontWeight: '800' },
  savedFilterCount: { minWidth: 14, fontSize: 11, fontWeight: '900', textAlign: 'center' },
  continueList: { width: '100%', maxWidth: 880, alignSelf: 'center' },
  historyList: { width: '100%', maxWidth: 980, alignSelf: 'center' },
  emptyState: { minHeight: 300, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 7 },
  emptyMessage: { maxWidth: 380, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  pressed: { opacity: 0.7 },
});
