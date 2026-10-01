import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MobileDownloadAssetV1, MobileDownloadJobV1, MobileDownloadPreferencesV1 } from '@orion/shared/types';
import { useOrionTheme } from '../context/ThemeContext';
import { OrionDialog } from './OrionDialog';
import { ChoicePill, SummaryRow, StatusCard, downloadModalStyles as styles } from './DownloadModalPresentation';
import { useResponsiveLayout } from '../services/responsive';
import { getMobileDownloadCapability } from '../services/downloadManager';
import { mobileDownloadItemKeyFromMediaV1, type MobileDownloadTargetV1 } from '../features/downloads/downloadIdentity';
import {
  cancelMobileDownloadSourceResolutionV1,
  completeMobileDownloadSourceResolutionV1,
  getMobileDownloadCandidateSnapshotsV1,
  getMobileDownloadSourceResolutionIntentV1,
  getMobileDownloadSourceResolutionFailureV1,
  selectMobileDownloadCandidateForItemV1,
  subscribeMobileDownloadCandidatesV1,
} from '../features/downloads/downloadCandidateCapture';
import type { MobileDownloadCandidateSnapshotV1, MobileDownloadTransferMethodV1 } from '../features/downloads/downloadCandidateCapture';
import {
  getMobileDownloadPreferencesV1,
  setMobileDownloadLibraryStorageTargetV1,
  subscribeMobileDownloadPreferencesV1,
} from '../features/downloads/downloadPreferences';
import { chooseNativeLibraryStorageTargetV1, validateNativeLibraryStorageTargetV1 } from '../features/downloads/nativeDownloadEngine';
import { startMobileDownloadFromSelectionV1 } from '../features/downloads/downloadStart';
import { readMobileDownloadRepositoryV1, subscribeMobileDownloadRepositoryV1 } from '../features/downloads/downloadRepository';
import { getMobileDownloadSourceChoices, getMobileSourceSafetyNotice, MOBILE_PLAYER_SOURCES } from '../features/playback/mobileSources';
import {
  discoverMobileDownloadSubtitlesV1,
  getPreferredMobileDownloadSubtitleIdsV1,
  type MobileDownloadSubtitleDiscoveryV1,
  type MobileDownloadSubtitleOptionV1,
} from '../features/downloads/downloadSubtitles';

interface DownloadModalProps {
  visible: boolean;
  onClose: () => void;
  target: MobileDownloadTargetV1 | null;
  onResolveSource: (target: MobileDownloadTargetV1, method: MobileDownloadTransferMethodV1, sourceId?: string) => void;
}

type DownloadStep = 'options' | 'prepare' | 'ready';
type SubtitleChoice = 'auto' | 'subdl' | 'wyzie' | 'none';

const EMPTY_PROVIDER_OUTCOMES: MobileDownloadSubtitleDiscoveryV1['providerOutcomes'] = {
  subdl: { configured: false, state: 'not-configured', count: 0 },
  wyzie: { configured: false, state: 'not-configured', count: 0 },
};
const EMPTY_SUBTITLES: MobileDownloadSubtitleDiscoveryV1 = {
  state: 'idle',
  tracks: [],
  providers: [],
  providerOutcomes: EMPTY_PROVIDER_OUTCOMES,
};
const DUPLICATE_BLOCKING_STATES = new Set([
  'queued', 'preflighting', 'downloading', 'paused', 'recovering', 'verifying',
  'finalizing', 'storage-blocked', 'action-required', 'expired', 'completed',
]);
const STEP_ORDER: readonly DownloadStep[] = ['options', 'prepare', 'ready'];
const sourceLabel = (sourceId: string) => MOBILE_PLAYER_SOURCES.find((source) => source.id === sourceId)?.label || 'Playback source';

function tracksForSubtitleChoice(
  discovery: MobileDownloadSubtitleDiscoveryV1,
  choice: SubtitleChoice,
): MobileDownloadSubtitleOptionV1[] {
  if (choice === 'none') return [];
  if (choice === 'subdl' || choice === 'wyzie') {
    return discovery.tracks.filter((track) => track.provider === choice);
  }
  return discovery.tracks.slice();
}

export function DownloadModal({ visible, onClose, target, onResolveSource }: DownloadModalProps) {
  const { theme } = useOrionTheme();
  const { isTablet } = useResponsiveLayout();
  const capability = getMobileDownloadCapability();

  const [preferences, setPreferences] = useState<MobileDownloadPreferencesV1>(getMobileDownloadPreferencesV1);
  const [transferMethod, setTransferMethod] = useState<MobileDownloadTransferMethodV1>('auto');
  const [step, setStep] = useState<DownloadStep>('options');
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [subtitleChoice, setSubtitleChoice] = useState<SubtitleChoice>(
    getMobileDownloadPreferencesV1().subtitlePreference === 'none' ? 'none' : 'auto',
  );
  const [candidateSnapshots, setCandidateSnapshots] = useState<readonly MobileDownloadCandidateSnapshotV1[]>(
    getMobileDownloadCandidateSnapshotsV1,
  );
  const [repositoryJobs, setRepositoryJobs] = useState<MobileDownloadJobV1[]>(() => readMobileDownloadRepositoryV1().jobs);
  const [repositoryAssets, setRepositoryAssets] = useState<MobileDownloadAssetV1[]>(() => readMobileDownloadRepositoryV1().assets);
  const [subtitles, setSubtitles] = useState<MobileDownloadSubtitleDiscoveryV1>(EMPTY_SUBTITLES);
  const [selectedSubtitleIds, setSelectedSubtitleIds] = useState<string[]>([]);
  const [starting, setStarting] = useState(false);
  const [choosingStorage, setChoosingStorage] = useState(false);
  const [validatedStorageTargetId, setValidatedStorageTargetId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [warningSourceId, setWarningSourceId] = useState<string | null>(null);

  useEffect(() => subscribeMobileDownloadPreferencesV1(setPreferences), []);
  useEffect(() => subscribeMobileDownloadCandidatesV1(setCandidateSnapshots), []);
  useEffect(() => subscribeMobileDownloadRepositoryV1((snapshot) => {
    setRepositoryJobs(snapshot.jobs);
    setRepositoryAssets(snapshot.assets);
  }), []);

  const isEpisode = target?.media.mediaType === 'tv' && target.media.season !== null && target.media.episode !== null;
  const displayTitle = isEpisode
    ? `${target?.media.seriesTitle || target?.media.title} · S${target?.media.season} E${target?.media.episode}`
    : target?.media.title || 'Download';
  const supportingTitle = isEpisode ? target?.media.episodeTitle : null;
  const needsEpisode = target?.media.mediaType === 'tv' && !isEpisode;
  const destination: MobileDownloadJobV1['destination'] = 'orion-library';
  const storageTarget = preferences.libraryStorageTarget;
  const storageReady = storageTarget?.mode === 'user-folder' && Boolean(storageTarget.targetId)
    && storageTarget.targetId === validatedStorageTargetId && storageTarget.writable && storageTarget.persistedPermission;
  const storageChecking = Boolean(storageTarget?.targetId) && !storageReady;
  const alternateSources = target ? getMobileDownloadSourceChoices(target.media.mediaType) : [];

  const selectedCandidate = target
    ? selectMobileDownloadCandidateForItemV1(
      target.itemKey,
      transferMethod,
      candidateSnapshots,
      destination,
      selectedSourceId,
    )
    : null;
  const sourceResolutionFailure = target ? getMobileDownloadSourceResolutionFailureV1(target.itemKey) : null;

  useEffect(() => {
    if (!visible) return;
    const intent = target ? getMobileDownloadSourceResolutionIntentV1(target.itemKey) : null;
    const method = intent?.method ?? 'auto';
    const sourceId = intent?.sourceId ?? null;
    setTransferMethod(method);
    setSelectedSourceId(sourceId);
    setStartError(null);
    setStarting(false);

    if (!target) {
      setStep('options');
      return;
    }

    const ready = selectMobileDownloadCandidateForItemV1(
      target.itemKey,
      method,
      getMobileDownloadCandidateSnapshotsV1(),
      destination,
      sourceId,
    );
    setStep(intent?.autoReturnIssued && ready ? 'ready' : 'options');
  }, [visible, target?.itemKey]);

  useEffect(() => {
    const targetId = storageTarget?.targetId;
    if (!targetId) {
      setValidatedStorageTargetId(null);
      return;
    }
    let active = true;
    setValidatedStorageTargetId(null);
    void validateNativeLibraryStorageTargetV1(targetId).then((validated) => {
      if (!active) return;
      if (!validated) {
        setPreferences(setMobileDownloadLibraryStorageTargetV1(null));
        if (visible) setStartError('Orion Library folder access needs to be selected again.');
        return;
      }
      setValidatedStorageTargetId(validated.targetId);
      if (
        validated.displayName !== storageTarget?.displayName
        || validated.writable !== storageTarget?.writable
        || validated.persistedPermission !== storageTarget?.persistedPermission
      ) {
        setPreferences(setMobileDownloadLibraryStorageTargetV1(validated));
      }
    });
    return () => { active = false; };
  }, [storageTarget?.displayName, storageTarget?.persistedPermission, storageTarget?.targetId, storageTarget?.writable, visible]);

  const duplicateJob = target ? repositoryJobs.find((job) => (
    job.destination === destination
    && DUPLICATE_BLOCKING_STATES.has(job.state)
    && mobileDownloadItemKeyFromMediaV1(job.media) === target.itemKey
    && (job.state !== 'completed' || repositoryAssets.find((asset) => asset.jobId === job.jobId)?.availability !== 'missing')
  )) : null;

  const preparedSourceIds = useMemo(() => new Set(
    candidateSnapshots
      .filter((entry) => entry.itemKey === target?.itemKey)
      .filter((entry) => selectMobileDownloadCandidateForItemV1(
        entry.itemKey,
        transferMethod,
        candidateSnapshots,
        destination,
        entry.candidate.sourceId,
      ))
      .map((entry) => entry.candidate.sourceId),
  ), [candidateSnapshots, destination, target?.itemKey, transferMethod]);

  useEffect(() => {
    let cancelled = false;
    if (!visible || !target || !selectedCandidate || subtitleChoice === 'none') {
      setSubtitles(EMPTY_SUBTITLES);
      setSelectedSubtitleIds([]);
      return () => { cancelled = true; };
    }

    setSubtitles({ state: 'checking', tracks: [], providers: [], providerOutcomes: EMPTY_PROVIDER_OUTCOMES });
    setSelectedSubtitleIds([]);
    discoverMobileDownloadSubtitlesV1(target).then((result) => {
      if (cancelled) return;
      setSubtitles(result);
      const eligible = tracksForSubtitleChoice(result, subtitleChoice);
      if (!eligible.length) {
        setSelectedSubtitleIds([]);
        return;
      }
      const scoped: MobileDownloadSubtitleDiscoveryV1 = { ...result, tracks: eligible };
      setSelectedSubtitleIds(getPreferredMobileDownloadSubtitleIdsV1(scoped));
    }).catch(() => {
      if (cancelled) return;
      setSubtitles({ state: 'provider-failure', tracks: [], providers: [], providerOutcomes: EMPTY_PROVIDER_OUTCOMES });
      setSelectedSubtitleIds([]);
    });
    return () => { cancelled = true; };
  }, [selectedCandidate?.candidate.candidateId, subtitleChoice, target?.itemKey, visible]);

  useEffect(() => {
    if (step === 'prepare' && selectedCandidate) setStep('ready');
  }, [selectedCandidate?.candidate.candidateId, step]);

  const eligibleSubtitleTracks = useMemo(
    () => tracksForSubtitleChoice(subtitles, subtitleChoice),
    [subtitleChoice, subtitles],
  );
  const subtitleCheckPending = Boolean(selectedCandidate)
    && subtitleChoice !== 'none'
    && (subtitles.state === 'idle' || subtitles.state === 'checking');

  const toggleSubtitleSelection = (id: string) => {
    setSelectedSubtitleIds((current) => {
      if (current.includes(id)) return current.filter((selectedId) => selectedId !== id);
      if (current.length >= 2) return current;
      return [...current, id];
    });
  };

  const selectedSourceLabel = selectedSourceId
    ? sourceLabel(selectedSourceId)
    : selectedCandidate
      ? sourceLabel(selectedCandidate.candidate.sourceId)
      : 'Auto';

  const subtitleSummary = useMemo(() => {
    if (subtitleChoice === 'none') return 'None';
    if (subtitles.state === 'checking') return 'Checking…';
    const selected = eligibleSubtitleTracks.filter((track) => selectedSubtitleIds.includes(track.id));
    if (selected.length === 1) return `${selected[0]?.languageLabel || 'Subtitle'} · ${selected[0]?.providerLabel || ''}`.trim();
    if (selected.length > 1) return `${selected.length} selected`;
    if (eligibleSubtitleTracks.length > 0) return 'None';
    if (subtitles.state !== 'ready' && subtitles.state !== 'none' && subtitles.state !== 'idle') return 'Unavailable';
    if (subtitleChoice === 'subdl') return subtitles.state !== 'idle' ? 'SubDL · No match' : 'SubDL';
    if (subtitleChoice === 'wyzie') return subtitles.state !== 'idle' ? 'Wyzie · No match' : 'Wyzie';
    return subtitles.state !== 'idle' ? 'No match' : 'Automatic';
  }, [eligibleSubtitleTracks, selectedSubtitleIds, subtitleChoice, subtitles.state]);

  const handleChooseStorage = async () => {
    if (choosingStorage) return;
    setChoosingStorage(true);
    setStartError(null);
    try {
      const selected = await chooseNativeLibraryStorageTargetV1();
      if (!selected || !selected.writable || !selected.persistedPermission) {
        setStartError('Orion could not keep writable access to that folder. Choose another folder.');
        return;
      }
      setValidatedStorageTargetId(selected.targetId);
      setPreferences(setMobileDownloadLibraryStorageTargetV1(selected));
    } catch (error) {
      setStartError(error instanceof Error ? error.message : 'Orion could not choose its storage folder.');
    } finally {
      setChoosingStorage(false);
    }
  };

  const handleOptionsContinue = () => {
    if (!target || needsEpisode || !storageReady || duplicateJob || !capability.available) return;
    setStartError(null);
    if (selectedCandidate) {
      setStep('ready');
      return;
    }
    setStep('prepare');
  };

  const handlePrepare = () => {
    if (!target || needsEpisode || starting || !storageReady) return;
    setStartError(null);
    if (selectedCandidate) {
      setStep('ready');
      return;
    }
    const warning = selectedSourceId ? getMobileSourceSafetyNotice(selectedSourceId) : null;
    if (warning && selectedSourceId) {
      setWarningSourceId(selectedSourceId);
      return;
    }
    onResolveSource(target, transferMethod, selectedSourceId || undefined);
  };

  const handleStart = async () => {
    if (!target || !selectedCandidate || needsEpisode || starting || duplicateJob || !storageReady) return;
    setStarting(true);
    setStartError(null);
    try {
      await startMobileDownloadFromSelectionV1({
        target,
        selection: selectedCandidate,
        preferences,
        selectedSubtitleAssetIds: selectedSubtitleIds,
      });
      completeMobileDownloadSourceResolutionV1(target.itemKey);
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Orion could not start this download.';
      setStartError(message);
      const code = typeof error === 'object' && error && 'code' in error
        ? String((error as { code?: unknown }).code || '')
        : '';
      if (code.includes('SOURCE') || code.includes('CONTEXT')) {
        cancelMobileDownloadSourceResolutionV1(target.itemKey);
        setCandidateSnapshots(getMobileDownloadCandidateSnapshotsV1());
        setStep('prepare');
      }
    } finally {
      setStarting(false);
    }
  };

  const chooseSource = (sourceId: string | null) => {
    setSelectedSourceId(sourceId);
    setStartError(null);
  };

  const renderStepRail = () => (
    <View style={styles.stepRail} accessibilityLabel={`Download step ${step}`}>
      {STEP_ORDER.map((entry, index) => {
        const active = entry === step;
        const complete = STEP_ORDER.indexOf(step) > index;
        return (
          <React.Fragment key={entry}>
            {index > 0 ? <View style={[styles.stepLine, { backgroundColor: complete || active ? theme.accent : theme.border }]} /> : null}
            <View style={styles.stepItem}>
              <View style={[styles.stepDot, {
                backgroundColor: active || complete ? theme.accent : theme.surface,
                borderColor: active || complete ? theme.accent : theme.border,
              }]}>
                {complete
                  ? <Ionicons name="checkmark" size={11} color={theme.onAccent} />
                  : <Text style={[styles.stepNumber, { color: active ? theme.onAccent : theme.textMuted }]}>{index + 1}</Text>}
              </View>
              <Text style={[styles.stepLabel, { color: active ? theme.text : theme.textMuted }]}>
                {entry.toUpperCase()}
              </Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );

  const renderOptions = () => (
    <>
      {needsEpisode ? (
        <StatusCard
          icon="list-outline"
          color={theme.accent}
          title="Choose an episode"
          detail="Open an episode below this title to download it for offline playback."
          theme={theme}
        />
      ) : null}

      {!storageReady ? (
        <View style={[styles.optionCard, { backgroundColor: theme.surface, borderColor: storageChecking ? theme.border : theme.warning }]}>
          <Ionicons name="folder-open-outline" size={21} color={theme.accent} />
          <View style={styles.optionCopy}>
            <Text style={[styles.optionTitle, { color: theme.text }]}>Orion Library storage</Text>
            <Text style={[styles.description, { color: theme.textSecondary }]}>
              {storageChecking ? 'Checking your selected folder…' : 'Choose a writable folder once. Orion will keep using it for your Library.'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose Orion Library storage folder"
            disabled={choosingStorage}
            onPress={() => void handleChooseStorage()}
            hitSlop={6}
          >
            <Text style={[styles.inlineAction, { color: theme.accent }]}>
              {choosingStorage ? 'Choosing…' : 'Choose'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <Text accessibilityRole="header" style={[styles.groupTitle, { color: theme.text }]}>Provider</Text>
      <View style={styles.choiceGrid}>
        <ChoicePill
          label="Auto"
          icon="sparkles-outline"
          selected={selectedSourceId === null}
          ready={selectedSourceId === null && Boolean(selectedCandidate)}
          onPress={() => chooseSource(null)}
          theme={theme}
        />
        {alternateSources.map((source) => (
          <ChoicePill
            key={source.id}
            label={source.label}
            icon="play-circle-outline"
            selected={selectedSourceId === source.id}
            ready={preparedSourceIds.has(source.id)}
            note={getMobileSourceSafetyNotice(source.id)?.shortLabel || undefined}
            onPress={() => chooseSource(source.id)}
            theme={theme}
          />
        ))}
      </View>

      <Text accessibilityRole="header" style={[styles.groupTitle, { color: theme.text }]}>Subtitles</Text>
      <View style={styles.choiceGrid}>
        <ChoicePill label="Automatic" icon="chatbox-ellipses-outline" selected={subtitleChoice === 'auto'} onPress={() => setSubtitleChoice('auto')} theme={theme} />
        <ChoicePill label="SubDL" icon="language-outline" selected={subtitleChoice === 'subdl'} onPress={() => setSubtitleChoice('subdl')} theme={theme} />
        <ChoicePill label="Wyzie" icon="language-outline" selected={subtitleChoice === 'wyzie'} onPress={() => setSubtitleChoice('wyzie')} theme={theme} />
        <ChoicePill label="None" icon="remove-circle-outline" selected={subtitleChoice === 'none'} onPress={() => setSubtitleChoice('none')} theme={theme} />
      </View>

      {duplicateJob ? (
        <StatusCard
          icon="copy-outline"
          color={theme.warning}
          title={duplicateJob.state === 'completed' ? 'Already downloaded' : 'Download already active'}
          detail={duplicateJob.state === 'completed'
            ? 'This title already has a verified Orion Library copy.'
            : 'Wait for, cancel, or resolve the existing download before starting another copy.'}
          theme={theme}
        />
      ) : null}
    </>
  );

  const renderPrepare = () => (
    <>
      <View style={[styles.prepareHero, { backgroundColor: theme.surface, borderColor: selectedCandidate ? theme.success : sourceResolutionFailure ? theme.danger : theme.border }]}>
        <View style={[styles.prepareIcon, { backgroundColor: selectedCandidate ? theme.success : theme.accentSoft }]}>
          <Ionicons
            name={selectedCandidate ? 'checkmark' : sourceResolutionFailure ? 'alert-circle-outline' : 'sparkles-outline'}
            size={22}
            color={selectedCandidate ? theme.onAccent : sourceResolutionFailure ? theme.danger : theme.accent}
          />
        </View>
        <View style={styles.prepareCopy}>
          <Text style={[styles.prepareTitle, { color: theme.text }]}>{selectedSourceLabel}</Text>
          <Text style={[styles.description, { color: theme.textSecondary }]}>
            {selectedCandidate
              ? 'Ready ✓'
              : sourceResolutionFailure
                ? 'Not available'
                : 'Orion will check this source and return here automatically when it is ready.'}
          </Text>
        </View>
      </View>

      {sourceResolutionFailure && !selectedCandidate ? (
        <StatusCard
          icon="alert-circle-outline"
          color={theme.danger}
          title="Not available"
          detail={sourceResolutionFailure}
          theme={theme}
        />
      ) : null}

      {preparedSourceIds.size > 0 ? (
        <Text style={[styles.quietHint, { color: theme.textMuted }]}>
          Prepared providers stay reusable while their secure session remains valid.
        </Text>
      ) : null}
    </>
  );

  const renderReady = () => (
    <>
      <View style={[styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <SummaryRow label="Provider" value={`${selectedSourceLabel}${selectedCandidate ? ' · Ready ✓' : ''}`} theme={theme} />
        <SummaryRow label="Subtitles" value={subtitleSummary} theme={theme} />
        <SummaryRow label="Quality" value={preferences.preferredQuality === 'best' ? 'Best available' : preferences.preferredQuality} theme={theme} />
        <SummaryRow label="Save to" value="Orion Library" theme={theme} last />
      </View>

      {subtitleChoice !== 'none' && selectedCandidate && subtitles.state === 'checking' ? (
        <StatusCard
          icon="sync-outline"
          color={theme.warning}
          title="Checking subtitles…"
          detail="Video is ready. Orion is checking your subtitle choice."
          theme={theme}
        />
      ) : null}

      {subtitleChoice !== 'none' && selectedCandidate && subtitles.state === 'ready' && eligibleSubtitleTracks.length > 0 ? (
        <View style={styles.subtitleSection}>
          <View style={styles.subtitleSectionHeader}>
            <View style={styles.subtitleSectionCopy}>
              <Text accessibilityRole="header" style={[styles.groupTitle, { color: theme.text }]}>Subtitle tracks</Text>
              <Text style={[styles.subtitleHint, { color: theme.textSecondary }]}>Choose up to 2 · {selectedSubtitleIds.length} selected</Text>
            </View>
            {selectedSubtitleIds.length > 0 ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Clear subtitle selection" onPress={() => setSelectedSubtitleIds([])} hitSlop={8}>
                <Text style={[styles.inlineAction, { color: theme.accent }]}>Clear</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.subtitleOptionGrid}>
            {eligibleSubtitleTracks.map((track) => {
              const selected = selectedSubtitleIds.includes(track.id);
              const disabled = !selected && selectedSubtitleIds.length >= 2;
              return (
                <Pressable
                  key={track.id}
                  accessibilityRole="checkbox"
                  accessibilityLabel={`${track.languageLabel} subtitle from ${track.providerLabel}`}
                  accessibilityState={{ checked: selected, disabled }}
                  disabled={disabled}
                  onPress={() => toggleSubtitleSelection(track.id)}
                  style={({ pressed }) => [styles.subtitleOption, {
                    opacity: disabled ? 0.55 : 1,
                    backgroundColor: selected ? theme.accentSoft : pressed ? theme.surfaceHover : theme.surface,
                    borderColor: selected ? theme.accent : theme.border,
                  }]}
                >
                  <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={19} color={selected ? theme.accent : theme.textMuted} />
                  <View style={styles.subtitleOptionCopy}>
                    <Text style={[styles.subtitleOptionTitle, { color: theme.text }]} numberOfLines={1}>
                      {track.languageLabel} · {track.providerLabel}
                    </Text>
                    <Text style={[styles.subtitleOptionMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                      {track.label}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {subtitleChoice !== 'none' && selectedCandidate && !subtitleCheckPending
        && subtitles.state !== 'ready' && subtitles.state !== 'idle' && subtitles.state !== 'none' ? (
        <StatusCard
          icon="information-circle-outline"
          color={theme.warning}
          title="Subtitles unavailable"
          detail="The video is still ready. You can download it without subtitles or go Back and choose another subtitle option."
          theme={theme}
        />
      ) : null}

      {duplicateJob ? (
        <StatusCard
          icon="copy-outline"
          color={theme.warning}
          title={duplicateJob.state === 'completed' ? 'Already downloaded' : 'Download already active'}
          detail={duplicateJob.state === 'completed'
            ? 'This title already has a verified Orion Library copy.'
            : 'Wait for, cancel, or resolve the existing download before starting another copy.'}
          theme={theme}
        />
      ) : null}
    </>
  );

  const primaryDisabled = !storageReady || needsEpisode || Boolean(duplicateJob) || !capability.available
    || starting || (step === 'ready' && (subtitleCheckPending || !selectedCandidate));

  const primaryLabel = step === 'options'
    ? storageChecking ? 'Checking storage…' : !storageReady ? 'Choose storage folder' : 'Continue'
    : step === 'prepare'
      ? selectedCandidate ? 'Ready' : 'Prepare'
      : starting ? 'Starting…' : duplicateJob ? 'Already active' : 'Start Download';

  const primaryAction = step === 'options'
    ? handleOptionsContinue
    : step === 'prepare'
      ? handlePrepare
      : handleStart;

  const secondaryLabel = step === 'options' ? 'Cancel' : 'Back';
  const secondaryAction = step === 'options' ? onClose : () => {
    setStartError(null);
    setStep('options');
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close download options"
            style={styles.backdrop}
            onPress={onClose}
          />
          <View style={[styles.card, isTablet && styles.cardTablet, { backgroundColor: theme.elevated, borderColor: theme.border }]}>
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={[styles.eyebrow, { color: theme.textMuted }]}>DOWNLOAD</Text>
                <Text accessibilityRole="header" style={[styles.cardTitle, { color: theme.text }]} numberOfLines={2}>
                  {displayTitle}
                </Text>
                {supportingTitle ? (
                  <Text style={[styles.mediaTitle, { color: theme.textSecondary }]} numberOfLines={2}>
                    {supportingTitle}
                  </Text>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close download options"
                style={({ pressed }) => [styles.closeBtn, {
                  backgroundColor: pressed ? theme.surfaceHover : theme.surface,
                  borderColor: theme.border,
                }]}
                onPress={onClose}
              >
                <Ionicons name="close" size={20} color={theme.text} />
              </Pressable>
            </View>

            <View style={styles.railWrap}>{renderStepRail()}</View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {step === 'options' ? renderOptions() : step === 'prepare' ? renderPrepare() : renderReady()}

              {startError ? (
                <StatusCard
                  icon="alert-circle-outline"
                  color={theme.danger}
                  title="Download needs attention"
                  detail={startError}
                  theme={theme}
                />
              ) : null}
              {!capability.available ? (
                <StatusCard
                  icon="time-outline"
                  color={theme.textMuted}
                  title="Waiting for download support"
                  detail={capability.reason}
                  theme={theme}
                />
              ) : null}
            </ScrollView>

            <View style={[styles.footer, { borderTopColor: theme.border }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={secondaryLabel}
                onPress={secondaryAction}
                style={({ pressed }) => [styles.secondaryButton, {
                  borderColor: theme.border,
                  backgroundColor: pressed ? theme.surfaceHover : theme.surface,
                }]}
              >
                <Text style={[styles.secondaryButtonText, { color: theme.textSecondary }]}>{secondaryLabel}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={primaryLabel}
                accessibilityState={{ disabled: primaryDisabled }}
                disabled={primaryDisabled}
                onPress={() => void primaryAction()}
                style={({ pressed }) => [styles.primaryButton, {
                  backgroundColor: primaryDisabled ? theme.accentSoft : pressed ? theme.accentSoft : theme.accent,
                  borderColor: primaryDisabled ? theme.border : theme.accent,
                }]}
              >
                <Text style={[styles.primaryButtonText, {
                  color: primaryDisabled ? theme.textMuted : theme.onAccent,
                }]}>
                  {primaryLabel}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <OrionDialog
        visible={Boolean(warningSourceId)}
        title={getMobileSourceSafetyNotice(warningSourceId || '')?.label || 'Source safety notice'}
        message={getMobileSourceSafetyNotice(warningSourceId || '')?.selectionMessage}
        onDismiss={() => setWarningSourceId(null)}
        actions={[
          { label: 'Cancel', role: 'cancel', onPress: () => setWarningSourceId(null) },
          {
            label: 'Try source',
            role: 'primary',
            onPress: () => {
              if (target && warningSourceId) onResolveSource(target, transferMethod, warningSourceId);
              setWarningSourceId(null);
            },
          },
        ]}
      />
    </>
  );
}
