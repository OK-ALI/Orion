import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { imgUrl } from '@orion/shared/api';
import type { ContinueWatchingEntry } from '@orion/shared/types';
import { useOrionTheme } from '../../context/ThemeContext';
import { compositePaletteColor, paletteContrast } from '../appearance/customAppearancePalette';
import { progressDescription } from './playbackFormatting';
import { useResponsiveLayout } from '../../services/responsive';
import { useContinueWatchingArtwork } from './useContinueWatchingArtwork';

interface ContinueWatchingCardProps {
  entry: ContinueWatchingEntry;
  onResume: () => void;
  onRemove: () => void;
  onMarkWatched: () => void;
  onOpenDetails?: () => void;
  presentation?: ContinueWatchingPresentation;
}

export type ContinueWatchingPresentation = 'home-rail' | 'library-full' | 'offline-compact';

const PRESS_OPACITY = 0.72;

function fadedOverCard(color: string, card: string) {
  const rgb = [1, 3, 5].map(index => Number.parseInt(color.slice(index, index + 2), 16));
  return compositePaletteColor('rgba(' + rgb.join(',') + ',' + PRESS_OPACITY + ')', card);
}

export function ContinueWatchingCard({
  entry,
  onResume,
  onRemove,
  onMarkWatched,
  onOpenDetails,
  presentation: presentationMode = 'home-rail',
}: ContinueWatchingCardProps) {
  const { width, shortestEdge } = useResponsiveLayout();
  const { theme, effectiveAppearanceThemeId, advancedAppearanceChoices } = useOrionTheme();
  const [resumeFocused, setResumeFocused] = useState(false);
  const adaptive = effectiveAppearanceThemeId === 'custom-light' ||
    (effectiveAppearanceThemeId === 'custom' && advancedAppearanceChoices?.custom.dark.rendering === 'adaptive');
  const resumePress = adaptive && paletteContrast(
    fadedOverCard(theme.onAccent, theme.elevated),
    fadedOverCard(theme.accent, theme.elevated),
  ) < 4.5 ? styles.pressScale : styles.pressed;
  const { progress } = entry;
  const { mediaIdentity, presentation } = progress;
  const compact = shortestEdge < 360;
  const isLibrary = presentationMode === 'library-full';
  const offlineCompact = presentationMode === 'offline-compact';
  const cardWidth = isLibrary
    ? '100%'
    : Math.min(330, Math.max(252, width * (compact ? 0.82 : 0.79)));
  const artwork = useContinueWatchingArtwork(entry);
  const episodeContext = mediaIdentity.mediaType === 'tv'
    ? `S${mediaIdentity.season || 1} E${mediaIdentity.episode || 1}${presentation.episodeTitle ? ` · ${presentation.episodeTitle}` : ''}`
    : mediaIdentity.year ? String(mediaIdentity.year) : 'Movie';
  const ratio = progress.duration > 0
    ? Math.min(1, Math.max(0, progress.currentTime / progress.duration))
    : 0;

  return (
    <View style={[styles.card, !isLibrary && styles.homeCard, { width: cardWidth, backgroundColor: theme.elevated, borderColor: theme.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${mediaIdentity.title}`}
        onPress={onOpenDetails || onResume}
        style={({ pressed }) => [styles.artworkFrame, offlineCompact && styles.offlineArtworkFrame, pressed && styles.pressed]}
      >
        {artwork ? (
          <Image source={{ uri: artwork }} style={styles.artwork} resizeMode="cover" />
        ) : (
          <View style={[styles.artwork, styles.fallback, { backgroundColor: theme.surface }]}>
            <Ionicons name="film-outline" size={34} color={theme.textMuted} />
          </View>
        )}
        <View style={[styles.scrim, { backgroundColor: theme.mediaScrim }]} />
        <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
          {ratio > 0 && <View style={[styles.progressFill, { width: `${ratio * 100}%`, backgroundColor: theme.accent }]} />}
        </View>
      </Pressable>

      <View style={[styles.content, !isLibrary && styles.homeContent, offlineCompact && styles.offlineContent]}>
        <Text style={[styles.title, !isLibrary && styles.homeTitle, { color: theme.text }]} numberOfLines={2}>{mediaIdentity.title}</Text>
        <Text style={[styles.context, { color: theme.textSecondary }]} numberOfLines={2}>{episodeContext}</Text>
        <Text style={[styles.progressText, { color: theme.textMuted }]} numberOfLines={1}>
          {progressDescription(progress.currentTime, progress.duration, progress.percent)}
        </Text>
        <View style={[styles.actions, compact && styles.actionsCompact, offlineCompact && styles.offlineActions]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Resume ${mediaIdentity.title}`}
            onPress={onResume}
            onFocus={adaptive ? () => setResumeFocused(true) : undefined}
            onBlur={adaptive ? () => setResumeFocused(false) : undefined}
            style={({ pressed }) => [styles.resume, { backgroundColor: theme.accent }, pressed && resumePress]}
          >
            <Ionicons name="play" size={17} color={theme.onAccent} />
            <Text style={[styles.resumeText, { color: theme.onAccent }]}>Resume</Text>
            {adaptive && resumeFocused && (
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.resumeOutline, { borderColor: theme.onAccent }]} />
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Mark ${mediaIdentity.title} watched`}
            onPress={onMarkWatched}
            style={({ pressed }) => [styles.iconButton, { borderColor: theme.border }, pressed && styles.pressed]}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color={theme.textSecondary} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${mediaIdentity.title} from Continue Watching`}
            onPress={onRemove}
            style={({ pressed }) => [styles.iconButton, { borderColor: theme.border }, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={21} color={theme.textSecondary} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const resumeRadius = 22;

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, overflow: 'hidden', flexShrink: 0 },
  artworkFrame: { width: '100%', aspectRatio: 16 / 9, overflow: 'hidden' },
  offlineArtworkFrame: { aspectRatio: 2.25 },
  offlineContent: { padding: 10, gap: 2 },
  offlineActions: { marginTop: 6 },
  artwork: { width: '100%', height: '100%' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  scrim: { ...StyleSheet.absoluteFill, opacity: 0.22 },
  progressTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 4 },
  progressFill: { height: '100%' },
  content: { padding: 14, gap: 4 },
  homeCard: { borderRadius: 16 },
  homeContent: { padding: 12 },
  title: { fontSize: 18, fontWeight: '800', lineHeight: 23 },
  homeTitle: { fontSize: 16, lineHeight: 20 },
  context: { fontSize: 13, lineHeight: 18 },
  progressText: { fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  actionsCompact: { alignItems: 'stretch' },
  resume: { minHeight: 44, paddingHorizontal: 16, borderRadius: resumeRadius, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, flexGrow: 1 },
  resumeOutline: { borderWidth: 2, borderRadius: resumeRadius },
  resumeText: { fontSize: 14, fontWeight: '800' },
  iconButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pressScale: { transform: [{ scale: 0.985 }] },
  pressed: { opacity: PRESS_OPACITY, transform: [{ scale: 0.985 }] },
});
