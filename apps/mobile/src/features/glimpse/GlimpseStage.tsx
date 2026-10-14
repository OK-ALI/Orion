import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { imgUrl } from '@orion/shared/api';
import { fontFamilies, radii, spacing } from '@orion/shared/tokens';
import { useOrionTheme } from '../../context/ThemeContext';
import { glimpseActionLabel, type GlimpseReel } from './glimpseModel';
import { GlimpseAmbientFrame } from './GlimpseAmbientFrame';
import type { GlimpsePalette } from './GlimpseAmbientSampler';
import type { PerformanceProfileId } from '../../services/performanceProfiles';
import { GlimpseVideoSurface } from './GlimpseVideoSurface';
import { fitGlimpseMedia } from './glimpseLayout';
import { glimpseFailureCopy, type GlimpseVideoFailure } from './glimpseEmbed';

export function GlimpseStage({ reel, active, selected, unavailable, failed, failure, onRetry, onOpenYouTube, muted, onMute, onView, onFailure, onPrevious, onNext, hasPrevious, hasNext, liked, likesUnavailable, onLike, onEnded, compact = false, onEvidence, ambientGlow = false, profile = 'balanced', reducedMotion = true }: {
  onEvidence?: (event: 'selected' | 'failed') => void; ambientGlow?: boolean; profile?: PerformanceProfileId; reducedMotion?: boolean; compact?: boolean; reel: GlimpseReel; active: boolean; selected: boolean; unavailable: boolean; failed: boolean; muted: boolean;
  onEnded?: () => void; onMute: () => void; onView: () => void; failure?: GlimpseVideoFailure; onRetry: () => void; onOpenYouTube: () => void; onFailure: (failure?: GlimpseVideoFailure) => void; liked: boolean; likesUnavailable: boolean; onLike: () => void;
  onPrevious: () => void; onNext: () => void; hasPrevious: boolean; hasNext: boolean;
}) {
  const { theme } = useOrionTheme();
  const [palette, setPalette] = useState<GlimpsePalette | null>(null);
  const [videoState, setVideoState] = useState('preparing');
  const ended = useRef(false);
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  useEffect(() => { if (active) { setPalette(null); ended.current = false; setVideoState('preparing'); } }, [active]);
  useEffect(() => { if (active) onEvidence?.('selected'); }, [active, reel.id]);
  const artwork = imgUrl(reel.artworkPath, 'w780');
  const mediaBounds = fitGlimpseMedia(bounds, reel.video.dimensions);
  const copy = unavailable ? 'Connect to stream this clip.' : failed ? glimpseFailureCopy(failure)
    : videoState === 'blocked' ? 'Use the video Play control to start.' : null;
  return <GlimpseAmbientFrame artworkPath={reel.artworkPath} enabled={active && ambientGlow} playing={videoState === 'playing'} reducedMotion={reducedMotion} palette={palette} profile={profile}><View style={[styles.stage, compact && styles.landscapeStage, { backgroundColor: theme.elevated, borderColor: theme.border }]}>
    <View style={styles.media} onLayout={event => setBounds(event.nativeEvent.layout)}>
      {!!artwork && <Image accessible={false} source={{ uri: artwork }} resizeMode="contain" style={StyleSheet.absoluteFill} />}
      <LinearGradient pointerEvents="none" colors={['transparent', theme.mediaScrim]} style={StyleSheet.absoluteFill} />
      {active && !failed && mediaBounds.width > 0 && <View style={mediaBounds}>
        <GlimpseVideoSurface reel={reel} muted={muted} ambientGlow={ambientGlow} profile={profile} reducedMotion={reducedMotion} onPalette={setPalette} onEvent={(event, reason) => {
          setVideoState(event);
          if (event === 'failed') { onEvidence?.('failed'); onFailure(reason); }
          if (event === 'ended' && active && !ended.current) { ended.current = true; onEnded?.(); }
        }} />
      </View>}
      {active && videoState === 'preparing' && <View pointerEvents="none" style={styles.preparing}>
        <ActivityIndicator color={theme.accent} />
        <Text style={[styles.status, { color: '#ffffff' }]}>Preparing clip…</Text>
      </View>}
      {selected && !!copy && <View pointerEvents={failed && !unavailable ? 'auto' : 'none'} style={[styles.message, { backgroundColor: theme.background }]}>
        <Text accessibilityLiveRegion="polite" style={[styles.status, { color: theme.text }]}>{copy}</Text>
        {failed && !unavailable && <View style={styles.failureActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Retry this clip" onPress={onRetry} style={[styles.failureButton, { borderColor: theme.border }]}>
            <Text style={{ color: theme.text }}>Retry</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Open clip in YouTube" onPress={onOpenYouTube} style={[styles.failureButton, { borderColor: theme.border, backgroundColor: theme.accentSoft }]}>
            <Text style={{ color: theme.text }}>Open in YouTube</Text>
          </Pressable>
        </View>}
      </View>}
    </View>
    {compact ? <ScrollView style={styles.landscapeMetadata} contentContainerStyle={[styles.metadata, { backgroundColor: theme.elevated }]}>
      <Text style={[styles.kind, { color: theme.accent }]}>
        {reel.media.isAnime ? 'ANIME' : reel.media.mediaType === 'movie' ? 'MOVIE' : 'SERIES'}{reel.year ? ' · ' + reel.year : ''} · {reel.video.type}
      </Text>
      <Text accessibilityRole="header" numberOfLines={2} style={[styles.title, { color: theme.text }]}>{reel.title}</Text>
      <Text numberOfLines={1} style={[styles.clipTitle, { color: theme.textSecondary }]}>{reel.clipTitle}</Text>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel={liked ? 'Unlike clip' : 'Like clip'}
          accessibilityState={{ selected: liked, disabled: likesUnavailable }} disabled={likesUnavailable} onPress={onLike}
          style={[styles.iconAction, { borderColor: theme.border, backgroundColor: liked ? theme.accentSoft : 'transparent', opacity: likesUnavailable ? 0.5 : 1 }]}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} color={liked ? theme.accent : theme.text} size={20} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={muted ? 'Unmute clip' : 'Mute clip'}
          accessibilityState={{ disabled: !active }} disabled={!active} onPress={onMute}
          style={[styles.iconAction, { borderColor: theme.border, opacity: active ? 1 : 0.5 }]}>
          <Ionicons name={muted ? 'volume-mute-outline' : 'volume-high-outline'} color={theme.text} size={20} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={glimpseActionLabel(reel) + ': ' + reel.title}
          onPress={onView} style={[styles.viewAction, styles.compactViewAction, { backgroundColor: theme.accentSoft, borderColor: theme.border }]}>
          <Text style={[styles.actionText, { color: theme.text }]}>{glimpseActionLabel(reel)}</Text>
          <Ionicons name="arrow-forward" color={theme.accent} size={18} />
        </Pressable>
      </View>
</ScrollView> :     <View style={[styles.metadata, { backgroundColor: theme.elevated }]}>
      <Text style={[styles.kind, { color: theme.accent }]}>
        {reel.media.isAnime ? 'ANIME' : reel.media.mediaType === 'movie' ? 'MOVIE' : 'SERIES'}{reel.year ? ' · ' + reel.year : ''} · {reel.video.type}
      </Text>
      <Text accessibilityRole="header" numberOfLines={2} style={[styles.title, { color: theme.text }]}>{reel.title}</Text>
      <Text numberOfLines={1} style={[styles.clipTitle, { color: theme.textSecondary }]}>{reel.clipTitle}</Text>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel={liked ? 'Unlike clip' : 'Like clip'}
          accessibilityState={{ selected: liked, disabled: likesUnavailable }} disabled={likesUnavailable} onPress={onLike}
          style={[styles.iconAction, { borderColor: theme.border, backgroundColor: liked ? theme.accentSoft : 'transparent', opacity: likesUnavailable ? 0.5 : 1 }]}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} color={liked ? theme.accent : theme.text} size={20} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={muted ? 'Unmute clip' : 'Mute clip'}
          accessibilityState={{ disabled: !active }} disabled={!active} onPress={onMute}
          style={[styles.iconAction, { borderColor: theme.border, opacity: active ? 1 : 0.5 }]}>
          <Ionicons name={muted ? 'volume-mute-outline' : 'volume-high-outline'} color={theme.text} size={20} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={glimpseActionLabel(reel) + ': ' + reel.title}
          onPress={onView} style={[styles.viewAction, { backgroundColor: theme.accentSoft, borderColor: theme.border }]}>
          <Text style={[styles.actionText, { color: theme.text }]}>{glimpseActionLabel(reel)}</Text>
          <Ionicons name="arrow-forward" color={theme.accent} size={18} />
        </Pressable>
      </View>
    </View>}

  </View></GlimpseAmbientFrame>;
}
const styles = StyleSheet.create({
  stage: { flex: 1, borderWidth: 1, borderRadius: radii.xl, overflow: 'hidden' },
  media: { flex: 1, minHeight: 0, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  landscapeStage: { flexDirection: 'row' }, landscapeMetadata: { width: 180, flexGrow: 0, flexShrink: 0 },
  metadata: { padding: spacing[3], gap: spacing[1] },
  kind: { fontFamily: fontFamilies.heading, fontSize: 11, fontWeight: '700' },
  title: { fontFamily: fontFamilies.heading, fontSize: 19, fontWeight: '800' },
  clipTitle: { fontSize: 12, marginBottom: spacing[2] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], alignItems: 'center' },
  iconAction: { minWidth: 44, minHeight: 44, borderWidth: 1, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center' },
  viewAction: { minHeight: 44, flex: 1, minWidth: 0, justifyContent: 'center', paddingHorizontal: spacing[2], borderRadius: radii.lg, borderWidth: 1, flexDirection: 'row', gap: spacing[2], alignItems: 'center' },
  compactViewAction: { flexBasis: '100%', flexGrow: 0, flexShrink: 0 },
  actionText: { fontSize: 12, fontWeight: '700', flexShrink: 1 },
  preparing: { position: 'absolute', gap: spacing[2], alignItems: 'center', backgroundColor: '#000000b0', padding: spacing[3], borderRadius: radii.lg },
  message: { position: 'absolute', left: spacing[4], right: spacing[4], padding: spacing[3], borderRadius: radii.lg },
  failureActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing[2], marginTop: spacing[3] },
  failureButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing[3], borderWidth: 1, borderRadius: radii.lg },
  status: { fontSize: 13, textAlign: 'center' },
});
