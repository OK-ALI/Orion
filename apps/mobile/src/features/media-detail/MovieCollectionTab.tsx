import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { tmdbFetch } from '@orion/shared/api';
import { mediaDetailConnectionCopy, type MediaDetailRemoteState } from './useMediaDetailRemoteState';
import type { TmdbMediaItem } from '@orion/shared/types';
import { radii, spacing } from '@orion/shared/tokens';
import { MediaCard } from '../../components/MediaCard';
import { useOrionTheme } from '../../context/ThemeContext';
import { usePerformanceProfile } from '../../context/PerformanceContext';
import { getRailRenderBudget } from '../../services/listPerformance';
import { useResponsiveLayout } from '../../services/responsive';

type MovieCollection = {
  id: number;
  name: string;
  parts: TmdbMediaItem[];
};

type Props = {
  remote: MediaDetailRemoteState;
  collectionId: number;
  collectionName: string;
  currentMovieId: string | number;
  onOpenMovie: (movieId: number) => void;
};

function collectionReleaseOrder(a: TmdbMediaItem, b: TmdbMediaItem) {
  const aDate = a.release_date || '';
  const bDate = b.release_date || '';
  if (aDate && bDate) return aDate.localeCompare(bDate);
  if (aDate) return -1;
  if (bDate) return 1;
  return Number(a.id) - Number(b.id);
}

export function MovieCollectionTab({ collectionId, collectionName, currentMovieId, onOpenMovie, remote }: Props) {
  const { theme } = useOrionTheme();
  const { resolvedProfile } = usePerformanceProfile();
  const { width } = useResponsiveLayout();
  const [collection, setCollection] = useState<MovieCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const renderBudget = useMemo(
    () => getRailRenderBudget(width, 140 + spacing[4] + spacing[3], resolvedProfile),
    [resolvedProfile, width],
  );

  useEffect(() => {
    if (!remote.remoteReadyRef.current) return;
    let cancelled = false;
    const generation = remote.generationRef.current;
    const isCurrent = () => !cancelled && remote.remoteReadyRef.current && generation === remote.generationRef.current;
    setLoading(true);
    setError(false);
    tmdbFetch<any>(`/collection/${collectionId}`)
      .then((result) => {
        if (!isCurrent()) return;
        const parts = (Array.isArray(result?.parts) ? result.parts : [])
          .filter((part: any) => part?.id != null)
          .map((part: any) => ({ ...part, media_type: 'movie' } as TmdbMediaItem))
          .sort(collectionReleaseOrder);
        setCollection({
          id: Number(result?.id || collectionId),
          name: String(result?.name || collectionName || 'Movie Collection'),
          parts,
        });
      })
      .catch(() => {
        if (isCurrent()) setError(true);
      })
      .finally(() => {
        if (isCurrent()) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [collectionId, collectionName, reloadKey, remote.refreshKey, remote.generationRef, remote.remoteReadyRef]);
  const currentCollection = collection?.id === collectionId ? collection : null;

  const currentIndex = useMemo(
    () => currentCollection?.parts.findIndex((part) => String(part.id) === String(currentMovieId)) ?? -1,
    [currentCollection?.parts, currentMovieId],
  );

  if (!currentCollection && !remote.network.remoteReady) {
    return <Text accessibilityLiveRegion="polite" style={[styles.stateText, { color: theme.textMuted }]}>{mediaDetailConnectionCopy(remote.network.productState)}</Text>;
  }
  if (!currentCollection && (loading || !error)) {
    return (
      <View style={styles.centerState} accessibilityLiveRegion="polite">
        <ActivityIndicator color={theme.accent} />
        <Text style={[styles.stateText, { color: theme.textMuted }]}>Loading collection…</Text>
      </View>
    );
  }

  if (error && !currentCollection) {
    return (
      <View style={[styles.errorCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Ionicons name="albums-outline" size={22} color={theme.textMuted} />
        <Text style={[styles.errorTitle, { color: theme.text }]}>Collection unavailable</Text>
        <Text style={[styles.stateText, { color: theme.textMuted }]}>Orion could not load this movie collection right now.</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry collection"
          style={({ pressed }) => [styles.retryButton, { borderColor: theme.accent }, pressed && { opacity: 0.7 }]}
          onPress={() => { if (remote.remoteReadyRef.current) setReloadKey((value) => value + 1); }}
        >
          <Ionicons name="refresh" size={15} color={theme.accent} />
          <Text style={[styles.retryText, { color: theme.accent }]}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const parts = currentCollection?.parts || [];
  if (parts.length === 0) {
    return <Text style={[styles.stateText, { color: theme.textMuted }]}>No collection titles are available.</Text>;
  }

  const positionText = currentIndex >= 0 ? ` • Film ${currentIndex + 1} of ${parts.length}` : '';
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{currentCollection?.name || collectionName}</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>{parts.length} films{positionText}</Text>
        </View>
        <View style={[styles.iconBadge, { backgroundColor: theme.accentSoft, borderColor: theme.border }]}>
          <Ionicons name="albums-outline" size={18} color={theme.accent} />
        </View>
      </View>
      <FlatList
        data={parts}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => String(item.id)}
        initialNumToRender={renderBudget.initialNumToRender}
        maxToRenderPerBatch={renderBudget.maxToRenderPerBatch}
        windowSize={renderBudget.windowSize}
        renderItem={({ item }) => {
          const current = String(item.id) === String(currentMovieId);
          return (
            <MediaCard
              item={item}
              disabled={current}
              contextLabel={current ? 'Current' : undefined}
              onPress={current ? undefined : () => onOpenMovie(Number(item.id))}
            />
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing[3], paddingBottom: spacing[4] },
  headerRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  headerCopy: { flex: 1 },
  title: { fontSize: 17, fontWeight: '900' },
  subtitle: { marginTop: 3, fontSize: 12, fontWeight: '600' },
  iconBadge: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  centerState: { minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  stateText: { fontSize: 13, lineHeight: 18 },
  errorCard: { minHeight: 170, borderWidth: 1, borderRadius: radii.xl, padding: spacing[4], alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  errorTitle: { fontSize: 15, fontWeight: '800' },
  retryButton: { minHeight: 44, marginTop: spacing[1], paddingHorizontal: spacing[4], borderWidth: 1, borderRadius: radii.full, flexDirection: 'row', alignItems: 'center', gap: 7 },
  retryText: { fontSize: 12, fontWeight: '800' },
});
