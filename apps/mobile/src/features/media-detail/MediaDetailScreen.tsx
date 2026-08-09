import { View, Text, StyleSheet, Image, ScrollView, ActivityIndicator, Pressable, FlatList, Animated, useWindowDimensions, Modal, Share } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { spacing } from '@orion/shared/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { tmdbFetch, imgUrl } from '@orion/shared/api';
import { TmdbMediaItem } from '@orion/shared/types';
import { DownloadModal } from '../../components/DownloadModal';
import { TrailerModal } from '../../components/TrailerModal';
import { MediaCard } from '../../components/MediaCard';
import { useLibrary } from '../../context/LibraryContext';
import { useResponsiveLayout } from '../../services/responsive';
import { useOrionTheme } from '../../context/ThemeContext';
import { styles } from "./mediaDetailStyles";
import { normalizeTrailerCandidates } from '../trailers/trailerCandidateService';
export default function MediaDetailScreen() {
  const { id, type } = useLocalSearchParams<{ id: string; type: 'movie' | 'tv' }>();
  const router = useRouter();
  const { theme } = useOrionTheme();
  const { isWatched, markWatched, markUnwatched, toggleSave, isSaved } = useLibrary();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'episodes' | 'cast' | 'recommended'>('info');
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [showTrailerModal, setShowTrailerModal] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [seasonVideos, setSeasonVideos] = useState<any[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const { isTablet } = useResponsiveLayout();
  const tabFadeAnim = useRef(new Animated.Value(1)).current;
  const handleTabChange = (tabKey: typeof activeTab) => {
    Animated.sequence([
      Animated.timing(tabFadeAnim, { toValue: 0.2, duration: 80, useNativeDriver: true }),
      Animated.timing(tabFadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
    setActiveTab(tabKey);
  };
  const isMovie = type === 'movie';
  useEffect(() => {
    async function loadDetails() {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await tmdbFetch<any>(`/${type}/${id}?append_to_response=credits,videos,recommendations`);
        setData(res);
      } catch (err) {
        console.error('Failed to fetch details:', err);
        setLoadError('Orion could not load this title. Check your connection and try again.');
        setData(null);
      } finally {
        setLoading(false);
      }
    }
    loadDetails();
  }, [id, type, reloadKey]);
  useEffect(() => {
    if (type !== 'tv' || !showTrailerModal || !selectedSeason) return;
    let cancelled = false;
    tmdbFetch<any>(`/tv/${id}/season/${selectedSeason}/videos`)
      .then((result) => {
        if (!cancelled) {
          setSeasonVideos((current) => [
            ...current.filter((video) => video.seasonNum !== selectedSeason),
            ...(result.results || []).map((video: any) => ({ ...video, seasonNum: selectedSeason })),
          ]);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [id, type, showTrailerModal, selectedSeason]);
  useEffect(() => {
    if (!isMovie && selectedSeason) {
      async function loadEpisodes() {
        setEpisodesLoading(true);
        try {
          const res = await tmdbFetch<any>(`/tv/${id}/season/${selectedSeason}`);
          setEpisodes(res.episodes || []);
        } catch (err) {
          console.error('Failed to fetch episodes:', err);
        } finally {
          setEpisodesLoading(false);
        }
      }
      loadEpisodes();
    }
  }, [id, isMovie, selectedSeason]);
  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }
  if (!data) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.background }]}>
        <Ionicons name="cloud-offline-outline" size={38} color={theme.textMuted} />
        <Text style={[styles.errorTitle, { color: theme.text }]}>{loadError || 'Media not found.'}</Text>
        <Pressable accessibilityRole="button" style={[styles.retryButton, { backgroundColor: theme.accent }]} onPress={() => setReloadKey((value) => value + 1)}>
          <Ionicons name="refresh" size={17} color={theme.onAccent} />
          <Text style={[styles.retryButtonText, { color: theme.onAccent }]}>Retry</Text>
        </Pressable>
      </View>
    );
  }
  const title = isMovie ? data.title : data.name;
  const year = isMovie ? data.release_date?.slice(0, 4) : data.first_air_date?.slice(0, 4);
  const runtime = isMovie ? `${data.runtime || 0}m` : `${data.number_of_seasons || 1} Seasons`;
  const genres = data.genres?.map((g: any) => g.name).join(' • ');
  const backdrop = imgUrl(data.backdrop_path, 'original');
  const poster = imgUrl(data.poster_path, 'w500');
  const castList = data.credits?.cast || [];
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
  // This content crosses the image-to-page fade. Once that fade reaches a light
  // theme surface, cinema-white metadata no longer has sufficient contrast.
  const heroText = theme.dark ? '#ffffff' : theme.text;
  const heroSecondary = theme.dark ? 'rgba(255,255,255,0.82)' : theme.textSecondary;
  const heroSurface = theme.dark ? 'rgba(255,255,255,0.10)' : theme.surface;
  const heroBorder = theme.dark ? 'rgba(255,255,255,0.18)' : theme.border;
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={20} color="#fff" />
      </Pressable>
      <Animated.ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={styles.backdropContainer}>
          {backdrop ? (
            <Image source={{ uri: backdrop }} style={styles.backdropImage} />
          ) : (
            <View style={[styles.backdropImage, { backgroundColor: theme.surface }]} />
          )}
          <LinearGradient
            colors={['rgba(5,5,10,0.10)', 'rgba(5,5,10,0.52)', 'rgba(5,5,10,0.84)', theme.background]}
            locations={[0, 0.4, 0.75, 1]}
            style={styles.backdropGradient}
          />
        </View>
        <View style={styles.detailsContent}>
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
              <Text style={[
                styles.titleText,
                {
                  color: heroText,
                  textShadowColor: theme.dark ? 'rgba(0,0,0,0.95)' : 'transparent',
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
                    },
                  ]} numberOfLines={1}>{genres}</Text>
                </View>
              )}
            </View>
          </View>
          <View style={[styles.actionRow, isTablet && styles.actionRowTablet]}>
            {isUnreleased ? (
              <View style={styles.unreleasedBtn}>
                <Ionicons name="lock-closed" size={16} color="#f87171" />
                <Text style={styles.unreleasedBtnText}>Unreleased</Text>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Watch ${title}`}
                style={({ pressed }) => [styles.playWrapper, styles.primaryWatchAction, pressed && styles.pressed]}
                onPress={() => router.push({
                  pathname: '/player/[id]',
                  params: {
                    id, type, title, year,
                    seriesTitle: type === 'tv' ? title : undefined,
                    posterPath: data.poster_path || undefined,
                    backdropPath: data.backdrop_path || undefined,
                  }
                })}
              >
                <View style={[styles.playButtonGlow, { backgroundColor: theme.accent }]} />
                <View style={[styles.playButton, { backgroundColor: theme.accent }]}>
                  <Ionicons name="play" size={18} color={theme.onAccent} />
                  <Text style={[styles.playButtonText, { color: theme.onAccent }]}>Watch Now</Text>
                </View>
              </Pressable>
            )}
            <View style={styles.secondaryActions}>
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [styles.trailerBtn, { backgroundColor: theme.surface, borderColor: theme.border }, pressed && styles.pressed]}
                onPress={() => toggleSave({ ...data, media_type: type })}
              >
                <Ionicons name={isSaved({ ...data, media_type: type }) ? "checkmark" : "add"} size={18} color={theme.text} />
                <Text style={[styles.trailerBtnText, { color: theme.text }]}>{isSaved({ ...data, media_type: type }) ? "In My List" : "My List"}</Text>
              </Pressable>
              {trailerObj && (
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.trailerBtn, { backgroundColor: theme.surface, borderColor: theme.border }, pressed && styles.pressed]}
                  onPress={() => setShowTrailerModal(true)}
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {['info', ...(isMovie ? [] : ['episodes']), 'cast', 'recommended'].map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <Pressable
                    key={tab}
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
          </View>
          <View style={styles.tabContent}>
            {activeTab === 'info' && (
              <View style={{ gap: spacing[5] }}>
                <Text style={[styles.overviewText, { color: theme.textSecondary }]}>{data.overview}</Text>
                {castList.length > 0 && (
                  <View style={styles.castSection}>
                    <Text style={[styles.subSectionTitle, { color: theme.textMuted }]}>TOP CAST & CREW</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.castScroll}>
                      {castList.slice(0, 15).map((actor: any) => (
                        <Pressable 
                          key={actor.id} 
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
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            )}
            {activeTab === 'cast' && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.castScroll}>
                {castList.slice(0, 25).map((actor: any) => (
                  <Pressable 
                    key={actor.id} 
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
                ))}
              </ScrollView>
            )}
            {activeTab === 'recommended' && (
              <FlatList
                data={(data.recommendations?.results || []).filter((r: any) => r.poster_path)}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: spacing[3], paddingBottom: spacing[4] }}
                keyExtractor={(item: any, idx: number) => `${item.id}_${idx}`}
                renderItem={({ item }: { item: TmdbMediaItem }) => (
                  <MediaCard
                    item={{ ...item, media_type: type } as TmdbMediaItem}
                    onPress={() => router.push(`/media/${item.id}?type=${type}`)}
                  />
                )}
                ListEmptyComponent={
                  <Text style={[styles.placeholderText, { color: theme.textMuted }]}>No recommendations available.</Text>
                }
              />
            )}
            {activeTab === 'episodes' && (
              <View style={styles.episodesListContainer}>
                {data.number_of_seasons > 1 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing[4] }}>
                    {Array.from({ length: data.number_of_seasons }, (_, i) => i + 1).map((s) => (
                      <Pressable
                        key={s}
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
                {episodesLoading ? (
                  <ActivityIndicator size="small" color={theme.accent} style={{ marginTop: 20 }} />
                ) : (
                  episodes.map((ep: any) => (
                    <Pressable
                      key={ep.id}
                      style={({ pressed }) => [
                        styles.episodeCard,
                        { backgroundColor: theme.elevated, borderColor: theme.border },
                        pressed && { opacity: 0.85 },
                      ]}
                      onPress={() => router.push({
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
                      })}
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
                          {!!ep.air_date && (
                            <Text style={[styles.episodeListDate, { color: theme.textMuted }]}>{ep.air_date}</Text>
                          )}
                        </View>
                        <Text style={[styles.episodeListName, { color: theme.text }]} numberOfLines={1}>{ep.name}</Text>
                        {!!ep.overview && (
                          <Text style={[styles.episodeOverviewText, { color: theme.textSecondary }]} numberOfLines={2}>
                            {ep.overview}
                          </Text>
                        )}
                        <View style={styles.epActionRow}>
                          <Pressable
                            style={({ pressed }) => [styles.epDownloadBtn, pressed && { opacity: 0.7 }, { marginRight: 8 }]}
                            onPress={(e) => {
                              e.stopPropagation();
                              const watched = isWatched(ep, { isEpisode: true, seriesId: id });
                              if (watched) {
                                markUnwatched(ep, { isEpisode: true, seriesId: id });
                              } else {
                                markWatched(ep, { isEpisode: true, seriesId: id });
                              }
                            }}
                          >
                            <Ionicons name={isWatched(ep, { isEpisode: true, seriesId: id }) ? "eye" : "eye-outline"} size={14} color={theme.accent} />
                            <Text style={[styles.epDownloadBtnText, { color: theme.accent }]}>{isWatched(ep, { isEpisode: true, seriesId: id }) ? "Watched" : "Mark Watched"}</Text>
                          </Pressable>
                          <Pressable
                            style={({ pressed }) => [styles.epDownloadBtn, pressed && { opacity: 0.7 }]}
                            onPress={(e) => {
                              e.stopPropagation();
                              setShowDownloadModal(true);
                            }}
                          >
                            <Ionicons name="lock-closed-outline" size={12} color={theme.textMuted} />
                            <Text style={[styles.epDownloadBtnText, { color: theme.textMuted }]}>Offline info</Text>
                          </Pressable>
                        </View>
                      </View>
                    </Pressable>
                  ))
                )}
              </View>
            )}
          </View>
          <View style={{ height: 120 }} />
        </View>
      </Animated.ScrollView>
      <DownloadModal
        visible={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
        title={title}
        tmdbId={id}
        type={type}
      />
      <Modal visible={showMoreSheet} transparent animationType="fade" onRequestClose={() => setShowMoreSheet(false)}>
        <View style={styles.moreOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowMoreSheet(false)} />
          <View style={[styles.moreSheet, { backgroundColor: theme.elevated, borderColor: theme.border }]}>
            <View style={styles.moreHeader}>
              <Text style={[styles.moreTitle, { color: theme.text }]}>More actions</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close more actions" onPress={() => setShowMoreSheet(false)} style={[styles.moreClose, { borderColor: theme.border }]}>
                <Ionicons name="close" size={20} color={theme.text} />
              </Pressable>
            </View>
            <Pressable style={styles.moreAction} onPress={() => {
              Share.share({ message: `${title}${year ? ` (${year})` : ''}` }).catch(() => {});
            }}>
              <Ionicons name="share-social-outline" size={20} color={theme.text} />
              <Text style={[styles.moreActionText, { color: theme.text }]}>Share title</Text>
            </Pressable>
            <Pressable style={styles.moreAction} onPress={() => {
              setShowMoreSheet(false);
              setShowDownloadModal(true);
            }}>
              <Ionicons name="lock-closed-outline" size={20} color={theme.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.moreActionText, { color: theme.text }]}>Mobile downloads</Text>
                <Text style={[styles.moreActionDescription, { color: theme.textMuted }]}>Locked during native downloader research</Text>
              </View>
            </Pressable>
            <View style={[styles.moreNotice, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="server-outline" size={18} color={theme.textMuted} />
              <Text style={[styles.moreActionDescription, { color: theme.textMuted }]}>Streaming sources are selected inside the player so the active session stays consistent.</Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
