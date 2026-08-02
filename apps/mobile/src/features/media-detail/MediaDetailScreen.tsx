import { View, Text, StyleSheet, Image, ScrollView, ActivityIndicator, Pressable, Platform, FlatList, Animated, useWindowDimensions, Modal, Share } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { accent, spacing, backgrounds, text, fontFamilies, fontSizes, radii } from '@orion/shared/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { tmdbFetch, imgUrl } from '@orion/shared/api';
import { TmdbMediaItem } from '@orion/shared/types';
import { DownloadModal } from '../../components/DownloadModal';
import { TrailerModal } from '../../components/TrailerModal';
import { MediaCard } from '../../components/MediaCard';
import { useLibrary } from '../../context/LibraryContext';
import { useResponsiveLayout } from '../../services/responsive';
import { styles } from "./mediaDetailStyles";
export default function MediaDetailScreen() {
  const { id, type } = useLocalSearchParams<{ id: string; type: 'movie' | 'tv' }>();
  const router = useRouter();
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
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={accent.primary} />
      </View>
    );
  }
  if (!data) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="cloud-offline-outline" size={38} color={text.muted} />
        <Text style={styles.errorTitle}>{loadError || 'Media not found.'}</Text>
        <Pressable accessibilityRole="button" style={styles.retryButton} onPress={() => setReloadKey((value) => value + 1)}>
          <Ionicons name="refresh" size={17} color="#fff" />
          <Text style={styles.retryButtonText}>Retry</Text>
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
  const combinedVideos = [...mainVideoResults, ...seasonVideos];
  const seenKeys = new Set<string>();
  const allTrailers: any[] = [];
  for (const v of combinedVideos) {
    if (v.site === 'YouTube' && !seenKeys.has(v.key)) {
      const type = String(v.type || '').trim();
      const lowerName = String(v.name || '').toLowerCase();
      const isOfficialType = type === 'Trailer' || type === 'Teaser';
      const EXCLUDED_KEYWORDS = [
        'behind the scenes', 'bloopers', 'blooper', 'interview', 'featurette',
        'scene clip', 'soundtrack', 'making of', 'announcement', 'date announcement',
        'premiere date', 'recap', 'special', 'promo', 'first look', 'sneak peek',
        'title sequence', 'theme song', 'intro', 'outro', 'breakdown', 'review',
        'reaction', 'cast reacts', 'greeting', 'message', 'commercial', 'tv spot',
        'spot', 'table read', 'read-through', 'q&a', 'panel', 'comic-con', 'vfx',
        'ost', 'opening credits', 'ending credits', 'audition'
      ];
      const isExcludedTitle = EXCLUDED_KEYWORDS.some((kw) => lowerName.includes(kw));
      if (isOfficialType && !isExcludedTitle) {
        seenKeys.add(v.key);
        const prefix = v.seasonNum ? `Season ${v.seasonNum}: ` : '';
        allTrailers.push({
          key: v.key,
          name: `${prefix}${v.name}`,
          type: v.type,
          season: v.seasonNum,
        });
      }
    }
  }
  const trailerObj = allTrailers.find((v: any) => v.type === 'Trailer') || allTrailers[0];
  const trailerKey = trailerObj?.key || null;
  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={20} color="#fff" />
      </Pressable>
      <Animated.ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={styles.backdropContainer}>
          {backdrop ? (
            <Image source={{ uri: backdrop }} style={styles.backdropImage} />
          ) : (
            <View style={[styles.backdropImage, { backgroundColor: '#1a102b' }]} />
          )}
          <LinearGradient
            colors={['rgba(5,5,10,0.15)', 'rgba(5,5,10,0.65)', 'rgba(5,5,10,0.92)', backgrounds.base]}
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
              {poster && <Image source={{ uri: poster }} style={styles.posterImage} />}
              {isUnreleased && (
                <View style={styles.posterLockOverlay}>
                  <Ionicons name="lock-closed" size={32} color="#f87171" />
                  <Text style={styles.posterLockText}>UNRELEASED</Text>
                </View>
              )}
            </View>
            <View style={styles.headerMeta}>
              <Text style={styles.titleText}>{title}</Text>
              <View style={styles.metaBadgeRow}>
                {!!data.vote_average && (
                  <View style={styles.ratingBadge}>
                    <Ionicons name="star" size={12} color="#fbbf24" />
                    <Text style={styles.metaText}>{data.vote_average.toFixed(1)}</Text>
                  </View>
                )}
                <Text style={styles.metaText}>{year}</Text>
                <Text style={styles.metaText}>•</Text>
                <Text style={styles.metaText}>{runtime}</Text>
                <View style={styles.hdBadge}><Text style={styles.hdText}>HD</Text></View>
              </View>
              {genres && (
                <View style={styles.genreInlineRow}>
                  <Text style={styles.genreInlineText} numberOfLines={1}>{genres}</Text>
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
                <View style={styles.playButtonGlow} />
                <View style={styles.playButton}>
                  <Ionicons name="play" size={18} color="#fff" />
                  <Text style={styles.playButtonText}>Watch Now</Text>
                </View>
              </Pressable>
            )}
            <View style={styles.secondaryActions}>
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [styles.trailerBtn, pressed && styles.pressed]}
                onPress={() => toggleSave({ ...data, media_type: type })}
              >
                <Ionicons name={isSaved({ ...data, media_type: type }) ? "checkmark" : "add"} size={18} color="#fff" />
                <Text style={styles.trailerBtnText}>{isSaved({ ...data, media_type: type }) ? "In My List" : "My List"}</Text>
              </Pressable>
              {trailerKey && (
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.trailerBtn, pressed && styles.pressed]}
                  onPress={() => setShowTrailerModal(true)}
                >
                  <Ionicons name="film-outline" size={18} color="#fff" />
                  <Text style={styles.trailerBtnText}>Trailer</Text>
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="More actions"
                style={({ pressed }) => [styles.listButton, pressed && styles.pressed]}
                onPress={() => setShowMoreSheet(true)}
              >
                <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
              </Pressable>
            </View>
          </View>
          <TrailerModal
            visible={showTrailerModal}
            onClose={() => setShowTrailerModal(false)}
            trailerKey={trailerKey}
            title={title}
            allTrailers={allTrailers}
          />
          <View style={styles.tabsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {['info', ...(isMovie ? [] : ['episodes']), 'cast', 'recommended'].map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <Pressable
                    key={tab}
                    onPress={() => handleTabChange(tab as any)}
                    style={({ pressed }) => [
                      styles.tabPill,
                      isActive && styles.tabPillActive,
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Text style={[styles.tabPillText, isActive && styles.tabPillTextActive]}>
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
                <Text style={styles.overviewText}>{data.overview}</Text>
                {castList.length > 0 && (
                  <View style={styles.castSection}>
                    <Text style={styles.subSectionTitle}>TOP CAST & CREW</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.castScroll}>
                      {castList.slice(0, 15).map((actor: any) => (
                        <Pressable 
                          key={actor.id} 
                          style={({ pressed }) => [styles.castCard, pressed && { opacity: 0.8 }]}
                          onPress={() => router.push(`/person/${actor.id}` as any)}
                        >
                          <Image 
                            source={{ uri: imgUrl(actor.profile_path, 'w200') || undefined }} 
                            style={styles.castImage} 
                          />
                          <Text style={styles.castName} numberOfLines={1}>{actor.name}</Text>
                          <Text style={styles.castCharacter} numberOfLines={1}>{actor.character || 'Actor'}</Text>
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
                    style={({ pressed }) => [styles.castCard, pressed && { opacity: 0.8 }]}
                    onPress={() => router.push(`/person/${actor.id}` as any)}
                  >
                    <Image 
                      source={{ uri: imgUrl(actor.profile_path, 'w200') || undefined }} 
                      style={styles.castImage} 
                    />
                    <Text style={styles.castName} numberOfLines={1}>{actor.name}</Text>
                    <Text style={styles.castCharacter} numberOfLines={1}>{actor.character || 'Actor'}</Text>
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
                  <Text style={styles.placeholderText}>No recommendations available.</Text>
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
                        style={[styles.seasonPill, selectedSeason === s && styles.seasonPillActive]}
                      >
                        <Text style={[styles.seasonPillText, selectedSeason === s && styles.seasonPillTextActive]}>
                          Season {s}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
                {episodesLoading ? (
                  <ActivityIndicator size="small" color={accent.primary} style={{ marginTop: 20 }} />
                ) : (
                  episodes.map((ep: any) => (
                    <Pressable
                      key={ep.id}
                      style={({ pressed }) => [styles.episodeCard, pressed && { opacity: 0.85 }]}
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
                          <View style={[styles.episodeListThumb, styles.emptyThumb]}>
                            <Ionicons name="film-outline" size={24} color="rgba(255,255,255,0.2)" />
                          </View>
                        )}
                        <View style={styles.playBadgeOverlay}>
                          <Ionicons name="play" size={12} color="#fff" />
                        </View>
                      </View>
                      <View style={styles.episodeListInfo}>
                        <View style={styles.epMetaRow}>
                          <Text style={styles.episodeListNum}>E{ep.episode_number}</Text>
                          {!!ep.vote_average && (
                            <View style={styles.epStarBadge}>
                              <Ionicons name="star" size={10} color="#fbbf24" />
                              <Text style={styles.epStarText}>{ep.vote_average.toFixed(1)}</Text>
                            </View>
                          )}
                          {!!ep.runtime && (
                            <Text style={styles.epRuntimeText}>{ep.runtime}m</Text>
                          )}
                          {!!ep.air_date && (
                            <Text style={styles.episodeListDate}>{ep.air_date}</Text>
                          )}
                        </View>
                        <Text style={styles.episodeListName} numberOfLines={1}>{ep.name}</Text>
                        {!!ep.overview && (
                          <Text style={styles.episodeOverviewText} numberOfLines={2}>
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
                            <Ionicons name={isWatched(ep, { isEpisode: true, seriesId: id }) ? "eye" : "eye-outline"} size={14} color={accent.primary} />
                            <Text style={styles.epDownloadBtnText}>{isWatched(ep, { isEpisode: true, seriesId: id }) ? "Watched" : "Mark Watched"}</Text>
                          </Pressable>
                          <Pressable
                            style={({ pressed }) => [styles.epDownloadBtn, pressed && { opacity: 0.7 }]}
                            onPress={(e) => {
                              e.stopPropagation();
                              setShowDownloadModal(true);
                            }}
                          >
                            <Ionicons name="lock-closed-outline" size={12} color={text.muted} />
                            <Text style={styles.epDownloadBtnText}>Offline info</Text>
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
          <View style={styles.moreSheet}>
            <View style={styles.moreHeader}>
              <Text style={styles.moreTitle}>More actions</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close more actions" onPress={() => setShowMoreSheet(false)} style={styles.moreClose}>
                <Ionicons name="close" size={20} color="#fff" />
              </Pressable>
            </View>
            <Pressable style={styles.moreAction} onPress={() => {
              Share.share({ message: `${title}${year ? ` (${year})` : ''}` }).catch(() => {});
            }}>
              <Ionicons name="share-social-outline" size={20} color="#fff" />
              <Text style={styles.moreActionText}>Share title</Text>
            </Pressable>
            <Pressable style={styles.moreAction} onPress={() => {
              setShowMoreSheet(false);
              setShowDownloadModal(true);
            }}>
              <Ionicons name="lock-closed-outline" size={20} color={text.muted} />
              <View style={{ flex: 1 }}>
                <Text style={styles.moreActionText}>Mobile downloads</Text>
                <Text style={styles.moreActionDescription}>Locked during native downloader research</Text>
              </View>
            </Pressable>
            <View style={styles.moreNotice}>
              <Ionicons name="server-outline" size={18} color={text.muted} />
              <Text style={styles.moreActionDescription}>Streaming sources are selected inside the player so the active session stays consistent.</Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
