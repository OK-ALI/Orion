import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  executePortableWatchedOneShotSyncV1,
  inspectPortableWatchedOneShotSyncV1,
  type PortableWatchedOneShotInspectionV1,
} from '@orion/shared/api';
import { PORTABLE_PROFILE_PRIMARY_KEY } from '@orion/shared/types';
import { fontSizes, radii, spacing } from '@orion/shared/tokens';
import { useLibrary } from '../../context/LibraryContext';
import { useOrionTheme } from '../../context/ThemeContext';
import { GoogleDriveCloudProfileStore } from '../account/googleDriveCloudProfileStore';
import {
  loadWatchedSyncCheckpointV1,
  saveWatchedSyncCheckpointV1,
} from '../account/watchedSyncCheckpoint';
import { buildMobilePortableWatchedPreviewV1 } from '../library/viewingStatePortableAdapter';
import { buildLocalMobileWatchedSnapshotV1 } from '../library/watchedSyncAdapter';

type UiState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'ready'; inspection: Extract<PortableWatchedOneShotInspectionV1, { state: 'ready' }> }
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

function readyCopy(inspection: Extract<PortableWatchedOneShotInspectionV1, { state: 'ready' }>): string {
  if (inspection.action === 'pull') {
    return `Cloud has ${itemLabel(inspection.targetCount)} ready to restore to this device. Nothing changes until you confirm.`;
  }
  if (inspection.action === 'merge') {
    return `Orion can safely combine this device and cloud into ${itemLabel(inspection.targetCount)} without deleting either side.`;
  }
  if (inspection.action === 'create') {
    return `No Orion cloud profile was found. Orion can create it with ${itemLabel(inspection.targetCount)} after you confirm.`;
  }
  return `This device can update the cloud to ${itemLabel(inspection.targetCount)}. Nothing changes until you confirm.`;
}

function reviewMessage(reason: string, conflictKeys: string[] = []): string {
  if (reason === 'tombstone-conflict') {
    return `${itemLabel(conflictKeys.length)} on this device were previously removed in the cloud. Orion will not resurrect them automatically.`;
  }
  if (reason === 'both-changed') {
    return 'Watched changed on this device and in the cloud since the last verified sync. Orion stopped instead of guessing which side should win.';
  }
  if (reason === 'profile-identity-mismatch' || reason === 'checkpoint-identity-mismatch') {
    return 'This Watched sync state belongs to a different Orion profile. Nothing was changed.';
  }
  if (reason === 'profile-missing-after-checkpoint') {
    return 'The previously verified cloud profile is missing. Orion will not recreate it automatically.';
  }
  if (reason === 'local-invalid' || reason === 'cloud-invalid') {
    return 'Watched contains data this Orion version cannot reconcile safely. Nothing was changed.';
  }
  return 'The verified Watched checkpoint no longer matches both copies. Orion stopped without overwriting either side.';
}

export function WatchedSyncControl({ accountEmail, profileId }: WatchedSyncControlProps) {
  const { theme } = useOrionTheme();
  const { watched, replaceWatchedFromSync } = useLibrary();
  const watchedRef = useRef(watched);
  watchedRef.current = watched;
  const localPreview = useMemo(() => buildMobilePortableWatchedPreviewV1(watched), [watched]);
  const [state, setState] = useState<UiState>({ phase: 'idle' });
  const busyRef = useRef(false);

  const readLocalPreview = () => buildMobilePortableWatchedPreviewV1(watchedRef.current);
  const applyLocalPreview = (preview: ReturnType<typeof buildMobilePortableWatchedPreviewV1>) => {
    const snapshot = buildLocalMobileWatchedSnapshotV1(preview, watchedRef.current);
    replaceWatchedFromSync(snapshot);
    watchedRef.current = snapshot;
  };

  const check = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setState({ phase: 'checking' });
    try {
      const store = new GoogleDriveCloudProfileStore(accountEmail);
      const checkpoint = loadWatchedSyncCheckpointV1(profileId);
      const result = await inspectPortableWatchedOneShotSyncV1({
        store,
        profileKey: PORTABLE_PROFILE_PRIMARY_KEY,
        profileId,
        localPreview: readLocalPreview(),
        checkpoint,
      });
      if (result.state === 'aligned') {
        saveWatchedSyncCheckpointV1(result.checkpoint);
        setState({ phase: 'synced', count: result.localCount, action: 'aligned' });
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

  const sync = async () => {
    if (busyRef.current || state.phase !== 'ready') return;
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
        checkpoint: loadWatchedSyncCheckpointV1(profileId),
        readLocalPreview,
        applyLocalPreview,
      });
      if (result.state === 'verified') {
        saveWatchedSyncCheckpointV1(result.checkpoint);
        setState({ phase: 'synced', count: result.count, action: result.action });
      } else {
        const message = result.reason === 'cloud-conflict' || result.reason === 'cloud-changed-before-pull'
          ? 'The cloud profile changed while Watched was syncing. Orion did not overwrite it. Check again.'
          : result.reason === 'local-changed-during-sync'
            ? `Watched changed on this device while sync was running.${result.cloudWasWritten ? ' The verified cloud write is preserved, but Orion did not create a checkpoint.' : ''} Check again.`
            : result.reason === 'cloud-verification-failed'
              ? 'The cloud write completed, but Orion could not verify the new copy within the safety window. Local Watched was left untouched and no checkpoint was created. Check Watched again before retrying.'
              : 'Watched changed after the readiness check. Orion stopped before using the stale plan. Check again.';
        setState({ phase: 'needs-review', message });
      }
    } catch {
      setState({ phase: 'error', message: 'Watched sync could not finish safely. Orion did not mark the operation as verified.' });
    } finally {
      busyRef.current = false;
    }
  };

  const busy = state.phase === 'checking' || state.phase === 'syncing';
  const status = state.phase === 'synced'
    ? 'Verified'
    : state.phase === 'ready'
      ? 'Ready'
      : state.phase === 'needs-review'
        ? 'Review'
        : state.phase === 'checking'
          ? 'Checking'
          : state.phase === 'syncing'
            ? 'Syncing'
            : state.phase === 'error'
              ? 'Error'
              : 'Manual';

  return (
    <View style={[styles.block, { borderTopColor: theme.border }]}>
      <View style={styles.heading}>
        <View style={[styles.icon, { backgroundColor: theme.accentSoft }]}>
          <Ionicons name="eye-outline" size={20} color={theme.accent} />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: theme.text }]}>Watched sync</Text>
          <Text style={[styles.description, { color: theme.textSecondary }]}>Exact movies and episodes only. This is a manual one-shot sync; automatic Watched sync is not enabled.</Text>
        </View>
        <View style={[styles.chip, { backgroundColor: theme.surfaceHover, borderColor: state.phase === 'needs-review' ? theme.warning : theme.border }]}>
          <Text style={[styles.chipText, { color: state.phase === 'needs-review' ? theme.warning : theme.textMuted }]}>{status}</Text>
        </View>
      </View>

      {state.phase === 'ready' && <Text style={[styles.message, { color: theme.textSecondary }]}>{readyCopy(state.inspection)}</Text>}
      {state.phase === 'syncing' && <Text style={[styles.message, { color: theme.textSecondary }]}>Verifying local Watched and the cloud copy. Orion will only mark this complete after both agree.</Text>}
      {state.phase === 'synced' && <Text style={[styles.message, { color: theme.accent }]}>{itemLabel(state.count)} verified across this device and Orion cloud.</Text>}
      {(state.phase === 'needs-review' || state.phase === 'error') && (
        <Text accessibilityRole="alert" style={[styles.message, { color: state.phase === 'needs-review' ? theme.warning : theme.textSecondary }]}>{state.message}</Text>
      )}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Check Watched sync"
          disabled={busy}
          onPress={() => void check()}
          style={({ pressed }) => [styles.button, { backgroundColor: theme.elevated, borderColor: theme.border }, pressed && styles.pressed, busy && styles.disabled]}
        >
          {busy ? <ActivityIndicator color={theme.text} /> : <Ionicons name="refresh-outline" size={17} color={theme.text} />}
          <Text style={[styles.buttonText, { color: theme.text }]}>{state.phase === 'checking' ? 'Checking...' : state.phase === 'syncing' ? 'Syncing...' : 'Check Watched'}</Text>
        </Pressable>
        {state.phase === 'ready' && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Confirm Watched sync"
            disabled={busy}
            onPress={() => void sync()}
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
  message: { fontSize: fontSizes.xs, lineHeight: 18, marginLeft: 52 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginLeft: 52 },
  button: { minHeight: 42, borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  buttonText: { fontSize: fontSizes.xs, fontWeight: '800' },
  pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.6 },
});
