import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  buildPortableMyListEnrollmentProfileV1,
  buildPortableMyListPreviewFromProfileV1,
  buildPortableMyListPreviewV1,
  inspectPortableMyListV1,
  portableMyListActiveMatchesPreviewV1,
  portableMyListMatchesPreviewV1,
  portableMyListNamespaceSignatureV1,
  portableMyListPreviewSignatureV1,
  PORTABLE_PROFILE_PRIMARY_KEY,
  type PortableMyListPreviewV1,
  type PortableProfileV3,
} from '@orion/shared/types';
import { fontSizes, radii, spacing } from '@orion/shared/tokens';
import { OrionDialog } from '../../components/OrionDialog';
import { useLibrary } from '../../context/LibraryContext';
import { useOrionTheme } from '../../context/ThemeContext';
import { GoogleDriveCloudProfileStore } from '../account/googleDriveCloudProfileStore';
import { useMyListSteadyStateSync } from '../account/MyListSteadyStateSync';
import { useOrionSyncPolicy } from '../account/SyncPolicyContext';
import { saveMyListSyncCheckpointV1 } from '../account/myListSyncCheckpoint';
import { buildLocalMyListSnapshotV1 } from '../library/myListPortableAdapter';

type ReadyState =
  | { phase: 'ready-create'; baselineRevisionTag: null; previewSignature: string }
  | { phase: 'ready-empty'; baselineRevisionTag: string; previewSignature: string }
  | {
      phase: 'ready-restore';
      baselineRevisionTag: string;
      previewSignature: string;
      cloudNamespaceSignature: string;
      cloudPreview: PortableMyListPreviewV1;
    };

type PreflightState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | ReadyState
  | { phase: 'syncing' }
  | { phase: 'synced' }
  | { phase: 'needs-review'; message: string }
  | { phase: 'error'; message: string };

interface MyListEnrollmentPreflightProps {
  accountEmail: string;
  profileId: string;
}

function itemLabel(count: number): string {
  return `${count} item${count === 1 ? '' : 's'}`;
}

function unrelatedNamespacesMatch(
  expected: PortableProfileV3,
  actual: PortableProfileV3,
): boolean {
  const expectedNames = Object.keys(expected.namespaces).filter((name) => name !== 'myList').sort();
  const actualNames = Object.keys(actual.namespaces).filter((name) => name !== 'myList').sort();
  if (expectedNames.length !== actualNames.length) return false;

  for (let index = 0; index < expectedNames.length; index += 1) {
    const name = expectedNames[index]!;
    if (actualNames[index] !== name) return false;
    if (JSON.stringify(expected.namespaces[name]) !== JSON.stringify(actual.namespaces[name])) {
      return false;
    }
  }
  return true;
}

export function MyListEnrollmentPreflight({
  accountEmail,
  profileId,
}: MyListEnrollmentPreflightProps) {
  const { theme } = useOrionTheme();
  const { saved, savedOrder, replaceMyListFromSync } = useLibrary();
  const steady = useMyListSteadyStateSync();
  const syncPolicy = useOrionSyncPolicy();
  const autoSyncEnabled = syncPolicy.getAutomatic('myList');
  const preview = useMemo(
    () => buildPortableMyListPreviewV1(saved, savedOrder),
    [saved, savedOrder],
  );
  const previewSignature = useMemo(
    () => JSON.stringify({
      orderedKeys: preview.orderedKeys,
      records: preview.records,
      rejectedKeys: preview.rejectedKeys,
    }),
    [preview],
  );
  const [state, setState] = useState<PreflightState>({ phase: 'idle' });
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const operationBusyRef = useRef(false);
  const contextKey = `${accountEmail}\u0000${profileId}\u0000${previewSignature}`;
  const contextKeyRef = useRef(contextKey);
  contextKeyRef.current = contextKey;

  useEffect(() => {
    setShowSyncDialog(false);
    if (!steady.hasCheckpoint) setState({ phase: 'idle' });
  }, [accountEmail, profileId, previewSignature, steady.hasCheckpoint]);

  const inspectEnrollment = async () => {
    if (operationBusyRef.current || state.phase === 'checking' || state.phase === 'syncing') return;

    if (preview.rejectedKeys.length > 0) {
      setState({
        phase: 'needs-review',
        message: `${itemLabel(preview.rejectedKeys.length)} on this device cannot be synced safely yet. Nothing was changed.`,
      });
      return;
    }

    const inspectionContextKey = contextKey;
    operationBusyRef.current = true;
    setState({ phase: 'checking' });
    try {
      const store = new GoogleDriveCloudProfileStore(accountEmail);
      const remote = await store.read(PORTABLE_PROFILE_PRIMARY_KEY);
      if (contextKeyRef.current !== inspectionContextKey) return;

      if (remote.state === 'missing') {
        setState({
          phase: 'ready-create',
          baselineRevisionTag: null,
          previewSignature,
        });
        return;
      }

      if (remote.profile.profileId !== profileId) {
        setState({
          phase: 'needs-review',
          message: 'This cloud data belongs to a different Orion profile. Sync is blocked and nothing was changed.',
        });
        return;
      }

      const myList = inspectPortableMyListV1(remote.profile);
      if (myList.state === 'invalid') {
        setState({
          phase: 'needs-review',
          message: 'Your cloud My List contains data this version of Orion cannot safely sync. Nothing was changed.',
        });
        return;
      }

      if (portableMyListActiveMatchesPreviewV1(remote.profile, preview)) {
        const cloudNamespaceSignature = portableMyListNamespaceSignatureV1(remote.profile);
        if (!cloudNamespaceSignature) {
          setState({
            phase: 'needs-review',
            message: 'Your cloud My List cannot be verified safely by this Orion version. Nothing was changed.',
          });
          return;
        }
        saveMyListSyncCheckpointV1({
          profileId,
          localSignature: portableMyListPreviewSignatureV1(preview),
          cloudNamespaceSignature,
          verifiedAt: Date.now(),
        });
        steady.refresh();
        setState({ phase: 'synced' });
        return;
      }

      if (myList.state === 'empty') {
        setState({
          phase: 'ready-empty',
          baselineRevisionTag: remote.revisionTag,
          previewSignature,
        });
        return;
      }

      const cloudPreview = buildPortableMyListPreviewFromProfileV1(remote.profile);
      const cloudNamespaceSignature = portableMyListNamespaceSignatureV1(remote.profile);
      if (
        preview.orderedKeys.length === 0
        && cloudPreview
        && cloudPreview.orderedKeys.length > 0
        && cloudNamespaceSignature
      ) {
        setState({
          phase: 'ready-restore',
          baselineRevisionTag: remote.revisionTag,
          previewSignature,
          cloudNamespaceSignature,
          cloudPreview,
        });
        return;
      }

      setState({
        phase: 'needs-review',
        message: 'Your cloud My List and this device both contain different saved changes. Orion will not merge or overwrite either copy automatically.',
      });
    } catch {
      if (contextKeyRef.current !== inspectionContextKey) return;
      setState({
        phase: 'error',
        message: 'Orion could not check My List sync right now. Nothing was uploaded or changed.',
      });
    } finally {
      operationBusyRef.current = false;
    }
  };

  // Sync status is cloud-derived, not a persisted local flag. Once this
  // component mounts (including after app relaunch), automatically perform the
  // same read-only inspection used by the manual readiness/status button.
  // This enrollment inspection never uploads anything. The first enrollment
  // write remains behind explicit confirmation; Candidate 3 steady-state sync
  // is handled by the global coordinator after a verified checkpoint exists.
  useEffect(() => {
    if (!steady.hasCheckpoint && autoSyncEnabled) void inspectEnrollment();
  }, [autoSyncEnabled, contextKey, steady.hasCheckpoint]);

  const confirmEnrollment = async () => {
    if (operationBusyRef.current) return;

    const readyState = state.phase === 'ready-create' || state.phase === 'ready-empty'
      ? state
      : null;
    setShowSyncDialog(false);
    if (!readyState) return;

    if (
      readyState.previewSignature !== previewSignature
      || preview.rejectedKeys.length > 0
    ) {
      setState({
        phase: 'needs-review',
        message: 'My List changed after the readiness check. Check sync readiness again before uploading anything.',
      });
      return;
    }

    const confirmedContextKey = contextKey;
    operationBusyRef.current = true;
    setState({ phase: 'syncing' });
    try {
      const store = new GoogleDriveCloudProfileStore(accountEmail);

      // Candidate 2 never trusts the earlier readiness result blindly. Re-read
      // immediately before the write and require the same cloud revision/state.
      const fresh = await store.read(PORTABLE_PROFILE_PRIMARY_KEY);
      if (contextKeyRef.current !== confirmedContextKey) {
        setState({
          phase: 'needs-review',
          message: 'My List changed while Orion was starting sync. Orion stopped before uploading the changed list. Check readiness again.',
        });
        return;
      }

      if (readyState.phase === 'ready-create') {
        if (fresh.state !== 'missing') {
          setState({
            phase: 'needs-review',
            message: 'Your cloud profile changed after the readiness check. Orion stopped before overwriting anything. Check readiness again.',
          });
          return;
        }
      } else {
        if (
          fresh.state !== 'found'
          || fresh.revisionTag !== readyState.baselineRevisionTag
          || fresh.profile.profileId !== profileId
          || inspectPortableMyListV1(fresh.profile).state !== 'empty'
        ) {
          setState({
            phase: 'needs-review',
            message: 'Your cloud profile changed after the readiness check. Orion stopped before overwriting anything. Check readiness again.',
          });
          return;
        }
      }

      const baseProfile = fresh.state === 'found'
        ? fresh.profile
        : null;
      const expectedRevisionTag = fresh.state === 'found'
        ? fresh.revisionTag
        : null;
      const candidate = buildPortableMyListEnrollmentProfileV1(
        baseProfile,
        preview,
        {
          profileId,
          updatedBy: profileId,
        },
      );

      if (contextKeyRef.current !== confirmedContextKey) {
        setState({
          phase: 'needs-review',
          message: 'My List changed while Orion was starting sync. Orion stopped before writing to the cloud. Check readiness again.',
        });
        return;
      }

      const write = await store.write(PORTABLE_PROFILE_PRIMARY_KEY, {
        profile: candidate,
        expectedRevisionTag,
      });
      if (write.state === 'conflict') {
        setState({
          phase: 'needs-review',
          message: 'Your cloud profile changed while Orion was starting sync. Orion did not overwrite it. Check readiness again.',
        });
        return;
      }

      // A successful write is not enough. Candidate 2 only reports Synced after
      // a fresh Drive read proves this exact revision and My List are present.
      const verify = await store.read(PORTABLE_PROFILE_PRIMARY_KEY);
      const verified = verify.state === 'found'
        && verify.revisionTag === write.revisionTag
        && verify.profile.profileId === profileId
        && verify.profile.revision === candidate.revision
        && verify.profile.createdAt === candidate.createdAt
        && verify.profile.updatedAt === candidate.updatedAt
        && unrelatedNamespacesMatch(candidate, verify.profile)
        && portableMyListMatchesPreviewV1(verify.profile, preview);

      if (!verified || verify.state !== 'found') {
        setState({
          phase: 'needs-review',
          message: 'Orion could not verify the cloud copy after writing. Your local My List was not changed. Check readiness before trying again.',
        });
        return;
      }

      const verifiedNamespaceSignature = portableMyListNamespaceSignatureV1(verify.profile);
      if (!verifiedNamespaceSignature) {
        setState({
          phase: 'needs-review',
          message: 'Orion verified the Drive write but could not establish a safe My List sync checkpoint. Check sync status before continuing.',
        });
        return;
      }
      saveMyListSyncCheckpointV1({
        profileId,
        localSignature: portableMyListPreviewSignatureV1(preview),
        cloudNamespaceSignature: verifiedNamespaceSignature,
        verifiedAt: Date.now(),
      });
      steady.refresh();

      if (contextKeyRef.current !== confirmedContextKey) {
        setState({
          phase: 'needs-review',
          message: 'My List changed while Orion was syncing. The cloud has the earlier confirmed copy, while your current local My List was left untouched. Check readiness before continuing.',
        });
        return;
      }

      setState({ phase: 'synced' });
    } catch {
      setState({
        phase: 'error',
        message: 'Orion could not complete and verify My List sync. Your local My List was not changed. Check readiness before trying again.',
      });
    } finally {
      operationBusyRef.current = false;
    }
  };

  const confirmRestore = async () => {
    if (operationBusyRef.current || state.phase !== 'ready-restore') return;
    const readyState = state;
    setShowSyncDialog(false);
    if (
      readyState.previewSignature !== previewSignature
      || preview.orderedKeys.length !== 0
      || preview.rejectedKeys.length > 0
    ) {
      setState({
        phase: 'needs-review',
        message: 'My List changed on this device before restore. Orion stopped without replacing anything.',
      });
      return;
    }

    const restoreContextKey = contextKey;
    operationBusyRef.current = true;
    setState({ phase: 'syncing' });
    try {
      const store = new GoogleDriveCloudProfileStore(accountEmail);
      const fresh = await store.read(PORTABLE_PROFILE_PRIMARY_KEY);
      if (
        contextKeyRef.current !== restoreContextKey
        || fresh.state !== 'found'
        || fresh.revisionTag !== readyState.baselineRevisionTag
        || fresh.profile.profileId !== profileId
      ) {
        setState({
          phase: 'needs-review',
          message: 'My List changed on this device or in the cloud before restore. Orion stopped without replacing anything.',
        });
        return;
      }

      const cloudPreview = buildPortableMyListPreviewFromProfileV1(fresh.profile);
      const cloudNamespaceSignature = portableMyListNamespaceSignatureV1(fresh.profile);
      if (
        !cloudPreview
        || !cloudNamespaceSignature
        || cloudNamespaceSignature !== readyState.cloudNamespaceSignature
        || portableMyListPreviewSignatureV1(cloudPreview) !== portableMyListPreviewSignatureV1(readyState.cloudPreview)
      ) {
        setState({
          phase: 'needs-review',
          message: 'The cloud My List changed before restore. Orion left this device untouched.',
        });
        return;
      }

      const snapshot = buildLocalMyListSnapshotV1(cloudPreview);
      replaceMyListFromSync(snapshot.saved, snapshot.savedOrder);
      saveMyListSyncCheckpointV1({
        profileId,
        localSignature: portableMyListPreviewSignatureV1(cloudPreview),
        cloudNamespaceSignature,
        verifiedAt: Date.now(),
      });
      // LibraryContext state changes will trigger the global coordinator with
      // the restored local signature. Do not refresh synchronously here while
      // React still exposes the pre-restore empty snapshot.
      setState({ phase: 'synced' });
    } catch {
      setState({
        phase: 'error',
        message: 'Orion could not restore My List safely. Your existing local My List was not replaced.',
      });
    } finally {
      operationBusyRef.current = false;
    }
  };

  const localCount = preview.orderedKeys.length;
  const steadyActive = steady.hasCheckpoint;
  const readyEnroll = !steadyActive && (state.phase === 'ready-create' || state.phase === 'ready-empty');
  const readyRestore = !steadyActive && state.phase === 'ready-restore';
  const restoreCloudCount = state.phase === 'ready-restore' ? state.cloudPreview.orderedKeys.length : 0;
  const ready = readyEnroll || readyRestore;
  const syncing = steadyActive ? steady.phase === 'syncing' : state.phase === 'syncing';
  const synced = steadyActive ? steady.phase === 'synced' : state.phase === 'synced';
  const checking = steadyActive ? steady.phase === 'checking' : state.phase === 'checking';
  const needsReview = steadyActive ? steady.phase === 'needs-review' : state.phase === 'needs-review';
  const paused = steadyActive && steady.phase === 'paused';
  const offline = steadyActive && steady.phase === 'offline';

  const feedback = steadyActive
    ? steady.message
    : readyRestore
      ? `${itemLabel(restoreCloudCount)} ${restoreCloudCount === 1 ? 'is' : 'are'} available in your Orion profile. This device My List is empty and can be restored without merging.`
      : readyEnroll
        ? `${itemLabel(localCount)} ${localCount === 1 ? 'is' : 'are'} ready to sync. Nothing has been uploaded yet.`
        : state.phase === 'syncing'
          ? 'Uploading My List and verifying the cloud copy. Your local library is not being changed.'
          : state.phase === 'synced'
            ? `${itemLabel(localCount)} ${localCount === 1 ? 'is' : 'are'} synced with your Orion profile. History, watched status and playback progress stay on this device for now.`
            : state.phase === 'needs-review' || state.phase === 'error'
              ? state.message
              : null;

  const statusLabel = checking
    ? 'Checking'
    : syncing
      ? 'Syncing…'
      : needsReview
        ? 'Needs review'
        : paused
          ? 'Paused'
          : synced
            ? 'Synced'
            : readyRestore
              ? 'Ready to restore'
              : readyEnroll
                ? 'Ready to sync'
                : offline
                  ? 'Not synced'
                  : 'Not synced';
  const statusColor = ready || syncing || synced
    ? theme.accent
    : needsReview
      ? theme.warning
      : theme.textMuted;

  const buttonLabel = checking
    ? 'Checking...'
    : syncing
      ? 'Syncing...'
      : steadyActive && !autoSyncEnabled && !needsReview
        ? 'Sync now'
        : steadyActive
          ? 'Check sync status'
        : readyRestore
          ? 'Restore My List'
          : readyEnroll
            ? 'Start My List sync'
            : synced
              ? 'Check sync status'
              : 'Check sync readiness';

  return (
    <View style={[styles.block, { borderTopColor: theme.border }]}>
      <View style={styles.heading}>
        <Ionicons name="list-outline" size={20} color={theme.textSecondary} />
        <View style={styles.headingCopy}>
          <Text style={[styles.title, { color: theme.text }]}>My List sync</Text>
          <Text style={[styles.copy, { color: theme.textSecondary }]}>
            Sync only My List. After enrollment, choose automatic updates or pause them and sync only when you ask. Other library activity stays on this device for now.
          </Text>
        </View>
        <View
          style={[
            styles.statusChip,
            {
              backgroundColor: theme.surfaceHover,
              borderColor: ready || syncing || synced ? theme.accent : theme.border,
            },
          ]}
        >
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      <Text style={[styles.localSummary, { color: theme.textSecondary }]}>
        {localCount} item{localCount === 1 ? '' : 's'} on this device
        {preview.rejectedKeys.length > 0 ? ` · ${preview.rejectedKeys.length} cannot sync` : ''}
      </Text>

      {steadyActive && (
        <View style={[styles.autoSyncRow, { borderColor: theme.border }]}>
          <View style={styles.autoSyncCopy}>
            <Text style={[styles.autoSyncTitle, { color: theme.text }]}>Auto sync</Text>
            <Text style={[styles.autoSyncDescription, { color: theme.textMuted }]}>
              {autoSyncEnabled
                ? 'My List changes sync automatically when Orion is online.'
                : 'Automatic cloud activity is paused. Local changes stay on this device until you choose Sync now or turn this back on.'}
            </Text>
          </View>
          <Switch
            accessibilityLabel="Auto sync My List"
            accessibilityHint="Turns automatic My List cloud synchronization on or off without deleting local or cloud data"
            accessibilityState={{ disabled: !syncPolicy.ready }}
            disabled={!syncPolicy.ready}
            value={autoSyncEnabled}
            onValueChange={(enabled) => syncPolicy.setAutomatic('myList', enabled)}
            trackColor={{ false: theme.surfaceHover, true: theme.accentSoft }}
            thumbColor={autoSyncEnabled ? theme.accent : theme.textMuted}
          />
        </View>
      )}

      {feedback && (
        <Text
          accessibilityRole="alert"
          style={[
            styles.feedback,
            {
              color: needsReview || state.phase === 'error' || (steadyActive && steady.phase === 'error')
                ? theme.warning
                : theme.textSecondary,
            },
          ]}
        >
          {feedback}
        </Text>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={buttonLabel}
        accessibilityHint={readyRestore
          ? 'Opens a confirmation before restoring the verified cloud My List to this empty device list'
          : readyEnroll
            ? 'Opens a confirmation before uploading only My List'
            : steadyActive && !autoSyncEnabled && !needsReview
              ? 'Runs one safe My List reconciliation even though automatic sync is paused'
              : 'Checks this device and Orion cloud data without changing unrelated library activity'}
        accessibilityState={{ disabled: checking || syncing }}
        disabled={checking || syncing}
        onPress={() => {
          if (ready) {
            setShowSyncDialog(true);
          } else if (steadyActive) {
            steady.refresh();
          } else {
            void inspectEnrollment();
          }
        }}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: theme.elevated, borderColor: theme.border },
          pressed && styles.pressed,
        ]}
      >
        {checking || syncing ? (
          <ActivityIndicator color={theme.text} />
        ) : (
          <Ionicons
            name={readyRestore ? 'cloud-download-outline' : readyEnroll ? 'cloud-upload-outline' : paused ? 'sync-outline' : synced ? 'checkmark-circle-outline' : 'shield-checkmark-outline'}
            size={17}
            color={theme.text}
          />
        )}
        <Text style={[styles.buttonText, { color: theme.text }]}>{buttonLabel}</Text>
      </Pressable>

      <OrionDialog
        visible={showSyncDialog}
        title={readyRestore ? 'Restore My List from Orion?' : 'Start My List sync?'}
        message={readyRestore
          ? `Restore ${itemLabel(restoreCloudCount)} from your Orion profile to this empty My List? History, watched status and playback progress stay on this device for now.`
          : `Sync ${itemLabel(localCount)} with your Orion profile? Orion will upload only My List. History, watched status and playback progress stay on this device for now.`}
        icon={readyRestore ? 'cloud-download-outline' : 'cloud-upload-outline'}
        onDismiss={() => setShowSyncDialog(false)}
        actions={[
          {
            label: 'Cancel',
            role: 'cancel',
            onPress: () => setShowSyncDialog(false),
          },
          {
            label: readyRestore ? 'Restore' : 'Start sync',
            role: 'primary',
            onPress: () => readyRestore ? void confirmRestore() : void confirmEnrollment(),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { borderTopWidth: 1, paddingTop: spacing[4], gap: spacing[3] },
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  headingCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: fontSizes.md, fontWeight: '800' },
  copy: { fontSize: fontSizes.xs, lineHeight: 18, marginTop: 4 },
  statusChip: { minHeight: 30, borderRadius: 15, borderWidth: 1, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  statusText: { fontSize: 10, fontWeight: '900' },
  localSummary: { fontSize: fontSizes.xs, fontWeight: '700', paddingLeft: 32 },
  autoSyncRow: {
    minHeight: 58,
    marginLeft: 32,
    paddingVertical: spacing[2],
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  autoSyncCopy: { flex: 1, minWidth: 0 },
  autoSyncTitle: { fontSize: fontSizes.sm, fontWeight: '800' },
  autoSyncDescription: { fontSize: fontSizes.xs, lineHeight: 17, marginTop: 2 },
  feedback: { fontSize: fontSizes.xs, lineHeight: 18, fontWeight: '600', paddingLeft: 32 },
  button: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    marginLeft: 32,
  },
  buttonText: { fontSize: fontSizes.xs, fontWeight: '800' },
  pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
});
