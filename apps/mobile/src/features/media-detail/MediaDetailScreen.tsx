import { View, Text, StyleSheet, Image, ScrollView, ActivityIndicator, Pressable, FlatList, Animated, useWindowDimensions, Modal, Share } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { spacing } from '@orion/shared/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { imgUrl } from '@orion/shared/api';
import { useMediaDetailRemoteState, mediaDetailConnectionCopy } from './useMediaDetailRemoteState';
import { useMediaDetailLocalAvailability, type MediaDetailLocalCopy } from './useMediaDetailLocalAvailability';
import { MediaDetailFallback, MediaDetailLocalCopies } from './MediaDetailFallback';
import { TmdbMediaItem } from '@orion/shared/types';
import { DownloadModal } from '../../components/DownloadModal';
import { TrailerModal } from '../../components/TrailerModal';
import { MediaCard } from '../../components/MediaCard';
import { useLibraryPlaybackActions, useLibraryVisual } from '../../context/LibraryContext';
import { useResponsiveLayout } from '../../services/responsive';
import { getRailRenderBudget } from '../../services/listPerformance';
import { useOrionTheme } from '../../context/ThemeContext';
import { usePerformanceProfile } from '../../context/PerformanceContext';
import { styles } from "./mediaDetailStyles";
import { EpisodeOverview } from './EpisodeOverview';
import { normalizeTrailerCandidates } from '../trailers/trailerCandidateService';
import { useMediaDetailWatched } from './useMediaDetailWatched';
import { EpisodeWatchedButton, MovieWatchedBadge, SeasonWatchedControl, WatchedFeedback } from './WatchedControls';
import { MovieCollectionTab } from './MovieCollectionTab';
import { isVerifiedPlaybackEvidence } from '../library/playbackLibrary';
import { createMobileDownloadTargetV1, type MobileDownloadTargetV1 } from '../downloads/downloadIdentity';
import { cancelMobileDownloadSourceResolutionV1, requestMobileDownloadSourceResolutionV1, type MobileDownloadTransferMethodV1 } from '../downloads/downloadCandidateCapture';
export default function MediaDetailScreen() {
  const { id, type } = useLocalSearchParams<{ id: string; type: 'movie' | 'tv' }>();
  const router = useRouter();
  const { theme } = useOrionTheme();
  const insets = useSafeAreaInsets();
  const { resolvedProfile } = usePerformanceProfile();
  const { toggleSave, isSaved } = useLibraryVisual();
  const { getPlaybackProgress } = useLibraryPlaybackActions();
  const [activeTab, setActiveTab] = useState<'info' | 'episodes' | 'cast' | 'recommended' | 'collection'>('info');
  const [downloadTarget, setDownloadTarget] = useState<MobileDownloadTargetV1 | null>(null);
  const pendingDownloadTargetRef = useRef<MobileDownloadTargetV1 | null>(null);
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [showTrailerModal, setShowTrailerModal] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const remote = useMediaDetailRemoteState({ id, type, selectedSeason, activeTab, showTrailerModal });
  const { data, loading, loadError, episodes, episodesLoading, seasonVideos, network, remoteReadyRef } = remote;
  const local = useMediaDetailLocalAvailability(id, type);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const detailScrollRef = useRef<ScrollView>(null);
  const detailContentYRef = useRef(0);
  const localCopiesYRef = useRef(0);
  const multipleOfflineEpisodes = type === 'tv' && local.copies.length > 1;
  const playOffline = (requested?: MediaDetailLocalCopy, season?: number, episode?: number) => {
    if (!requested && season === undefined && episode === undefined && type === 'tv' && local.getPlayableCopies().length > 1) {
      setActionMessage('Choose a downloaded episode from Offline Episodes.');
      detailScrollRef.current?.scrollTo({ y: Math.max(0, detailContentYRef.current + localCopiesYRef.current - 16), animated: false });
      return;
    }
    const copy = local.findPlayableCopy(requested?.asset.assetId, season, episode);
    if (!copy) { setActionMessage('No verified local copy is available. This action needs a connection.'); return; }
    const { entry, asset } = copy;
    router.push({ pathname: '/player/[id]', params: {
      id: String(entry.media.id), type: entry.media.mediaType,
      title: entry.media.episodeTitle || entry.media.title, year: entry.media.year ?? undefined,
      seriesTitle: entry.media.seriesTitle || undefined, season: entry.media.season ?? undefined,
      episode: entry.media.episode ?? undefined, episodeTitle: entry.media.episodeTitle || undefined,
      posterPath: entry.posterPath || entry.media.posterPath || undefined,
      backdropPath: entry.backdropPath || entry.media.backdropPath || undefined,
      isOffline: 'true', offlineAssetId: asset.assetId,
    } });
  };
  const connectionMessage = mediaDetailConnectionCopy(network.productState, local.copies.length > 0);
  const [, setProgressRefreshVersion] = useState(0);
  const { width, isTablet } = useResponsiveLayout();
  const { fontScale } = useWindowDimensions();
  const tabFadeAnim = useRef(new Animated.Value(1)).current;
  const handleTabChange = (tabKey: typeof activeTab) => {
    Animated.sequence([
      Animated.timing(tabFadeAnim, { toValue: 0.2, duration: 80, useNativeDriver: true }),
      Animated.timing(tabFadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
    setActiveTab(tabKey);
  };
  const isMovie = type === 'movie';
  const watchedActions = useMediaDetailWatched({
    data,
    immediateRecord: local.record || { id, title: 'This movie', media_type: type },
    type,
    seriesId: id,
    title: isMovie ? (data?.title || local.record?.title || 'This movie') : (data?.name || local.record?.name || 'This show'),
    selectedSeason,
    episodes,
  });
  const castList = useMemo(() => data?.credits?.cast || [], [data?.credits?.cast]);
  const topCast = useMemo(() => castList.slice(0, 15), [castList]);
  const fullCast = useMemo(() => castList.slice(0, 25), [castList]);
  const recommendedItems = useMemo(() => (data?.recommendations?.results || []).filter((item: any) => item.poster_path).map((item: TmdbMediaItem) => ({ ...item, media_type: type } as TmdbMediaItem)), [data?.recommendations?.results, type]);
  const castRenderBudget = useMemo(() => getRailRenderBudget(width, 106 + spacing[3], resolvedProfile), [resolvedProfile, width]);
  const recommendationRenderBudget = useMemo(() => getRailRenderBudget(width, 140 + spacing[4] + spacing[3], resolvedProfile), [resolvedProfile, width]);
  const collectionRef = useMemo(() => {
    if (!isMovie || !data?.belongs_to_collection?.id) return null;
    return {
      id: Number(data.belongs_to_collection.id),
      name: String(data.belongs_to_collection.name || 'Movie Collection'),
    };
  }, [data?.belongs_to_collection?.id, data?.belongs_to_collection?.name, isMovie]);
  const fitCollectionTabs = isMovie && !!collectionRef && !isTablet && fontScale <= 1.05;
  const openCollectionMovie = useCallback((movieId: number) => {
    if (String(movieId) === String(id)) return;
    router.push({
      pathname: '/media/[id]',
      params: { id: String(movieId), type: 'movie' },
    });
  }, [id, router]);
  useFocusEffect(
    useCallback(() => {
      setProgressRefreshVersion((version) => version + 1);
      const pendingDownloadTarget = pendingDownloadTargetRef.current;
      if (pendingDownloadTarget && remoteReadyRef.current) {
        pendingDownloadTargetRef.current = null;
        setDownloadTarget(pendingDownloadTarget);
      }
    }, []),
  );
  const closeDownloadOptions = useCallback(() => {
    if (downloadTarget) cancelMobileDownloadSourceResolutionV1(downloadTarget.itemKey);
    setDownloadTarget(null);
  }, [downloadTarget]);
  const resolveDownloadSource = useCallback((target: MobileDownloadTargetV1, method: MobileDownloadTransferMethodV1) => {
    if (!remoteReadyRef.current || String(target.media.id) !== String(id) || target.media.mediaType !== type) return;
    requestMobileDownloadSourceResolutionV1(target.itemKey, method);
    pendingDownloadTargetRef.current = target;
    setDownloadTarget(null);
    router.push({
      pathname: '/player/[id]',
      params: {
        id: String(target.media.id),
        type: target.media.mediaType,
        title: target.media.title,
        year: target.media.year ?? undefined,
        seriesTitle: target.media.seriesTitle || undefined,
        season: target.media.season ?? undefined,
        episode: target.media.episode ?? undefined,
        episodeTitle: target.media.episodeTitle || undefined,
        posterPath: target.media.posterPath || undefined,
        backdropPath: target.media.backdropPath || undefined,
      },
    });
  }, [router, id, type, remoteReadyRef]);
  useEffect(() => {
    setActionMessage(null);
    if (downloadTarget) cancelMobileDownloadSourceResolutionV1(downloadTarget.itemKey);
    if (pendingDownloadTargetRef.current) cancelMobileDownloadSourceResolutionV1(pendingDownloadTargetRef.current.itemKey);
    pendingDownloadTargetRef.current = null;
    setDownloadTarget(null);
  }, [id, type, network.remoteReady]);
  if (loading && !data && !local.record && !isMovie) {
    return <View style={[styles.container, styles.centered, { backgroundColor: theme.background }]}><ActivityIndicator size="large" color={theme.accent} /></View>;
  }
  if (!data) {
    return <MediaDetailFallback title={local.record?.title} year={local.record?.year} copies={local.copies}
      message={actionMessage || (!network.remoteReady ? connectionMessage : loadError || connectionMessage)}
      checkingLocal={local.reconciliation === 'checking'} remoteReady={network.remoteReady} loading={loading}
      saved={!!local.record && isSaved(local.record)} watched={watchedActions.movieWatched}
      onPlay={playOffline} onOpenLibrary={() => router.push('/(tabs)/downloads')} onBack={() => router.back()}
      onRetry={remote.retry} onSave={() => { if (local.record) toggleSave(local.record); }}
      onWatched={isMovie ? watchedActions.toggleMovieWatched : undefined} />;
  }
  const title = isMovie ? data.title : data.name;
  const year = isMovie ? data.release_date?.slice(0, 4) : data.first_air_date?.slice(0, 4);
  const runtime = isMovie ? `${data.runtime || 0}m` : `${data.number_of_seasons || 1} Seasons`;
  const genres = data.genres?.map((g: any) => g.name).join(' • ');
  const backdrop = imgUrl(data.backdrop_path, 'original');
  const poster = imgUrl(data.poster_path, 'w500');
  const releaseDateStr = isMovie ? data.release_date : data.first_air_date;
  const isUnreleased = releaseDateStr ? new Date(releaseDateStr) > new Date() : false;
  const mainVideoResults: any[] = data.videos?.results || [];
  const originalLanguage = String(data.original_language || 'en').toLowerCase();
  const preferredLanguage = (() => {
    try { return Intl.DateTimeFormat().resolvedOptions().locale.split('-')[0]?.toLowerCase() || originalLanguage; }
    catch { return originalLanguage; }
  })();
  const allTrailers = normalizeTrailerCandidates(mainVideoResults, seasonVideos, preferredLanguage, originalLanguage);
  const trailerObj = allTrailers[0];
  const heroText = theme.dark ? '#ffffff' : theme.text;
  const heroSecondary = theme.dark ? 'rgba(255,255,255,0.82)' : theme.textSecondary;
  const heroSurface = theme.dark ? 'rgba(255,255,255,0.10)' : theme.surface;
  const heroBorder = theme.dark ? 'rgba(255,255,255,0.18)' : theme.border;
  const backdropFadeColors = theme.dark
    ? ['rgba(5,5,10,0.10)', 'rgba(5,5,10,0.52)', 'rgba(5,5,10,0.84)', theme.background] as const
    : [`${theme.background}00`, `${theme.background}52`, `${theme.background}E8`, theme.background] as const;
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={6}
        onPress={() => router.back()}
        style={[styles.backButton, { top: Math.max(insets.top + 8, 16) }]}
      >
        <Ionicons name="arrow-back" size={20} color="#fff" />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isMovie ? `Download ${title}` : `Download episodes of ${title}`}
        accessibilityHint={!network.remoteReady ? 'Downloading new media needs a connection' : isMovie ? 'Opens download options' : 'Opens the episode list where you can choose episodes to download'}
        accessibilityState={{ disabled: !network.remoteReady }}
        disabled={!network.remoteReady}
        hitSlop={6}
        onPress={() => {
          if (!remoteReadyRef.current) return;
          if (isMovie) {
            setDownloadTarget(createMobileDownloadTargetV1({
              id,
              mediaType: type,
              title,
              year,
              posterPath: data.poster_path || null,
              backdropPath: data.backdrop_path || null,
            }));
            return;
          }

          handleTabChange('episodes');
        }}
        style={({ pressed }) => [
          styles.topDownloadButton,
          { top: Math.max(insets.top + 8, 16) },
          pressed && styles.pressed,
        ]}
      >
        <BlurView
          intensity={34}
          tint={theme.dark ? 'dark' : 'light'}
          style={styles.topDownloadGlass}
        >
          <Ionicons name="download-outline" size={18} color="#fff" />
        </BlurView>
      </Pressable>

      <Animated.ScrollView ref={detailScrollRef} style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={styles.backdropContainer}>
          {backdrop ? (
            <Image source={{ uri: backdrop }} style={styles.backdropImage} />
          ) : (
            <View style={[styles.backdropImage, { backgroundColor: theme.surface }]} />
          )}
          <LinearGradient
            colors={backdropFadeColors}
            locations={[0, 0.4, 0.75, 1]}
            style={styles.backdropGradient}
          />
        </View>
        <View style={styles.detailsContent} onLayout={(event) => { detailContentYRef.current = event.nativeEvent.layout.y; }}>
          {isUnreleased && (
            <View style={styles.unreleasedBannerTop}>
              <Ionicons name="lock-closed" size={16} color="#f87171" />
              <Text style={styles.unreleasedBannerText}>
                UNRELEASED MEDIA • Releasing {releaseDateStr ? new Date(releaseDateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Soon'}
              </Text>
            </View>
          )}
          <View style={styles.headerRow}>
            <View style={styles.posterWrapper}>
              {poster && <Image source={{ uri: poster }} style={[styles.posterImage, { borderColor: heroBorder }]} />}
              {isUnreleased && (
                <View style={styles.posterLockOverlay}>
                  <Ionicons name="lock-closed" size={32} color="#f87171" />
                  <Text style={styles.posterLockText}>UNRELEASED</Text>
                </View>
              )}
            </View>
            <View style={styles.headerMeta}>
              <Text accessibilityRole="header" style={[
                styles.titleText,
                {
                  color: heroText,
                  textShadowColor: theme.dark ? 'rgba(0,0,0,0.95)' : 'transparent',
                  textShadowOffset: theme.dark ? { width: 0, height: 2 } : { width: 0, height: 0 },
                  textShadowRadius: theme.dark ? 10 : 0,
                },
              ]}>{title}</Text>
              <View style={styles.metaBadgeRow}>
                {!!data.vote_average && (
                  <View style={styles.ratingBadge}>
                    <Ionicons name="star" size={12} color="#fbbf24" />
                    <Text style={[styles.metaText, { color: heroText }]}>{data.vote_average.toFixed(1)}</Text>
                  </View>
                )}
                <Text style={[styles.metaText, { color: heroSecondary }]}>{year}</Text>
                <Text style={[styles.metaText, { color: heroSecondary }]}>•</Text>
                <Text style={[styles.metaText, { color: heroSecondary }]}>{runtime}</Text>
                <View style={[styles.hdBadge, { backgroundColor: heroSurface, borderColor: heroBorder }]}>
                  <Text style={[styles.hdText, { color: heroText }]}>HD</Text>
                </View>
              </View>
              {genres && (
                <View style={styles.genreInlineRow}>
                  <Text style={[
                    styles.genreInlineText,
                    {
                      color: theme.accent,
                      textShadowColor: theme.dark ? 'rgba(0,0,0,0.9)' : 'transparent',
                      textShadowOffset: theme.dark ? { width: 0, height: 1 } : { width: 0, height: 0 },
                      textShadowRadius: theme.dark ? 4 : 0,
                    },
                  ]} numberOfLines={2}>{genres}</Text>
                </View>
              )}
              {isMovie && <MovieWatchedBadge watched={watchedActions.movieWatched} theme={theme} />}
            </View>
          </View>
          {(!network.remoteReady || loadError || actionMessage) && <Text accessibilityLiveRegion="polite" style={[styles.overviewText, { color: theme.textSecondary }]}>
            {actionMessage || (!network.remoteReady ? connectionMessage + ' Streaming, trailers and new downloads need a connection.' : loadError)}
          </Text>}
          <View onLayout={(event) => { localCopiesYRef.current = event.nativeEvent.layout.y; }}>
            <MediaDetailLocalCopies presentation={network.productState === 'online' ? 'compact' : 'card'} copies={local.copies} onPlay={playOffline} onOpenLibrary={() => router.push('/(tabs)/downloads')} />
          </View>
          <View style={[styles.actionStack, isTablet && styles.actionRowTablet]}>
            {isUnreleased ? (
              <View style={styles.unreleasedBtn}>
                <Ionicons name="lock-closed" size={16} color="#f87171" />
                <Text style={styles.unreleasedBtnText}>Unreleased</Text>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={!network.remoteReady && local.copies.length ? (multipleOfflineEpisodes ? 'Offline Episodes' : `Play ${title} offline`) : `Watch ${title}`}
                accessibilityHint={!network.remoteReady ? (multipleOfflineEpisodes ? 'Choose an episode from your downloaded episodes' : local.copies.length ? 'Plays the verified downloaded copy listed above' : 'This action needs a connection') : 'Streams this title'}
                accessibilityState={{ disabled: !network.remoteReady && !local.copies.length }}
                disabled={!network.remoteReady && !local.copies.length}
                style={({ pressed }) => [styles.playWrapper, styles.primaryWatchAction, pressed && styles.pressed]}
                onPress={() => {
                  if (!remoteReadyRef.current) { playOffline(); return; }
                  router.push({
                  pathname: '/player/[id]',
                  params: {
                    id, type, title, year,
                    seriesTitle: type === 'tv' ? title : undefined,
                    posterPath: data.poster_path || undefined,
                    backdropPath: data.backdrop_path || undefined,
                  }
                }); }}
              >
                <View style={[styles.playButtonGlow, { backgroundColor: theme.accent }]} />
                <View style={[styles.playButton, { backgroundColor: theme.accent }]}>
                  <Ionicons name="play" size={18} color={theme.onAccent} />
                  <Text style={[styles.playButtonText, { color: theme.onAccent }]}>{!network.remoteReady && local.copies.length ? (multipleOfflineEpisodes ? 'Offline Episodes' : 'Play Offline') : 'Watch Now'}</Text>
                </View>
              </Pressable>
            )}
            <View style={styles.secondaryActionRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isSaved({ ...data, media_type: type }) ? `Remove ${title} from My List` : `Add ${title} to My List`}
                accessibilityState={{ selected: isSaved({ ...data, media_type: type }) }}
                style={({ pressed }) => [
                  styles.trailerBtn,
                  styles.secondaryActionButton,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                  pressed && styles.pressed,
                ]}
                onPress={() => toggleSave({ ...data, media_type: type })}
              >
                <Ionicons name={isSaved({ ...data, media_type: type }) ? "checkmark" : "add"} size={18} color={theme.text} />
                <Text style={[styles.trailerBtnText, { color: theme.text }]}>{isSaved({ ...data, media_type: type }) ? "In My List" : "My List"}</Text>
              </Pressable>
              {trailerObj && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Play ${title} trailer`}
                  accessibilityHint={!network.remoteReady ? 'Trailers need a connection' : 'Plays the trailer'}
                  accessibilityState={{ disabled: !network.remoteReady }}
                  disabled={!network.remoteReady}
                  style={({ pressed }) => [
                    styles.trailerBtn,
                    styles.secondaryActionButton,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                    pressed && styles.pressed,
                  ]}
                  onPress={() => { if (remoteReadyRef.current) setShowTrailerModal(true); }}
                >
                  <Ionicons name="film-outline" size={18} color={theme.text} />
                  <Text style={[styles.trailerBtnText, { color: theme.text }]}>Trailer</Text>
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="More actions"
                style={({ pressed }) => [styles.listButton, { backgroundColor: theme.surface, borderColor: theme.border }, pressed && styles.pressed]}
                onPress={() => setShowMoreSheet(true)}
              >
                <Ionicons name="ellipsis-horizontal" size={20} color={theme.text} />
              </Pressable>
            </View>
          </View>
          <TrailerModal
            visible={showTrailerModal}
            onClose={() => setShowTrailerModal(false)}
            title={title}
            candidates={allTrailers}
          />
          <View style={[styles.tabsContainer, { borderBottomColor: theme.border }]}>
            {fitCollectionTabs ? (
              <View style={{ flexDirection: 'row', gap: 6, width: '100%' }}>
                {(['info', 'cast', 'recommended', 'collection'] as const).map((tab) => {
                  const isActive = activeTab === tab;
                  const fittedFlex = tab === 'recommended' ? 1.8 : tab === 'collection' ? 1.5 : 0.85;
                  return (
                    <Pressable
                      key={tab}
                      accessibilityRole="tab"
                      accessibilityLabel={`${tab.charAt(0).toUpperCase() + tab.slice(1)} section`}
                      accessibilityState={{ selected: isActive }}
                      onPress={() => handleTabChange(tab)}
                      style={({ pressed }) => [
                        styles.tabPill,
                        { flex: fittedFlex, paddingHorizontal: 6, alignItems: 'center' },
                        { backgroundColor: isActive ? theme.accentSoft : theme.surface, borderColor: isActive ? theme.accent : theme.border },
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <Text
                        numberOfLines={1}
                        style={[styles.tabPillText, { color: isActive ? theme.accent : theme.textSecondary }]}
                      >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {['info', ...(isMovie ? [] : ['episodes']), 'cast', 'recommended', ...(collectionRef ? ['collection'] : [])].map((tab) => {
                  const isActive = activeTab === tab;
                  return (
                    <Pressable
                      key={tab}
                      accessibilityRole="tab"
                      accessibilityLabel={`${tab.charAt(0).toUpperCase() + tab.slice(1)} section`}
                      accessibilityState={{ selected: isActive }}
                      onPress={() => handleTabChange(tab as any)}
                      style={({ pressed }) => [
                        styles.tabPill,
                        { backgroundColor: isActive ? theme.accentSoft : theme.surface, borderColor: isActive ? theme.accent : theme.border },
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <Text style={[styles.tabPillText, { color: isActive ? theme.accent : theme.textSecondary }]}>
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
          <View style={styles.tabContent}>
            {activeTab === 'info' && (
              <View style={{ gap: spacing[5] }}>
                <Text style={[styles.overviewText, { color: theme.textSecondary }]}>{data.overview}</Text>
                {castList.length > 0 && (
                  <View style={styles.castSection}>
                    <Text style={[styles.subSectionTitle, { color: theme.textMuted }]}>TOP CAST & CREW</Text>
                    <FlatList
                      data={topCast}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.castScroll}
                      keyExtractor={(actor: any) => String(actor.id)}
                      initialNumToRender={castRenderBudget.initialNumToRender}
                      maxToRenderPerBatch={castRenderBudget.maxToRenderPerBatch}
                      windowSize={castRenderBudget.windowSize}
                      renderItem={({ item: actor }: { item: any }) => (
                        <Pressable
                          style={({ pressed }) => [styles.castCard, { backgroundColor: theme.surface, borderColor: theme.border }, pressed && { opacity: 0.8 }]}
                          onPress={() => router.push(`/person/${actor.id}` as any)}
                        >
                          <Image
                            source={{ uri: imgUrl(actor.profile_path, 'w200') || undefined }}
                            style={[styles.castImage, { backgroundColor: theme.surface, borderColor: theme.border }]}
                          />
                          <Text style={[styles.castName, { color: theme.text }]} numberOfLines={1}>{actor.name}</Text>
                          <Text style={[styles.castCharacter, { color: theme.textMuted }]} numberOfLines={1}>{actor.character || 'Actor'}</Text>
                        </Pressable>
                      )}
                    />
                  </View>
                )}
              </View>
            )}
            {activeTab === 'cast' && (
              <FlatList
                data={fullCast}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.castScroll}
                keyExtractor={(actor: any) => String(actor.id)}
                initialNumToRender={castRenderBudget.initialNumToRender}
                maxToRenderPerBatch={castRenderBudget.maxToRenderPerBatch}
                windowSize={castRenderBudget.windowSize}
                renderItem={({ item: actor }: { item: any }) => (
                  <Pressable
                    style={({ pressed }) => [styles.castCard, { backgroundColor: theme.surface, borderColor: theme.border }, pressed && { opacity: 0.8 }]}
                    onPress={() => router.push(`/person/${actor.id}` as any)}
                  >
                    <Image
                      source={{ uri: imgUrl(actor.profile_path, 'w200') || undefined }}
                      style={[styles.castImage, { backgroundColor: theme.surface, borderColor: theme.border }]}
                    />
                    <Text style={[styles.castName, { color: theme.text }]} numberOfLines={1}>{actor.name}</Text>
                    <Text style={[styles.castCharacter, { color: theme.textMuted }]} numberOfLines={1}>{actor.character || 'Actor'}</Text>
                  </Pressable>
                )}
              />
            )}
            {activeTab === 'recommended' && (
              <FlatList
                data={recommendedItems}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: spacing[3], paddingBottom: spacing[4] }}
                keyExtractor={(item: any, idx: number) => `${item.id}_${idx}`}
                initialNumToRender={recommendationRenderBudget.initialNumToRender}
                maxToRenderPerBatch={recommendationRenderBudget.maxToRenderPerBatch}
                windowSize={recommendationRenderBudget.windowSize}
                renderItem={({ item }: { item: TmdbMediaItem }) => (
                  <MediaCard
                    item={item}
                    onPress={() => router.push(`/media/${item.id}?type=${type}`)}
                  />
                )}
                ListEmptyComponent={
                  <Text style={[styles.placeholderText, { color: theme.textMuted }]}>No recommendations available.</Text>
                }
              />
            )}
            {activeTab === 'collection' && collectionRef && (
              <MovieCollectionTab
                collectionId={collectionRef.id}
                collectionName={collectionRef.name}
                currentMovieId={id}
                onOpenMovie={openCollectionMovie}
                remote={remote}
              />
            )}
            {activeTab === 'episodes' && (
              <View style={styles.episodesListContainer}>
                {data.number_of_seasons > 1 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing[4] }}>
                    {Array.from({ length: data.number_of_seasons }, (_, i) => i + 1).map((s) => (
                      <Pressable
                        key={s}
                        accessibilityRole="button"
                        accessibilityLabel={`Season ${s}`}
                        accessibilityState={{ selected: selectedSeason === s }}
                        onPress={() => setSelectedSeason(s)}
                        style={[styles.seasonPill, { backgroundColor: selectedSeason === s ? theme.accent : theme.surface, borderColor: selectedSeason === s ? theme.accent : theme.border }]}
                      >
                        <Text style={[styles.seasonPillText, { color: selectedSeason === s ? theme.onAccent : theme.textSecondary }]}>
                          Season {s}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
                {!episodesLoading && episodes.length > 0 && (
                  <SeasonWatchedControl
                    season={selectedSeason}
                    watched={watchedActions.seasonWatched}
                    onPress={watchedActions.requestSeasonToggle}
                    theme={theme}
                  />
                )}
                {!episodesLoading && !remote.episodesLoaded && <Text style={[styles.placeholderText, { color: theme.textMuted }]}>
                  {!network.remoteReady ? connectionMessage : remote.episodesError ? 'Episode information is unavailable. Please try again later.' : 'Episode information has not loaded yet.'}
                </Text>}
                {episodesLoading ? (
                  <ActivityIndicator size="small" color={theme.accent} style={{ marginTop: 20 }} />
                ) : (
                  episodes.map((ep: any) => {
                    const episodeWatched = watchedActions.isEpisodeWatched(ep);
                    const episodeProgress = getPlaybackProgress('tv', id, selectedSeason, ep.episode_number);
                    const episodeProgressPercent = !episodeWatched
                      && episodeProgress
                      && isVerifiedPlaybackEvidence(episodeProgress.evidence)
                      && episodeProgress.currentTime > 0
                      && episodeProgress.percent != null
                      ? Math.max(0, Math.min(100, episodeProgress.percent))
                      : 0;
                    const progressLabel = episodeProgressPercent > 0
                      ? `, ${Math.round(episodeProgressPercent)} percent watched`
                      : '';
                    return (
                      <Pressable
                        key={ep.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Episode ${ep.episode_number}, ${ep.name}${episodeWatched ? ', watched' : progressLabel}`}
                        accessibilityHint={network.remoteReady ? "Starts this episode" : "Plays a downloaded copy if available; streaming needs a connection"}
                        style={({ pressed }) => [
                          styles.episodeCard,
                          { backgroundColor: theme.elevated, borderColor: theme.border },
                          pressed && { opacity: 0.85 },
                        ]}
                        onPress={() => {
                          if (!remoteReadyRef.current) { playOffline(undefined, selectedSeason, ep.episode_number); return; }
                          router.push({
                          pathname: '/player/[id]',
                          params: {
                            id, type, title: ep.name, year,
                            seriesTitle: title,
                            season: selectedSeason,
                            episode: ep.episode_number,
                            episodeTitle: ep.name,
                            posterPath: data.poster_path || undefined,
                            backdropPath: ep.still_path || data.backdrop_path || undefined,
                          }
                        }); }}
                      >
                        <View style={styles.epThumbWrapper}>
                          {ep.still_path ? (
                            <Image source={{ uri: imgUrl(ep.still_path, 'w300') || undefined }} style={styles.episodeListThumb} />
                          ) : (
                            <View style={[styles.episodeListThumb, styles.emptyThumb, { backgroundColor: theme.surface }]}>
                              <Ionicons name="film-outline" size={24} color={theme.textMuted} />
                            </View>
                          )}
                          <View style={styles.playBadgeOverlay}>
                            <Ionicons name="play" size={12} color="#fff" />
                          </View>
                          {episodeProgressPercent > 0 && (
                            <View style={[styles.episodeProgressTrack, { backgroundColor: theme.border }]}>
                              <View
                                style={[
                                  styles.episodeProgressFill,
                                  { backgroundColor: theme.accent, width: `${episodeProgressPercent}%` as `${number}%` },
                                ]}
                              />
                            </View>
                          )}
                        </View>
                        <View style={styles.episodeListInfo}>
                          <View style={styles.epMetaRow}>
                            <Text style={[styles.episodeListNum, { color: theme.accent }]}>E{ep.episode_number}</Text>
                            {!!ep.vote_average && (
                              <View style={styles.epStarBadge}>
                                <Ionicons name="star" size={10} color="#fbbf24" />
                                <Text style={styles.epStarText}>{ep.vote_average.toFixed(1)}</Text>
                              </View>
                            )}
                            {!!ep.runtime && (
                              <Text style={[styles.epRuntimeText, { color: theme.textMuted }]}>{ep.runtime}m</Text>
                            )}
                          </View>
                          {!!ep.air_date && (
                            <Text style={[styles.episodeListDate, { color: theme.textMuted }]}>{ep.air_date}</Text>
                          )}
                          <Text style={[styles.episodeListName, { color: theme.text }]} numberOfLines={1}>{ep.name}</Text>
                          {!!ep.overview && (
                            <EpisodeOverview overview={ep.overview} theme={theme} />
                          )}
                          <View style={styles.epActionRow}>
                            <EpisodeWatchedButton
                              episodeNumber={ep.episode_number}
                              watched={episodeWatched}
                              theme={theme}
                              onPress={() => watchedActions.toggleEpisodeWatched(ep)}
                            />
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Download Episode ${ep.episode_number}`}
                              accessibilityHint={network.remoteReady ? "Opens download options for this episode" : "Downloading new media needs a connection"}
                              accessibilityState={{ disabled: !network.remoteReady }}
                              disabled={!network.remoteReady}
                              hitSlop={4}
                              style={({ pressed }) => [styles.epDownloadBtn, { backgroundColor: theme.surface, borderColor: theme.border }, pressed && { opacity: 0.7 }]}
                              onPress={(e) => {
                                e.stopPropagation();
                                if (!remoteReadyRef.current) return;
                                setDownloadTarget(createMobileDownloadTargetV1({
                                  id,
                                  mediaType: type,
                                  title: ep.name,
                                  year,
                                  seriesTitle: title,
                                  season: selectedSeason,
                                  episode: ep.episode_number,
                                  episodeTitle: ep.name,
                                  posterPath: data.poster_path || null,
                                  backdropPath: ep.still_path || data.backdrop_path || null,
                                }));
                              }}
                            >
                              <Ionicons name="download-outline" size={12} color={theme.accent} />
                              <Text numberOfLines={1} style={[styles.epDownloadBtnText, { color: theme.text }]}>Download</Text>
                            </Pressable>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })
                )}
              </View>
            )}
          </View>
          <View style={{ height: 120 }} />
        </View>
      </Animated.ScrollView>
      {network.remoteReady && <DownloadModal
        visible={Boolean(downloadTarget)}
        onClose={closeDownloadOptions}
        onResolveSource={resolveDownloadSource}
        target={downloadTarget}
      />}
      <Modal visible={showMoreSheet} transparent animationType="fade" onRequestClose={() => setShowMoreSheet(false)}>
        <View style={styles.moreOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowMoreSheet(false)} />
          <View style={[styles.moreSheet, { backgroundColor: theme.elevated, borderColor: theme.border }]}>
            <View style={styles.moreHeader}>
              <Text style={[styles.moreTitle, { color: theme.text }]}>More actions</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close more actions" hitSlop={4} onPress={() => setShowMoreSheet(false)} style={[styles.moreClose, { borderColor: theme.border }]}>
                <Ionicons name="close" size={20} color={theme.text} />
              </Pressable>
            </View>
            {isMovie && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={watchedActions.movieWatched ? `Mark ${title} unwatched` : `Mark ${title} watched`}
                style={styles.moreAction}
                onPress={() => {
                  setShowMoreSheet(false);
                  watchedActions.toggleMovieWatched();
                }}
              >
                <Ionicons name={watchedActions.movieWatched ? "checkmark-circle" : "eye-outline"} size={20} color={theme.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.moreActionText, { color: theme.text }]}>
                    {watchedActions.movieWatched ? "Mark unwatched" : "Mark watched"}
                  </Text>
                  <Text style={[styles.moreActionDescription, { color: theme.textMuted }]}>
                    Watched state stays separate from History, progress and My List.
                  </Text>
                </View>
              </Pressable>
            )}
            <Pressable accessibilityRole="button" accessibilityLabel={`Share ${title}`} style={styles.moreAction} onPress={() => {
              Share.share({ message: `${title}${year ? ` (${year})` : ''}` }).catch(() => {});
            }}>
              <Ionicons name="share-social-outline" size={20} color={theme.text} />
              <Text style={[styles.moreActionText, { color: theme.text }]}>Share title</Text>
            </Pressable>

          </View>
        </View>
      </Modal>
      <WatchedFeedback
        dialog={watchedActions.seasonDialog}
        selectedSeason={selectedSeason}
        episodeCount={episodes.length}
        onDismissDialog={watchedActions.dismissSeasonDialog}
        onConfirmDialog={watchedActions.confirmSeasonToggle}
        undoNotice={watchedActions.undoNotice}
        onDismissUndo={watchedActions.dismissUndo}
      />
    </View>
  );
}
