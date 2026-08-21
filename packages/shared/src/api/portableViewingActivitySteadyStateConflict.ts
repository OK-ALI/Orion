import type { CloudProfileStore } from './cloudProfileStore';
import {
  buildPortableViewingActivityStateFromProfileV1,
  buildPortableViewingActivitySteadyStateProfileV1,
  portableViewingActivityNamespaceSignatureV1,
  portableViewingActivityTruthSignatureV1,
  PORTABLE_VIEWING_ACTIVITY_SYNC_CHECKPOINT_SCHEMA_VERSION,
  type PortableViewingActivityPreviewV1,
  type PortableViewingActivityStateV1,
  type PortableViewingActivitySyncCheckpointV1,
} from '../types/portableViewingActivity';
import {
  createPortableProfileV3,
  type PortableProfileRecordV3,
  type PortableProfileV3,
  type PortableRecordNamespaceV3,
} from '../types/portableProfile';

const DEFAULT_READ_BACK_DELAYS_MS = [0, 250, 750, 1500] as const;

export type PortableViewingActivitySteadyStateConflictResolutionV1 = 'keep-local' | 'keep-cloud';

export type PortableViewingActivitySteadyStateConflictResolutionResultV1 =
  | {
      state: 'verified';
      resolution: PortableViewingActivitySteadyStateConflictResolutionV1;
      count: { history: number; progress: number };
      checkpoint: PortableViewingActivitySyncCheckpointV1;
    }
  | {
      state: 'needs-review';
      reason:
        | 'readiness-changed'
        | 'cloud-conflict'
        | 'cloud-verification-failed'
        | 'cloud-changed-before-pull'
        | 'local-changed-during-resolution'
        | 'local-apply-failed';
      cloudWasWritten: boolean;
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

function semanticallyEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function namespace(profile: PortableProfileV3, name: 'history' | 'progress'): PortableRecordNamespaceV3 {
  const value = profile.namespaces[name] as PortableRecordNamespaceV3 | undefined;
  return value ?? { schemaVersion: 1, revision: 0, updatedAt: profile.updatedAt, records: {} };
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

function count(preview: Pick<PortableViewingActivityPreviewV1, 'history' | 'progress'>) {
  return { history: Object.keys(preview.history).length, progress: Object.keys(preview.progress).length };
}

function explicitLocalNamespace(
  previous: PortableRecordNamespaceV3,
  local: Record<string, unknown>,
  updatedBy: string,
  now: number,
): { namespace: PortableRecordNamespaceV3; changed: boolean } {
  const records: Record<string, PortableProfileRecordV3> = {};
  let changed = false;
  for (const key of Object.keys(local).sort()) {
    const existing = previous.records[key];
    const value = local[key];
    if (existing && existing.deletedAt == null && semanticallyEqual(existing.value, value)) {
      records[key] = existing;
      continue;
    }
    changed = true;
    records[key] = {
      revision: (existing?.revision ?? 0) + 1,
      updatedAt: now,
      updatedBy,
      deletedAt: null,
      value: value as any,
    };
  }
  for (const [key, existing] of Object.entries(previous.records)) {
    if (Object.prototype.hasOwnProperty.call(local, key)) continue;
    if (existing.deletedAt != null) {
      records[key] = existing;
      continue;
    }
    changed = true;
    records[key] = {
      revision: existing.revision + 1,
      updatedAt: now,
      updatedBy,
      deletedAt: now,
      value: null,
    };
  }
  return {
    namespace: changed
      ? { schemaVersion: 1, revision: previous.revision + 1, updatedAt: now, records }
      : previous,
    changed,
  };
}

function explicitLocalProfile(
  remote: PortableProfileV3,
  local: PortableViewingActivityPreviewV1,
  updatedBy: string,
): PortableProfileV3 {
  const history = namespace(remote, 'history');
  const progress = namespace(remote, 'progress');
  const now = Math.max(Date.now(), remote.updatedAt + 1, history.updatedAt + 1, progress.updatedAt + 1);
  const nextHistory = explicitLocalNamespace(history, local.history, updatedBy, now);
  const nextProgress = explicitLocalNamespace(progress, local.progress, updatedBy, now);
  if (!nextHistory.changed && !nextProgress.changed) return remote;
  return {
    ...remote,
    revision: remote.revision + 1,
    updatedAt: now,
    namespaces: {
      ...remote.namespaces,
      history: nextHistory.namespace,
      progress: nextProgress.namespace,
    },
  };
}

function localApplyState(
  target: PortableViewingActivityStateV1,
  local: PortableViewingActivityPreviewV1,
): PortableViewingActivityStateV1 {
  const historyTombstones = new Set(target.tombstones.history);
  const progressTombstones = new Set(target.tombstones.progress);
  for (const key of Object.keys(local.history)) if (!target.history[key]) historyTombstones.add(key);
  for (const key of Object.keys(local.progress)) if (!target.progress[key]) progressTombstones.add(key);
  return {
    ...target,
    tombstones: {
      history: [...historyTombstones].sort(),
      progress: [...progressTombstones].sort(),
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

/**
 * Explicit recovery for genuine post-checkpoint Viewing Activity divergence.
 * The v1 checkpoint cannot prove deletion intent for missing records, so there
 * is deliberately no post-checkpoint "combine" action. The user chooses one
 * complete portable truth source and Orion revalidates it before mutation.
 */
export async function resolvePortableViewingActivitySteadyStateConflictV1(input: {
  store: CloudProfileStore;
  profileKey: string;
  profileId: string;
  updatedBy: string;
  checkpoint: PortableViewingActivitySyncCheckpointV1;
  resolution: PortableViewingActivitySteadyStateConflictResolutionV1;
  readLocalPreview: () => PortableViewingActivityPreviewV1 | Promise<PortableViewingActivityPreviewV1>;
  applyLocalState: (state: PortableViewingActivityStateV1) => void | Promise<void>;
  readBackDelaysMs?: readonly number[];
  shouldProceed?: () => boolean | Promise<boolean>;
}): Promise<PortableViewingActivitySteadyStateConflictResolutionResultV1> {
  if (input.checkpoint.profileId !== input.profileId) {
    return { state: 'needs-review', reason: 'readiness-changed', cloudWasWritten: false };
  }

  const startLocal = await input.readLocalPreview();
  if (startLocal.rejected.history.length || startLocal.rejected.progress.length) {
    return { state: 'needs-review', reason: 'readiness-changed', cloudWasWritten: false };
  }
  try {
    buildPortableViewingActivitySteadyStateProfileV1(
      createPortableProfileV3(input.profileId, 1),
      startLocal,
      { profileId: input.profileId, updatedBy: input.updatedBy, now: Math.max(Date.now(), 2) },
    );
  } catch {
    return { state: 'needs-review', reason: 'readiness-changed', cloudWasWritten: false };
  }
  const startLocalSignature = portableViewingActivityTruthSignatureV1(startLocal);
  const remote = await input.store.read(input.profileKey);
  if (remote.state !== 'found' || remote.profile.profileId !== input.profileId) {
    return { state: 'needs-review', reason: 'readiness-changed', cloudWasWritten: false };
  }
  const cloudState = buildPortableViewingActivityStateFromProfileV1(remote.profile);
  const cloudNamespaceSignature = portableViewingActivityNamespaceSignatureV1(remote.profile);
  if (!cloudState || !cloudNamespaceSignature) {
    return { state: 'needs-review', reason: 'readiness-changed', cloudWasWritten: false };
  }
  const localChanged = startLocalSignature !== input.checkpoint.localTruthSignature;
  const cloudChanged = cloudNamespaceSignature !== input.checkpoint.cloudNamespaceSignature;
  if (!localChanged || !cloudChanged) {
    return { state: 'needs-review', reason: 'readiness-changed', cloudWasWritten: false };
  }
  if (!(await canProceed(input.shouldProceed))) return { state: 'cancelled' };

  if (input.resolution === 'keep-cloud') {
    const stable = await input.store.read(input.profileKey);
    if (
      stable.state !== 'found'
      || stable.profile.profileId !== input.profileId
      || portableViewingActivityNamespaceSignatureV1(stable.profile) !== cloudNamespaceSignature
    ) {
      return { state: 'needs-review', reason: 'cloud-changed-before-pull', cloudWasWritten: false };
    }
    const latestLocal = await input.readLocalPreview();
    if (portableViewingActivityTruthSignatureV1(latestLocal) !== startLocalSignature) {
      return { state: 'needs-review', reason: 'local-changed-during-resolution', cloudWasWritten: false };
    }
    if (!(await canProceed(input.shouldProceed))) return { state: 'cancelled' };
    try {
      await input.applyLocalState(localApplyState(cloudState, latestLocal));
    } catch {
      return { state: 'needs-review', reason: 'local-apply-failed', cloudWasWritten: false };
    }
    const applied = await input.readLocalPreview();
    const targetSignature = portableViewingActivityTruthSignatureV1(cloudState);
    if (portableViewingActivityTruthSignatureV1(applied) !== targetSignature) {
      return { state: 'needs-review', reason: 'local-apply-failed', cloudWasWritten: false };
    }
    return {
      state: 'verified',
      resolution: input.resolution,
      count: count(cloudState),
      checkpoint: checkpointFor(input.profileId, targetSignature, cloudNamespaceSignature),
    };
  }

  const latestLocal = await input.readLocalPreview();
  if (portableViewingActivityTruthSignatureV1(latestLocal) !== startLocalSignature) {
    return { state: 'needs-review', reason: 'local-changed-during-resolution', cloudWasWritten: false };
  }
  const candidate = explicitLocalProfile(remote.profile, startLocal, input.updatedBy);
  if (!(await canProceed(input.shouldProceed))) return { state: 'cancelled' };

  let verifiedProfile = remote.profile;
  let cloudWasWritten = false;
  if (!semanticallyEqual(candidate, remote.profile)) {
    const write = await input.store.write(input.profileKey, {
      profile: candidate,
      expectedRevisionTag: remote.revisionTag,
    });
    if (write.state === 'conflict') {
      return { state: 'needs-review', reason: 'cloud-conflict', cloudWasWritten: false };
    }
    cloudWasWritten = true;
    const candidateNamespaceSignature = portableViewingActivityNamespaceSignatureV1(candidate);
    const candidateState = buildPortableViewingActivityStateFromProfileV1(candidate);
    if (!candidateNamespaceSignature || !candidateState) {
      return { state: 'needs-review', reason: 'cloud-verification-failed', cloudWasWritten: true };
    }
    const candidateTruthSignature = portableViewingActivityTruthSignatureV1(candidateState);
    let verified: PortableProfileV3 | null = null;
    for (const delayMs of input.readBackDelaysMs || DEFAULT_READ_BACK_DELAYS_MS) {
      await wait(delayMs);
      const readBack = await input.store.read(input.profileKey);
      const readBackState = readBack.state === 'found'
        ? buildPortableViewingActivityStateFromProfileV1(readBack.profile)
        : null;
      if (
        readBack.state === 'found'
        && readBack.profile.profileId === input.profileId
        && portableViewingActivityNamespaceSignatureV1(readBack.profile) === candidateNamespaceSignature
        && readBackState != null
        && portableViewingActivityTruthSignatureV1(readBackState) === candidateTruthSignature
      ) {
        verified = readBack.profile;
        break;
      }
    }
    if (!verified) {
      return { state: 'needs-review', reason: 'cloud-verification-failed', cloudWasWritten: true };
    }
    verifiedProfile = verified;
  }

  const finalLocal = await input.readLocalPreview();
  if (portableViewingActivityTruthSignatureV1(finalLocal) !== startLocalSignature) {
    return { state: 'needs-review', reason: 'local-changed-during-resolution', cloudWasWritten };
  }
  const verifiedNamespaceSignature = portableViewingActivityNamespaceSignatureV1(verifiedProfile);
  if (!verifiedNamespaceSignature) {
    return { state: 'needs-review', reason: 'cloud-verification-failed', cloudWasWritten };
  }
  return {
    state: 'verified',
    resolution: input.resolution,
    count: count(startLocal),
    checkpoint: checkpointFor(input.profileId, startLocalSignature, verifiedNamespaceSignature),
  };
}
