import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  executePortableWatchedOneShotSyncV1,
  inspectPortableWatchedOneShotSyncV1,
  type PortableWatchedOneShotInspectionV1,
} from '@orion/shared/api';
import { PORTABLE_PROFILE_PRIMARY_KEY } from '@orion/shared/types';
import { useLibrary } from '../../context/LibraryContext';
import { useOrionTheme } from '../../context/ThemeContext';
import { fontSizes, radii, spacing } from '@orion/shared/tokens';
import { OrionDialog } from '../../components/OrionDialog';
import { GoogleDriveCloudProfileStore } from '../account/googleDriveCloudProfileStore';
import { useOrionSyncPolicy } from '../account/SyncPolicyContext';
import { useWatchedSteadyStateSync } from '../account/WatchedSteadyStateSync';
import {
  loadWatchedSyncCheckpointV1,
  saveWatchedSyncCheckpointV1,
} from '../account/watchedSyncCheckpoint';
import { buildMobilePortableWatchedPreviewV1 } from '../library/viewingStatePortableAdapter';
import { buildLocalMobileWatchedSnapshotV1 } from '../library/watchedSyncAdapter';
import { AccountSyncDomainRow } from './AccountSyncDomainRow';
import { useManualSyncPresentation } from './useManualSyncPresentation';

type ReadyInspection = Extract<PortableWatchedOneShotInspectionV1, { state: 'ready' }>;

type UiState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'ready'; inspection: ReadyInspection }
  | { phase: 'syncing' }
  | { phase: 'synced'; count: number; action: string }
  | { phase: 'needs-review'; message: string }
  | { phase: 'error'; message: string };

interface WatchedSyncControlProps {
  accountEmail: string;
  profileId: string;
}

function itemLabel(count: number): string {
  return count === 1 ? '1 watched movie or episode' : `${count} watched movies & episodes`;
}

function readyCopy(result: ReadyInspection): string {
  if (result.action === 'pull') return `Orion Cloud has ${itemLabel(result.targetCount)} ready to restore on this device. Nothing changes until you confirm.`;
  if (result.action === 'merge') return `Orion can safely combine both copies into ${itemLabel(result.targetCount)} without deleting either side. Nothing changes until you confirm.`;
  if (result.action === 'create') return `Watched is not in Orion Cloud yet. Orion can start it with ${itemLabel(result.targetCount)}. Nothing changes until you confirm.`;
  return `This device can update Orion Cloud to ${itemLabel(result.targetCount)}. Nothing changes until you confirm.`;
}

function reviewMessage(reason: string, conflictKeys: string[]): string {
  if (reason === 'tombstone-conflict') return `${itemLabel(conflictKeys.length)} were previously removed in Orion Cloud. Orion will not restore them automatically.`;
  if (reason === 'both-changed') return 'Watched changed on this device and in Orion Cloud since the last sync. Orion stopped instead of choosing a winner.';
  if (reason === 'profile-missing-after-checkpoint') return 'Previously synced Watched data is missing from Orion Cloud. Orion will not recreate it automatically.';
  if (reason.includes('identity')) return 'Watched in Orion Cloud does not match this signed-in Google account.';
  if (reason.includes('invalid')) return 'Watched contains data this Orion version cannot sync safely.';
  return 'Watched no longer matches the last synced copies. Orion stopped without overwriting either side.';
}

export function WatchedSyncControl({ accountEmail, profileId }: WatchedSyncControlProps) {
  const { theme } = useOrionTheme();
  const { watched, replaceWatchedFromSync } = useLibrary();
  const syncPolicy = useOrionSyncPolicy();
  const steady = useWatchedSteadyStateSync();
  const autoSyncEnabled = syncPolicy.getAutomatic('watched');
  const manualSync = useManualSyncPresentation(steady.refresh);
  const watchedRef = useRef(watched);
  watchedRef.current = watched;
  const localPreview = useMemo(() => buildMobilePortableWatchedPreviewV1(watched), [watched]);
  const [state, setState] = useState<UiState>({ phase: 'idle' });
  const [reviewResolution, setReviewResolution] = useState<'device' | 'cloud' | null>(null);
  const busyRef = useRef(false);
  const locallyEnrolled = !!loadWatchedSyncCheckpointV1(profileId);
  const steadyActive = locallyEnrolled || steady.hasCheckpoint;

  const readLocalPreview = () => buildMobilePortableWatchedPreviewV1(watchedRef.current);
  const applyLocalPreview = (preview: ReturnType<typeof buildMobilePortableWatchedPreviewV1>) => {
    const snapshot = buildLocalMobileWatchedSnapshotV1(preview, watchedRef.current);
    replaceWatchedFromSync(snapshot);
    watchedRef.current = snapshot;
  };

  const checkEnrollment = async () => {
    if (busyRef.current || steadyActive) return;
    busyRef.current = true;
    setState({ phase: 'checking' });
    try {
      const store = new GoogleDriveCloudProfileStore(accountEmail);
      const result = await inspectPortableWatchedOneShotSyncV1({
        store,
        profileKey: PORTABLE_PROFILE_PRIMARY_KEY,
        profileId,
        localPreview: readLocalPreview(),
        checkpoint: null,
      });
      if (result.state === 'aligned') {
        saveWatchedSyncCheckpointV1(result.checkpoint);
        setState({ phase: 'synced', count: result.localCount, action: 'aligned' });
        steady.refresh();
      } else if (result.state === 'ready') {
        setState({ phase: 'ready', inspection: result });
      } else {
        setState({ phase: 'needs-review', message: reviewMessage(result.reason, result.conflictKeys) });
      }
    } catch {
      setState({ phase: 'error', message: 'Orion could not check Watched sync right now. Nothing was uploaded or changed.' });
    } finally {
      busyRef.current = false;
    }
  };

  const confirmEnrollment = async () => {
    if (busyRef.current || state.phase !== 'ready' || steadyActive) return;
    const expected = state.inspection;
    busyRef.current = true;
    setState({ phase: 'syncing' });
    try {
      const store = new GoogleDriveCloudProfileStore(accountEmail);
      const result = await executePortableWatchedOneShotSyncV1({
        store,
        profileKey: PORTABLE_PROFILE_PRIMARY_KEY,
        profileId,
        updatedBy: profileId,
        expectedConfirmationKey: expected.confirmationKey,
        checkpoint: null,
        readLocalPreview,
        applyLocalPreview,
      });
      if (result.state === 'verified') {
        saveWatchedSyncCheckpointV1(result.checkpoint);
        setState({ phase: 'synced', count: result.count, action: result.action });
        steady.refresh();
      } else {
        const message = result.reason === 'cloud-conflict' || result.reason === 'cloud-changed-before-pull'
          ? 'Orion Cloud changed while Watched was syncing. Orion did not overwrite it. Check again.'
          : result.reason === 'local-changed-during-sync'
            ? `Watched changed on this device while sync was running.${result.cloudWasWritten ? ' The earlier Orion Cloud update was preserved, but Orion did not finish the sync.' : ''} Check again.`
            : result.reason === 'cloud-verification-failed'
              ? 'Orion Cloud was updated, but Orion could not safely verify the new copy. Local Watched was left untouched.'
              : 'Watched changed after the readiness check. Orion stopped before using the stale plan. Check again.';
        setState({ phase: 'needs-review', message });
      }
    } catch {
      setState({ phase: 'error', message: 'Watched could not finish syncing safely. Orion left the operation incomplete instead of guessing.' });
    } finally {
      busyRef.current = false;
    }
  };

  const steadyBusy = steady.phase === 'checking' || steady.phase === 'syncing';
  const enrollmentBusy = state.phase === 'checking' || state.phase === 'syncing';
  const busy = (steadyActive ? steadyBusy : enrollmentBusy)
    || (steadyActive && !autoSyncEnabled && manualSync.manualBusy);
  const needsReview = steadyActive
    ? steady.phase === 'needs-review' || steady.phase === 'error'
    : state.phase === 'needs-review' || state.phase === 'error';
  const steadyReviewAvailable = steadyActive && steady.phase === 'needs-review' && steady.review?.reason === 'both-changed';
  const badge = manualSync.manualBusy
    ? 'Syncing'
    : steadyActive
      ? steady.phase === 'synced' ? 'Synced'
        : steady.phase === 'paused' ? 'Paused'
          : steady.phase === 'offline' ? 'Offline'
            : steady.phase === 'needs-review' || steady.phase === 'error' ? 'Needs review'
              : steady.phase === 'checking' ? 'Checking'
                : steady.phase === 'syncing' ? 'Syncing'
                  : 'Set up'
      : state.phase === 'needs-review' || state.phase === 'error' ? 'Needs review'
        : state.phase === 'checking' ? 'Checking'
          : state.phase === 'syncing' ? 'Syncing'
            : state.phase === 'synced' ? 'Synced'
              : 'Set up';

  const localCount = Object.keys(localPreview.records).length;
  const feedback = manualSync.manualBusy
    ? 'Syncing watched movies & episodes with Orion Cloud.'
    : steadyActive
    ? steady.phase === 'synced'
      ? `${itemLabel(steady.count ?? localCount)} synced with Orion Cloud.`
      : steady.phase === 'paused'
        ? 'Automatic sync is paused. Local Watched changes stay on this device until you choose Sync now or turn Auto Sync back on.'
        : steady.phase === 'offline'
          ? 'Watched is waiting for a connection. Your local Watched state stays available on this device.'
          : steady.phase === 'checking'
            ? 'Checking Watched with Orion Cloud.'
            : steady.phase === 'syncing'
              ? 'Syncing Watched with Orion Cloud.'
              : steady.phase === 'needs-review'
                ? 'Watched needs your attention before Orion can sync it safely. Orion did not choose a winner or overwrite either copy.'
                : steady.phase === 'error'
                  ? 'Orion could not sync Watched right now. Your local Watched state was left available.'
                  : null
    : state.phase === 'ready' ? readyCopy(state.inspection)
      : state.phase === 'syncing' ? 'Syncing Watched with Orion Cloud. Orion will only mark this complete after both copies agree.'
        : state.phase === 'synced' ? `${itemLabel(state.count)} synced across this device and Orion Cloud.`
          : state.phase === 'needs-review' || state.phase === 'error' ? state.message : null;

  const actionLabel = manualSync.manualBusy
    ? 'Syncing...'
    : busy
      ? steadyActive ? (steady.phase === 'syncing' ? 'Syncing...' : 'Checking...') : (state.phase === 'syncing' ? 'Syncing...' : 'Checking...')
      : steadyActive
        ? 'Sync now'
        : 'Check Watched';
  const showFeedback = Boolean(feedback) && (!steadyActive || needsReview);
  const showAction = steadyActive
    ? !autoSyncEnabled && !needsReview
    : state.phase !== 'ready';

  return (
    <>
      <AccountSyncDomainRow
        icon="eye-outline"
        title="Watched"
        summary={itemLabel(localCount)}
        status={badge}
        autoSync={steadyActive ? {
          value: autoSyncEnabled,
          disabled: !syncPolicy.ready,
          accessibilityLabel: 'Auto sync Watched',
          accessibilityHint: 'Turns automatic Watched sync through Orion Cloud on or off without deleting local or cloud data',
          onValueChange: (enabled) => syncPolicy.setAutomatic('watched', enabled),
        } : undefined}
        action={showAction ? {
          label: actionLabel,
          accessibilityLabel: steadyActive ? actionLabel : 'Check Watched',
          accessibilityHint: steadyActive
            ? 'Runs one safe Watched sync while automatic sync is paused'
            : 'Checks this device and Orion Cloud before first Watched sync',
          disabled: busy,
          busy,
          onPress: () => {
            if (steadyActive) {
              manualSync.runManualSync();
            } else {
              void checkEnrollment();
            }
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

        {!steadyActive && state.phase === 'ready' && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Confirm Watched sync"
            disabled={busy}
            onPress={() => void confirmEnrollment()}
            style={({ pressed }) => [styles.button, { backgroundColor: theme.accentSoft, borderColor: theme.accent }, pressed && styles.pressed]}
          >
            <Ionicons name="cloud-upload-outline" size={17} color={theme.accent} />
            <Text style={[styles.buttonText, { color: theme.accent }]}>Confirm sync</Text>
          </Pressable>
        )}

        {steadyReviewAvailable && (
          <View style={styles.reviewActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Keep this device Watched state"
              onPress={() => setReviewResolution('device')}
              style={({ pressed }) => [styles.button, { backgroundColor: theme.elevated, borderColor: theme.border }, pressed && styles.pressed]}
            >
              <Text style={[styles.buttonText, { color: theme.text }]}>Keep this device</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Keep Orion Cloud Watched state"
              onPress={() => setReviewResolution('cloud')}
              style={({ pressed }) => [styles.button, { backgroundColor: theme.elevated, borderColor: theme.border }, pressed && styles.pressed]}
            >
              <Text style={[styles.buttonText, { color: theme.text }]}>Keep Orion Cloud</Text>
            </Pressable>
          </View>
        )}

        {localPreview.rejectedKeys.length > 0 && (
          <Text style={[styles.message, { color: theme.warning }]}>{itemLabel(localPreview.rejectedKeys.length)} cannot sync safely yet.</Text>
        )}
      </AccountSyncDomainRow>

      <OrionDialog
        visible={reviewResolution != null}
        title="Resolve Watched conflict?"
        message={reviewResolution === 'device'
          ? `Keep this device's ${steady.review?.localCount ?? localCount} watched movies and episodes and replace the current Orion Cloud Watched state?`
          : `Keep Orion Cloud's ${steady.review?.cloudCount ?? 0} watched movies and episodes and replace this device Watched state?`}
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
  reviewActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  button: { minHeight: 44, borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  buttonText: { fontSize: fontSizes.xs, fontWeight: '800' },
  pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
});
