import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  executePortableViewingActivityOneShotSyncV1,
  inspectPortableViewingActivityOneShotSyncV1,
  type PortableViewingActivityEnrollmentResolutionV1,
  type PortableViewingActivityOneShotInspectionV1,
} from '@orion/shared/api';
import { PORTABLE_PROFILE_PRIMARY_KEY, type PortableViewingActivityStateV1 } from '@orion/shared/types';
import { fontSizes, radii, spacing } from '@orion/shared/tokens';
import { OrionDialog } from '../../components/OrionDialog';
import { useLibrary } from '../../context/LibraryContext';
import { useOrionTheme } from '../../context/ThemeContext';
import { GoogleDriveCloudProfileStore } from '../account/googleDriveCloudProfileStore';
import {
  loadViewingActivitySyncCheckpointV1,
  saveViewingActivitySyncCheckpointV1,
} from '../account/viewingActivitySyncCheckpoint';
import {
  buildLocalMobileViewingActivitySnapshotV1,
  buildMobilePortableViewingActivityPreviewV1,
} from '../library/viewingStatePortableAdapter';

type ReadyInspection = Extract<PortableViewingActivityOneShotInspectionV1, { state: 'ready' }>;

type UiState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'ready'; inspection: ReadyInspection }
  | { phase: 'syncing' }
  | { phase: 'enrolled'; history: number; progress: number }
  | { phase: 'needs-review'; message: string }
  | { phase: 'error'; message: string };

interface ViewingActivitySyncControlProps {
  accountEmail: string;
  profileId: string;
}

function countCopy(history: number, progress: number): string {
  return `${history} History ${history === 1 ? 'entry' : 'entries'} • ${progress} progress ${progress === 1 ? 'item' : 'items'}`;
}

function resolutionLabel(resolution: PortableViewingActivityEnrollmentResolutionV1): string {
  if (resolution === 'device') return 'Keep this device';
  if (resolution === 'cloud') return 'Keep Orion Cloud';
  return 'Combine recent activity';
}

function resolutionMessage(
  resolution: PortableViewingActivityEnrollmentResolutionV1,
  inspection: ReadyInspection,
): string {
  if (resolution === 'device') {
    return `Use this device's ${countCopy(inspection.localCount.history, inspection.localCount.progress)} as the verified Viewing Activity kept in Orion Cloud? Newer Cloud playback or removals will still be protected.`;
  }
  if (resolution === 'cloud') {
    return `Restore Orion Cloud's ${countCopy(inspection.cloudCount.history, inspection.cloudCount.progress)} to this device? Local-only unverified playback evidence stays local.`;
  }
  return 'Combine both copies by keeping the later verified playback or removal for each movie or episode. Orion will stop on an exact-time conflict instead of guessing.';
}

function inspectionMessage(result: Extract<PortableViewingActivityOneShotInspectionV1, { state: 'needs-review' }>): string {
  if (result.reason === 'profile-identity-mismatch') return 'Viewing Activity in Orion Cloud belongs to a different Orion profile. Nothing was changed.';
  if (result.reason === 'local-invalid') return 'Some verified local History or Progress cannot be represented safely yet. Orion stopped without changing either copy.';
  if (result.reason === 'cloud-invalid') return 'Viewing Activity in Orion Cloud contains data this Orion version cannot safely reconcile. Nothing was changed.';
  return 'Orion could not find a safe first-sync choice for Viewing Activity. Nothing was overwritten.';
}

function executionMessage(reason: string, cloudWasWritten: boolean): string {
  if (reason === 'cloud-conflict' || reason === 'cloud-changed-before-apply') return 'Orion Cloud changed while Viewing Activity was syncing. Orion stopped instead of overwriting it. Check again.';
  if (reason === 'local-changed-during-sync') return `Viewing Activity changed on this device while sync was running.${cloudWasWritten ? ' The verified Cloud update was preserved, but enrollment was not completed.' : ''} Check again.`;
  if (reason === 'cloud-verification-failed') return 'Orion Cloud was updated, but Orion could not safely verify the new copy. Enrollment was not completed.';
  if (reason === 'local-apply-failed') return `Orion could not verify the local Viewing Activity update.${cloudWasWritten ? ' The verified Orion Cloud copy was preserved, but no enrollment checkpoint was created.' : ''}`;
  if (reason === 'resolution-no-longer-safe') return 'That sync choice is no longer safe because Viewing Activity changed. Check again.';
  return 'Viewing Activity changed after the readiness check. Orion stopped before using the stale plan.';
}

export function ViewingActivitySyncControl({ accountEmail, profileId }: ViewingActivitySyncControlProps) {
  const { theme } = useOrionTheme();
  const {
    watched,
    history,
    progress,
    replaceViewingActivityFromSync,
  } = useLibrary();
  const watchedRef = useRef(watched);
  const historyRef = useRef(history);
  const progressRef = useRef(progress);
  watchedRef.current = watched;
  historyRef.current = history;
  progressRef.current = progress;

  const localPreview = useMemo(() => buildMobilePortableViewingActivityPreviewV1({ watched, history, progress }), [watched, history, progress]);
  const checkpoint = loadViewingActivitySyncCheckpointV1(profileId);
  const [state, setState] = useState<UiState>({ phase: 'idle' });
  const [resolution, setResolution] = useState<PortableViewingActivityEnrollmentResolutionV1 | null>(null);
  const busyRef = useRef(false);
  const activeRef = useRef(true);
  useEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; };
  }, [accountEmail, profileId]);
  const enrolled = !!checkpoint || state.phase === 'enrolled';
  const busy = state.phase === 'checking' || state.phase === 'syncing';

  const readLocalPreview = () => buildMobilePortableViewingActivityPreviewV1({
    watched: watchedRef.current,
    history: historyRef.current,
    progress: progressRef.current,
  });

  const applyLocalState = (portableState: PortableViewingActivityStateV1) => {
    const snapshot = buildLocalMobileViewingActivitySnapshotV1(portableState, {
      history: historyRef.current,
      progress: progressRef.current,
    });
    replaceViewingActivityFromSync(snapshot.history, snapshot.progress);
    historyRef.current = snapshot.history;
    progressRef.current = snapshot.progress;
  };

  const checkEnrollment = async () => {
    if (busyRef.current || enrolled) return;
    busyRef.current = true;
    setState({ phase: 'checking' });
    try {
      const result = await inspectPortableViewingActivityOneShotSyncV1({
        store: new GoogleDriveCloudProfileStore(accountEmail),
        profileKey: PORTABLE_PROFILE_PRIMARY_KEY,
        profileId,
        updatedBy: profileId,
        localPreview: readLocalPreview(),
      });
      if (!activeRef.current) return;
      if (result.state === 'aligned') {
        saveViewingActivitySyncCheckpointV1(result.checkpoint);
        setState({ phase: 'enrolled', history: result.localCount.history, progress: result.localCount.progress });
      } else if (result.state === 'ready') {
        setState({ phase: 'ready', inspection: result });
      } else {
        setState({ phase: 'needs-review', message: inspectionMessage(result) });
      }
    } catch {
      if (!activeRef.current) return;
      setState({ phase: 'error', message: 'Orion could not check Viewing Activity with Orion Cloud. Nothing was uploaded or changed.' });
    } finally {
      busyRef.current = false;
    }
  };

  const confirmResolution = async () => {
    if (busyRef.current || state.phase !== 'ready' || !resolution || enrolled) return;
    const selected = resolution;
    const inspection = state.inspection;
    setResolution(null);
    busyRef.current = true;
    setState({ phase: 'syncing' });
    try {
      const result = await executePortableViewingActivityOneShotSyncV1({
        store: new GoogleDriveCloudProfileStore(accountEmail),
        profileKey: PORTABLE_PROFILE_PRIMARY_KEY,
        profileId,
        updatedBy: profileId,
        resolution: selected,
        expectedConfirmationKey: inspection.confirmationKey,
        readLocalPreview,
        applyLocalState,
        shouldProceed: () => activeRef.current,
      });
      if (!activeRef.current) return;
      if (result.state === 'verified') {
        saveViewingActivitySyncCheckpointV1(result.checkpoint);
        setState({ phase: 'enrolled', history: result.count.history, progress: result.count.progress });
      } else {
        setState({ phase: 'needs-review', message: executionMessage(result.reason, result.cloudWasWritten) });
      }
    } catch {
      if (!activeRef.current) return;
      setState({ phase: 'error', message: 'Viewing Activity could not finish syncing safely. Orion left the operation incomplete instead of guessing.' });
    } finally {
      busyRef.current = false;
    }
  };

  const localCount = countCopy(Object.keys(localPreview.history).length, Object.keys(localPreview.progress).length);
  const needsReview = state.phase === 'needs-review' || state.phase === 'error';
  const badge = enrolled ? 'Enrolled'
    : state.phase === 'ready' ? 'Ready'
      : state.phase === 'checking' ? 'Checking'
        : state.phase === 'syncing' ? 'Syncing'
          : needsReview ? 'Needs review' : 'Manual';
  const feedback = state.phase === 'ready'
    ? `This device has ${countCopy(state.inspection.localCount.history, state.inspection.localCount.progress)}. Orion Cloud has ${countCopy(state.inspection.cloudCount.history, state.inspection.cloudCount.progress)}. Choose how to establish Viewing Activity sync.`
    : state.phase === 'syncing' ? 'Syncing verified History and Progress. Orion will create enrollment only after the Cloud and local result are verified.'
      : state.phase === 'enrolled' ? `${countCopy(state.history, state.progress)} verified with Orion Cloud for this account.`
        : state.phase === 'needs-review' || state.phase === 'error' ? state.message : null;

  return (
    <View style={[styles.block, { borderTopColor: theme.border }]}>
      <View style={styles.heading}>
        <View style={[styles.icon, { backgroundColor: theme.accentSoft }]}>
          <Ionicons name="time-outline" size={20} color={theme.accent} />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: theme.text }]}>Viewing Activity</Text>
          <Text style={[styles.description, { color: theme.textSecondary }]}>Keep verified History and playback Progress portable across Orion devices. Continue Watching remains derived from Progress on each device.</Text>
        </View>
        <View style={[styles.chip, { backgroundColor: theme.surfaceHover, borderColor: needsReview ? theme.warning : theme.border }]}>
          <Text style={[styles.chipText, { color: needsReview ? theme.warning : theme.textMuted }]}>{badge}</Text>
        </View>
      </View>

      <Text style={[styles.localSummary, { color: theme.textSecondary }]}>{localCount} on this device</Text>
      {feedback && <Text accessibilityRole={needsReview ? 'alert' : undefined} style={[styles.message, { color: needsReview ? theme.warning : theme.textSecondary }]}>{feedback}</Text>}
      {enrolled && (
        <Text style={[styles.message, { color: theme.textSecondary }]}>Automatic Viewing Activity sync is not enabled yet. New verified playback changes stay on this device.</Text>
      )}

      {!enrolled && state.phase === 'ready' ? (
        <View style={styles.actions}>
          {state.inspection.availableResolutions.map((choice) => (
            <Pressable
              key={choice}
              accessibilityRole="button"
              accessibilityLabel={resolutionLabel(choice)}
              disabled={busy}
              onPress={() => setResolution(choice)}
              style={({ pressed }) => [styles.button, { backgroundColor: choice === 'combine' ? theme.accentSoft : theme.elevated, borderColor: choice === 'combine' ? theme.accent : theme.border }, pressed && styles.pressed]}
            >
              <Text style={[styles.buttonText, { color: choice === 'combine' ? theme.accent : theme.text }]}>{resolutionLabel(choice)}</Text>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void checkEnrollment()}
            style={({ pressed }) => [styles.button, { backgroundColor: theme.elevated, borderColor: theme.border }, pressed && styles.pressed]}
          >
            <Text style={[styles.buttonText, { color: theme.text }]}>Check again</Text>
          </Pressable>
        </View>
      ) : !enrolled ? (
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Check Viewing Activity"
            disabled={busy}
            onPress={() => void checkEnrollment()}
            style={({ pressed }) => [styles.button, { backgroundColor: theme.elevated, borderColor: theme.border }, pressed && styles.pressed, busy && styles.disabled]}
          >
            {busy ? <ActivityIndicator color={theme.text} /> : <Ionicons name="refresh-outline" size={17} color={theme.text} />}
            <Text style={[styles.buttonText, { color: theme.text }]}>{busy ? (state.phase === 'syncing' ? 'Syncing...' : 'Checking...') : 'Check Viewing Activity'}</Text>
          </Pressable>
        </View>
      ) : null}

      <OrionDialog
        visible={resolution != null && state.phase === 'ready'}
        title="Sync Viewing Activity?"
        message={resolution && state.phase === 'ready' ? resolutionMessage(resolution, state.inspection) : ''}
        icon="cloud-outline"
        onDismiss={() => setResolution(null)}
        actions={[
          { label: 'Cancel', role: 'cancel', onPress: () => setResolution(null) },
          { label: 'Confirm', role: 'primary', onPress: () => void confirmResolution() },
        ]}
      />

      {(localPreview.rejected.history.length > 0 || localPreview.rejected.progress.length > 0) && (
        <Text style={[styles.message, { color: theme.warning }]}>Some verified Viewing Activity cannot be represented safely yet and will block enrollment.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { borderTopWidth: 1, paddingTop: spacing[4], gap: spacing[3] },
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  icon: { width: 40, height: 40, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: fontSizes.md, fontWeight: '800' },
  description: { fontSize: fontSizes.xs, lineHeight: 18, marginTop: 4 },
  chip: { minHeight: 30, borderRadius: 15, borderWidth: 1, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 10, fontWeight: '900' },
  localSummary: { fontSize: fontSizes.xs, lineHeight: 18, marginLeft: 52 },
  message: { fontSize: fontSizes.xs, lineHeight: 18, marginLeft: 52 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginLeft: 52 },
  button: { minHeight: 42, borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  buttonText: { fontSize: fontSizes.xs, fontWeight: '800' },
  pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.6 },
});
