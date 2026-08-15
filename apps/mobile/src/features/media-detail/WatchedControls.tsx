import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OrionDialog } from '../../components/OrionDialog';
import { WatchedUndoBanner } from '../../components/WatchedUndoBanner';
import { styles } from './mediaDetailStyles';
import type { SeasonWatchedDialog, WatchedUndoNotice } from './useMediaDetailWatched';

export function MovieWatchedBadge({ watched, theme }: { watched: boolean; theme: any }) {
  if (!watched) return null;
  return (
    <View style={styles.movieWatchedStatus}>
      <Ionicons name="checkmark-circle" size={13} color={theme.accent} />
      <Text style={[styles.movieWatchedStatusText, { color: theme.accent }]}>Watched</Text>
    </View>
  );
}

export function SeasonWatchedControl({
  season,
  watched,
  onPress,
  theme,
}: {
  season: number;
  watched: boolean;
  onPress: () => void;
  theme: any;
}) {
  return (
    <View style={styles.seasonWatchedRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={watched ? `Mark Season ${season} unwatched` : `Mark Season ${season} watched`}
        accessibilityHint="Changes watched state for episodes in this season"
        accessibilityState={{ selected: watched }}
        onPress={onPress}
        style={({ pressed }) => [
          styles.seasonWatchedAction,
          {
            backgroundColor: watched ? theme.accentSoft : theme.surface,
            borderColor: watched ? theme.accent : theme.border,
          },
          pressed && { opacity: 0.72 },
        ]}
      >
        <Ionicons name={watched ? "checkmark-circle" : "eye-outline"} size={16} color={theme.accent} />
        <Text style={[styles.seasonWatchedActionText, { color: watched ? theme.accent : theme.text }]}>
          {watched ? `Season ${season} Watched` : `Mark Season ${season} Watched`}
        </Text>
      </Pressable>
    </View>
  );
}

export function EpisodeWatchedBadge({ watched, theme }: { watched: boolean; theme: any }) {
  if (!watched) return null;
  return (
    <View style={[styles.episodeWatchedBadge, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}>
      <Ionicons name="checkmark" size={10} color={theme.accent} />
      <Text style={[styles.episodeWatchedBadgeText, { color: theme.accent }]}>Watched</Text>
    </View>
  );
}

export function EpisodeWatchedButton({
  episodeNumber,
  watched,
  onPress,
  theme,
}: {
  episodeNumber: number;
  watched: boolean;
  onPress: () => void;
  theme: any;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={watched ? `Mark Episode ${episodeNumber} unwatched` : `Mark Episode ${episodeNumber} watched`}
      accessibilityHint="Changes watched state for this episode"
      accessibilityState={{ selected: watched }}
      hitSlop={4}
      style={({ pressed }) => [
        styles.epDownloadBtn,
        {
          backgroundColor: watched ? theme.accentSoft : theme.surface,
          borderColor: watched ? theme.accent : theme.border,
        },
        pressed && { opacity: 0.7 },
      ]}
      onPress={(event) => {
        event.stopPropagation();
        onPress();
      }}
    >
      <Ionicons name={watched ? "checkmark-circle" : "eye-outline"} size={14} color={theme.accent} />
      <Text numberOfLines={1} style={[styles.epDownloadBtnText, { color: watched ? theme.accent : theme.textSecondary }]}>
        {watched ? "Watched" : "Mark Watched"}
      </Text>
    </Pressable>
  );
}

export function WatchedFeedback({
  dialog,
  selectedSeason,
  episodeCount,
  onDismissDialog,
  onConfirmDialog,
  undoNotice,
  onDismissUndo,
}: {
  dialog: SeasonWatchedDialog;
  selectedSeason: number;
  episodeCount: number;
  onDismissDialog: () => void;
  onConfirmDialog: () => void;
  undoNotice: WatchedUndoNotice;
  onDismissUndo: () => void;
}) {
  return (
    <>
      <OrionDialog
        visible={Boolean(dialog)}
        title={dialog?.action === 'unwatch'
          ? `Mark Season ${selectedSeason} unwatched?`
          : `Mark Season ${selectedSeason} watched?`}
        message={`This changes watched state for ${episodeCount} episode${episodeCount === 1 ? '' : 's'} only. History, playback progress and My List stay unchanged.`}
        icon={dialog?.action === 'unwatch' ? 'eye-off-outline' : 'checkmark-circle-outline'}
        onDismiss={onDismissDialog}
        actions={[
          { label: 'Cancel', role: 'cancel', onPress: onDismissDialog },
          {
            label: dialog?.action === 'unwatch' ? 'Mark Unwatched' : 'Mark Watched',
            role: 'primary',
            onPress: onConfirmDialog,
          },
        ]}
      />
      <WatchedUndoBanner notice={undoNotice} onDismiss={onDismissUndo} />
    </>
  );
}
