import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontSizes, radii, spacing } from '@orion/shared/tokens';
import type { MobileDownloadAssetV1, MobileDownloadJobV1, MobileDownloadPreferencesV1 } from '@orion/shared/types';
import { useOrionTheme } from '../context/ThemeContext';
import { useResponsiveLayout } from '../services/responsive';
import { getMobileDownloadCapability } from '../services/downloadManager';
import { mobileDownloadItemKeyFromMediaV1, type MobileDownloadTargetV1 } from '../features/downloads/downloadIdentity';
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
  subscribeMobileDownloadPreferencesV1,
} from '../features/downloads/downloadPreferences';
import { startMobileDownloadFromSelectionV1 } from '../features/downloads/downloadStart';
import { readMobileDownloadRepositoryV1, subscribeMobileDownloadRepositoryV1 } from '../features/downloads/downloadRepository';
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

const EMPTY_PROVIDER_OUTCOMES: MobileDownloadSubtitleDiscoveryV1['providerOutcomes'] = {
  subdl: { configured: false, state: 'not-configured', count: 0 },
  wyzie: { configured: false, state: 'not-configured', count: 0 },
};
const EMPTY_SUBTITLES: MobileDownloadSubtitleDiscoveryV1 = { state: 'idle', tracks: [], providers: [], providerOutcomes: EMPTY_PROVIDER_OUTCOMES };
const DUPLICATE_BLOCKING_STATES = new Set(['queued', 'preflighting', 'downloading', 'paused', 'recovering', 'verifying', 'finalizing', 'storage-blocked', 'action-required', 'expired', 'completed']);

function providerOutcomeSummary(discovery: MobileDownloadSubtitleDiscoveryV1): string {
  return (['subdl', 'wyzie'] as const).map((provider) => {
    const label = provider === 'subdl' ? 'SubDL' : 'Wyzie';
    const outcome = discovery.providerOutcomes[provider];
    if (!outcome.configured || outcome.state === 'not-configured') return `${label}: not configured`;
    if (outcome.state === 'available') return `${label}: ${outcome.count}`;
    if (outcome.state === 'no-results') return `${label}: 0 results`;
    if (outcome.state === 'invalid-key') return `${label}: invalid key`;
    if (outcome.state === 'quota-or-rate-limited') return `${label}: quota/rate limited`;
    if (outcome.state === 'offline') return `${label}: offline`;
    return `${label}: provider failure`;
  }).join(' · ');
}

export function DownloadModal({ visible, onClose, target, onResolveSource }: DownloadModalProps) {
  const { theme } = useOrionTheme();
  const { isTablet } = useResponsiveLayout();
  const capability = getMobileDownloadCapability();
  const [preferences, setPreferences] = useState<MobileDownloadPreferencesV1>(getMobileDownloadPreferencesV1);
  const [transferMethod, setTransferMethod] = useState<MobileDownloadTransferMethodV1>('auto');
  const [candidateSnapshots, setCandidateSnapshots] = useState<readonly MobileDownloadCandidateSnapshotV1[]>(getMobileDownloadCandidateSnapshotsV1);
  const [repositoryJobs, setRepositoryJobs] = useState<MobileDownloadJobV1[]>(() => readMobileDownloadRepositoryV1().jobs);
  const [repositoryAssets, setRepositoryAssets] = useState<MobileDownloadAssetV1[]>(() => readMobileDownloadRepositoryV1().assets);
  const [subtitles, setSubtitles] = useState<MobileDownloadSubtitleDiscoveryV1>(EMPTY_SUBTITLES);
  const [selectedSubtitleIds, setSelectedSubtitleIds] = useState<string[]>([]);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => subscribeMobileDownloadPreferencesV1(setPreferences), []);
  useEffect(() => subscribeMobileDownloadCandidatesV1(setCandidateSnapshots), []);
  useEffect(() => subscribeMobileDownloadRepositoryV1((snapshot) => {
    setRepositoryJobs(snapshot.jobs);
    setRepositoryAssets(snapshot.assets);
  }), []);
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
  const destination: MobileDownloadJobV1['destination'] = preferences.deviceStorageTarget
    ? 'device-storage'
    : 'orion-library';
  const destinationTitle = destination === 'device-storage'
    ? preferences.deviceStorageTarget?.displayName || 'Device Storage'
    : 'Orion Library';
  const destinationDetail = destination === 'device-storage'
    ? 'Portable media saved to your persisted Android storage folder.'
    : 'Managed offline media for reliable playback inside Orion.';
  const duplicateJob = target ? repositoryJobs.find((job) => (
    job.destination === destination
    && DUPLICATE_BLOCKING_STATES.has(job.state)
    && mobileDownloadItemKeyFromMediaV1(job.media) === target.itemKey
    && (job.state !== 'completed' || repositoryAssets.find((asset) => asset.jobId === job.jobId)?.availability !== 'missing')
  )) : null;
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
      setSelectedSubtitleIds([]);
      return () => { cancelled = true; };
    }
    setSubtitles({ state: 'checking', tracks: [], providers: [], providerOutcomes: EMPTY_PROVIDER_OUTCOMES });
    setSelectedSubtitleIds([]);
    discoverMobileDownloadSubtitlesV1(target).then((result) => {
      if (cancelled) return;
      setSubtitles(result);
      setSelectedSubtitleIds(getPreferredMobileDownloadSubtitleIdsV1(result));
    }).catch(() => {
      if (cancelled) return;
      setSubtitles({ state: 'provider-failure', tracks: [], providers: [], providerOutcomes: EMPTY_PROVIDER_OUTCOMES });
      setSelectedSubtitleIds([]);
    });
    return () => { cancelled = true; };
  }, [preferences.subtitlePreference, selectedCandidate?.candidate.candidateId, target?.itemKey, visible]);

  const subtitleCheckPending = Boolean(selectedCandidate) && preferences.subtitlePreference === 'preferred' && (subtitles.state === 'idle' || subtitles.state === 'checking');

  const toggleSubtitleSelection = (id: string) => {
    setSelectedSubtitleIds((current) => {
      if (current.includes(id)) return current.filter((selectedId) => selectedId !== id);
      if (current.length >= 2) return current;
      return [...current, id];
    });
  };

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
      const providerDetail = providerOutcomeSummary(subtitles);
      if (selectedSubtitleIds.length === 0) {
        return { icon: 'remove-circle-outline' as const, color: theme.textMuted, title: 'Subtitles ready', detail: `None selected · ${subtitles.tracks.length} available · ${providers} · ${providerDetail}` };
      }
      const selected = subtitles.tracks.filter((track) => selectedSubtitleIds.includes(track.id));
      const selectionLabel = selected.length === 1 ? selected[0]?.languageLabel || '1 selected' : `${selected.length} selected`;
      return { icon: 'checkmark-circle' as const, color: theme.success, title: 'Subtitles ready', detail: `${selectionLabel} · ${subtitles.tracks.length} available · ${providers} · ${providerDetail}` };
    }
    if (subtitles.state === 'provider-key-required') return { icon: 'key-outline' as const, color: theme.warning, title: 'Subtitle keys not configured', detail: 'Add your SubDL or Wyzie key in Downloads Settings. Video can still download without subtitles.' };
    if (subtitles.state === 'provider-key-invalid') return { icon: 'key-outline' as const, color: theme.warning, title: 'Subtitle key needs attention', detail: 'A configured provider rejected its key. Update it in Downloads Settings.' };
    if (subtitles.state === 'provider-limited') return { icon: 'speedometer-outline' as const, color: theme.warning, title: 'Subtitle quota or rate limit', detail: providerOutcomeSummary(subtitles) };
    if (subtitles.state === 'offline') return { icon: 'cloud-offline-outline' as const, color: theme.warning, title: 'Subtitle check offline', detail: 'Video can still download. Orion could not reach SubDL or Wyzie right now.' };
    if (subtitles.state === 'provider-failure') return { icon: 'alert-circle-outline' as const, color: theme.warning, title: 'Subtitle providers unavailable', detail: 'Video can still download without subtitles.' };
    return { icon: 'checkmark-circle-outline' as const, color: theme.textMuted, title: 'No matching subtitles found', detail: `Video is still ready without subtitles. ${providerOutcomeSummary(subtitles)}` };
  }, [preferences.subtitlePreference, selectedCandidate, selectedSubtitleIds, subtitles, theme.success, theme.textMuted, theme.warning]);


  const handleResolveSource = () => {
    if (!target || needsEpisode || starting) return;
    setStartError(null);
    onResolveSource(target, transferMethod);
  };

  const handleStart = async () => {
    if (!target || !selectedCandidate || needsEpisode || starting || duplicateJob) return;
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
            <View style={[styles.optionCard, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}>
              <Ionicons name={destination === 'device-storage' ? 'folder-outline' : 'albums-outline'} size={21} color={theme.accent} />
              <View style={styles.optionCopy}>
                <Text style={[styles.optionTitle, { color: theme.text }]}>{destinationTitle}</Text>
                <Text style={[styles.description, { color: theme.textSecondary }]}>{destinationDetail}</Text>
              </View>
              <Ionicons name="checkmark-circle" size={20} color={theme.accent} />
            </View>

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
            {duplicateJob ? <StatusCard icon="copy-outline" color={theme.warning} title={duplicateJob.state === 'completed' ? 'Already downloaded here' : 'Download already active'} detail={duplicateJob.state === 'completed' ? `This title already has a verified ${destinationTitle} copy.` : `Wait for, cancel, or resolve the existing ${destinationTitle} download before starting another copy.`} theme={theme} /> : null}
            <StatusCard icon={subtitleStatus.icon} color={subtitleStatus.color} title={subtitleStatus.title} detail={subtitleStatus.detail} theme={theme} />
            {preferences.subtitlePreference === 'preferred' && selectedCandidate && subtitles.state === 'ready' ? (
              <View style={styles.subtitleSection}>
                <View style={styles.subtitleSectionHeader}>
                  <View style={styles.subtitleSectionCopy}>
                    <Text accessibilityRole="header" style={[styles.groupTitle, { color: theme.text }]}>Choose subtitles</Text>
                    <Text style={[styles.subtitleHint, { color: theme.textSecondary }]}>Select up to 2 · {selectedSubtitleIds.length} selected</Text>
                  </View>
                  {selectedSubtitleIds.length > 0 ? (
                    <Pressable accessibilityRole="button" accessibilityLabel="Clear subtitle selection" onPress={() => setSelectedSubtitleIds([])} hitSlop={8}>
                      <Text style={[styles.subtitleClear, { color: theme.accent }]}>Clear</Text>
                    </Pressable>
                  ) : null}
                </View>

                <View style={styles.subtitleOptionGrid}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityLabel="No subtitles for this download"
                    accessibilityState={{ checked: selectedSubtitleIds.length === 0 }}
                    onPress={() => setSelectedSubtitleIds([])}
                    style={({ pressed }) => [styles.subtitleOption, { backgroundColor: selectedSubtitleIds.length === 0 ? theme.accentSoft : pressed ? theme.surfaceHover : theme.surface, borderColor: selectedSubtitleIds.length === 0 ? theme.accent : theme.border }]}
                  >
                    <Ionicons name={selectedSubtitleIds.length === 0 ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={selectedSubtitleIds.length === 0 ? theme.accent : theme.textMuted} />
                    <View style={styles.subtitleOptionCopy}>
                      <Text style={[styles.subtitleOptionTitle, { color: theme.text }]}>No subtitles for this download</Text>
                      <Text style={[styles.subtitleOptionMeta, { color: theme.textSecondary }]}>Save only the video and audio for this item.</Text>
                    </View>
                  </Pressable>

                  {subtitles.tracks.map((track) => {
                    const selected = selectedSubtitleIds.includes(track.id);
                    const disabled = !selected && selectedSubtitleIds.length >= 2;
                    return (
                      <Pressable
                        key={track.id}
                        accessibilityRole="checkbox"
                        accessibilityLabel={`${track.languageLabel} subtitle from ${track.providerLabel}, ${track.label}`}
                        accessibilityState={{ checked: selected, disabled }}
                        disabled={disabled}
                        onPress={() => toggleSubtitleSelection(track.id)}
                        style={({ pressed }) => [styles.subtitleOption, { opacity: disabled ? 0.55 : 1, backgroundColor: selected ? theme.accentSoft : pressed ? theme.surfaceHover : theme.surface, borderColor: selected ? theme.accent : theme.border }]}
                      >
                        <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={selected ? theme.accent : theme.textMuted} />
                        <View style={styles.subtitleOptionCopy}>
                          <Text style={[styles.subtitleOptionTitle, { color: theme.text }]} numberOfLines={1}>{track.languageLabel} · {track.providerLabel} · {track.format.toUpperCase()}</Text>
                          <Text style={[styles.subtitleOptionMeta, { color: theme.textSecondary }]} numberOfLines={2}>{track.label}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

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
            <Pressable accessibilityRole="button" accessibilityLabel={needsEpisode ? 'Choose an episode before downloading' : selectedCandidate ? 'Start download' : 'Open player to resolve download source'} accessibilityState={{ disabled: needsEpisode || starting || subtitleCheckPending || Boolean(duplicateJob) || !capability.available }} disabled={needsEpisode || starting || subtitleCheckPending || Boolean(duplicateJob) || !capability.available} onPress={selectedCandidate ? handleStart : handleResolveSource} style={({ pressed }) => [styles.primaryButton, { backgroundColor: needsEpisode || subtitleCheckPending || duplicateJob || !capability.available ? theme.accentSoft : pressed ? theme.accentSoft : theme.accent, borderColor: needsEpisode || subtitleCheckPending || duplicateJob || !capability.available ? theme.border : theme.accent }]}>
              <Text style={[styles.primaryButtonText, { color: needsEpisode || subtitleCheckPending || duplicateJob || !capability.available ? theme.textMuted : theme.onAccent }]}>{needsEpisode ? 'Choose episode' : duplicateJob ? (duplicateJob.state === 'completed' ? 'Already downloaded' : 'Already active') : starting ? 'Starting…' : selectedCandidate ? 'Start download' : 'Open player'}</Text>
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
  subtitleSection: { gap: spacing[2] },
  subtitleSectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing[3] },
  subtitleSectionCopy: { flex: 1, minWidth: 0 },
  subtitleHint: { fontSize: fontSizes.xs, lineHeight: 17, marginTop: 2 },
  subtitleClear: { fontSize: fontSizes.xs, fontWeight: '900', paddingVertical: 4 },
  subtitleOptionGrid: { gap: spacing[2] },
  subtitleOption: { minHeight: 64, borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: spacing[3], paddingVertical: spacing[2], flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  subtitleOptionCopy: { flex: 1, minWidth: 0 },
  subtitleOptionTitle: { fontSize: fontSizes.sm, fontWeight: '800' },
  subtitleOptionMeta: { fontSize: fontSizes.xs, lineHeight: 17, marginTop: 2 },
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
