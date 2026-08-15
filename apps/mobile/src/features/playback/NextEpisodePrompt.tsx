import { useEffect, useRef, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { imgUrl } from '@orion/shared/api';
import { radii, spacing } from '@orion/shared/tokens';
import { useOrionTheme } from '../../context/ThemeContext';
import {
  NEXT_EPISODE_COUNTDOWN_SECONDS,
  type NextEpisodeCandidate,
} from './playbackCompletion';

export function NextEpisodePrompt({
  episode,
  onPlayNow,
  onCancel,
}: {
  episode: NextEpisodeCandidate;
  onPlayNow: () => void;
  onCancel: () => void;
}) {
  const { theme } = useOrionTheme();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const compactLandscape = landscape && height < 520;
  const [countdown, setCountdown] = useState(NEXT_EPISODE_COUNTDOWN_SECONDS);
  const launchedRef = useRef(false);

  useEffect(() => {
    if (countdown <= 0) {
      if (!launchedRef.current) {
        launchedRef.current = true;
        onPlayNow();
      }
      return undefined;
    }
    const timer = setTimeout(() => setCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [countdown, onPlayNow]);

  const playNow = () => {
    if (launchedRef.current) return;
    launchedRef.current = true;
    onPlayNow();
  };
  const still = episode.stillPath ? imgUrl(episode.stillPath, 'w500') : null;

  const stillArtwork = (compact = false) => (
    <View
      style={[
        styles.stillFrame,
        compact && styles.stillFrameCompact,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      {still ? (
        <Image source={{ uri: still }} style={styles.still} resizeMode="cover" />
      ) : (
        <Ionicons name="play-circle-outline" size={compact ? 32 : 42} color={theme.textMuted} />
      )}
    </View>
  );

  const episodeCopy = (
    <>
      <Text style={[styles.eyebrow, { color: theme.accent }]}>UP NEXT</Text>
      <Text style={[styles.meta, { color: theme.textSecondary }]}>Season {episode.seasonNumber} · Episode {episode.episodeNumber}</Text>
      <Text
        numberOfLines={compactLandscape ? 2 : 3}
        style={[styles.title, compactLandscape && styles.titleCompact, { color: theme.text }]}
      >
        {episode.name}
      </Text>
      <Text accessibilityLiveRegion="polite" style={[styles.countdown, { color: theme.textMuted }]}>Starting in <Text style={{ color: theme.text, fontWeight: '900' }}>{countdown}</Text>s</Text>
    </>
  );

  return (
    <Modal transparent statusBarTranslucent animationType="fade" onRequestClose={onCancel}>
      <ScrollView
        style={[styles.backdrop, { backgroundColor: theme.mediaScrim }]}
        contentContainerStyle={[
          styles.content,
          landscape && styles.contentLandscape,
          compactLandscape && styles.contentCompactLandscape,
        ]}
        bounces={false}
        keyboardShouldPersistTaps="handled"
      >
        <View
          accessibilityViewIsModal
          style={[
            styles.card,
            landscape && styles.cardLandscape,
            compactLandscape && styles.cardCompactLandscape,
            { backgroundColor: theme.elevated, borderColor: theme.border },
          ]}
        >
          {compactLandscape ? (
            <View style={styles.compactHeroRow}>
              <View style={styles.compactCopy}>{episodeCopy}</View>
              {stillArtwork(true)}
            </View>
          ) : (
            <>
              {episodeCopy}
              {stillArtwork()}
            </>
          )}
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Play episode ${episode.episodeNumber} now`}
              onPress={playNow}
              style={[styles.button, styles.primaryButton, { backgroundColor: theme.accent }]}
            >
              <Ionicons name="play" size={18} color={theme.onAccent} />
              <Text style={[styles.primaryText, { color: theme.onAccent }]}>Play Now</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={[styles.button, styles.secondaryButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Text style={[styles.secondaryText, { color: theme.text }]}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[4],
  },
  contentLandscape: {
    alignItems: 'flex-end',
    paddingHorizontal: spacing[5],
  },
  contentCompactLandscape: {
    paddingVertical: spacing[2],
  },
  card: {
    width: '100%',
    maxWidth: 520,
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing[4],
    gap: spacing[3],
  },
  cardLandscape: {
    width: '46%',
    minWidth: 340,
    maxWidth: 460,
  },
  cardCompactLandscape: {
    paddingVertical: spacing[3],
    gap: spacing[2],
  },
  compactHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  compactCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing[2],
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
  },
  stillFrame: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stillFrameCompact: {
    width: '40%',
    maxWidth: 176,
    minWidth: 132,
    flexShrink: 0,
  },
  still: { width: '100%', height: '100%' },
  meta: { fontSize: 13, fontWeight: '700' },
  title: { fontSize: 23, lineHeight: 29, fontWeight: '900' },
  titleCompact: { fontSize: 19, lineHeight: 23 },
  countdown: { fontSize: 14 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  button: {
    minHeight: 48,
    borderRadius: radii.full,
    paddingHorizontal: spacing[4],
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing[2],
  },
  primaryButton: { flexGrow: 1 },
  secondaryButton: { borderWidth: 1, minWidth: 112 },
  primaryText: { fontSize: 14, fontWeight: '900' },
  secondaryText: { fontSize: 14, fontWeight: '800' },
});
