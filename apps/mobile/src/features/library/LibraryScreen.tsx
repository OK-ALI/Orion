import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ContinueWatchingEntry } from '@orion/shared/types';
import { useLibrary } from '../../context/LibraryContext';
import { useOrionTheme } from '../../context/ThemeContext';
import { MediaCard } from '../../components/MediaCard';
import { ContinueWatchingCard } from './ContinueWatchingCard';
import { HistoryRow } from './HistoryRow';
import { historyEntryKey, selectLatestHistory } from './playbackLibrary';

type LibraryTab = 'saved' | 'continue' | 'history';

const TABS: Array<{ id: LibraryTab; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: 'saved', label: 'My List', icon: 'bookmark' },
  { id: 'continue', label: 'Continue', icon: 'play-circle' },
  { id: 'history', label: 'History', icon: 'time' },
];

function validTab(value: string | undefined): LibraryTab {
  return value === 'continue' || value === 'history' ? value : 'saved';
}

export default function LibraryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { width } = useWindowDimensions();
  const { theme } = useOrionTheme();
  const {
    saved, savedOrder, history, progress, watched,
    clearHistory, removeHistoryEntry, removeProgress, markProgressWatched,
    getContinueWatching, enrichPlaybackMetadata,
  } = useLibrary();
  const [activeTab, setActiveTab] = useState<LibraryTab>(() => validTab(params.tab));

  useEffect(() => setActiveTab(validTab(params.tab)), [params.tab]);

  const savedItems = useMemo(
    () => savedOrder.map((key) => saved[key]).filter(Boolean),
    [saved, savedOrder],
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

  const horizontalPadding = width < 360 ? 12 : width >= 900 ? 32 : 18;
  const columnCount = width >= 900 ? 5 : width >= 600 ? 4 : width >= 390 ? 3 : 2;
  const gridGap = width < 360 ? 8 : 12;
  const cardWidth = Math.max(112, (width - horizontalPadding * 2 - gridGap * (columnCount - 1)) / columnCount);

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

  const confirmClearHistory = () => Alert.alert(
    'Clear watch history?',
    'This removes History only. My List, watched state and playback progress stay unchanged.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear History', style: 'destructive', onPress: clearHistory },
    ],
  );

  const emptyState = (icon: keyof typeof Ionicons.glyphMap, title: string, message: string) => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.surface }]}>
        <Ionicons name={icon} size={30} color={theme.textMuted} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.emptyMessage, { color: theme.textSecondary }]}>{message}</Text>
    </View>
  );

  const counts: Record<LibraryTab, number> = {
    saved: savedItems.length,
    continue: continueItems.length,
    history: historyItems.length,
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={styles.container}>
        <View style={[styles.header, { paddingHorizontal: horizontalPadding }]}>
          <View style={styles.titleRow}>
            <View style={styles.titleCopy}>
              <Text style={[styles.eyebrow, { color: theme.accent }]}>YOUR STORIES</Text>
              <Text style={[styles.pageTitle, { color: theme.text }]}>Library</Text>
            </View>
            {activeTab === 'history' && historyItems.length > 0 && (
              <Pressable accessibilityRole="button" accessibilityLabel="Clear watch history" onPress={confirmClearHistory} style={({ pressed }) => [styles.headerAction, { borderColor: theme.border }, pressed && styles.pressed]}>
                <Ionicons name="trash-outline" size={19} color={theme.textSecondary} />
              </Pressable>
            )}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <Pressable key={tab.id} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => setActiveTab(tab.id)} style={({ pressed }) => [styles.tab, { backgroundColor: active ? theme.accentSoft : theme.surface, borderColor: active ? theme.accent : theme.border }, pressed && styles.pressed]}>
                  <Ionicons name={tab.icon} size={18} color={active ? theme.accent : theme.textSecondary} />
                  <Text style={[styles.tabText, { color: active ? theme.text : theme.textSecondary }]}>{tab.label}</Text>
                  <Text style={[styles.count, { color: active ? theme.accent : theme.textMuted }]}>{counts[tab.id]}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {activeTab === 'saved' && (
          <FlatList
            key={`saved-${columnCount}`}
            data={savedItems}
            numColumns={columnCount}
            keyExtractor={(item) => `${item.media_type || 'movie'}_${item.id}`}
            contentContainerStyle={[styles.listContent, { paddingHorizontal: horizontalPadding }]}
            columnWrapperStyle={{ gap: gridGap }}
            ListEmptyComponent={emptyState('bookmark-outline', 'Your list is ready for its first story', 'Save a movie or series and it will appear here.')}
            renderItem={({ item }) => (
              <MediaCard item={item} width={cardWidth} height={cardWidth * 1.52} style={{ marginRight: 0, marginBottom: 18 }} onPress={() => openDetails(item.id, item.media_type === 'tv' ? 'tv' : 'movie')} />
            )}
          />
        )}

        {activeTab === 'continue' && (
          <FlatList
            data={continueItems}
            keyExtractor={(entry) => entry.key}
            contentContainerStyle={[styles.listContent, styles.continueList, { paddingHorizontal: horizontalPadding }]}
            ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
            ListEmptyComponent={emptyState('play-circle-outline', 'Nothing waiting to resume', 'Verified playback appears here after 30 seconds.')}
            renderItem={({ item }) => (
              <ContinueWatchingCard
                entry={item}
                fullWidth
                onResume={() => resumeProgress(item)}
                onOpenDetails={() => openDetails(item.progress.mediaIdentity.id, item.progress.mediaIdentity.mediaType)}
                onRemove={() => removeProgress(item.key)}
                onMarkWatched={() => markProgressWatched(item.key)}
              />
            )}
          />
        )}

        {activeTab === 'history' && (
          <FlatList
            data={historyItems}
            keyExtractor={(item) => item._key}
            contentContainerStyle={[styles.listContent, styles.historyList, { paddingHorizontal: horizontalPadding }]}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            ListEmptyComponent={emptyState('time-outline', 'No verified watch history', 'Movies and episodes enter History after Orion confirms advancing playback.')}
            renderItem={({ item }) => (
              <HistoryRow
                item={item}
                onResume={() => resumeHistory(item)}
                onOpenDetails={() => openDetails(item.id, item.media_type === 'tv' ? 'tv' : 'movie')}
                onRemove={() => {
                  Alert.alert('Remove from History?', 'Playback progress and watched state will remain unchanged.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Remove', style: 'destructive', onPress: () => removeHistoryEntry(item._key) },
                  ]);
                }}
              />
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  header: { paddingTop: 18, paddingBottom: 12, gap: 15 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 66, marginLeft: 48 },
  titleCopy: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  pageTitle: { fontSize: 34, lineHeight: 40, fontWeight: '900', letterSpacing: -1 },
  headerAction: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tabs: { gap: 9, paddingRight: 4 },
  tab: { minHeight: 46, borderWidth: 1, borderRadius: 23, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 7 },
  tabText: { fontSize: 14, fontWeight: '700' },
  count: { fontSize: 12, fontWeight: '800', minWidth: 12, textAlign: 'center' },
  listContent: { paddingTop: 12, paddingBottom: 96, flexGrow: 1 },
  continueList: { width: '100%', maxWidth: 880, alignSelf: 'center' },
  historyList: { width: '100%', maxWidth: 980, alignSelf: 'center' },
  emptyState: { minHeight: 300, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 7 },
  emptyMessage: { maxWidth: 380, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  pressed: { opacity: 0.7 },
});
