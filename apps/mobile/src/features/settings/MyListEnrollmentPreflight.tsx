import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
import { AccountSyncDomainRow } from './AccountSyncDomainRow';
import { useManualSyncPresentation } from './useManualSyncPresentation';

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
  return `${count} title${count === 1 ? '' : 's'}`;
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
  const manualSync = useManualSyncPresentation(steady.refresh);
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
  const [reviewResolution, setReviewResolution] = useState<'device' | 'cloud' | null>(null);
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
          message: 'This Orion Cloud data belongs to a different Orion profile. Sync is blocked and nothing was changed.',
        });
        return;
      }

      const myList = inspectPortableMyListV1(remote.profile);
      if (myList.state === 'invalid') {
        setState({
          phase: 'needs-review',
          message: 'My List in Orion Cloud contains data this version of Orion cannot safely sync. Nothing was changed.',
        });
        return;
      }

      if (portableMyListActiveMatchesPreviewV1(remote.profile, preview)) {
        const cloudNamespaceSignature = portableMyListNamespaceSignatureV1(remote.profile);
        if (!cloudNamespaceSignature) {
          setState({
            phase: 'needs-review',
            message: 'My List in Orion Cloud cannot be verified safely by this Orion version. Nothing was changed.',
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
        message: 'My List on this device and in Orion Cloud both contain different saved changes. Orion will not merge or overwrite either copy automatically.',
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
            message: 'Orion Cloud changed after the readiness check. Orion stopped before overwriting anything. Check readiness again.',
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
            message: 'Orion Cloud changed after the readiness check. Orion stopped before overwriting anything. Check readiness again.',
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
          message: 'My List changed while Orion was starting sync. Orion stopped before updating Orion Cloud. Check readiness again.',
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
          message: 'Orion Cloud changed while Orion was starting sync. Orion did not overwrite it. Check readiness again.',
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
          message: 'Orion could not verify the Orion Cloud copy after syncing. Your local My List was not changed. Check readiness before trying again.',
        });
        return;
      }

      const verifiedNamespaceSignature = portableMyListNamespaceSignatureV1(verify.profile);
      if (!verifiedNamespaceSignature) {
        setState({
          phase: 'needs-review',
          message: 'Orion verified the Orion Cloud update but could not finish a safe My List sync. Check status before continuing.',
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
          message: 'My List changed while Orion was syncing. Orion Cloud has the earlier confirmed copy, while your current local My List was left untouched. Check readiness before continuing.',
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
          message: 'My List changed on this device or in Orion Cloud before restore. Orion stopped without replacing anything.',
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
          message: 'My List in Orion Cloud changed before restore. Orion left this device untouched.',
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
  const engineSyncing = steadyActive ? steady.phase === 'syncing' : state.phase === 'syncing';
  const syncing = engineSyncing || (steadyActive && !autoSyncEnabled && manualSync.manualBusy);
  const synced = steadyActive ? steady.phase === 'synced' : state.phase === 'synced';
  const checking = !manualSync.manualBusy && (steadyActive ? steady.phase === 'checking' : state.phase === 'checking');
  const needsReview = steadyActive
    ? steady.phase === 'needs-review' || steady.phase === 'error'
    : state.phase === 'needs-review' || state.phase === 'error';
  const paused = steadyActive && steady.phase === 'paused';
  const offline = steadyActive && steady.phase === 'offline';
  const steadyReviewAvailable = steadyActive && steady.phase === 'needs-review' && steady.review?.reason === 'both-changed';

  const feedback = manualSync.manualBusy
    ? 'Syncing My List with Orion Cloud.'
    : steadyActive
    ? steady.phase === 'synced'
      ? `${itemLabel(localCount)} synced with Orion Cloud.`
      : steady.phase === 'paused'
        ? 'Automatic sync is paused. Local My List changes stay on this device until you choose Sync now or turn Auto Sync back on.'
        : steady.phase === 'offline'
          ? 'My List is waiting for a connection. Your local My List stays available on this device.'
          : steady.phase === 'checking'
            ? 'Checking My List with Orion Cloud.'
            : steady.phase === 'syncing'
              ? 'Syncing My List with Orion Cloud.'
              : steady.phase === 'needs-review'
                ? 'My List needs your attention before Orion can sync it safely. Orion did not merge or overwrite either copy.'
                : steady.phase === 'error'
                  ? 'Orion could not sync My List right now. Your local My List was not changed.'
                  : null
    : readyRestore
      ? `${itemLabel(restoreCloudCount)} ${restoreCloudCount === 1 ? 'is' : 'are'} available in Orion Cloud. This device My List is empty and can be restored without merging.`
      : readyEnroll
        ? `${itemLabel(localCount)} ${localCount === 1 ? 'is' : 'are'} ready to sync. Nothing has been uploaded yet.`
        : state.phase === 'syncing'
          ? 'Syncing My List with Orion Cloud. Your local library outside My List is not being changed.'
          : state.phase === 'synced'
            ? `${itemLabel(localCount)} ${localCount === 1 ? 'is' : 'are'} synced with Orion Cloud.`
            : state.phase === 'needs-review' || state.phase === 'error'
              ? state.message
              : null;

  const statusLabel = syncing
    ? 'Syncing'
    : checking
      ? 'Checking'
      : needsReview
        ? 'Needs review'
        : paused
          ? 'Paused'
          : synced
            ? 'Synced'
            : offline
              ? 'Offline'
              : 'Set up';
  const actionLabel = syncing
    ? 'Syncing...'
    : checking
      ? 'Checking...'
      : steadyActive
        ? 'Sync now'
        : readyRestore
          ? 'Restore My List'
          : readyEnroll
            ? 'Start My List sync'
            : 'Check My List';
  const showFeedback = Boolean(feedback) && (!steadyActive || needsReview);
  const showAction = !steadyActive || (!autoSyncEnabled && !needsReview);

  return (
    <>
      <AccountSyncDomainRow
        icon="list-outline"
        title="My List"
        summary={`${localCount} title${localCount === 1 ? '' : 's'}${preview.rejectedKeys.length > 0 ? `, ${preview.rejectedKeys.length} cannot sync` : ''}`}
        status={statusLabel}
        autoSync={steadyActive ? {
          value: autoSyncEnabled,
          disabled: !syncPolicy.ready,
          accessibilityLabel: 'Auto sync My List',
          accessibilityHint: 'Turns automatic My List sync through Orion Cloud on or off without deleting local or cloud data',
          onValueChange: (enabled) => syncPolicy.setAutomatic('myList', enabled),
        } : undefined}
        action={showAction ? {
          label: actionLabel,
          accessibilityHint: readyRestore
            ? 'Opens a confirmation before restoring the synced My List from Orion Cloud to this empty device list'
            : readyEnroll
              ? 'Opens a confirmation before uploading only My List'
              : steadyActive
                ? 'Runs one safe My List sync while automatic sync is paused'
                : 'Checks this device and Orion Cloud data without changing unrelated library activity',
          disabled: checking || syncing,
          busy: checking || syncing,
          onPress: () => {
            if (ready) {
              setShowSyncDialog(true);
            } else if (steadyActive) {
              manualSync.runManualSync();
            } else {
              void inspectEnrollment();
            }
          },
        } : undefined}
      >
        {showFeedback && (
          <Text
            accessibilityRole={needsReview ? 'alert' : undefined}
            style={[styles.feedback, { color: needsReview ? theme.warning : theme.textSecondary }]}
          >
            {feedback}
          </Text>
        )}

        {steadyReviewAvailable && (
          <View style={styles.reviewActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Keep this device My List"
              onPress={() => setReviewResolution('device')}
              style={({ pressed }) => [styles.reviewButton, { backgroundColor: theme.elevated, borderColor: theme.border }, pressed && styles.pressed]}
            >
              <Text style={[styles.buttonText, { color: theme.text }]}>Keep this device</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Keep Orion Cloud My List"
              onPress={() => setReviewResolution('cloud')}
              style={({ pressed }) => [styles.reviewButton, { backgroundColor: theme.elevated, borderColor: theme.border }, pressed && styles.pressed]}
            >
              <Text style={[styles.buttonText, { color: theme.text }]}>Keep Orion Cloud</Text>
            </Pressable>
          </View>
        )}
      </AccountSyncDomainRow>

      <OrionDialog
        visible={reviewResolution != null}
        title="Resolve My List conflict?"
        message={reviewResolution === 'device'
          ? `Keep the ${steady.review?.localCount ?? localCount} titles on this device and replace the current Orion Cloud My List? Cloud-only changes will no longer be active.`
          : `Keep the ${steady.review?.cloudCount ?? 0} titles in Orion Cloud and replace this device My List? Device-only changes will no longer be active.`}
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

      <OrionDialog
        visible={showSyncDialog}
        title={readyRestore ? 'Restore My List from Orion?' : 'Start My List sync?'}
        message={readyRestore
          ? `Restore ${itemLabel(restoreCloudCount)} from Orion Cloud to this empty My List? This action changes only My List.`
          : `Sync ${itemLabel(localCount)} with Orion Cloud? Orion will upload only My List. Other sync domains are not part of this action.`}
        icon={readyRestore ? 'cloud-download-outline' : 'cloud-upload-outline'}
        onDismiss={() => setShowSyncDialog(false)}
        actions={[
          { label: 'Cancel', role: 'cancel', onPress: () => setShowSyncDialog(false) },
          {
            label: readyRestore ? 'Restore' : 'Sync',
            role: 'primary',
            onPress: () => {
              setShowSyncDialog(false);
              void confirmEnrollment();
            },
          },
        ]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  feedback: { fontSize: fontSizes.xs, lineHeight: 18, fontWeight: '600' },
  reviewActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  reviewButton: { minHeight: 44, borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: fontSizes.xs, fontWeight: '800' },
  pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
});
