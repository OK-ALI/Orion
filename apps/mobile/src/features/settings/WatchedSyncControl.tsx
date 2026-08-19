import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import {
  executePortableWatchedOneShotSyncV1,
  inspectPortableWatchedOneShotSyncV1,
  type PortableWatchedOneShotInspectionV1,
} from '@orion/shared/api';
import { PORTABLE_PROFILE_PRIMARY_KEY } from '@orion/shared/types';
import { useLibrary } from '../../context/LibraryContext';
import { useOrionTheme } from '../../context/ThemeContext';
import { fontSizes, radii, spacing } from '@orion/shared/tokens';
import { GoogleDriveCloudProfileStore } from '../account/googleDriveCloudProfileStore';
import { useOrionSyncPolicy } from '../account/SyncPolicyContext';
import { useWatchedSteadyStateSync } from '../account/WatchedSteadyStateSync';
import {
  loadWatchedSyncCheckpointV1,
  saveWatchedSyncCheckpointV1,
} from '../account/watchedSyncCheckpoint';
import { buildMobilePortableWatchedPreviewV1 } from '../library/viewingStatePortableAdapter';
import { buildLocalMobileWatchedSnapshotV1 } from '../library/watchedSyncAdapter';

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
  return `${count} Watched item${count === 1 ? '' : 's'}`;
}

function readyCopy(result: ReadyInspection): string {
  if (result.action === 'pull') return `Cloud has ${itemLabel(result.targetCount)} ready to restore on this device. Nothing changes until you confirm.`;
  if (result.action === 'merge') return `Orion can safely combine both copies into ${itemLabel(result.targetCount)} without deleting either side. Nothing changes until you confirm.`;
  if (result.action === 'create') return `No portable profile was found. Orion can create one with ${itemLabel(result.targetCount)}. Nothing changes until you confirm.`;
  return `This device can update the cloud to ${itemLabel(result.targetCount)}. Nothing changes until you confirm.`;
}

function reviewMessage(reason: string, conflictKeys: string[]): string {
  if (reason === 'tombstone-conflict') return `${itemLabel(conflictKeys.length)} were previously removed in the cloud. Orion will not resurrect them automatically.`;
  if (reason === 'both-changed') return 'Watched changed on this device and in the cloud since the last verified sync. Orion stopped instead of choosing a winner.';
  if (reason === 'profile-missing-after-checkpoint') return 'The previously verified portable profile is missing. Orion will not recreate it automatically.';
  if (reason.includes('identity')) return 'The portable Watched state does not match this signed-in Google identity.';
  if (reason.includes('invalid')) return 'Watched contains data this Orion version cannot reconcile safely.';
  return 'The verified Watched checkpoint no longer matches both copies. Orion stopped without overwriting either side.';
}

export function WatchedSyncControl({ accountEmail, profileId }: WatchedSyncControlProps) {
  const { theme } = useOrionTheme();
  const { watched, replaceWatchedFromSync } = useLibrary();
  const syncPolicy = useOrionSyncPolicy();
  const steady = useWatchedSteadyStateSync();
  const autoSyncEnabled = syncPolicy.getAutomatic('watched');
  const watchedRef = useRef(watched);
  watchedRef.current = watched;
  const localPreview = useMemo(() => buildMobilePortableWatchedPreviewV1(watched), [watched]);
  const [state, setState] = useState<UiState>({ phase: 'idle' });
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
          ? 'The cloud profile changed while Watched was syncing. Orion did not overwrite it. Check again.'
          : result.reason === 'local-changed-during-sync'
            ? `Watched changed on this device while sync was running.${result.cloudWasWritten ? ' The verified cloud write is preserved, but Orion did not create a checkpoint.' : ''} Check again.`
            : result.reason === 'cloud-verification-failed'
              ? 'The cloud write completed, but Orion could not verify the new copy within the safety window. Local Watched was left untouched and no checkpoint was created.'
              : 'Watched changed after the readiness check. Orion stopped before using the stale plan. Check again.';
        setState({ phase: 'needs-review', message });
      }
    } catch {
      setState({ phase: 'error', message: 'Watched sync could not finish safely. Orion did not mark the operation as verified.' });
    } finally {
      busyRef.current = false;
    }
  };

  const steadyBusy = steady.phase === 'checking' || steady.phase === 'syncing';
  const enrollmentBusy = state.phase === 'checking' || state.phase === 'syncing';
  const busy = steadyActive ? steadyBusy : enrollmentBusy;
  const needsReview = steadyActive ? steady.phase === 'needs-review' : state.phase === 'needs-review';
  const badge = steadyActive
    ? steady.phase === 'synced' ? 'Verified'
      : steady.phase === 'paused' ? 'Paused'
        : steady.phase === 'offline' ? 'Offline'
          : steady.phase === 'needs-review' ? 'Review'
            : steady.phase === 'checking' ? 'Checking'
              : steady.phase === 'syncing' ? 'Syncing'
                : steady.phase === 'error' ? 'Error' : 'Automatic'
    : state.phase === 'ready' ? 'Ready'
      : state.phase === 'needs-review' ? 'Review'
        : state.phase === 'checking' ? 'Checking'
          : state.phase === 'syncing' ? 'Syncing'
            : state.phase === 'synced' ? 'Verified'
              : state.phase === 'error' ? 'Error' : 'Manual';

  const feedback = steadyActive
    ? steady.message
    : state.phase === 'ready' ? readyCopy(state.inspection)
      : state.phase === 'syncing' ? 'Verifying local Watched and the cloud copy. Orion will only mark this complete after both agree.'
        : state.phase === 'synced' ? `${itemLabel(state.count)} verified across this device and Orion cloud.`
          : state.phase === 'needs-review' || state.phase === 'error' ? state.message : null;

  const buttonLabel = busy
    ? steadyActive ? (steady.phase === 'syncing' ? 'Syncing...' : 'Checking...') : (state.phase === 'syncing' ? 'Syncing...' : 'Checking...')
    : steadyActive && !autoSyncEnabled && !needsReview ? 'Sync now'
      : steadyActive ? 'Check sync status'
        : state.phase === 'ready' ? 'Check Watched'
          : 'Check Watched';

  return (
    <View style={[styles.block, { borderTopColor: theme.border }]}>
      <View style={styles.heading}>
        <View style={[styles.icon, { backgroundColor: theme.accentSoft }]}>
          <Ionicons name="eye-outline" size={20} color={theme.accent} />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: theme.text }]}>Watched sync</Text>
          <Text style={[styles.description, { color: theme.textSecondary }]}>Exact movies and episodes only. First enrollment is explicit; after that, sync can run automatically or stay paused on this device.</Text>
        </View>
        <View style={[styles.chip, { backgroundColor: theme.surfaceHover, borderColor: needsReview ? theme.warning : theme.border }]}>
          <Text style={[styles.chipText, { color: needsReview ? theme.warning : theme.textMuted }]}>{badge}</Text>
        </View>
      </View>

      {steadyActive && (
        <View style={[styles.autoSyncRow, { borderColor: theme.border }]}>
          <View style={styles.autoSyncCopy}>
            <Text style={[styles.autoSyncTitle, { color: theme.text }]}>Auto sync</Text>
            <Text style={[styles.autoSyncDescription, { color: theme.textMuted }]}>
              {autoSyncEnabled
                ? 'Watched changes reconcile automatically when Orion is online.'
                : 'Automatic cloud activity is paused. Local changes stay here until you choose Sync now or turn this back on.'}
            </Text>
          </View>
          <Switch
            accessibilityLabel="Auto sync Watched"
            accessibilityHint="Turns automatic Watched cloud synchronization on or off without deleting local or cloud data"
            accessibilityState={{ disabled: !syncPolicy.ready }}
            disabled={!syncPolicy.ready}
            value={autoSyncEnabled}
            onValueChange={(enabled) => syncPolicy.setAutomatic('watched', enabled)}
            trackColor={{ false: theme.surfaceHover, true: theme.accentSoft }}
            thumbColor={autoSyncEnabled ? theme.accent : theme.textMuted}
          />
        </View>
      )}

      {feedback && (
        <Text accessibilityRole={needsReview ? 'alert' : undefined} style={[styles.message, { color: needsReview ? theme.warning : steadyActive && steady.phase === 'synced' ? theme.accent : theme.textSecondary }]}>{feedback}</Text>
      )}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={steadyActive ? buttonLabel : 'Check Watched sync'}
          disabled={busy}
          onPress={() => {
            if (steadyActive) steady.refresh();
            else void checkEnrollment();
          }}
          style={({ pressed }) => [styles.button, { backgroundColor: theme.elevated, borderColor: theme.border }, pressed && styles.pressed, busy && styles.disabled]}
        >
          {busy ? <ActivityIndicator color={theme.text} /> : <Ionicons name="refresh-outline" size={17} color={theme.text} />}
          <Text style={[styles.buttonText, { color: theme.text }]}>{buttonLabel}</Text>
        </Pressable>
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
      </View>
      {localPreview.rejectedKeys.length > 0 && (
        <Text style={[styles.message, { color: theme.warning }]}>{itemLabel(localPreview.rejectedKeys.length)} cannot be represented safely and will block sync.</Text>
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
  autoSyncRow: { marginLeft: 52, borderWidth: 1, borderRadius: radii.lg, padding: spacing[3], flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  autoSyncCopy: { flex: 1, minWidth: 0 },
  autoSyncTitle: { fontSize: fontSizes.xs, fontWeight: '800' },
  autoSyncDescription: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  message: { fontSize: fontSizes.xs, lineHeight: 18, marginLeft: 52 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginLeft: 52 },
  button: { minHeight: 42, borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  buttonText: { fontSize: fontSizes.xs, fontWeight: '800' },
  pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.6 },
});
