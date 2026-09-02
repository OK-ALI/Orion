import { useEffect, useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLibrary } from '../../context/LibraryContext';
import { useNetworkStatus } from '../../context/NetworkContext';
import { useOrionTheme } from '../../context/ThemeContext';
import { ContinueWatchingCard } from './ContinueWatchingCard';
import { useResponsiveLayout } from '../../services/responsive';
import { getRailRenderBudget } from '../../services/listPerformance';
import { usePerformanceProfile } from '../../context/PerformanceContext';

export function HomeContinueWatching({ presentation = 'default' }: {
  presentation?: 'default' | 'offline-compact';
}) {
  const offlineCompact = presentation === 'offline-compact';
  const router = useRouter();
  const { width, shortestEdge } = useResponsiveLayout();
  const { theme } = useOrionTheme();
  const { remoteReady } = useNetworkStatus();
  const { resolvedProfile } = usePerformanceProfile();
  const {
    progress, watched, getContinueWatching, enrichPlaybackMetadata,
    removeProgress, markProgressWatched,
  } = useLibrary();

  const entries = useMemo(
    () => getContinueWatching().slice(0, 10),
    [getContinueWatching, progress, watched],
  );

  useEffect(() => {
    if (!remoteReady) return;

    entries.forEach((entry) => {
      const presentation = entry.progress.presentation;

      if (!presentation.posterPath || !presentation.backdropPath) {
        enrichPlaybackMetadata(entry.key).catch(() => {});
      }
    });
  }, [enrichPlaybackMetadata, entries, remoteReady]);

  if (!entries.length) return null;

  const padding = shortestEdge < 360 ? 12 : 20;
  const compact = shortestEdge < 360;
  const cardSpan =
    Math.min(
      330,
      Math.max(
        252,
        width * (compact ? 0.82 : 0.79),
      ),
    ) + 12;

  const renderBudget =
    getRailRenderBudget(
      width,
      cardSpan,
      resolvedProfile,
    );

  const resume = (entry: typeof entries[number]) => {
    const {
      mediaIdentity,
      presentation,
    } = entry.progress;

    router.push({
      pathname: '/player/[id]',
      params: {
        id: String(mediaIdentity.id),
        type: mediaIdentity.mediaType,
        title:
          presentation.episodeTitle ||
          mediaIdentity.title,
        seriesTitle:
          presentation.seriesTitle ||
          (
            mediaIdentity.mediaType === 'tv'
              ? mediaIdentity.title
              : undefined
          ),
        year:
          mediaIdentity.year
            ? String(mediaIdentity.year)
            : undefined,
        season:
          mediaIdentity.season
            ? String(mediaIdentity.season)
            : undefined,
        episode:
          mediaIdentity.episode
            ? String(mediaIdentity.episode)
            : undefined,
        episodeTitle:
          presentation.episodeTitle ||
          undefined,
        posterPath:
          presentation.posterPath ||
          undefined,
        backdropPath:
          presentation.backdropPath ||
          undefined,
      },
    });
  };

  return (
    <View style={[styles.section, offlineCompact && styles.offlineSection]}>
      <View
        style={[
          styles.header,
          offlineCompact && styles.offlineHeader,
          { paddingHorizontal: padding },
        ]}
      >
        <View style={styles.headingCopy}>
          <Text
            style={[
              styles.eyebrow,
              { color: theme.accent },
            ]}
          >
            PICK UP THE STORY
          </Text>

          <Text
            style={[
              styles.title,
              { color: theme.text },
            ]}
          >
            Continue Watching
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View all Continue Watching"
          onPress={() =>
            router.push({
              pathname: '/(tabs)/library',
              params: {
                tab: 'continue',
              },
            })
          }
          style={({ pressed }) => [
            styles.viewAll,
            { borderColor: theme.border },
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.viewAllText,
              { color: theme.textSecondary },
            ]}
          >
            View all
          </Text>

          <Ionicons
            name="chevron-forward"
            size={17}
            color={theme.textSecondary}
          />
        </Pressable>
      </View>

      <FlatList
        data={entries}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(entry) => entry.key}
        initialNumToRender={renderBudget.initialNumToRender}
        maxToRenderPerBatch={renderBudget.maxToRenderPerBatch}
        windowSize={renderBudget.windowSize}
        contentContainerStyle={{
          paddingHorizontal: padding,
          gap: 12,
        }}
        renderItem={({ item }) => (
          <ContinueWatchingCard
            entry={item}
            presentation={offlineCompact ? 'offline-compact' : 'home-rail'}
            onResume={() => resume(item)}
            onOpenDetails={() =>
              router.push({
                pathname: '/media/[id]',
                params: {
                  id: String(
                    item.progress.mediaIdentity.id,
                  ),
                  type:
                    item.progress.mediaIdentity.mediaType,
                },
              })
            }
            onRemove={() =>
              removeProgress(item.key)
            }
            onMarkWatched={() =>
              markProgressWatched(item.key)
            }
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  offlineSection: { marginBottom: 16 },
  offlineHeader: { minHeight: 60, paddingTop: 6, paddingBottom: 6 },
  header: {
    minHeight: 72,
    paddingTop: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headingCopy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.7,
    marginBottom: 3,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  viewAll: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
});