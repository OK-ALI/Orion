import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontSizes, radii, spacing } from '@orion/shared/tokens';
import type { MobileDownloadPreferencesV1 } from '@orion/shared/types';
import { useOrionTheme } from '../context/ThemeContext';
import { useResponsiveLayout } from '../services/responsive';
import { getMobileDownloadCapability } from '../services/downloadManager';
import type { MobileDownloadTargetV1 } from '../features/downloads/downloadIdentity';
import {
  cancelMobileDownloadSourceResolutionV1,
  completeMobileDownloadSourceResolutionV1,
  getMobileDownloadCandidateSnapshotsV1,
  getMobileDownloadSourceResolutionIntentV1,
  selectMobileDownloadCandidateForItemV1,
  subscribeMobileDownloadCandidatesV1,
} from '../features/downloads/downloadCandidateCapture';
import type { MobileDownloadCandidateSnapshotV1, MobileDownloadTransferMethodV1 } from '../features/downloads/downloadCandidateCapture';
import {
  getMobileDownloadPreferencesV1,
  setMobileDownloadDefaultDestinationV1,
  setMobileDownloadDeviceStorageTargetV1,
  subscribeMobileDownloadPreferencesV1,
} from '../features/downloads/downloadPreferences';
import { startMobileDownloadFromSelectionV1 } from '../features/downloads/downloadStart';
import { chooseNativeDeviceStorageTargetV1 } from '../features/downloads/nativeDownloadEngine';
import {
  discoverMobileDownloadSubtitlesV1,
  getPreferredMobileDownloadSubtitleIdsV1,
  type MobileDownloadSubtitleDiscoveryV1,
} from '../features/downloads/downloadSubtitles';

interface DownloadModalProps {
  visible: boolean;
  onClose: () => void;
  target: MobileDownloadTargetV1 | null;
  onResolveSource: (target: MobileDownloadTargetV1, method: MobileDownloadTransferMethodV1) => void;
}

const EMPTY_SUBTITLES: MobileDownloadSubtitleDiscoveryV1 = { state: 'idle', tracks: [], providers: [] };

export function DownloadModal({ visible, onClose, target, onResolveSource }: DownloadModalProps) {
  const { theme } = useOrionTheme();
  const { isTablet } = useResponsiveLayout();
  const capability = getMobileDownloadCapability();
  const [preferences, setPreferences] = useState<MobileDownloadPreferencesV1>(getMobileDownloadPreferencesV1);
  const [transferMethod, setTransferMethod] = useState<MobileDownloadTransferMethodV1>('auto');
  const [candidateSnapshots, setCandidateSnapshots] = useState<readonly MobileDownloadCandidateSnapshotV1[]>(getMobileDownloadCandidateSnapshotsV1);
  const [subtitles, setSubtitles] = useState<MobileDownloadSubtitleDiscoveryV1>(EMPTY_SUBTITLES);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [choosingFolder, setChoosingFolder] = useState(false);

  useEffect(() => subscribeMobileDownloadPreferencesV1(setPreferences), []);
  useEffect(() => subscribeMobileDownloadCandidatesV1(setCandidateSnapshots), []);
  useEffect(() => {
    if (!visible) return;
    const intent = target ? getMobileDownloadSourceResolutionIntentV1(target.itemKey) : null;
    setTransferMethod(intent?.method ?? 'auto');
    setStartError(null);
    setStarting(false);
  }, [visible, target?.itemKey]);

  const isEpisode = target?.media.mediaType === 'tv' && target.media.season !== null && target.media.episode !== null;
  const displayTitle = isEpisode
    ? `${target?.media.seriesTitle || target?.media.title} · S${target?.media.season} E${target?.media.episode}`
    : target?.media.title || 'Download';
  const supportingTitle = isEpisode ? target?.media.episodeTitle : null;
  const needsEpisode = target?.media.mediaType === 'tv' && !isEpisode;
  const destination = preferences.defaultDestination;
  const selectedCandidate = target
    ? selectMobileDownloadCandidateForItemV1(target.itemKey, transferMethod, candidateSnapshots, destination)
    : null;
  const latestCandidate = target ? candidateSnapshots.find((entry) => entry.itemKey === target.itemKey)?.candidate ?? null : null;
  const methodOptions: readonly { id: MobileDownloadTransferMethodV1; title: string; description: string }[] = [
    { id: 'auto', title: 'Auto', description: 'Recommended. Choose the best ready HLS or DASH stream.' },
    { id: 'fragments', title: 'Stream fragments', description: 'Use a ready HLS or DASH stream explicitly.' },
  ];

  useEffect(() => {
    let cancelled = false;
    if (!visible || !target || !selectedCandidate || preferences.subtitlePreference === 'none') {
      setSubtitles(EMPTY_SUBTITLES);
      return () => { cancelled = true; };
    }
    setSubtitles({ state: 'checking', tracks: [], providers: [] });
    discoverMobileDownloadSubtitlesV1(target).then((result) => {
      if (!cancelled) setSubtitles(result);
    }).catch(() => {
      if (!cancelled) setSubtitles({ state: 'provider-failure', tracks: [], providers: [] });
    });
    return () => { cancelled = true; };
  }, [preferences.subtitlePreference, selectedCandidate?.candidate.candidateId, target?.itemKey, visible]);

  const selectedSubtitleIds = useMemo(
    () => preferences.subtitlePreference === 'preferred' ? getPreferredMobileDownloadSubtitleIdsV1(subtitles) : [],
    [preferences.subtitlePreference, subtitles],
  );
  const subtitleCheckPending = Boolean(selectedCandidate) && preferences.subtitlePreference === 'preferred' && (subtitles.state === 'idle' || subtitles.state === 'checking');

  const sourceStatus = useMemo(() => {
    if (selectedCandidate) {
      const kind = selectedCandidate.candidate.preflight.resolvedManifestKind.toUpperCase();
      return {
        tone: 'success' as const,
        icon: 'checkmark-circle' as const,
        title: 'Ready to download',
        detail: `${kind} stream ready · ${selectedCandidate.candidate.sourceId} · ${preferences.preferredQuality === 'best' ? 'Best available' : preferences.preferredQuality}`,
      };
    }
    if (!latestCandidate) {
      return { tone: 'neutral' as const, icon: 'play-circle-outline' as const, title: 'Playback source required', detail: 'Open the player. Orion will return here automatically as soon as a ready HLS or DASH stream is resolved.' };
    }
    if (destination === 'device-storage' && latestCandidate.preflight.state === 'ready' && !latestCandidate.capabilities.deviceStorage) {
      return { tone: 'warning' as const, icon: 'folder-open-outline' as const, title: 'Device Storage unavailable for this stream', detail: latestCandidate.capabilities.deviceStorageBlockedReason || 'Save this stream to Orion Library or try another source.' };
    }
    const state = latestCandidate.preflight.state;
    const kind = latestCandidate.preflight.resolvedManifestKind;
    if (state === 'checking') return { tone: 'warning' as const, icon: 'sync-outline' as const, title: 'Resolving stream…', detail: `Checking ${latestCandidate.sourceId} for a downloadable HLS or DASH stream.` };
    if (state === 'expired' || state === 'action-required') return { tone: 'warning' as const, icon: 'refresh-circle-outline' as const, title: 'Source needs refresh', detail: latestCandidate.preflight.reason || 'Open the player and choose a source again.' };
    if (state === 'protected' || state === 'unreachable' || state === 'unsupported' || kind === 'direct') return { tone: 'danger' as const, icon: 'alert-circle-outline' as const, title: 'This source is not download-ready', detail: kind === 'direct' ? 'This source exposed only a Direct file. Mobile downloads now require HLS or DASH. Try another source.' : latestCandidate.preflight.reason || 'Try another playback source.' };
    return { tone: 'neutral' as const, icon: 'play-circle-outline' as const, title: 'Playback source required', detail: 'Open the player and choose a source that exposes a ready HLS or DASH stream.' };
  }, [destination, latestCandidate, preferences.preferredQuality, selectedCandidate]);

  const statusColor = sourceStatus.tone === 'success' ? theme.success : sourceStatus.tone === 'warning' ? theme.warning : sourceStatus.tone === 'danger' ? theme.danger : theme.textMuted;

  const subtitleStatus = useMemo(() => {
    if (preferences.subtitlePreference === 'none') return { icon: 'remove-circle-outline' as const, color: theme.textMuted, title: 'Subtitles off', detail: 'No automatic subtitle will be attached to this download.' };
    if (!selectedCandidate) return { icon: 'chatbox-ellipses-outline' as const, color: theme.textMuted, title: 'Subtitles', detail: 'SubDL and Wyzie are checked after the stream is ready.' };
    if (subtitles.state === 'checking') return { icon: 'sync-outline' as const, color: theme.warning, title: 'Checking subtitles…', detail: 'Searching SubDL and Wyzie for an English match.' };
    if (subtitles.state === 'ready') {
      const providers = subtitles.providers.join(' + ');
      const selected = subtitles.tracks.find((track) => selectedSubtitleIds.includes(track.id));
      return { icon: 'checkmark-circle' as const, color: theme.success, title: 'Subtitles ready', detail: `${selected?.languageLabel || 'Preferred'} · ${subtitles.tracks.length} available · ${providers}` };
    }
    if (subtitles.state === 'offline') return { icon: 'cloud-offline-outline' as const, color: theme.warning, title: 'Subtitle check offline', detail: 'Video can still download. Orion could not reach SubDL or Wyzie right now.' };
    if (subtitles.state === 'provider-failure') return { icon: 'alert-circle-outline' as const, color: theme.warning, title: 'Subtitle providers unavailable', detail: 'Video can still download without subtitles.' };
    return { icon: 'checkmark-circle-outline' as const, color: theme.textMuted, title: 'No matching subtitles found', detail: 'Video is still ready to download without subtitles.' };
  }, [preferences.subtitlePreference, selectedCandidate, selectedSubtitleIds, subtitles, theme.success, theme.textMuted, theme.warning]);


  const selectDestination = async (next: 'orion-library' | 'device-storage') => {
    if (next === 'orion-library') {
      setMobileDownloadDefaultDestinationV1('orion-library');
      return;
    }
    if (preferences.deviceStorageTarget?.targetId && preferences.deviceStorageTarget.writable && preferences.deviceStorageTarget.persistedPermission) {
      setMobileDownloadDefaultDestinationV1('device-storage');
      return;
    }
    if (choosingFolder) return;
    setChoosingFolder(true);
    try {
      const picked = await chooseNativeDeviceStorageTargetV1();
      if (!picked) return;
      setMobileDownloadDeviceStorageTargetV1(picked);
      setMobileDownloadDefaultDestinationV1('device-storage');
    } finally {
      setChoosingFolder(false);
    }
  };

  const handleResolveSource = () => {
    if (!target || needsEpisode || starting) return;
    setStartError(null);
    onResolveSource(target, transferMethod);
  };

  const handleStart = async () => {
    if (!target || !selectedCandidate || needsEpisode || starting) return;
    setStarting(true);
    setStartError(null);
    try {
      await startMobileDownloadFromSelectionV1({ target, selection: selectedCandidate, preferences, selectedSubtitleAssetIds: selectedSubtitleIds });
      completeMobileDownloadSourceResolutionV1(target.itemKey);
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Orion could not start this download.';
      setStartError(message);
      const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code || '') : '';
      if (code.includes('SOURCE') || code.includes('CONTEXT')) {
        cancelMobileDownloadSourceResolutionV1(target.itemKey);
        setCandidateSnapshots(getMobileDownloadCandidateSnapshotsV1());
      }
    } finally {
      setStarting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close download options" style={styles.backdrop} onPress={onClose} />
        <View style={[styles.card, isTablet && styles.cardTablet, { backgroundColor: theme.elevated, borderColor: theme.border }]}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={[styles.eyebrow, { color: theme.textMuted }]}>DOWNLOAD</Text>
              <Text accessibilityRole="header" style={[styles.cardTitle, { color: theme.text }]} numberOfLines={2}>{displayTitle}</Text>
              {supportingTitle ? <Text style={[styles.mediaTitle, { color: theme.textSecondary }]} numberOfLines={2}>{supportingTitle}</Text> : null}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close download options" style={({ pressed }) => [styles.closeBtn, { backgroundColor: pressed ? theme.surfaceHover : theme.surface, borderColor: theme.border }]} onPress={onClose}>
              <Ionicons name="close" size={20} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {needsEpisode ? <StatusCard icon="list-outline" color={theme.accent} title="Choose an episode" detail="Open an episode below this title to download it for offline playback." theme={theme} /> : null}

            <Text accessibilityRole="header" style={[styles.groupTitle, { color: theme.text }]}>Save to</Text>
            <Pressable accessibilityRole="radio" accessibilityState={{ checked: destination === 'orion-library' }} onPress={() => void selectDestination('orion-library')} style={({ pressed }) => [styles.optionCard, { backgroundColor: destination === 'orion-library' ? theme.accentSoft : pressed ? theme.surfaceHover : theme.surface, borderColor: destination === 'orion-library' ? theme.accent : theme.border }]}>
              <Ionicons name="albums-outline" size={21} color={destination === 'orion-library' ? theme.accent : theme.textSecondary} /><View style={styles.optionCopy}><Text style={[styles.optionTitle, { color: theme.text }]}>Orion Library</Text><Text style={[styles.description, { color: theme.textSecondary }]}>Managed fragmented media for Orion offline playback.</Text></View><Ionicons name={destination === 'orion-library' ? 'radio-button-on' : 'radio-button-off'} size={20} color={destination === 'orion-library' ? theme.accent : theme.textMuted} />
            </Pressable>
            <Pressable accessibilityRole="radio" accessibilityState={{ checked: destination === 'device-storage' }} onPress={() => void selectDestination('device-storage')} style={({ pressed }) => [styles.optionCard, { backgroundColor: destination === 'device-storage' ? theme.accentSoft : pressed ? theme.surfaceHover : theme.surface, borderColor: destination === 'device-storage' ? theme.accent : theme.border }]}>
              <Ionicons name="folder-open-outline" size={21} color={destination === 'device-storage' ? theme.accent : theme.textSecondary} /><View style={styles.optionCopy}><Text style={[styles.optionTitle, { color: theme.text }]}>Device Storage</Text><Text style={[styles.description, { color: theme.textSecondary }]}>{preferences.deviceStorageTarget ? `Portable MP4 · ${preferences.deviceStorageTarget.displayName}` : choosingFolder ? 'Opening Android folder picker…' : 'Choose an Android folder for a portable MP4.'}</Text></View><Ionicons name={destination === 'device-storage' ? 'radio-button-on' : 'radio-button-off'} size={20} color={destination === 'device-storage' ? theme.accent : theme.textMuted} />
            </Pressable>

            <Text accessibilityRole="header" style={[styles.groupTitle, { color: theme.text }]}>Download method</Text>
            <View style={styles.optionGrid}>
              {methodOptions.map((option) => {
                const selected = transferMethod === option.id;
                return (
                  <Pressable key={option.id} accessibilityRole="radio" accessibilityLabel={`Download method ${option.title}`} accessibilityState={{ checked: selected }} onPress={() => setTransferMethod(option.id)} style={({ pressed }) => [styles.optionCard, { backgroundColor: selected ? theme.accentSoft : pressed ? theme.surfaceHover : theme.surface, borderColor: selected ? theme.accent : theme.border }]}>
                    <Ionicons name={option.id === 'auto' ? 'sparkles-outline' : 'layers-outline'} size={21} color={selected ? theme.accent : theme.textSecondary} />
                    <View style={styles.optionCopy}>
                      <Text style={[styles.optionTitle, { color: theme.text }]}>{option.title}{option.id === 'auto' ? ' · Recommended' : ''}</Text>
                      <Text style={[styles.description, { color: theme.textSecondary }]}>{option.description}</Text>
                    </View>
                    <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? theme.accent : theme.textMuted} />
                  </Pressable>
                );
              })}
            </View>

            <StatusCard icon={sourceStatus.icon} color={statusColor} title={sourceStatus.title} detail={sourceStatus.detail} theme={theme} />
            <StatusCard icon={subtitleStatus.icon} color={subtitleStatus.color} title={subtitleStatus.title} detail={subtitleStatus.detail} theme={theme} />

            <View style={[styles.preferenceRow, { borderColor: theme.border }]}>
              <View style={styles.preferenceCopy}>
                <Text style={[styles.preferenceLabel, { color: theme.textMuted }]}>QUALITY</Text>
                <Text style={[styles.preferenceValue, { color: theme.text }]}>{preferences.preferredQuality === 'best' ? 'Best available' : preferences.preferredQuality}</Text>
              </View>
              <View style={styles.preferenceCopy}>
                <Text style={[styles.preferenceLabel, { color: theme.textMuted }]}>SOURCE</Text>
                <Text style={[styles.preferenceValue, { color: selectedCandidate ? theme.success : theme.textMuted }]} numberOfLines={1}>{selectedCandidate ? selectedCandidate.candidate.sourceId : 'Not ready'}</Text>
              </View>
            </View>

            {startError ? <StatusCard icon="alert-circle-outline" color={theme.danger} title="Download needs attention" detail={startError} theme={theme} /> : null}
            {!capability.available ? <StatusCard icon="time-outline" color={theme.textMuted} title="Waiting for download support" detail={capability.reason} theme={theme} /> : null}
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: theme.border }]}>
            <Pressable accessibilityRole="button" accessibilityLabel="Cancel download options" onPress={onClose} style={({ pressed }) => [styles.secondaryButton, { borderColor: theme.border, backgroundColor: pressed ? theme.surfaceHover : theme.surface }]}>
              <Text style={[styles.secondaryButtonText, { color: theme.textSecondary }]}>Cancel</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={needsEpisode ? 'Choose an episode before downloading' : selectedCandidate ? 'Start download' : 'Open player to resolve download source'} accessibilityState={{ disabled: needsEpisode || starting || subtitleCheckPending || !capability.available }} disabled={needsEpisode || starting || subtitleCheckPending || !capability.available} onPress={selectedCandidate ? handleStart : handleResolveSource} style={({ pressed }) => [styles.primaryButton, { backgroundColor: needsEpisode || subtitleCheckPending || !capability.available ? theme.accentSoft : pressed ? theme.accentSoft : theme.accent, borderColor: needsEpisode || subtitleCheckPending || !capability.available ? theme.border : theme.accent }]}>
              <Text style={[styles.primaryButtonText, { color: needsEpisode || !capability.available ? theme.textMuted : theme.onAccent }]}>{needsEpisode ? 'Choose episode' : starting ? 'Starting…' : selectedCandidate ? 'Start download' : 'Open player'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function StatusCard({ icon, color, title, detail, theme }: { icon: React.ComponentProps<typeof Ionicons>['name']; color: string; title: string; detail: string; theme: ReturnType<typeof useOrionTheme>['theme'] }) {
  return (
    <View style={[styles.notice, { backgroundColor: theme.surfaceHover, borderColor: color }]}>
      <Ionicons name={icon} size={20} color={color} />
      <View style={styles.noticeCopy}>
        <Text style={[styles.noticeTitle, { color }]}>{title}</Text>
        <Text style={[styles.description, { color: theme.textSecondary }]}>{detail}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing[4], paddingVertical: spacing[6] },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0, 0, 0, 0.78)' },
  card: { width: '100%', maxWidth: 460, maxHeight: '88%', borderRadius: radii['2xl'], borderWidth: 1, overflow: 'hidden' },
  cardTablet: { maxWidth: 560 },
  header: { padding: spacing[5], paddingBottom: spacing[3], flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  cardTitle: { fontSize: 21, lineHeight: 26, fontWeight: '900', marginTop: 3 },
  mediaTitle: { fontSize: fontSizes.sm, lineHeight: 19, marginTop: 3, fontWeight: '700' },
  closeBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: spacing[5], paddingBottom: spacing[4], gap: spacing[3] },
  groupTitle: { fontSize: fontSizes.sm, fontWeight: '900', marginTop: spacing[1] },
  optionGrid: { gap: spacing[2] },
  optionCard: { minHeight: 76, borderWidth: 1, borderRadius: radii.xl, padding: spacing[3], flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  optionCopy: { flex: 1, minWidth: 0 },
  optionTitle: { fontSize: fontSizes.sm, fontWeight: '900' },
  description: { fontSize: fontSizes.xs, lineHeight: 17, marginTop: 3 },
  compactNotice: { minHeight: 48, borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: spacing[3], paddingVertical: spacing[2], flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  compactNoticeText: { flex: 1, fontSize: fontSizes.xs, lineHeight: 17 },
  preferenceRow: { borderWidth: 1, borderRadius: radii.xl, padding: spacing[3], flexDirection: 'row', gap: spacing[4] },
  preferenceCopy: { flex: 1, minWidth: 0 },
  preferenceLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  preferenceValue: { fontSize: fontSizes.sm, fontWeight: '800', marginTop: 4 },
  notice: { borderWidth: 1, borderRadius: radii.xl, padding: spacing[3], flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  noticeCopy: { flex: 1, minWidth: 0 },
  noticeTitle: { fontSize: fontSizes.sm, fontWeight: '900' },
  footer: { borderTopWidth: 1, padding: spacing[4], flexDirection: 'row', gap: spacing[3] },
  secondaryButton: { flex: 1, minHeight: 48, borderRadius: radii.xl, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { fontSize: fontSizes.sm, fontWeight: '800' },
  primaryButton: { flex: 1.25, minHeight: 48, borderRadius: radii.xl, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { fontSize: fontSizes.sm, fontWeight: '900' },
});
