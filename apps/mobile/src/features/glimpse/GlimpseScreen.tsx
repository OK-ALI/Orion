import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, FlatList, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radii, spacing } from '@orion/shared/tokens';
import { useOrionTheme } from '../../context/ThemeContext';
import { usePerformanceProfile } from '../../context/PerformanceContext';
import { useNetworkStatus } from '../../context/NetworkContext';
import { resolveMotionPolicy } from '../../services/motionPolicy';
import { useResponsiveLayout } from '../../services/responsive';
import { MobilePageHeader } from '../../components/MobilePageHeader';
import { LibrarySortDialog } from '../library/LibrarySortDialog';
import { MOBILE_LIBRARY_SORT_OPTIONS } from '../library/librarySort';
import { glimpseDestination, type GlimpseReel } from './glimpseModel';
import { activeGlimpseReel, glimpseRenderBudget, settledGlimpseIndex } from './glimpsePolicy';
import { useGlimpseForeground } from './useGlimpseForeground';
import { useGlimpseFeed } from './useGlimpseFeed';
import { useGlimpseLikes } from './useGlimpseLikes';
import { useGlimpsePreferences, type GlimpseTab } from './glimpsePreferences';
import { GlimpseFeedOrder } from './GlimpseFeedOrder';
import { sortGlimpseReels } from './glimpseTitleMetadata';
import { defaultGlimpseFilters, filterGlimpseReels, rankGlimpseSearch, type GlimpseFilters } from './glimpseBrowse';
import { recordFeedbackEvent } from '../feedback/feedbackDiagnostics';
import { GlimpseStage } from './GlimpseStage';
import { GlimpseControls } from './GlimpseControls';
import { glimpseLoadFailureCopy } from './glimpseLoadFailure';
import { glimpseStageWidth } from './glimpseLayout';
import { glimpseYouTubeUrl, type GlimpseVideoFailure } from './glimpseEmbed';

export default function GlimpseScreen() {
  const { theme, preferences, systemReducedMotion } = useOrionTheme();
  const motion = resolveMotionPolicy(preferences.reducedMotion, systemReducedMotion);
  const { resolvedProfile } = usePerformanceProfile();
  const budget = glimpseRenderBudget(resolvedProfile);
  const network = useNetworkStatus();
  const focused = useIsFocused();
  const foreground = useGlimpseForeground();
  const { isLandscape } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const likes = useGlimpseLikes();
  const local = useGlimpsePreferences();
  const { welcomeDiscover } = useLocalSearchParams<{ welcomeDiscover?: string }>();
  const initialPosition = useRef(local.preferences.rememberPosition ? local.preferences.position : null).current;
  const [tab, setTab] = useState<GlimpseTab>(welcomeDiscover === '1' ? 'discover' : initialPosition?.tab || 'discover');
  const [selectedIds, setSelectedIds] = useState<Record<GlimpseTab, string | null>>({
    discover: initialPosition?.tab === 'discover' ? initialPosition.reel.id : null,
    liked: initialPosition?.tab === 'liked' ? initialPosition.reel.id : null,
  });
  const positions = useRef({ discover: 0, liked: 0 });
  const interaction = useRef(false);
  const dragging = useRef(false);
  const dragOrigin = useRef(0);
  const edgeSwipe = useRef(false);
  const [scrolling, setScrolling] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [controlsBlocked, setControlsBlocked] = useState(false);
  const [controlsExpanded, setControlsExpanded] = useState(false);
  const controlsOcclusion = useRef(false);
  const blockControls = useCallback((blocked: boolean) => { controlsOcclusion.current = blocked; setControlsBlocked(blocked); }, []);
  const [sortVisible, setSortVisible] = useState(false);
  const pendingAdvance = useRef<{ id: string; automatic: boolean; skipUnavailable: boolean } | null>(null);
  const [waitingForNext, setWaitingForNext] = useState(false);
  const cancelAdvance = () => { pendingAdvance.current = null; setWaitingForNext(false); };
  const [queries, setQueries] = useState({ discover: '', liked: '' });
  const [filters, setFilters] = useState<Record<GlimpseTab, GlimpseFilters>>({ discover: defaultGlimpseFilters(), liked: defaultGlimpseFilters() });
  const [muted, setMuted] = useState(local.preferences.startMuted);
  const [failed, setFailed] = useState<Map<string, GlimpseVideoFailure>>(() => new Map());
  const [pageHeight, setPageHeight] = useState(0);
  const [pageWidth, setPageWidth] = useState(0);
  const [alignedData, setAlignedData] = useState<string | null>(null);
  const list = useRef<FlatList<GlimpseReel>>(null);
  const enabled = focused && foreground && network.remoteReady && tab === 'discover' && !navigating && !controlsBlocked && !sortVisible && !scrolling;
  const feedView = useMemo(() => ({ filters: filters.discover, query: queries.discover }), [filters.discover, queries.discover]);
  const viewKey = JSON.stringify(feedView);
  const previousView = useRef(viewKey);
  if (previousView.current !== viewKey) positions.current.discover = 0;
  useEffect(() => {
    if (previousView.current === viewKey) return;
    previousView.current = viewKey; cancelAdvance(); setFailed(new Map());
    setSelectedIds(value => ({ ...value, discover: null }));
  }, [viewKey]);
  const feed = useGlimpseFeed(enabled, budget.titleBatch, initialPosition?.tab === 'discover' ? initialPosition.reel : null, feedView);
  const baseReels = tab === 'liked' ? likes.reels : feed.reels;
  const feedOrder = useRef(new GlimpseFeedOrder()).current;
  const reels = useMemo(() => {
    const sorted = rankGlimpseSearch(sortGlimpseReels(filterGlimpseReels(baseReels, filters[tab], queries[tab]), local.preferences.sorts[tab]), queries[tab]);
    return tab === 'discover' ? feedOrder.order(viewKey + ':' + local.preferences.sorts.discover, sorted, selectedIds.discover, positions.current.discover) : sorted;
  }, [baseReels, filters, queries, tab, local.preferences.sorts, viewKey, selectedIds.discover, feedOrder]);
  const selectedIndex = reels.findIndex(reel => reel.id === selectedIds[tab]);
  const index = selectedIndex >= 0 ? selectedIndex : Math.min(positions.current[tab], Math.max(0, reels.length - 1));
  positions.current[tab] = index;
  const current = reels[index];
  // Appending behind the same reel preserves its native offset and player.
  const dataKey = tab + ':' + (current?.id || '') + ':' + index;
  const active = activeGlimpseReel({ focused, foreground, remoteReady: network.remoteReady,
    discover: tab === 'discover', liked: tab === 'liked', scrolling: scrolling || alignedData !== dataKey,
    navigating: navigating || controlsBlocked || sortVisible,
    reelId: current && !failed.has(current.id) ? current.id : null });
  const activeRef = useRef(active); activeRef.current = active;
  feed.activeId.current = selectedIds.discover || feed.reels[0]?.id || null;
  const select = (id: string | null) => setSelectedIds(value => value[tab] === id ? value : ({ ...value, [tab]: id }));
  useEffect(() => { setMuted(local.preferences.startMuted); }, [local.preferences.startMuted]);
  useEffect(() => { if (focused && foreground) { interaction.current = false; dragging.current = false; setNavigating(false); setScrolling(false); } }, [focused, foreground]);
  useEffect(() => { if (current && selectedIds[tab] !== current.id) select(current.id); }, [tab, selectedIds[tab], current?.id]);
  useEffect(() => {
    if (pageHeight > 0 && !dragging.current && !interaction.current) {
      list.current?.scrollToOffset({ offset: index * pageHeight, animated: false });
      setAlignedData(dataKey); interaction.current = false; setScrolling(false);
    }
  }, [pageHeight, dataKey]);
  useEffect(() => {
    // Demand follows the visible sorted/filtered window, not raw catalog indices.
    // Space barren probes to avoid a tight request loop.
    if (!enabled || scrolling || feed.status !== 'ready' || feed.exhausted) return;
    if (!waitingForNext && feed.reels.length > 0 && (reels.length === 0 || index < reels.length - 1 - Math.max(1, budget.metadataAhead))) return;
    const timer = setTimeout(() => { void feed.loadMore(); }, 350);
    return () => clearTimeout(timer);
  }, [enabled, scrolling, feed.status, feed.exhausted, feed.reels, reels.length, index, budget.metadataAhead, feed.loadMore, waitingForNext]);
  useEffect(() => {
    const saved = local.preferences.position;
    if (local.preferences.rememberPosition && !local.unavailable && focused && !scrolling && !navigating && alignedData === dataKey && current
      && (saved?.tab !== tab || saved.reel.id !== current.id)) local.update({ position: { tab, reel: current } });
  }, [local.preferences.rememberPosition, local.preferences.position, local.unavailable, focused, scrolling, navigating, alignedData, dataKey, current?.id, tab, local.update]);
  const move = (next: number) => {
    if (next < 0 || next >= reels.length || pageHeight <= 0) return;
    interaction.current = true; setScrolling(true); select(reels[next]?.id || null);
    list.current?.scrollToOffset({ offset: next * pageHeight, animated: !motion.reduceMotion });
    if (motion.reduceMotion) {
      setAlignedData(tab + ':' + reels[next].id + ':' + next);
      interaction.current = false; setScrolling(false);
    }
  };
  const settle = (offset: number) => {
    const next = settledGlimpseIndex(offset, pageHeight, reels.length);
    select(reels[next]?.id || null);
    list.current?.scrollToOffset({ offset: next * pageHeight, animated: false });
    dragging.current = false; interaction.current = false;
    setAlignedData(tab + ':' + (reels[next]?.id || '') + ':' + next); setScrolling(false);
    if (edgeSwipe.current && next === reels.length - 1 && reels[next]) nextReel(reels[next].id);
    edgeSwipe.current = false;
  };
  const nextReel = (id: string, automatic = false, skipUnavailable = false) => {
    const from = reels.findIndex(reel => reel.id === id);
    if (from < 0) return;
    cancelAdvance();
    const next = reels.findIndex((reel, offset) => offset > from && (!skipUnavailable || !failed.has(reel.id)));
    if (next >= 0) { move(next); return; }
    if (tab === 'discover' && !feed.exhausted && enabled) {
      pendingAdvance.current = { id, automatic, skipUnavailable }; setWaitingForNext(true);
      if (feed.status !== 'error') void feed.loadMore();
    }
  };
  useEffect(() => {
    const pending = pendingAdvance.current;
    if (!pending) return;
    if (!enabled || navigating || sortVisible || controlsBlocked || scrolling || current?.id !== pending.id
      || (pending.automatic && !local.preferences.autoAdvance)) { cancelAdvance(); return; }
    const next = reels.findIndex((reel, offset) => offset > index && (!pending.skipUnavailable || !failed.has(reel.id)));
    if (next >= 0 && alignedData === dataKey) {
      cancelAdvance(); move(next);
    } else if (feed.exhausted) cancelAdvance();
  }, [enabled, navigating, sortVisible, controlsBlocked, scrolling, current?.id, local.preferences.autoAdvance,
    reels, index, alignedData, dataKey, feed.exhausted, failed]);
  const leave = (destination: Parameters<typeof router.push>[0]) => {
    cancelAdvance(); interaction.current = true; setNavigating(true); router.push(destination);
  };
  const noMatches = baseReels.length > 0 && reels.length === 0;
  const header = <MobilePageHeader eyebrow="DISCOVER STORIES" title="Glimpse" compact={controlsExpanded} subtitle={isLandscape || controlsExpanded ? undefined : 'Discover stories through a clip.'}
      reserveFloatingTriggerInLandscape trailing={<Pressable accessibilityRole="button" accessibilityLabel="Glimpse settings"
        onPress={() => leave({ pathname: '/settings', params: { section: 'glimpse', glimpseEntry: String(Date.now()) } })} style={styles.icon}>
        <Ionicons name="settings-outline" size={22} color={theme.accent} />
      </Pressable>} />;
  const controls = <View><View style={[styles.tabs, { borderColor: theme.border }]}>
        {(['discover', 'liked'] as const).map(value => <Pressable key={value} accessibilityRole="tab"
          accessibilityLabel={value === 'discover' ? 'Discover Glimpse' : 'Liked Glimpse'} accessibilityState={{ selected: tab === value }}
          onPress={() => { if (tab !== value) { cancelAdvance(); interaction.current = false; setScrolling(true); controlsOcclusion.current = false; setControlsBlocked(false); setTab(value); } }}
          style={[styles.tab, { backgroundColor: tab === value ? theme.accentSoft : 'transparent' }]}>
          <Text style={[styles.tabLabel, { color: tab === value ? theme.text : theme.textSecondary }]}>{value === 'discover' ? 'Discover' : 'Liked'}</Text>
        </Pressable>)}
      </View>
      <GlimpseControls key={tab} query={queries[tab]} onQuery={query => setQueries(value => ({ ...value, [tab]: query }))}
        filters={filters[tab]} onFilters={value => setFilters(previous => ({ ...previous, [tab]: value }))}
        sort={local.preferences.sorts[tab]} onSort={() => { cancelAdvance(); interaction.current = true; setSortVisible(true); }}
        localSearch={tab === 'liked'} unavailable={local.unavailable} onOcclusion={blockControls} onExpanded={setControlsExpanded} />
      {(likes.unavailable || likes.saveError || local.unavailable || local.saveError) && <Text accessibilityLiveRegion="polite" style={[styles.footerCopy, { color: theme.accent }]}>
        {likes.unavailable ? 'Liked clips are unavailable on this device.' : likes.saveError ? 'This Like could not be saved. Please try again.'
          : local.unavailable ? 'Glimpse preferences are unavailable on this device.' : 'This preference could not be saved. Please try again.'}
      </Text>}</View>;
  const feedContent = <View style={styles.feed}><View style={styles.viewport} onLayout={event => {
        setPageWidth(event.nativeEvent.layout.width);
        if (event.nativeEvent.layout.height !== pageHeight) setPageHeight(event.nativeEvent.layout.height);
      }}>
        {reels.length > 0 && pageHeight > 0 ? <FlatList ref={list} style={styles.clipList} data={reels}
          keyExtractor={reel => reel.id} initialNumToRender={budget.initialNumToRender}
          maxToRenderPerBatch={budget.maxToRenderPerBatch} windowSize={budget.windowSize}
          extraData={[active, index, muted, failed, pageHeight, likes.document]} showsVerticalScrollIndicator={false}
          removeClippedSubviews={false}
          snapToInterval={pageHeight} decelerationRate="fast" disableIntervalMomentum
          getItemLayout={(_, itemIndex) => ({ length: pageHeight, offset: itemIndex * pageHeight, index: itemIndex })}
          scrollEventThrottle={16}
          onScrollBeginDrag={() => { cancelAdvance(); edgeSwipe.current = false; dragOrigin.current = index * pageHeight; dragging.current = true; interaction.current = true; }}
          onScroll={event => {
            if (interaction.current && Math.abs(event.nativeEvent.contentOffset.y - dragOrigin.current) >= Math.min(24, Math.max(12, pageHeight * 0.04))) setScrolling(true);
          }}
          onScrollEndDrag={event => {
            const velocity = event.nativeEvent.velocity?.y;
            edgeSwipe.current = index === reels.length - 1 && (velocity || 0) > 0;
            if (velocity === undefined || Math.abs(velocity) < 0.05) settle(event.nativeEvent.contentOffset.y);
          }}
          onMomentumScrollBegin={() => { if (dragging.current || scrolling) interaction.current = true; }}
          onMomentumScrollEnd={event => { if (dragging.current || interaction.current) settle(event.nativeEvent.contentOffset.y); }}
          renderItem={({ item, index: itemIndex }) => <View importantForAccessibility={itemIndex === index ? 'auto' : 'no-hide-descendants'}
            style={[styles.reelRow, { height: pageHeight, paddingBottom: spacing[2] }]}>
            <View style={{ width: '100%', flex: 1, height: '100%', maxWidth: glimpseStageWidth(pageWidth, pageHeight, isLandscape) }}>
            <GlimpseStage onEvidence={event => recordFeedbackEvent({ at: Date.now(), area: 'Glimpse', event: event === 'selected' ? 'reel-selected' : 'failure', ...(event === 'failed' ? { code: 'GLIMPSE_SOURCE_FAILED' } : {}), mediaId: item.media.tmdbId, mediaType: item.media.mediaType, sourceType: 'youtube', owned: true }, event === 'failed')} ambientGlow={active === item.id && local.preferences.ambientGlow} profile={resolvedProfile} reducedMotion={motion.reduceMotion} compact={isLandscape} reel={item} selected={itemIndex === index} active={active === item.id} unavailable={!network.remoteReady}
              failed={failed.has(item.id)} failure={failed.get(item.id)} muted={muted}
              onRetry={() => { cancelAdvance(); setFailed(value => { const next = new Map(value); next.delete(item.id); return next; }); }}
              onOpenYouTube={() => {
                cancelAdvance(); interaction.current = true; setNavigating(true);
                // Release before the explicit source handoff; iframe navigation remains blocked.
                requestAnimationFrame(() => { void Linking.openURL(glimpseYouTubeUrl(item)).catch(() => {
                  interaction.current = false; setNavigating(false); AccessibilityInfo.announceForAccessibility('YouTube could not open. Please try again.');
                }); });
              }} liked={likes.document.records[item.id]?.tombstone === false}
              likesUnavailable={likes.unavailable} onLike={() => likes.toggle(item)} onMute={() => setMuted(value => !value)}
              hasPrevious={itemIndex > 0} hasNext={itemIndex + 1 < reels.length} onPrevious={() => { cancelAdvance(); move(itemIndex - 1); }} onNext={() => nextReel(item.id)}
              onEnded={() => { if (local.preferences.autoAdvance && activeRef.current === item.id && !interaction.current && !controlsOcclusion.current) nextReel(item.id, true); }}
              onFailure={reason => {
                setFailed(value => new Map([...value, [item.id, reason || { kind: 'unknown', code: null }] as const].slice(-512)));
                if (tab === 'discover' && activeRef.current === item.id && !interaction.current && !controlsOcclusion.current) nextReel(item.id, false, true);
              }} onView={() => leave(glimpseDestination(item))} />
            </View>
          </View>} /> : <View style={styles.empty}>
          {enabled && feed.status === 'loading' && !noMatches && <ActivityIndicator color={theme.accent} />}
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            {noMatches ? 'No matching clips' : tab === 'liked' ? 'No liked clips yet' : !network.remoteReady ? 'Glimpse needs a connection'
              : feed.status === 'loading' ? 'Finding clips…' : feed.status === 'error' ? 'Clips could not load' : feed.exhausted ? 'No matching clips available' : 'No clips found yet'}
          </Text>
          <Text style={[styles.emptyCopy, { color: theme.textSecondary }]}>
            {noMatches ? tab === 'liked' ? 'No saved clips match these filters.' : 'No clips match your search and filters.' : tab === 'liked' ? 'Like a clip to keep it here. Streaming needs a connection.'
              : !network.remoteReady ? 'Saved content remains available. Glimpse will resume when connected.'
                : feed.status === 'error' ? glimpseLoadFailureCopy(feed.failure) : feed.exhausted ? queries[tab].trim() ? 'No clips are available for this search. Try another title or adjust filters.' : 'You’ve reached the end. Try another region or title.' : 'Clips load automatically as you explore.'}
          </Text>
          {enabled && feed.status === 'error' && !feed.exhausted && <Pressable accessibilityRole="button" accessibilityLabel="Retry Glimpse clips"
            onPress={() => void feed.loadMore()} style={[styles.retry, { backgroundColor: theme.accentSoft }]}>
            <Text style={{ color: theme.text }}>Retry</Text>
          </Pressable>}
        </View>}
        {reels.length > 0 && pageHeight > 0 && <View style={styles.sideRail}>
              <Pressable accessibilityRole="button" accessibilityLabel="Previous reel" disabled={index === 0}
                accessibilityState={{ disabled: index === 0 }} style={[styles.railButton, { opacity: index > 0 ? 1 : 0.35 }]}
                onPress={() => { cancelAdvance(); move(index - 1); }}>
                <View style={[styles.railIcon, { borderColor: theme.border, backgroundColor: theme.elevated }]}><Ionicons name="chevron-up" size={22} color={theme.text} /></View>
                <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[styles.railLabel, { color: theme.textSecondary }]}>Prev</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Next reel" disabled={index + 1 >= reels.length && (tab === 'liked' || feed.exhausted)}
                accessibilityState={{ disabled: index + 1 >= reels.length && (tab === 'liked' || feed.exhausted) }}
                style={[styles.railButton, { opacity: index + 1 < reels.length || (tab === 'discover' && !feed.exhausted) ? 1 : 0.35 }]}
                onPress={() => current && nextReel(current.id)}>
                <View style={[styles.railIcon, { borderColor: theme.border, backgroundColor: theme.elevated }]}><Ionicons name="chevron-down" size={22} color={theme.text} /></View>
                <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[styles.railLabel, { color: theme.textSecondary }]}>Next</Text></Pressable>
            </View>}
      </View>
      {reels.length > 0 && <View style={styles.footer}>
        <Text accessibilityLiveRegion="polite" numberOfLines={2} style={[styles.footerCopy, { color: theme.textMuted }]}>
          {!network.remoteReady ? 'Streaming unavailable offline' : tab === 'liked' ? 'Liked clips stay on this device.'
            : feed.status === 'error' ? glimpseLoadFailureCopy(feed.failure)
            : waitingForNext ? 'Finding the next clip…' : feed.status === 'loading' ? 'Finding more clips…'
              : feed.exhausted && index === reels.length - 1 ? queries[tab].trim() ? 'No more clips for this search.' : 'You’ve reached the end.' : 'Swipe to explore'}
        </Text>
        {enabled && feed.status === 'error' && !feed.exhausted && <Pressable accessibilityRole="button"
          accessibilityLabel="Retry Glimpse clips" style={styles.more} onPress={() => void feed.loadMore()}><Text style={{ color: theme.accent }}>Retry</Text></Pressable>}
      </View>}
      </View>;
  const sortDialog = <LibrarySortDialog eyebrow="GLIMPSE" visible={sortVisible} selected={local.preferences.sorts[tab]}
        onDismiss={() => { interaction.current = false; setSortVisible(false); }} onSelect={sort => {
          if (local.update({ sorts: { ...local.preferences.sorts, [tab]: sort } })) {
            const label = MOBILE_LIBRARY_SORT_OPTIONS.find(option => option.id === sort)?.label;
            AccessibilityInfo.announceForAccessibility('Glimpse sorted by ' + label + '.');
          }
          interaction.current = false; setSortVisible(false);
        }} />;
  const contentInsets = { paddingLeft: insets.left + spacing[4], paddingRight: insets.right + spacing[4], paddingBottom: Math.max(insets.bottom, 8) + spacing[2] };
  return <View style={[styles.screen, isLandscape && styles.landscape, { backgroundColor: theme.background }]}>
    {isLandscape ? <ScrollView style={styles.landscapePanel} contentContainerStyle={{ paddingBottom: insets.bottom }}>
      {header}<View style={styles.panelControls}>{controls}</View>
    </ScrollView> : header}
    <View style={[styles.body, contentInsets, isLandscape && { paddingLeft: spacing[3], paddingTop: insets.top + spacing[2] }]}>
      {!isLandscape && controls}{feedContent}{sortDialog}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1 }, landscape: { flexDirection: 'row' }, landscapePanel: { width: 260, flexGrow: 0, flexShrink: 0 }, panelControls: { paddingHorizontal: spacing[4] }, body: { flex: 1, minHeight: 0 },
  tabs: { flexDirection: 'row', borderWidth: 1, borderRadius: radii.lg, padding: spacing[1], marginBottom: spacing[2] },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md }, tabLabel: { fontSize: 14, fontWeight: '700' },
  reelRow: { alignItems: 'flex-start', width: '100%' }, clipList: { flex: 1, minWidth: 0 },
  sideRail: { width: 48, alignItems: 'center', justifyContent: 'center', gap: spacing[3], flexShrink: 0 },
  railButton: { minWidth: 44, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: spacing[1] },
  railIcon: { width: 44, height: 44, borderWidth: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }, railLabel: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
  feed: { flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center', minHeight: 0 }, viewport: { flex: 1, minHeight: 0, flexDirection: 'row', gap: spacing[2] },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing[3], padding: spacing[5] },
  emptyTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' }, emptyCopy: { fontSize: 14, textAlign: 'center' },
  retry: { minHeight: 44, padding: spacing[3], borderRadius: radii.lg }, footer: { minHeight: 44, paddingRight: 60, gap: spacing[2], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerCopy: { fontSize: 11, flexShrink: 1 }, more: { minHeight: 44, justifyContent: 'center', padding: spacing[2] },
  icon: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
