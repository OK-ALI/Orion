import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { imgUrl } from '@orion/shared/api';
import { useOrionTheme } from '../../context/ThemeContext';
import { formatPlaybackClock } from './playbackFormatting';

interface HistoryRowProps {
  item: any;
  onResume: () => void;
  onOpenDetails: () => void;
  onRemove: () => void;
}

export function HistoryRow({ item, onResume, onOpenDetails, onRemove }: HistoryRowProps) {
  const { width } = useWindowDimensions();
  const { theme } = useOrionTheme();
  const compact = width < 380;
  const artwork = imgUrl(item.backdrop_path || item.poster_path, 'w500');
  const title = item.media_type === 'tv' ? (item.name || item.title) : item.title;
  const context = item.media_type === 'tv' && item.season && item.episode
    ? `S${item.season} E${item.episode}${item.episode_title ? ` · ${item.episode_title}` : ''}`
    : item.year || 'Movie';

  return (
    <View style={[styles.row, compact && styles.rowCompact, { borderColor: theme.border, backgroundColor: theme.elevated }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${title}`} onPress={onOpenDetails} style={styles.artworkButton}>
        {artwork ? (
          <Image source={{ uri: artwork }} style={styles.artwork} resizeMode="cover" />
        ) : (
          <View style={[styles.artwork, styles.fallback, { backgroundColor: theme.surface }]}>
            <Ionicons name="film-outline" size={24} color={theme.textMuted} />
          </View>
        )}
      </Pressable>
      <View style={styles.info}>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>{title || 'Untitled'}</Text>
        <Text style={[styles.context, { color: theme.textSecondary }]} numberOfLines={2}>{context}</Text>
        {Number(item.currentTime) > 0 && (
          <Text style={[styles.time, { color: theme.textMuted }]}>{formatPlaybackClock(item.currentTime)} watched</Text>
        )}
      </View>
      <View style={[styles.actions, compact && styles.actionsCompact]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Resume ${title}`} onPress={onResume} style={({ pressed }) => [styles.resume, { backgroundColor: theme.accent }, pressed && styles.pressed]}>
          <Ionicons name="play" size={18} color={theme.onAccent} />
          {!compact && <Text style={[styles.resumeText, { color: theme.onAccent }]}>Resume</Text>}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${title} from History`} onPress={onRemove} style={({ pressed }) => [styles.remove, { borderColor: theme.border }, pressed && styles.pressed]}>
          <Ionicons name="trash-outline" size={19} color={theme.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { width: '100%', borderRadius: 16, borderWidth: 1, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowCompact: { alignItems: 'flex-start' },
  artworkButton: { borderRadius: 11, overflow: 'hidden' },
  artwork: { width: 112, aspectRatio: 16 / 10, borderRadius: 11 },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, minWidth: 0, gap: 3 },
  title: { fontSize: 16, fontWeight: '800', lineHeight: 21 },
  context: { fontSize: 12, lineHeight: 17 },
  time: { fontSize: 11 },
  actions: { flexDirection: 'row', gap: 7, alignItems: 'center' },
  actionsCompact: { flexDirection: 'column' },
  resume: { minWidth: 44, minHeight: 44, borderRadius: 22, paddingHorizontal: 13, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  resumeText: { fontSize: 13, fontWeight: '800' },
  remove: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
});
