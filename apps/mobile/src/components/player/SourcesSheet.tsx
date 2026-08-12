import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing } from '@orion/shared/tokens';
import { getMobileSourceHealthV2 } from '../../services/sourceHealth';
import { useOrionTheme } from '../../context/ThemeContext';
import {
  MOBILE_PLAYER_SOURCES,
  getMobileSourceContinuityCapability,
} from '../../features/playback/mobileSources';
import type { EmbeddedSubtitleTrackV1, ShieldVerificationState, SubtitleDiscoveryState } from '@orion/shared/types';

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

const DISPLAY_NAMES: Record<string, string> = {
  videasy: 'Videasy', vidsrc: 'VidSrc', vidking: 'VidKing', vidlink: 'VidLink',
  autoembed: 'AutoEmbed', vsembed: 'VsEmbed', '111movies': '111Movies', vixsrc: 'VixSrc',
};

const protectionLabel = (state: ShieldVerificationState) => ({
  verified: 'Protected', failed: 'Protection issue', disabled: 'Protection off',
  unavailable: 'Protection unavailable', 'dependency-allowed': 'Protection active',
  limited: 'Protection limited',
}[state] || 'Protection limited');

const playbackStatusLabel = (state: string | null | undefined, cooling = false) => {
  if (cooling) return 'Try again shortly';
  return ({
    ready: 'Playing normally',
    slow: 'Starting slowly',
    limited: 'May be limited',
    failed: 'Having trouble',
    unknown: 'Checking source',
  } as Record<string, string>)[state || 'unknown'] || 'Available';
};

export function SourcesSheet(props: SourcesSheetProps) {
  const {
    currentSourceId, onSelect, onRetry, onClose, mediaType = 'movie', shieldState = 'limited',
    blockedRequests = 0, allowedDependencies = 0, subtitleState = 'idle', subtitleCount = 0,
    subtitleTracks = [], selectedSubtitleId = null, onSelectSubtitle, onFindExternalSubtitles,
  } = props;
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { theme } = useOrionTheme();
  const wide = width >= 700 || width > height;
  const [detailsOpen, setDetailsOpen] = useState(wide);
  const active = MOBILE_PLAYER_SOURCES.find((source) => source.id === currentSourceId);
  const health = getMobileSourceHealthV2(currentSourceId, mediaType);
  const sourceName = DISPLAY_NAMES[currentSourceId] || active?.label || 'Selected source';
  const activeContinuity = getMobileSourceContinuityCapability(currentSourceId);
  const healthLabel = playbackStatusLabel(health?.state);
  const subtitleLabel = health?.subtitleSupport === 'available' || subtitleCount > 0
    ? 'Subtitles available'
    : active?.supportsExternalSubtitles ? 'More subtitles available' : 'Subtitles may vary';
  const timingLabel = health?.telemetrySupport === 'observable'
    ? 'Progress saving ready'
    : health?.telemetrySupport === 'unobservable' ? 'Progress saving unavailable' : 'Checking progress saving';

  const sourceList = (
    <ScrollView style={styles.sourceScroll} contentContainerStyle={styles.sourceList} showsVerticalScrollIndicator={false}>
      {MOBILE_PLAYER_SOURCES.map((source) => {
        const selected = source.id === currentSourceId;
        const runtime = getMobileSourceHealthV2(source.id, mediaType);
        const supported = mediaType === 'movie' ? source.media.movie : source.media.tv;
        const cooling = Boolean(runtime?.cooldownUntil && runtime.cooldownUntil > Date.now());
        const status = playbackStatusLabel(runtime?.state, cooling);
        const continuity = getMobileSourceContinuityCapability(source.id);
        const continuityTone = continuity.mode === 'seamless'
          ? theme.success
          : continuity.mode === 'outgoing-only' || continuity.mode === 'limited-resume' || continuity.mode === 'unpredictable'
            ? theme.warning
            : theme.textSecondary;
        return (
          <Pressable
            key={source.id}
            disabled={!supported}
            accessibilityRole="button"
            accessibilityLabel={`${DISPLAY_NAMES[source.id] || source.label}. ${continuity.label}. ${status}.`}
            accessibilityHint={continuity.description}
            accessibilityState={{ selected, disabled: !supported }}
            onPress={() => { onSelect(source.id); onClose(); }}
            style={({ pressed }) => [
              styles.sourceRow,
              { backgroundColor: selected ? theme.accentSoft : theme.surface, borderColor: selected ? theme.accent : theme.border },
              !supported && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.sourceIcon, { backgroundColor: selected ? theme.accent : theme.elevated, borderColor: selected ? theme.accent : theme.border }]}>
              <Ionicons name={selected ? 'play' : 'hardware-chip-outline'} size={17} color={selected ? theme.onAccent : theme.textSecondary} />
            </View>
            <View style={styles.sourceCopy}>
              <View style={styles.sourceNameRow}>
                <Text numberOfLines={1} style={[styles.sourceName, { color: theme.text }]}>{DISPLAY_NAMES[source.id] || source.label}</Text>
                <View style={[styles.continuityBadge, { borderColor: continuityTone }]}>
                  <Text numberOfLines={1} style={[styles.continuityBadgeText, { color: continuityTone }]}>{continuity.shortLabel}</Text>
                </View>
              </View>
              <Text numberOfLines={1} style={[styles.sourceStatus, { color: runtime?.state === 'failed' ? theme.danger : theme.textSecondary }]}>{status}</Text>
            </View>
            <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={21} color={selected ? theme.accent : theme.textSecondary} />
          </Pressable>
        );
      })}
    </ScrollView>
  );

  const details = (
    <ScrollView style={styles.detailsScroll} contentContainerStyle={styles.detailsBody} showsVerticalScrollIndicator={false}>
      <View style={[styles.detailCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.detailTitle, { color: theme.text }]}>{protectionLabel(shieldState)}</Text>
        <Text style={[styles.detailText, { color: theme.textSecondary }]}>
          {blockedRequests > 0 ? `${blockedRequests} unwanted connection${blockedRequests === 1 ? '' : 's'} blocked` : 'Protection is active while you watch.'}
        </Text>
        {allowedDependencies > 0 && <Text style={[styles.detailText, { color: theme.textSecondary }]}>Playback connections needed by this source are allowed</Text>}
      </View>
      <View style={[styles.detailCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.detailTitle, { color: theme.text }]}>Resume & progress</Text>
        <Text style={[
          styles.detailTextStrong,
          { color: activeContinuity.mode === 'seamless' ? theme.success : activeContinuity.mode === 'outgoing-only' || activeContinuity.mode === 'limited-resume' || activeContinuity.mode === 'unpredictable' || activeContinuity.mode === 'start-over-only' ? theme.warning : theme.textSecondary },
        ]}>{activeContinuity.label}</Text>
        <View style={styles.capabilityList}>
          <Text style={[styles.capabilityLine, { color: activeContinuity.canTrackProgress ? theme.text : theme.textMuted }]}>
            {activeContinuity.canTrackProgress ? '✓' : '–'} Saves your place
          </Text>
          <Text style={[styles.capabilityLine, { color: activeContinuity.canTransferOut ? theme.text : theme.textMuted }]}>
            {activeContinuity.canTransferOut ? '✓' : '–'} Continue on another source
          </Text>
          <Text style={[styles.capabilityLine, { color: activeContinuity.mode === 'limited-resume' ? theme.warning : activeContinuity.canReceivePosition ? theme.text : theme.textMuted }]}>
            {activeContinuity.mode === 'limited-resume' ? '⚠' : activeContinuity.canReceivePosition ? '✓' : '✕'} Continue here from another source
          </Text>
        </View>
        <Text style={[styles.detailText, { color: theme.textSecondary }]}>{activeContinuity.description}</Text>
        <Text style={[styles.detailMeta, { color: theme.textMuted }]}>{timingLabel} · {subtitleLabel}</Text>
        {health?.lastFailure && <Text numberOfLines={2} style={[styles.detailText, { color: theme.warning }]}>This source had trouble recently. Try again if playback doesn't start.</Text>}
      </View>
      {onRetry && (
        <Pressable onPress={onRetry} style={({ pressed }) => [styles.outlineAction, { borderColor: theme.accent }, pressed && styles.pressed]}>
          <Ionicons name="refresh-outline" size={17} color={theme.accent} />
          <Text style={[styles.actionText, { color: theme.accent }]}>Try again</Text>
        </Pressable>
      )}
      <View style={[styles.detailCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.detailTitle, { color: theme.text }]}>Subtitles</Text>
        <Text style={[styles.detailText, { color: theme.textSecondary }]}>
          {subtitleState === 'discovering' ? 'Finding subtitles…' : subtitleCount > 0 ? `${subtitleCount} subtitle track${subtitleCount === 1 ? '' : 's'} available` : subtitleLabel}
        </Text>
        {subtitleTracks.slice(0, 4).map((track) => {
          const selected = track.id === selectedSubtitleId;
          return (
            <Pressable
              key={track.id}
              disabled={!onSelectSubtitle || track.availability === 'unavailable'}
              onPress={() => onSelectSubtitle?.(track.id)}
              style={({ pressed }) => [styles.subtitleRow, { borderColor: selected ? theme.accent : theme.border }, pressed && styles.pressed]}
            >
              <Text numberOfLines={1} style={[styles.subtitleName, { color: theme.text }]}>{track.label}</Text>
              <Ionicons name={selected ? 'checkmark-circle' : 'add-circle-outline'} size={19} color={selected ? theme.accent : theme.textSecondary} />
            </Pressable>
          );
        })}
        {onFindExternalSubtitles && (
          <Pressable disabled={subtitleState === 'discovering'} onPress={onFindExternalSubtitles} style={({ pressed }) => [styles.inlineAction, pressed && styles.pressed]}>
            <Text style={[styles.actionText, { color: theme.accent }]}>{subtitleState === 'discovering' ? 'Searching…' : 'Find more subtitles'}</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );

  return (
    <View style={[styles.overlay, wide && styles.overlayWide]}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: theme.mediaScrim }]} onPress={onClose} />
      <View style={[
        styles.sheet,
        { backgroundColor: theme.elevated, borderColor: theme.border, paddingBottom: Math.max(insets.bottom, 12) },
        wide && styles.sheetWide,
      ]}>
        {!wide && <View style={[styles.handle, { backgroundColor: theme.border }]} />}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <View style={styles.headerCopy}>
            <Text style={[styles.title, { color: theme.text }]}>Streaming Servers</Text>
            <Text numberOfLines={1} style={[styles.currentLine, { color: theme.textSecondary }]}>{sourceName} · {protectionLabel(shieldState)} · {healthLabel}</Text>
          </View>
          <Pressable accessibilityLabel="Close streaming servers" onPress={onClose} style={[styles.close, { backgroundColor: theme.surface }]}>
            <Ionicons name="close" size={22} color={theme.text} />
          </Pressable>
        </View>
        {!wide && (
          <Pressable onPress={() => setDetailsOpen((value) => !value)} style={[styles.detailsToggle, { borderBottomColor: theme.border }]}>
            <Text style={[styles.toggleText, { color: theme.text }]}>Source details</Text>
            <Ionicons name={detailsOpen ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textSecondary} />
          </Pressable>
        )}
        <View style={[styles.content, wide && styles.contentWide]}>
          <View style={[styles.listPane, wide && { borderRightColor: theme.border }]}>{sourceList}</View>
          {(wide || detailsOpen) && <View style={[styles.detailsPane, !wide && styles.detailsPanePhone]}>{details}</View>}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end', zIndex: 1000 },
  overlayWide: { justifyContent: 'center', alignItems: 'center' },
  sheet: { width: '100%', height: '78%', maxHeight: '86%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, overflow: 'hidden' },
  sheetWide: { width: '86%', height: '78%', maxWidth: 980, borderRadius: 24 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 8 },
  header: { minHeight: 68, paddingHorizontal: spacing[4], flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1 },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 19, fontWeight: '800' },
  currentLine: { marginTop: 3, fontSize: 12 },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  detailsToggle: { minHeight: 46, paddingHorizontal: spacing[4], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1 },
  toggleText: { fontSize: 14, fontWeight: '700' },
  content: { flex: 1, minHeight: 0 },
  contentWide: { flexDirection: 'row' },
  listPane: { flex: 1, minWidth: 0 },
  detailsPane: { flex: 1, minWidth: 0 },
  detailsPanePhone: { flex: 0, maxHeight: '46%' },
  sourceScroll: { flex: 1 },
  sourceList: { padding: spacing[3], gap: 8 },
  sourceRow: { minHeight: 58, borderRadius: radii.lg, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  sourceIcon: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sourceCopy: { flex: 1, minWidth: 0 },
  sourceNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0 },
  sourceName: { fontSize: 14, fontWeight: '800', flexShrink: 1 },
  continuityBadge: { borderWidth: 1, borderRadius: radii.full, paddingHorizontal: 7, paddingVertical: 2, maxWidth: 126 },
  continuityBadgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.2 },
  sourceStatus: { marginTop: 2, fontSize: 11, textTransform: 'capitalize' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
  detailsScroll: { flex: 1 },
  detailsBody: { padding: spacing[3], gap: 10 },
  detailCard: { borderWidth: 1, borderRadius: radii.lg, padding: 12, gap: 4 },
  detailTitle: { fontSize: 14, fontWeight: '800' },
  detailText: { fontSize: 12, lineHeight: 17, textTransform: 'none' },
  detailMeta: { fontSize: 10, lineHeight: 15, marginTop: 2 },
  detailTextStrong: { fontSize: 12, lineHeight: 17, fontWeight: '900' },
  capabilityList: { gap: 2, marginTop: 2, marginBottom: 2 },
  capabilityLine: { fontSize: 11, lineHeight: 16, fontWeight: '700' },
  outlineAction: { minHeight: 44, borderRadius: radii.full, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 13, fontWeight: '800' },
  subtitleRow: { minHeight: 44, marginTop: 5, borderWidth: 1, borderRadius: radii.md, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  subtitleName: { flex: 1, fontSize: 12, fontWeight: '700' },
  inlineAction: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
});
