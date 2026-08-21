import type {
  CloudProfileReadResult,
  CloudProfileStore,
} from './cloudProfileStore';
import {
  buildPortableWatchedFirstEnrollmentProfileV1,
  buildPortableWatchedPreviewFromProfileV1,
  buildPortableWatchedSteadyStateProfileV1,
  planPortableWatchedReconciliationV1,
  portableWatchedNamespaceSignatureV1,
  portableWatchedTruthMatchesPreviewV1,
  portableWatchedTruthSignatureV1,
  PORTABLE_WATCHED_SYNC_CHECKPOINT_SCHEMA_VERSION,
  type PortableWatchedPreviewV1,
  type PortableWatchedReconcileDecisionV1,
  type PortableWatchedSyncCheckpointV1,
} from '../types/portableWatchedSync';
import type { PortableProfileV3 } from '../types/portableProfile';

const DEFAULT_READ_BACK_DELAYS_MS = [0, 250, 750, 1500] as const;

type FoundRead = Extract<CloudProfileReadResult, { state: 'found' }>;

export type PortableWatchedOneShotInspectionV1 =
  | {
      state: 'aligned';
      localCount: number;
      cloudCount: number;
      checkpoint: PortableWatchedSyncCheckpointV1;
    }
  | {
      state: 'ready';
      action: 'create' | 'push' | 'merge' | 'pull';
      localCount: number;
      cloudCount: number;
      targetCount: number;
      conflictKeys: string[];
      confirmationKey: string;
    }
  | {
      state: 'needs-review';
      reason: Extract<PortableWatchedReconcileDecisionV1, { state: 'needs-review' }>['reason'];
      conflictKeys: string[];
      localCount: number;
      cloudCount: number;
    };

export type PortableWatchedOneShotExecutionV1 =
  | {
      state: 'verified';
      action: 'create' | 'push' | 'merge' | 'pull';
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
        | 'local-changed-during-sync'
        | 'cancelled';
      cloudWasWritten: boolean;
    };

interface InternalInspection {
  publicResult: PortableWatchedOneShotInspectionV1;
  decision: PortableWatchedReconcileDecisionV1;
  remote: CloudProfileReadResult;
  localTruthSignature: string;
  cloudNamespaceSignature: string | null;
  confirmationKey: string | null;
}

function count(preview: PortableWatchedPreviewV1): number {
  return Object.keys(preview.records).length;
}

function checkpointFor(
  profileId: string,
  localTruthSignature: string,
  cloudNamespaceSignature: string,
  verifiedAt = Date.now(),
): PortableWatchedSyncCheckpointV1 {
  return {
    schemaVersion: PORTABLE_WATCHED_SYNC_CHECKPOINT_SCHEMA_VERSION,
    profileId,
    localTruthSignature,
    cloudNamespaceSignature,
    verifiedAt,
  };
}

function makeConfirmationKey(input: {
  action: string;
  localTruthSignature: string;
  targetTruthSignature: string;
  revisionTag: string | null;
  cloudNamespaceSignature: string | null;
}): string {
  return JSON.stringify(input);
}

async function wait(delayMs: number): Promise<void> {
  if (delayMs <= 0) return;
  await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}

async function canProceed(callback?: () => boolean | Promise<boolean>): Promise<boolean> {
  return callback ? !!(await callback()) : true;
}

async function inspectInternal(input: {
  store: CloudProfileStore;
  profileKey: string;
  profileId: string;
  localPreview: PortableWatchedPreviewV1;
  checkpoint: PortableWatchedSyncCheckpointV1 | null;
}): Promise<InternalInspection> {
  const remote = await input.store.read(input.profileKey);
  const profile = remote.state === 'found' ? remote.profile : null;
  const decision = planPortableWatchedReconciliationV1({
    profile,
    profileId: input.profileId,
    localPreview: input.localPreview,
    checkpoint: input.checkpoint,
  });
  const localTruthSignature = portableWatchedTruthSignatureV1(input.localPreview);
  const cloudPreviewForCount = remote.state === 'found'
    ? buildPortableWatchedPreviewFromProfileV1(remote.profile)
    : null;
  const cloudCount = decision.state === 'aligned'
    ? count(decision.cloudPreview)
    : cloudPreviewForCount
      ? count(cloudPreviewForCount)
      : 0;
  const cloudNamespaceSignature = remote.state === 'found'
    ? portableWatchedNamespaceSignatureV1(remote.profile)
    : null;

  if (decision.state === 'aligned') {
    const checkpoint = checkpointFor(
      input.profileId,
      localTruthSignature,
      decision.cloudNamespaceSignature,
    );
    return {
      publicResult: {
        state: 'aligned',
        localCount: count(input.localPreview),
        cloudCount: count(decision.cloudPreview),
        checkpoint,
      },
      decision,
      remote,
      localTruthSignature,
      cloudNamespaceSignature: decision.cloudNamespaceSignature,
      confirmationKey: null,
    };
  }

  if (decision.state === 'needs-review') {
    return {
      publicResult: {
        state: 'needs-review',
        reason: decision.reason,
        conflictKeys: decision.conflictKeys,
        localCount: count(input.localPreview),
        cloudCount,
      },
      decision,
      remote,
      localTruthSignature,
      cloudNamespaceSignature,
      confirmationKey: null,
    };
  }

  const confirmationKey = makeConfirmationKey({
    action: decision.action,
    localTruthSignature,
    targetTruthSignature: portableWatchedTruthSignatureV1(decision.targetPreview),
    revisionTag: remote.revisionTag,
    cloudNamespaceSignature: decision.cloudNamespaceSignature,
  });
  return {
    publicResult: {
      state: 'ready',
      action: decision.action,
      localCount: count(input.localPreview),
      cloudCount,
      targetCount: count(decision.targetPreview),
      conflictKeys: [],
      confirmationKey,
    },
    decision,
    remote,
    localTruthSignature,
    cloudNamespaceSignature: decision.cloudNamespaceSignature,
    confirmationKey,
  };
}

export async function inspectPortableWatchedOneShotSyncV1(input: {
  store: CloudProfileStore;
  profileKey: string;
  profileId: string;
  localPreview: PortableWatchedPreviewV1;
  checkpoint: PortableWatchedSyncCheckpointV1 | null;
}): Promise<PortableWatchedOneShotInspectionV1> {
  return (await inspectInternal(input)).publicResult;
}

export async function executePortableWatchedOneShotSyncV1(input: {
  store: CloudProfileStore;
  profileKey: string;
  profileId: string;
  updatedBy: string;
  expectedConfirmationKey: string;
  checkpoint: PortableWatchedSyncCheckpointV1 | null;
  readLocalPreview: () => PortableWatchedPreviewV1 | Promise<PortableWatchedPreviewV1>;
  applyLocalPreview: (preview: PortableWatchedPreviewV1) => void | Promise<void>;
  readBackDelaysMs?: readonly number[];
  shouldProceed?: () => boolean | Promise<boolean>;
}): Promise<PortableWatchedOneShotExecutionV1> {
  const startLocal = await input.readLocalPreview();
  const fresh = await inspectInternal({
    store: input.store,
    profileKey: input.profileKey,
    profileId: input.profileId,
    localPreview: startLocal,
    checkpoint: input.checkpoint,
  });
  if (
    fresh.publicResult.state !== 'ready'
    || !fresh.confirmationKey
    || fresh.confirmationKey !== input.expectedConfirmationKey
    || fresh.decision.state !== 'ready'
  ) {
    return { state: 'needs-review', reason: 'readiness-changed', cloudWasWritten: false };
  }

  if (!(await canProceed(input.shouldProceed))) {
    return { state: 'needs-review', reason: 'cancelled', cloudWasWritten: false };
  }

  const action = fresh.decision.action;
  const targetPreview = fresh.decision.targetPreview;
  const targetTruthSignature = portableWatchedTruthSignatureV1(targetPreview);

  if (action === 'pull') {
    const stable = await input.store.read(input.profileKey);
    const stableSignature = stable.state === 'found'
      ? portableWatchedNamespaceSignatureV1(stable.profile)
      : null;
    if (
      stable.state !== 'found'
      || fresh.remote.state !== 'found'
      || stable.profile.profileId !== input.profileId
      || stableSignature !== fresh.cloudNamespaceSignature
      || !portableWatchedTruthMatchesPreviewV1(stable.profile, targetPreview)
    ) {
      return { state: 'needs-review', reason: 'cloud-changed-before-pull', cloudWasWritten: false };
    }
    const latestLocal = await input.readLocalPreview();
    if (portableWatchedTruthSignatureV1(latestLocal) !== fresh.localTruthSignature) {
      return { state: 'needs-review', reason: 'local-changed-during-sync', cloudWasWritten: false };
    }
    if (!(await canProceed(input.shouldProceed))) {
      return { state: 'needs-review', reason: 'cancelled', cloudWasWritten: false };
    }
    await input.applyLocalPreview(targetPreview);
    const applied = await input.readLocalPreview();
    if (portableWatchedTruthSignatureV1(applied) !== targetTruthSignature || !stableSignature) {
      throw new Error('Portable Watched local apply could not be verified.');
    }
    return {
      state: 'verified',
      action,
      count: count(targetPreview),
      checkpoint: checkpointFor(input.profileId, targetTruthSignature, stableSignature),
    };
  }

  const baseProfile = fresh.remote.state === 'found' ? fresh.remote.profile : null;
  const candidate = input.checkpoint
    ? (() => {
        if (!baseProfile) throw new Error('Portable Watched checkpoint cannot write a missing cloud profile.');
        return buildPortableWatchedSteadyStateProfileV1(baseProfile, targetPreview, {
          profileId: input.profileId,
          updatedBy: input.updatedBy,
        });
      })()
    : buildPortableWatchedFirstEnrollmentProfileV1(baseProfile, targetPreview, {
        profileId: input.profileId,
        updatedBy: input.updatedBy,
      });

  if (!(await canProceed(input.shouldProceed))) {
    return { state: 'needs-review', reason: 'cancelled', cloudWasWritten: false };
  }

  const write = await input.store.write(input.profileKey, {
    profile: candidate,
    expectedRevisionTag: fresh.remote.revisionTag,
  });
  if (write.state === 'conflict') {
    return { state: 'needs-review', reason: 'cloud-conflict', cloudWasWritten: false };
  }

  const candidateNamespaceSignature = portableWatchedNamespaceSignatureV1(candidate);
  if (!candidateNamespaceSignature) {
    throw new Error('Portable Watched candidate namespace could not be verified.');
  }
  let verified: FoundRead | null = null;
  for (const delayMs of input.readBackDelaysMs || DEFAULT_READ_BACK_DELAYS_MS) {
    await wait(delayMs);
    const readBack = await input.store.read(input.profileKey);
    if (
      readBack.state === 'found'
      // The conditional pre-write revision tag protects the shared document
      // from overwriting a newer remote revision. Read-back verification owns
      // only Watched: unrelated My List/Viewing Activity writes may advance the
      // profile immediately after this write and must not fabricate a failure.
      && readBack.profile.profileId === input.profileId
      && portableWatchedNamespaceSignatureV1(readBack.profile) === candidateNamespaceSignature
      && portableWatchedTruthMatchesPreviewV1(readBack.profile, targetPreview)
    ) {
      verified = readBack;
      break;
    }
  }
  if (!verified) {
    return { state: 'needs-review', reason: 'cloud-verification-failed', cloudWasWritten: true };
  }

  const latestLocal = await input.readLocalPreview();
  if (portableWatchedTruthSignatureV1(latestLocal) !== fresh.localTruthSignature) {
    return { state: 'needs-review', reason: 'local-changed-during-sync', cloudWasWritten: true };
  }
  if (portableWatchedTruthSignatureV1(latestLocal) !== targetTruthSignature) {
    await input.applyLocalPreview(targetPreview);
  }
  const finalLocal = await input.readLocalPreview();
  if (portableWatchedTruthSignatureV1(finalLocal) !== targetTruthSignature) {
    throw new Error('Portable Watched local convergence could not be verified.');
  }
  const verifiedNamespaceSignature = portableWatchedNamespaceSignatureV1(verified.profile);
  if (!verifiedNamespaceSignature) {
    return { state: 'needs-review', reason: 'cloud-verification-failed', cloudWasWritten: true };
  }
  return {
    state: 'verified',
    action,
    count: count(targetPreview),
    checkpoint: checkpointFor(input.profileId, targetTruthSignature, verifiedNamespaceSignature),
  };
}
