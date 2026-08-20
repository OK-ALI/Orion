import type { CloudProfileStore } from './cloudProfileStore';
import {
  buildPortableViewingActivityStateFromProfileV1,
  buildPortableViewingActivitySteadyStateProfileV1,
  mergePortableViewingActivityRecordsV1,
  portableViewingActivityNamespaceSignatureV1,
  portableViewingActivityTruthSignatureV1,
  PORTABLE_VIEWING_ACTIVITY_SYNC_CHECKPOINT_SCHEMA_VERSION,
  type PortableViewingActivityPreviewV1,
  type PortableViewingActivityStateV1,
  type PortableViewingActivitySyncCheckpointV1,
} from '../types/portableViewingActivity';
import {
  createPortableProfileV3,
  type PortableProfileV3,
  type PortableRecordNamespaceV3,
} from '../types/portableProfile';

const DEFAULT_READ_BACK_DELAYS_MS = [0, 250, 750, 1500] as const;

export type PortableViewingActivitySteadyStateReconcileV1 =
  | { state: 'unenrolled' }
  | {
      state: 'verified';
      action: 'aligned' | 'push' | 'merge' | 'pull';
      count: { history: number; progress: number };
      checkpoint: PortableViewingActivitySyncCheckpointV1;
    }
  | {
      state: 'needs-review';
      reason: string;
      historyConflictKeys: string[];
      progressConflictKeys: string[];
      cloudWasWritten: boolean;
      localCount: { history: number; progress: number };
      cloudCount: { history: number; progress: number };
    }
  | { state: 'cancelled' };

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  const source = value as Record<string, unknown>;
  const normalized: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort()) normalized[key] = canonicalize(source[key]);
  return normalized;
}

function semanticallyEqual(left: PortableProfileV3, right: PortableProfileV3): boolean {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function unrelatedNamespacesMatch(expected: PortableProfileV3, actual: PortableProfileV3): boolean {
  const strip = (profile: PortableProfileV3) => Object.fromEntries(
    Object.entries(profile.namespaces).filter(([name]) => name !== 'history' && name !== 'progress'),
  );
  return JSON.stringify(canonicalize(strip(expected))) === JSON.stringify(canonicalize(strip(actual)));
}

function namespace(profile: PortableProfileV3, name: 'history' | 'progress'): PortableRecordNamespaceV3 {
  const value = profile.namespaces[name] as PortableRecordNamespaceV3 | undefined;
  return value ?? { schemaVersion: 1, revision: 0, updatedAt: profile.updatedAt, records: {} };
}

function count(preview: Pick<PortableViewingActivityPreviewV1, 'history' | 'progress'>) {
  return { history: Object.keys(preview.history).length, progress: Object.keys(preview.progress).length };
}

/**
 * Presentation metadata is portable for display quality, but it is not verified
 * playback truth. Mobile may enrich posters/titles after a checkpoint without a
 * new playback event. Treat those refinements as aligned when the canonical
 * event facts are unchanged, while keeping exact-time playback contradictions
 * fail-closed.
 */
function verifiedEventTruthSignature(
  preview: Pick<PortableViewingActivityPreviewV1, 'history' | 'progress'>,
): string {
  return JSON.stringify(canonicalize({
    history: Object.keys(preview.history).sort().map((key) => [key, {
      lastPlayedAt: preview.history[key]!.lastPlayedAt,
      verified: preview.history[key]!.verified,
    }]),
    progress: Object.keys(preview.progress).sort().map((key) => [key, {
      currentTime: preview.progress[key]!.currentTime,
      duration: preview.progress[key]!.duration,
      percent: preview.progress[key]!.percent,
      startedAt: preview.progress[key]!.startedAt,
      lastPlayedAt: preview.progress[key]!.lastPlayedAt,
      verified: preview.progress[key]!.verified,
    }]),
  }));
}

function checkpointFor(
  profileId: string,
  localTruthSignature: string,
  cloudNamespaceSignature: string,
): PortableViewingActivitySyncCheckpointV1 {
  return {
    schemaVersion: PORTABLE_VIEWING_ACTIVITY_SYNC_CHECKPOINT_SCHEMA_VERSION,
    profileId,
    localTruthSignature,
    cloudNamespaceSignature,
    verifiedAt: Date.now(),
  };
}

function targetFromMergedRecords(
  remote: PortableProfileV3,
  historyRecords: PortableRecordNamespaceV3['records'],
  progressRecords: PortableRecordNamespaceV3['records'],
): PortableProfileV3 {
  const remoteHistory = namespace(remote, 'history');
  const remoteProgress = namespace(remote, 'progress');
  const sameHistory = JSON.stringify(canonicalize(historyRecords)) === JSON.stringify(canonicalize(remoteHistory.records));
  const sameProgress = JSON.stringify(canonicalize(progressRecords)) === JSON.stringify(canonicalize(remoteProgress.records));
  if (sameHistory && sameProgress) return remote;
  const now = Math.max(Date.now(), remote.updatedAt + 1, remoteHistory.updatedAt + 1, remoteProgress.updatedAt + 1);
  return {
    ...remote,
    revision: remote.revision + 1,
    updatedAt: now,
    namespaces: {
      ...remote.namespaces,
      history: sameHistory
        ? remoteHistory
        : { schemaVersion: 1, revision: remoteHistory.revision + 1, updatedAt: now, records: historyRecords },
      progress: sameProgress
        ? remoteProgress
        : { schemaVersion: 1, revision: remoteProgress.revision + 1, updatedAt: now, records: progressRecords },
    },
  };
}

async function wait(delayMs: number): Promise<void> {
  if (delayMs <= 0) return;
  await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}

async function canProceed(callback?: () => boolean | Promise<boolean>): Promise<boolean> {
  return callback ? !!(await callback()) : true;
}

export async function reconcilePortableViewingActivitySteadyStateSyncV1(input: {
  store: CloudProfileStore;
  profileKey: string;
  profileId: string;
  updatedBy: string;
  checkpoint: PortableViewingActivitySyncCheckpointV1 | null;
  readLocalPreview: () => PortableViewingActivityPreviewV1 | Promise<PortableViewingActivityPreviewV1>;
  applyLocalState: (state: PortableViewingActivityStateV1) => void | Promise<void>;
  readBackDelaysMs?: readonly number[];
  shouldProceed?: () => boolean | Promise<boolean>;
  onExecutionStart?: (action: 'push' | 'merge' | 'pull') => void;
}): Promise<PortableViewingActivitySteadyStateReconcileV1> {
  if (!input.checkpoint) return { state: 'unenrolled' };
  if (input.checkpoint.profileId !== input.profileId) {
    return {
      state: 'needs-review', reason: 'checkpoint-profile-mismatch', historyConflictKeys: [], progressConflictKeys: [],
      cloudWasWritten: false, localCount: { history: 0, progress: 0 }, cloudCount: { history: 0, progress: 0 },
    };
  }

  const startLocal = await input.readLocalPreview();
  const localCount = count(startLocal);
  if (startLocal.rejected.history.length || startLocal.rejected.progress.length) {
    return {
      state: 'needs-review', reason: 'local-invalid', historyConflictKeys: [...startLocal.rejected.history],
      progressConflictKeys: [...startLocal.rejected.progress], cloudWasWritten: false, localCount,
      cloudCount: { history: 0, progress: 0 },
    };
  }
  const startLocalSignature = portableViewingActivityTruthSignatureV1(startLocal);
  const remote = await input.store.read(input.profileKey);
  if (remote.state === 'missing') {
    return {
      state: 'needs-review', reason: 'profile-missing-after-checkpoint', historyConflictKeys: [], progressConflictKeys: [],
      cloudWasWritten: false, localCount, cloudCount: { history: 0, progress: 0 },
    };
  }
  if (remote.profile.profileId !== input.profileId) {
    return {
      state: 'needs-review', reason: 'profile-identity-mismatch', historyConflictKeys: [], progressConflictKeys: [],
      cloudWasWritten: false, localCount, cloudCount: { history: 0, progress: 0 },
    };
  }
  const cloudState = buildPortableViewingActivityStateFromProfileV1(remote.profile);
  const cloudNamespaceSignature = portableViewingActivityNamespaceSignatureV1(remote.profile);
  if (!cloudState || !cloudNamespaceSignature) {
    return {
      state: 'needs-review', reason: 'cloud-invalid', historyConflictKeys: [], progressConflictKeys: [], cloudWasWritten: false,
      localCount, cloudCount: { history: 0, progress: 0 },
    };
  }
  const cloudCount = count(cloudState);
  const cloudTruthSignature = portableViewingActivityTruthSignatureV1(cloudState);
  const sameVerifiedEventTruth = verifiedEventTruthSignature(startLocal) === verifiedEventTruthSignature(cloudState);
  const localChanged = startLocalSignature !== input.checkpoint.localTruthSignature;
  const cloudChanged = cloudNamespaceSignature !== input.checkpoint.cloudNamespaceSignature;

  if (!localChanged && !cloudChanged) {
    if (cloudTruthSignature !== startLocalSignature && !sameVerifiedEventTruth) {
      return {
        state: 'needs-review', reason: 'checkpoint-truth-mismatch', historyConflictKeys: [], progressConflictKeys: [],
        cloudWasWritten: false, localCount, cloudCount,
      };
    }
    return {
      state: 'verified', action: 'aligned', count: localCount,
      checkpoint: checkpointFor(input.profileId, startLocalSignature, cloudNamespaceSignature),
    };
  }

  if (sameVerifiedEventTruth) {
    return {
      state: 'verified', action: 'aligned', count: localCount,
      checkpoint: checkpointFor(input.profileId, startLocalSignature, cloudNamespaceSignature),
    };
  }

  if (!(await canProceed(input.shouldProceed))) return { state: 'cancelled' };

  if (!localChanged && cloudChanged) {
    input.onExecutionStart?.('pull');
    const stable = await input.store.read(input.profileKey);
    if (
      stable.state !== 'found'
      || stable.profile.profileId !== input.profileId
      || stable.revisionTag !== remote.revisionTag
      || portableViewingActivityNamespaceSignatureV1(stable.profile) !== cloudNamespaceSignature
    ) {
      return {
        state: 'needs-review', reason: 'cloud-changed-before-pull', historyConflictKeys: [], progressConflictKeys: [],
        cloudWasWritten: false, localCount, cloudCount,
      };
    }
    const latestLocal = await input.readLocalPreview();
    if (portableViewingActivityTruthSignatureV1(latestLocal) !== startLocalSignature) {
      return {
        state: 'needs-review', reason: 'local-changed-during-sync', historyConflictKeys: [], progressConflictKeys: [],
        cloudWasWritten: false, localCount, cloudCount,
      };
    }
    if (!(await canProceed(input.shouldProceed))) return { state: 'cancelled' };
    try {
      await input.applyLocalState(cloudState);
    } catch {
      return {
        state: 'needs-review', reason: 'local-apply-failed', historyConflictKeys: [], progressConflictKeys: [],
        cloudWasWritten: false, localCount, cloudCount,
      };
    }
    const applied = await input.readLocalPreview();
    if (portableViewingActivityTruthSignatureV1(applied) !== cloudTruthSignature) {
      return {
        state: 'needs-review', reason: 'local-apply-failed', historyConflictKeys: [], progressConflictKeys: [],
        cloudWasWritten: false, localCount, cloudCount,
      };
    }
    return {
      state: 'verified', action: 'pull', count: cloudCount,
      checkpoint: checkpointFor(input.profileId, cloudTruthSignature, cloudNamespaceSignature),
    };
  }

  let action: 'push' | 'merge' = 'push';
  let candidate: PortableProfileV3;
  if (localChanged && cloudChanged) {
    action = 'merge';
    const ambiguousHistory = Object.keys(cloudState.history).filter((key) => !Object.prototype.hasOwnProperty.call(startLocal.history, key));
    const ambiguousProgress = Object.keys(cloudState.progress).filter((key) => !Object.prototype.hasOwnProperty.call(startLocal.progress, key));
    if (ambiguousHistory.length || ambiguousProgress.length) {
      return {
        state: 'needs-review', reason: 'two-sided-removal-ambiguity', historyConflictKeys: ambiguousHistory,
        progressConflictKeys: ambiguousProgress, cloudWasWritten: false, localCount, cloudCount,
      };
    }
    const localProfile = buildPortableViewingActivitySteadyStateProfileV1(
      createPortableProfileV3(input.profileId, 1), startLocal,
      { profileId: input.profileId, updatedBy: input.updatedBy, now: Math.max(Date.now(), 2) },
    );
    const merged = mergePortableViewingActivityRecordsV1(remote.profile, localProfile);
    if (merged.state === 'needs-review') {
      return {
        state: 'needs-review', reason: 'event-time-conflict', historyConflictKeys: merged.historyConflictKeys,
        progressConflictKeys: merged.progressConflictKeys, cloudWasWritten: false, localCount, cloudCount,
      };
    }
    candidate = targetFromMergedRecords(remote.profile, merged.historyRecords, merged.progressRecords);
  } else {
    try {
      candidate = buildPortableViewingActivitySteadyStateProfileV1(remote.profile, startLocal, {
        profileId: input.profileId,
        updatedBy: input.updatedBy,
      });
    } catch {
      return {
        state: 'needs-review', reason: 'local-update-unsafe', historyConflictKeys: [], progressConflictKeys: [],
        cloudWasWritten: false, localCount, cloudCount,
      };
    }
  }

  input.onExecutionStart?.(action);
  const latestBeforeWrite = await input.readLocalPreview();
  if (portableViewingActivityTruthSignatureV1(latestBeforeWrite) !== startLocalSignature) {
    return {
      state: 'needs-review', reason: 'local-changed-during-sync', historyConflictKeys: [], progressConflictKeys: [],
      cloudWasWritten: false, localCount, cloudCount,
    };
  }
  if (!(await canProceed(input.shouldProceed))) return { state: 'cancelled' };

  let verifiedProfile = remote.profile;
  let verifiedNamespaceSignature = cloudNamespaceSignature;
  let cloudWasWritten = false;
  if (!semanticallyEqual(candidate, remote.profile)) {
    const write = await input.store.write(input.profileKey, { profile: candidate, expectedRevisionTag: remote.revisionTag });
    if (write.state === 'conflict') {
      return {
        state: 'needs-review', reason: 'cloud-conflict', historyConflictKeys: [], progressConflictKeys: [],
        cloudWasWritten: false, localCount, cloudCount,
      };
    }
    cloudWasWritten = true;
    const candidateSignature = portableViewingActivityNamespaceSignatureV1(candidate);
    if (!candidateSignature) throw new Error('Portable Viewing Activity steady-state candidate is invalid.');
    let verified = null as null | Extract<Awaited<ReturnType<CloudProfileStore['read']>>, { state: 'found' }>;
    for (const delayMs of input.readBackDelaysMs || DEFAULT_READ_BACK_DELAYS_MS) {
      await wait(delayMs);
      const readBack = await input.store.read(input.profileKey);
      if (
        readBack.state === 'found'
        && readBack.profile.profileId === input.profileId
        && portableViewingActivityNamespaceSignatureV1(readBack.profile) === candidateSignature
        && unrelatedNamespacesMatch(candidate, readBack.profile)
        && semanticallyEqual(candidate, readBack.profile)
      ) {
        verified = readBack;
        break;
      }
    }
    if (!verified) {
      return {
        state: 'needs-review', reason: 'cloud-verification-failed', historyConflictKeys: [], progressConflictKeys: [],
        cloudWasWritten: true, localCount, cloudCount,
      };
    }
    verifiedProfile = verified.profile;
    verifiedNamespaceSignature = candidateSignature;
  }

  const latestLocal = await input.readLocalPreview();
  if (portableViewingActivityTruthSignatureV1(latestLocal) !== startLocalSignature) {
    return {
      state: 'needs-review', reason: 'local-changed-during-sync', historyConflictKeys: [], progressConflictKeys: [],
      cloudWasWritten, localCount, cloudCount,
    };
  }
  if (!(await canProceed(input.shouldProceed))) return { state: 'cancelled' };

  const targetState = buildPortableViewingActivityStateFromProfileV1(verifiedProfile);
  if (!targetState) {
    return {
      state: 'needs-review', reason: 'cloud-verification-failed', historyConflictKeys: [], progressConflictKeys: [],
      cloudWasWritten, localCount, cloudCount,
    };
  }
  const targetTruthSignature = portableViewingActivityTruthSignatureV1(targetState);
  if (targetTruthSignature !== startLocalSignature) {
    try {
      await input.applyLocalState(targetState);
    } catch {
      return {
        state: 'needs-review', reason: 'local-apply-failed', historyConflictKeys: [], progressConflictKeys: [],
        cloudWasWritten, localCount, cloudCount,
      };
    }
  }
  const applied = await input.readLocalPreview();
  if (portableViewingActivityTruthSignatureV1(applied) !== targetTruthSignature) {
    return {
      state: 'needs-review', reason: 'local-apply-failed', historyConflictKeys: [], progressConflictKeys: [],
      cloudWasWritten, localCount, cloudCount,
    };
  }

  return {
    state: 'verified', action, count: count(targetState),
    checkpoint: checkpointFor(input.profileId, targetTruthSignature, verifiedNamespaceSignature),
  };
}
