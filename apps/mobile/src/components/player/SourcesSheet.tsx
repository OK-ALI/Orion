import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ScrollView, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { accent, radii, spacing } from '@orion/shared/tokens';
import { getMobileSourceHealthV2 } from '../../services/sourceHealth';
import { useOrionTheme } from '../../context/ThemeContext';
import { MOBILE_PLAYER_SOURCES } from '../../features/playback/mobileSources';
import type {
  EmbeddedSubtitleTrackV1,
  ShieldVerificationState,
  SubtitleDiscoveryState,
} from '@orion/shared/types';

interface SourcesSheetProps {
  currentSourceId: string;
  onSelect: (sourceId: string) => void;
  onRetry?: () => void;
  onClose: () => void;
  mediaType?: 'movie' | 'tv';
  shieldState?: ShieldVerificationState;
  blockedRequests?: number;
  allowedDependencies?: number;
  subtitleState?: SubtitleDiscoveryState;
  subtitleCount?: number;
  subtitleTracks?: EmbeddedSubtitleTrackV1[];
  selectedSubtitleId?: string | null;
  onSelectSubtitle?: (trackId: string) => void;
  onFindExternalSubtitles?: () => void;
}

// Rich Source Metadata & Labels
const SOURCE_DETAILS: Record<string, { label: string; badge: string; badgeColor: string }> = {
  videasy: { label: 'VidEasy Ultra', badge: 'FAST • 1080p', badgeColor: '#10b981' },
  vidsrc: { label: 'VidSrc Primary', badge: 'RECOMMENDED', badgeColor: '#67e8f9' },
  vidking: { label: 'VidKing Cinema', badge: 'HIGH SPEED', badgeColor: '#3b82f6' },
  vidlink: { label: 'VidLink Engine', badge: 'EXP', badgeColor: '#f59e0b' },
  autoembed: { label: 'AutoEmbed Direct', badge: 'MULTI-HOST', badgeColor: '#a855f7' },
  vsembed: { label: 'VSEmbed Stream', badge: 'STABLE', badgeColor: '#10b981' },
  '111movies': { label: '111Movies Server', badge: 'EXP', badgeColor: '#f59e0b' },
  vixsrc: { label: 'VixSrc Stream', badge: 'EXP', badgeColor: '#f59e0b' },
  allmanga: { label: 'AllManga Anime', badge: 'ANIME SPECIAL', badgeColor: '#ec4899' },
};

export function SourcesSheet({
  currentSourceId,
  onSelect,
  onRetry,
  onClose,
  mediaType = 'movie',
  shieldState = 'limited',
  blockedRequests = 0,
  allowedDependencies = 0,
  subtitleState = 'idle',
  subtitleCount = 0,
  subtitleTracks = [],
  selectedSubtitleId = null,
  onSelectSubtitle,
  onFindExternalSubtitles,
}: SourcesSheetProps) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { theme } = useOrionTheme();
  const activeSource = MOBILE_PLAYER_SOURCES.find((source) => source.id === currentSourceId);
  const activeHealth = getMobileSourceHealthV2(currentSourceId, mediaType);
  const activeResume = activeSource?.resumeStrategy && activeSource.resumeStrategy !== 'none'
    ? 'Position support available'
    : 'Position support unavailable';
  const activeTelemetry = activeHealth?.telemetrySupport === 'observable'
    ? 'Timing available'
    : activeHealth?.telemetrySupport === 'unobservable'
      ? 'Timing unavailable'
      : 'Timing not verified yet';
  const activeSubtitles = activeHealth?.subtitleSupport === 'available'
    ? 'Provider subtitles available'
    : activeSource?.supportsExternalSubtitles
      ? 'External subtitles available'
      : 'Subtitle support not verified';

  return (
    <View style={[styles.overlay, isLandscape && styles.overlayLandscape]}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheetContent, { backgroundColor: theme.elevated, borderColor: theme.border }, isLandscape && styles.sheetContentLandscape]}>
        {/* Top Handle */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Ionicons name="server-outline" size={18} color={theme.accent} />
            <Text style={[styles.title, { color: theme.text }]}>Streaming Servers</Text>
          </View>

          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={18} color={theme.text} />
          </Pressable>
        </View>

        {/* Compact Sources List */}
        <View style={[styles.evidence, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.evidenceTitle, { color: theme.text }]}>
            {shieldState === 'verified'
              ? 'Protected'
              : shieldState === 'failed'
                ? 'Rule problem'
                : shieldState === 'disabled'
                  ? 'Protection disabled'
                  : shieldState === 'unavailable'
                    ? 'Protection unavailable'
                  : shieldState === 'dependency-allowed'
                    ? 'Required playback request allowed'
                  : 'Limited protection'}
          </Text>
          <Text style={[styles.evidenceText, { color: theme.textSecondary }]}>
            {blockedRequests > 0 ? `${blockedRequests} unwanted request${blockedRequests === 1 ? '' : 's'} blocked` : 'Watching required playback requests'}
            {allowedDependencies > 0 ? ` · ${allowedDependencies} required request${allowedDependencies === 1 ? '' : 's'} allowed` : ''}
          </Text>
        </View>

        <View style={[styles.activeSummary, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.activeSummaryTitle, { color: theme.text }]} numberOfLines={1}>
            {activeSource?.label || 'Selected source'}
          </Text>
          <Text style={[styles.activeSummaryDetail, { color: theme.textSecondary }]} numberOfLines={2}>
            {activeTelemetry} / {activeResume} / {activeSubtitles}
          </Text>
          {activeHealth?.lastFailure && (
            <Text style={[styles.activeSummaryWarning, { color: theme.warning || theme.accent }]} numberOfLines={1}>
              Last issue: {activeHealth.lastFailure.replace(/-/g, ' ')}
            </Text>
          )}
        </View>
        {onRetry && (
          <View style={styles.recoveryActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry selected streaming source"
              onPress={onRetry}
              style={({ pressed }) => [styles.retryAction, { borderColor: theme.accent }, pressed && { opacity: 0.76 }]}
            >
              <Ionicons name="refresh-outline" size={14} color={theme.accent} />
              <Text style={[styles.retryActionText, { color: theme.accent }]}>Retry source</Text>
            </Pressable>
          </View>
        )}

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          {MOBILE_PLAYER_SOURCES.map((source) => {
            const isActive = source.id === currentSourceId;
            const runtimeHealth = getMobileSourceHealthV2(source.id, mediaType);
            const isCoolingDown = Boolean(runtimeHealth?.cooldownUntil && runtimeHealth.cooldownUntil > Date.now());
            const supportsMedia = mediaType === 'movie' ? source.media.movie : source.media.tv;
            const meta = SOURCE_DETAILS[source.id] || {
              label: source.id.toUpperCase(),
              badge: source.health === 'experimental' ? 'EXP' : 'STABLE',
              badgeColor: '#f59e0b',
            };

            return (
              <Pressable
                key={source.id}
                disabled={!supportsMedia}
                style={({ pressed }) => [
                  styles.sourceRow,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                  isActive && { backgroundColor: theme.accentSoft, borderColor: theme.accent },
                  !supportsMedia && styles.disabledRow,
                  pressed && { opacity: 0.85 },
                ]}
                onPress={() => {
                  onSelect(source.id);
                  onClose();
                }}
              >
                {/* Left Icon + Title */}
                <View style={styles.leftCol}>
                  <View style={[
                    styles.iconContainer,
                    { backgroundColor: theme.elevated, borderColor: theme.border },
                    isActive && { backgroundColor: theme.accent, borderColor: theme.accent },
                  ]}>
                    <Ionicons 
                      name={isActive ? "play" : "hardware-chip-outline"} 
                      size={14} 
                      color={isActive ? theme.onAccent : theme.textSecondary}
                    />
                  </View>

                  <View style={styles.nameCol}>
                    <Text style={[styles.sourceName, { color: isActive ? theme.text : theme.textSecondary }, isActive && styles.activeText]}>
                      {meta.label}
                    </Text>

                    <View style={styles.badgeRow}>
                      <View style={[styles.badge, { backgroundColor: `${meta.badgeColor}22`, borderColor: `${meta.badgeColor}55` }]}>
                        <Text style={[styles.badgeText, { color: meta.badgeColor }]}>{meta.badge}</Text>
                      </View>
                      {runtimeHealth?.state && runtimeHealth.state !== 'unknown' && (
                        <Text style={[
                          styles.healthText,
                          runtimeHealth.state === 'failed' && { color: theme.danger },
                        ]}>
                          {isCoolingDown ? 'Cooling down' : runtimeHealth.state}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>

                {/* Right Selection Radio / Checkmark */}
                {isActive ? (
                  <View style={[styles.activeCheckPill, { backgroundColor: theme.accent }]}>
                    <Ionicons name="checkmark-circle" size={14} color={theme.onAccent} />
                    <Text style={styles.activePillText}>ACTIVE</Text>
                  </View>
                ) : (
                  <View style={[styles.unselectedDot, { borderColor: theme.border }]} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
        {subtitleTracks.length > 0 && (
          <View style={[styles.subtitleTracks, { borderTopColor: theme.border }]}>
            {subtitleTracks.slice(0, 3).map((track) => {
              const selected = track.id === selectedSubtitleId;
              return (
                <Pressable
                  key={track.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Use ${track.label} subtitles`}
                  disabled={!onSelectSubtitle || track.availability === 'unavailable'}
                  onPress={() => onSelectSubtitle?.(track.id)}
                  style={({ pressed }) => [
                    styles.subtitleTrack,
                    { backgroundColor: selected ? theme.accentSoft : theme.surface, borderColor: selected ? theme.accent : theme.border },
                    pressed && { opacity: 0.76 },
                  ]}
                >
                  <View style={styles.subtitleTrackCopy}>
                    <Text numberOfLines={1} style={[styles.subtitleTrackLabel, { color: theme.text }]}>{track.label}</Text>
                    <Text numberOfLines={1} style={[styles.subtitleTrackMeta, { color: theme.textSecondary }]}>
                      {track.language.toUpperCase()} / {track.discoveryMethod === 'external' ? 'Orion fallback' : 'Provider track'}
                    </Text>
                  </View>
                  <Ionicons
                    name={selected ? 'checkmark-circle' : 'add-circle-outline'}
                    size={18}
                    color={selected ? theme.accent : theme.textSecondary}
                  />
                </Pressable>
              );
            })}
          </View>
        )}
        {onFindExternalSubtitles && (
          <View style={[styles.subtitleFooter, { borderTopColor: theme.border }]}>
            <View style={styles.subtitleCopy}>
              <Text style={[styles.subtitleTitle, { color: theme.text }]}>Subtitles</Text>
              <Text style={[styles.subtitleDetail, { color: theme.textSecondary }]}>
                {subtitleState === 'discovering'
                  ? 'Finding subtitle tracks…'
                  : subtitleCount > 0
                    ? `${subtitleCount} track${subtitleCount === 1 ? '' : 's'} available or detected`
                    : 'Find external subtitle tracks when this source has none.'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Find external subtitles"
              disabled={subtitleState === 'discovering'}
              onPress={onFindExternalSubtitles}
              style={({ pressed }) => [styles.subtitleAction, { borderColor: theme.accent }, pressed && { opacity: 0.76 }]}
            >
              <Text style={[styles.subtitleActionText, { color: theme.accent }]}>
                {subtitleState === 'discovering' ? 'Searching' : 'Find'}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  sheetContent: {
    backgroundColor: '#0d0d16',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    maxHeight: '60%',
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  sheetContentLandscape: {
    width: 400,
    alignSelf: 'center',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderWidth: 1,
    maxHeight: '80%',
    paddingBottom: 16,
  },
  overlayLandscape: {
    justifyContent: 'center',
  },
  handle: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignSelf: 'center',
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: spacing[3],
    gap: 6,
  },
  evidence: {
    marginHorizontal: spacing[3],
    marginTop: 2,
    paddingHorizontal: spacing[3],
    paddingVertical: 9,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  evidenceTitle: { fontSize: 12, fontWeight: '800' },
  evidenceText: { marginTop: 2, fontSize: 11, lineHeight: 16 },
  activeSummary: {
    marginHorizontal: spacing[3],
    marginTop: 8,
    paddingHorizontal: spacing[3],
    paddingVertical: 9,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  activeSummaryTitle: { fontSize: 12, fontWeight: '800' },
  activeSummaryDetail: { marginTop: 2, fontSize: 10, lineHeight: 15 },
  activeSummaryWarning: { marginTop: 4, fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  recoveryActions: { flexDirection: 'row', paddingHorizontal: spacing[3], paddingTop: 8 },
  retryAction: { minHeight: 36, paddingHorizontal: 12, gap: 6, borderRadius: radii.full, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  retryActionText: { fontSize: 12, fontWeight: '800' },
  subtitleFooter: {
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing[3],
    paddingTop: 10,
  },
  subtitleTracks: { borderTopWidth: 1, paddingHorizontal: spacing[3], paddingTop: 8, gap: 6 },
  subtitleTrack: { minHeight: 44, borderWidth: 1, borderRadius: radii.md, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  subtitleTrackCopy: { flex: 1, minWidth: 0 },
  subtitleTrackLabel: { fontSize: 12, fontWeight: '700' },
  subtitleTrackMeta: { marginTop: 1, fontSize: 10 },
  subtitleCopy: { flex: 1 },
  subtitleTitle: { fontSize: 12, fontWeight: '800' },
  subtitleDetail: { marginTop: 2, fontSize: 10, lineHeight: 14 },
  subtitleAction: { minWidth: 64, minHeight: 36, paddingHorizontal: 12, borderRadius: radii.full, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  subtitleActionText: { fontSize: 12, fontWeight: '800' },
  sourceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: 8,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  activeRow: {
    backgroundColor: 'rgba(229, 9, 20, 0.16)',
    borderColor: accent.primary,
  },
  disabledRow: {
    opacity: 0.48,
  },
  leftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  activeIconContainer: {
    backgroundColor: accent.primary,
    borderColor: accent.primary,
  },
  nameCol: {
    gap: 2,
  },
  sourceName: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    fontWeight: '600',
  },
  activeText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  healthText: { color: 'rgba(255,255,255,0.55)', fontSize: 9, textTransform: 'uppercase', fontWeight: '700' },
  healthFailed: { color: '#f87171' },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  activeCheckPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: accent.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  activePillText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  unselectedDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
});
