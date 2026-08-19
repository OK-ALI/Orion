import type { CloudProfileStore } from './cloudProfileStore';
import {
  buildPortableWatchedPreviewFromProfileV1,
  buildPortableWatchedSteadyStateProfileV1,
  planPortableWatchedReconciliationV1,
  portableWatchedNamespaceSignatureV1,
  portableWatchedTruthMatchesPreviewV1,
  portableWatchedTruthSignatureV1,
  PORTABLE_WATCHED_SYNC_CHECKPOINT_SCHEMA_VERSION,
  type PortableWatchedPreviewV1,
  type PortableWatchedSyncCheckpointV1,
} from '../types/portableWatchedSync';
import type { PortableProfileV3 } from '../types/portableProfile';

const DEFAULT_READ_BACK_DELAYS_MS = [0, 250, 750, 1500] as const;

export type PortableWatchedSteadyStateConflictResolutionV1 = 'keep-local' | 'keep-cloud';

export type PortableWatchedSteadyStateConflictResolutionResultV1 =
  | {
      state: 'verified';
      resolution: PortableWatchedSteadyStateConflictResolutionV1;
      count: number;
      checkpoint: PortableWatchedSyncCheckpointV1;
    }
  | {
      state: 'needs-review';
      reason:
        | 'readiness-changed'
        | 'cloud-conflict'
        | 'cloud-verification-failed'
        | 'cloud-changed-before-pull'
        | 'local-changed-during-resolution';
      cloudWasWritten: boolean;
    }
  | { state: 'cancelled' };

function count(preview: PortableWatchedPreviewV1): number {
  return Object.keys(preview.records).length;
}

function checkpointFor(
  profileId: string,
  localTruthSignature: string,
  cloudNamespaceSignature: string,
): PortableWatchedSyncCheckpointV1 {
  return {
    schemaVersion: PORTABLE_WATCHED_SYNC_CHECKPOINT_SCHEMA_VERSION,
    profileId,
    localTruthSignature,
    cloudNamespaceSignature,
    verifiedAt: Date.now(),
  };
}

function canonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (!value || typeof value !== 'object') return value;
  const source = value as Record<string, unknown>;
  const normalized: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort()) normalized[key] = canonicalJson(source[key]);
  return normalized;
}

function portableProfilesSemanticallyMatch(expected: PortableProfileV3, actual: PortableProfileV3): boolean {
  return JSON.stringify(canonicalJson(expected)) === JSON.stringify(canonicalJson(actual));
}

function unrelatedNamespacesMatch(expected: PortableProfileV3, actual: PortableProfileV3): boolean {
  const withoutWatched = (profile: PortableProfileV3) => Object.fromEntries(
    Object.entries(profile.namespaces).filter(([name]) => name !== 'watched'),
  );
  return JSON.stringify(canonicalJson(withoutWatched(expected)))
    === JSON.stringify(canonicalJson(withoutWatched(actual)));
}

async function wait(delayMs: number): Promise<void> {
  if (delayMs <= 0) return;
  await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}

async function canProceed(callback?: () => boolean | Promise<boolean>): Promise<boolean> {
  return callback ? !!(await callback()) : true;
}

/**
 * Explicit recovery for genuine post-checkpoint Watched divergence. There is no
 * automatic union here: an absent Watched record can be an intentional unwatch,
 * so only an explicit whole-copy choice is safe with the v1 checkpoint model.
 */
export async function resolvePortableWatchedSteadyStateConflictV1(input: {
  store: CloudProfileStore;
  profileKey: string;
  profileId: string;
  updatedBy: string;
  checkpoint: PortableWatchedSyncCheckpointV1;
  resolution: PortableWatchedSteadyStateConflictResolutionV1;
  readLocalPreview: () => PortableWatchedPreviewV1 | Promise<PortableWatchedPreviewV1>;
  applyLocalPreview: (preview: PortableWatchedPreviewV1) => void | Promise<void>;
  readBackDelaysMs?: readonly number[];
  shouldProceed?: () => boolean | Promise<boolean>;
}): Promise<PortableWatchedSteadyStateConflictResolutionResultV1> {
  if (input.checkpoint.profileId !== input.profileId) {
    return { state: 'needs-review', reason: 'readiness-changed', cloudWasWritten: false };
  }

  const startLocal = await input.readLocalPreview();
  if (startLocal.rejectedKeys.length > 0) {
    return { state: 'needs-review', reason: 'readiness-changed', cloudWasWritten: false };
  }
  const startLocalSignature = portableWatchedTruthSignatureV1(startLocal);
  const remote = await input.store.read(input.profileKey);
  if (remote.state !== 'found' || remote.profile.profileId !== input.profileId) {
    return { state: 'needs-review', reason: 'readiness-changed', cloudWasWritten: false };
  }

  const decision = planPortableWatchedReconciliationV1({
    profile: remote.profile,
    profileId: input.profileId,
    localPreview: startLocal,
    checkpoint: input.checkpoint,
  });
  if (decision.state !== 'needs-review' || decision.reason !== 'both-changed') {
    return { state: 'needs-review', reason: 'readiness-changed', cloudWasWritten: false };
  }

  const cloudPreview = buildPortableWatchedPreviewFromProfileV1(remote.profile);
  const cloudNamespaceSignature = portableWatchedNamespaceSignatureV1(remote.profile);
  if (!cloudPreview || !cloudNamespaceSignature) {
    return { state: 'needs-review', reason: 'readiness-changed', cloudWasWritten: false };
  }
  if (!(await canProceed(input.shouldProceed))) return { state: 'cancelled' };

  if (input.resolution === 'keep-cloud') {
    const stable = await input.store.read(input.profileKey);
    const stableSignature = stable.state === 'found'
      ? portableWatchedNamespaceSignatureV1(stable.profile)
      : null;
    if (
      stable.state !== 'found'
      || stable.revisionTag !== remote.revisionTag
      || stable.profile.profileId !== input.profileId
      || stableSignature !== cloudNamespaceSignature
      || !portableWatchedTruthMatchesPreviewV1(stable.profile, cloudPreview)
    ) {
      return { state: 'needs-review', reason: 'cloud-changed-before-pull', cloudWasWritten: false };
    }
    const latestLocal = await input.readLocalPreview();
    if (portableWatchedTruthSignatureV1(latestLocal) !== startLocalSignature) {
      return { state: 'needs-review', reason: 'local-changed-during-resolution', cloudWasWritten: false };
    }
    if (!(await canProceed(input.shouldProceed))) return { state: 'cancelled' };

    await input.applyLocalPreview(cloudPreview);
    const applied = await input.readLocalPreview();
    const targetSignature = portableWatchedTruthSignatureV1(cloudPreview);
    if (portableWatchedTruthSignatureV1(applied) !== targetSignature || !stableSignature) {
      throw new Error('Portable Watched local conflict resolution could not be verified.');
    }
    return {
      state: 'verified',
      resolution: input.resolution,
      count: count(cloudPreview),
      checkpoint: checkpointFor(input.profileId, targetSignature, stableSignature),
    };
  }

  const latestLocal = await input.readLocalPreview();
  if (portableWatchedTruthSignatureV1(latestLocal) !== startLocalSignature) {
    return { state: 'needs-review', reason: 'local-changed-during-resolution', cloudWasWritten: false };
  }

  const candidate = buildPortableWatchedSteadyStateProfileV1(remote.profile, startLocal, {
    profileId: input.profileId,
    updatedBy: input.updatedBy,
  });
  if (!(await canProceed(input.shouldProceed))) return { state: 'cancelled' };

  const write = await input.store.write(input.profileKey, {
    profile: candidate,
    expectedRevisionTag: remote.revisionTag,
  });
  if (write.state === 'conflict') {
    return { state: 'needs-review', reason: 'cloud-conflict', cloudWasWritten: false };
  }

  const candidateNamespaceSignature = portableWatchedNamespaceSignatureV1(candidate);
  if (!candidateNamespaceSignature) throw new Error('Portable Watched conflict candidate could not be verified.');

  let verifiedProfile: PortableProfileV3 | null = null;
  for (const delayMs of input.readBackDelaysMs || DEFAULT_READ_BACK_DELAYS_MS) {
    await wait(delayMs);
    const readBack = await input.store.read(input.profileKey);
    if (
      readBack.state === 'found'
      && portableProfilesSemanticallyMatch(candidate, readBack.profile)
      && portableWatchedNamespaceSignatureV1(readBack.profile) === candidateNamespaceSignature
      && unrelatedNamespacesMatch(candidate, readBack.profile)
      && portableWatchedTruthMatchesPreviewV1(readBack.profile, startLocal)
    ) {
      verifiedProfile = readBack.profile;
      break;
    }
  }
  if (!verifiedProfile) {
    return { state: 'needs-review', reason: 'cloud-verification-failed', cloudWasWritten: true };
  }

  const finalLocal = await input.readLocalPreview();
  if (portableWatchedTruthSignatureV1(finalLocal) !== startLocalSignature) {
    return { state: 'needs-review', reason: 'local-changed-during-resolution', cloudWasWritten: true };
  }
  const verifiedNamespaceSignature = portableWatchedNamespaceSignatureV1(verifiedProfile);
  if (!verifiedNamespaceSignature) {
    return { state: 'needs-review', reason: 'cloud-verification-failed', cloudWasWritten: true };
  }

  return {
    state: 'verified',
    resolution: input.resolution,
    count: count(startLocal),
    checkpoint: checkpointFor(input.profileId, startLocalSignature, verifiedNamespaceSignature),
  };
}
