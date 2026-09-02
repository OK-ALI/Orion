import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing } from '@orion/shared/tokens';
import { useOrionTheme } from '../../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MediaDetailLocalCopy } from './useMediaDetailLocalAvailability';

export function MediaDetailLocalCopies({ copies, onPlay, onOpenLibrary, presentation = 'card' }: {
  presentation?: 'card' | 'compact';
  copies: MediaDetailLocalCopy[]; onPlay: (copy: MediaDetailLocalCopy) => void; onOpenLibrary: () => void;
}) {
  const { theme } = useOrionTheme();
  if (!copies.length) return null;
  const compact = presentation === 'compact';
  return (
    <View style={compact ? styles.capability : [styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {compact ? (
        <View style={styles.capabilityLabel}>
          <Ionicons name="download-outline" size={16} color={theme.textSecondary} accessible={false} />
          <Text style={[styles.capabilityText, { color: theme.textSecondary }]}>Available offline</Text>
        </View>
      ) : (
        <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>
          {copies.length > 1 && copies[0].entry.media.mediaType === 'tv' ? 'Offline Episodes' : 'Available offline'}
        </Text>
      )}
      {copies.slice(0, 8).map((copy) => {
        const media = copy.entry.media;
        const label = media.mediaType === 'tv'
          ? `Play Offline · S${media.season} E${media.episode}${copy.entry.episodeTitle ? ` · ${copy.entry.episodeTitle}` : ''}`
          : 'Play Offline';
        return (
          <Pressable key={copy.asset.assetId} accessibilityRole="button" accessibilityLabel={label}
            onPress={() => onPlay(copy)} style={compact
              ? ({ pressed }) => [styles.compactButton, { backgroundColor: pressed ? theme.surfaceHover : theme.surface, borderColor: theme.border }]
              : [styles.button, { backgroundColor: theme.accent }]}>
            <Text style={compact ? [styles.compactButtonText, { color: theme.text }] : [styles.buttonText, { color: theme.onAccent }]}>{label}</Text>
          </Pressable>
        );
      })}
      {copies.length > 8 && (
        <Pressable accessibilityRole="button" accessibilityLabel="See all downloads" onPress={onOpenLibrary} style={compact ? [styles.compactButton, { borderColor: theme.border }] : styles.button}>
          <Text style={[styles.buttonText, { color: theme.accent }]}>See all downloads</Text>
        </Pressable>
      )}
    </View>
  );
}

export function MediaDetailFallback({ title, year, copies, message, checkingLocal, remoteReady, loading, saved, watched,
  onPlay, onOpenLibrary, onBack, onRetry, onSave, onWatched }: {
  title?: string; year?: string | number | null; copies: MediaDetailLocalCopy[]; message: string;
  checkingLocal: boolean; remoteReady: boolean; loading: boolean; saved: boolean; watched: boolean;
  onPlay: (copy: MediaDetailLocalCopy) => void; onOpenLibrary: () => void; onBack: () => void; onRetry: () => void;
  onSave: () => void; onWatched?: () => void;
}) {
  const { theme } = useOrionTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={[styles.fallback, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack} style={styles.button}>
        <Text style={[styles.buttonText, { color: theme.accent }]}>Back</Text>
      </Pressable>
      {title && <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{title}</Text>}
      {year != null && <Text style={{ color: theme.textSecondary }}>{year}</Text>}
      <Text accessibilityLiveRegion="polite" style={[styles.body, { color: theme.textSecondary }]}>{message}</Text>
      {loading && <Text style={[styles.body, { color: theme.textMuted }]}>Refreshing title information…</Text>}
      {checkingLocal && <Text style={[styles.body, { color: theme.textMuted }]}>Checking your Orion Library.</Text>}
      {!!copies.length && <Text style={[styles.body, { color: theme.textSecondary }]}>Your local copy is ready to play.</Text>}
      {!remoteReady && <Text style={[styles.body, { color: theme.textMuted }]}>Streaming, trailers and new downloads need a connection.</Text>}
      <MediaDetailLocalCopies copies={copies} onPlay={onPlay} onOpenLibrary={onOpenLibrary} />
      {!!copies.length && (
        <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={saved ? 'Remove from My List' : 'Add to My List'}
            accessibilityState={{ selected: saved }} onPress={onSave} style={styles.button}>
            <Text style={[styles.buttonText, { color: theme.text }]}>{saved ? 'In My List' : 'My List'}</Text>
          </Pressable>
          {onWatched && <Pressable accessibilityRole="button" accessibilityLabel={watched ? 'Mark unwatched' : 'Mark watched'}
            accessibilityState={{ selected: watched }} onPress={onWatched} style={styles.button}>
            <Text style={[styles.buttonText, { color: theme.text }]}>{watched ? 'Mark unwatched' : 'Mark watched'}</Text>
          </Pressable>}
        </View>
      )}
      <Pressable accessibilityRole="button" accessibilityLabel={remoteReady ? 'Retry title information' : 'Retry needs a connection'}
        accessibilityState={{ disabled: !remoteReady || loading }} disabled={!remoteReady || loading} onPress={onRetry} style={styles.button}>
        <Text style={[styles.buttonText, { color: remoteReady ? theme.accent : theme.textMuted }]}>Retry title information</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fallback: { paddingHorizontal: 24, gap: 16 },
  capability: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing[3], rowGap: spacing[1], marginTop: spacing[2] },
  capabilityLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, maxWidth: '100%' },
  capabilityText: { fontSize: 13, flexShrink: 1 },
  compactButton: { minHeight: 44, minWidth: 44, maxWidth: '100%', flexShrink: 1, paddingHorizontal: spacing[3], paddingVertical: spacing[2], justifyContent: 'center', borderRadius: 22, borderWidth: StyleSheet.hairlineWidth },
  compactButtonText: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 12 },
  title: { fontSize: 26, fontWeight: '800' },
  heading: { fontSize: 16, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 21 },
  button: { minHeight: 44, paddingVertical: 12, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 12 },
  buttonText: { fontSize: 14, fontWeight: '700' },
});
