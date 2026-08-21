import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
import { useOrionSyncPolicy } from '../account/SyncPolicyContext';
import { useViewingActivitySteadyStateSync } from '../account/ViewingActivitySteadyStateSync';
import {
  loadViewingActivitySyncCheckpointV1,
  saveViewingActivitySyncCheckpointV1,
} from '../account/viewingActivitySyncCheckpoint';
import {
  buildLocalMobileViewingActivitySnapshotV1,
  buildMobilePortableViewingActivityPreviewV1,
} from '../library/viewingStatePortableAdapter';
import { AccountSyncDomainRow } from './AccountSyncDomainRow';
import { useManualSyncPresentation } from './useManualSyncPresentation';

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
  return `${history} history ${history === 1 ? 'entry' : 'entries'}, ${progress} playback ${progress === 1 ? 'position' : 'positions'}`;
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
  if (result.reason === 'local-invalid') return 'Some verified local History or playback positions cannot be represented safely yet. Orion stopped without changing either copy.';
  if (result.reason === 'cloud-invalid') return 'Viewing Activity in Orion Cloud contains data this Orion version cannot safely sync. Nothing was changed.';
  return 'Orion could not find a safe first-sync choice for Viewing Activity. Nothing was overwritten.';
}

function executionMessage(reason: string, cloudWasWritten: boolean): string {
  if (reason === 'cloud-conflict' || reason === 'cloud-changed-before-apply') return 'Orion Cloud changed while Viewing Activity was syncing. Orion stopped instead of overwriting it. Check again.';
  if (reason === 'local-changed-during-sync') return `Viewing Activity changed on this device while sync was running.${cloudWasWritten ? ' The verified Cloud update was preserved, but enrollment was not completed.' : ''} Check again.`;
  if (reason === 'cloud-verification-failed') return 'Orion Cloud was updated, but Orion could not safely verify the new copy. Enrollment was not completed.';
  if (reason === 'local-apply-failed') return `Orion could not verify the local Viewing Activity update.${cloudWasWritten ? ' The verified Orion Cloud copy was preserved, but setup was not confirmed on this device.' : ''}`;
  if (reason === 'resolution-no-longer-safe') return 'That sync choice is no longer safe because Viewing Activity changed. Check again.';
  return 'Viewing Activity changed after the readiness check. Orion stopped before using the stale plan.';
}

export function ViewingActivitySyncControl({ accountEmail, profileId }: ViewingActivitySyncControlProps) {
  const { theme } = useOrionTheme();
  const syncPolicy = useOrionSyncPolicy();
  const steady = useViewingActivitySteadyStateSync();
  const autoSyncEnabled = syncPolicy.getAutomatic('viewingActivity');
  const manualSync = useManualSyncPresentation(steady.refresh);
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
  const [reviewResolution, setReviewResolution] = useState<'device' | 'cloud' | null>(null);
  const busyRef = useRef(false);
  const activeRef = useRef(true);
  useEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; };
  }, [accountEmail, profileId]);
  const enrolled = !!checkpoint || state.phase === 'enrolled';
  const steadyActive = enrolled;

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
        steady.refresh();
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
        steady.refresh();
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
  const steadyBusy = steady.phase === 'checking' || steady.phase === 'syncing';
  const enrollmentBusy = state.phase === 'checking' || state.phase === 'syncing';
  const busy = (steadyActive ? steadyBusy : enrollmentBusy)
    || (steadyActive && manualSync.manualBusy);
  const steadyReview = steady.phase === 'needs-review' && steady.review?.reason === 'two-sided-divergence'
    ? steady.review
    : null;
  const steadyReviewAvailable = steadyActive && steadyReview != null;
  const needsReview = steadyActive
    ? steady.phase === 'needs-review' || steady.phase === 'error'
    : state.phase === 'needs-review' || state.phase === 'error';
  const badge = manualSync.manualBusy
    ? 'Syncing'
    : steadyActive
      ? steady.phase === 'synced' ? 'Synced'
        : steady.phase === 'paused' ? 'Paused'
          : steady.phase === 'offline' ? 'Offline'
            : steady.phase === 'needs-review' || steady.phase === 'error' ? 'Needs review'
              : steady.phase === 'checking' ? 'Syncing'
                : steady.phase === 'syncing' ? 'Syncing'
                  : 'Set up'
      : state.phase === 'checking' ? 'Syncing'
        : state.phase === 'syncing' ? 'Syncing'
          : needsReview ? 'Needs review' : 'Set up';
  const feedback = manualSync.manualBusy
    ? 'Syncing history and playback positions with Orion Cloud.'
    : steadyActive
    ? steady.phase === 'synced' ? null
      : steady.phase === 'paused' ? 'Automatic sync is paused. History and playback positions stay on this device until you choose Sync now or turn Auto sync back on.'
        : steady.phase === 'offline' ? 'Viewing Activity is waiting for a connection. Local history and playback positions remain available.'
          : steady.message
    : state.phase === 'ready'
      ? `This device has ${countCopy(state.inspection.localCount.history, state.inspection.localCount.progress)}. Orion Cloud has ${countCopy(state.inspection.cloudCount.history, state.inspection.cloudCount.progress)}. Choose how to establish Viewing Activity sync.`
      : state.phase === 'syncing' ? 'Syncing history and playback positions. Orion will finish setup only after both copies are confirmed.'
        : state.phase === 'needs-review' || state.phase === 'error' ? state.message : null;
  const showFeedback = Boolean(feedback) && (!steadyActive || needsReview) && !steadyReviewAvailable;
  const actionLabel = manualSync.manualBusy
    ? 'Syncing...'
    : busy
      ? (steady.phase === 'syncing' || state.phase === 'syncing' ? 'Syncing...' : 'Checking...')
      : enrolled
        ? steady.phase === 'error'
          ? 'Try again'
          : steady.phase === 'needs-review' && !steadyReviewAvailable
            ? 'Check again'
            : 'Sync now'
        : 'Check Viewing Activity';
  const showAction = enrolled
    ? !steadyReviewAvailable && (
        steady.phase === 'error'
        || steady.phase === 'needs-review'
        || !autoSyncEnabled
      )
    : state.phase !== 'ready';


  return (
    <>
      <AccountSyncDomainRow
        icon="time-outline"
        title="Viewing Activity"
        summary={localCount}
        status={badge}
        autoSync={steadyActive ? {
          value: autoSyncEnabled,
          disabled: !syncPolicy.ready,
          accessibilityLabel: 'Auto sync Viewing Activity',
          accessibilityHint: 'Turns automatic history and playback-position sync through Orion Cloud on or off without deleting local or cloud data',
          onValueChange: (enabled) => syncPolicy.setAutomatic('viewingActivity', enabled),
        } : undefined}
        action={showAction ? {
          label: actionLabel,
          accessibilityLabel: enrolled ? actionLabel : 'Check Viewing Activity',
          accessibilityHint: enrolled
            ? steady.phase === 'error'
              ? 'Retries one safe Viewing Activity sync after the last Orion Cloud error'
              : steady.phase === 'needs-review' && !steadyReviewAvailable
                ? 'Checks the current Viewing Activity copies again without choosing a winner'
                : 'Runs one safe Viewing Activity sync while automatic sync is paused'
            : 'Checks this device and Orion Cloud before first Viewing Activity sync',
          disabled: busy,
          busy,
          onPress: () => {
            if (enrolled) manualSync.runManualSync();
            else void checkEnrollment();
          },
        } : undefined}
      >
        {showFeedback && (
          <Text
            accessibilityRole={needsReview ? 'alert' : undefined}
            style={[styles.message, { color: needsReview ? theme.warning : theme.textSecondary }]}
          >
            {feedback}
          </Text>
        )}

        {steadyReviewAvailable && steadyReview && (
          <View style={[styles.reviewBox, { borderColor: theme.border, backgroundColor: theme.elevated }]}>
            <View style={styles.reviewCounts}>
              <View style={styles.reviewCount}>
                <Text style={[styles.reviewLabel, { color: theme.textMuted }]}>This device</Text>
                <Text style={[styles.reviewValue, { color: theme.text }]}>{countCopy(steadyReview.localCount.history, steadyReview.localCount.progress)}</Text>
              </View>
              <View style={styles.reviewCount}>
                <Text style={[styles.reviewLabel, { color: theme.textMuted }]}>Orion Cloud</Text>
                <Text style={[styles.reviewValue, { color: theme.text }]}>{countCopy(steadyReview.cloudCount.history, steadyReview.cloudCount.progress)}</Text>
              </View>
            </View>
            <Text style={[styles.reviewDescription, { color: theme.textSecondary }]}>Both copies changed. Choose which one Orion should keep.</Text>
            <View style={styles.actions}>
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => setReviewResolution('device')} style={({ pressed }) => [styles.button, { backgroundColor: theme.elevated, borderColor: theme.border }, pressed && styles.pressed, busy && styles.disabled]}>
                <Text style={[styles.buttonText, { color: theme.text }]}>Keep this device</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => setReviewResolution('cloud')} style={({ pressed }) => [styles.button, { backgroundColor: theme.elevated, borderColor: theme.border }, pressed && styles.pressed, busy && styles.disabled]}>
                <Text style={[styles.buttonText, { color: theme.text }]}>Keep Orion Cloud</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => autoSyncEnabled ? steady.refresh() : manualSync.runManualSync()} style={({ pressed }) => [styles.button, { backgroundColor: theme.elevated, borderColor: theme.border }, pressed && styles.pressed, busy && styles.disabled]}>
                <Text style={[styles.buttonText, { color: theme.text }]}>Check again</Text>
              </Pressable>
            </View>
          </View>
        )}

        {!enrolled && state.phase === 'ready' && (
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
        )}

        {(localPreview.rejected.history.length > 0 || localPreview.rejected.progress.length > 0) && (
          <Text style={[styles.message, { color: theme.warning }]}>Some viewing activity cannot sync safely yet.</Text>
        )}
      </AccountSyncDomainRow>

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

      <OrionDialog
        visible={reviewResolution != null}
        title="Resolve Viewing Activity conflict?"
        message={reviewResolution === 'device'
          ? `Keep this device's ${steadyReview ? countCopy(steadyReview.localCount.history, steadyReview.localCount.progress) : localCount} and replace the current Orion Cloud Viewing Activity?`
          : `Keep Orion Cloud's ${steadyReview ? countCopy(steadyReview.cloudCount.history, steadyReview.cloudCount.progress) : 'Viewing Activity'} and replace this device's synced history and playback positions?`}
        icon="alert-circle-outline"
        onDismiss={() => setReviewResolution(null)}
        actions={[
          { label: 'Cancel', role: 'cancel', onPress: () => setReviewResolution(null) },
          {
            label: 'Confirm',
            role: 'primary',
            onPress: () => {
              const choice = reviewResolution;
              setReviewResolution(null);
              if (choice) steady.resolveReview(choice);
            },
          },
        ]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  message: { fontSize: fontSizes.xs, lineHeight: 18 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  reviewBox: { borderWidth: 1, borderRadius: radii.lg, padding: spacing[3], gap: spacing[3] },
  reviewCounts: { flexDirection: 'row', gap: spacing[3] },
  reviewCount: { flex: 1 },
  reviewLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  reviewValue: { fontSize: fontSizes.sm, fontWeight: '800', marginTop: 3 },
  reviewDescription: { fontSize: fontSizes.xs, lineHeight: 18 },
  button: { minHeight: 44, borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  buttonText: { fontSize: fontSizes.xs, fontWeight: '800' },
  pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.6 },
});
