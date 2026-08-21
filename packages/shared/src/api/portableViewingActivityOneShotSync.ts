import type {
  CloudProfileReadResult,
  CloudProfileStore,
} from './cloudProfileStore';
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

export type PortableViewingActivityEnrollmentResolutionV1 = 'device' | 'cloud' | 'combine';

export interface PortableViewingActivityCountsV1 {
  history: number;
  progress: number;
}

export type PortableViewingActivityOneShotInspectionV1 =
  | {
      state: 'aligned';
      localCount: PortableViewingActivityCountsV1;
      cloudCount: PortableViewingActivityCountsV1;
      checkpoint: PortableViewingActivitySyncCheckpointV1;
    }
  | {
      state: 'ready';
      localCount: PortableViewingActivityCountsV1;
      cloudCount: PortableViewingActivityCountsV1;
      availableResolutions: PortableViewingActivityEnrollmentResolutionV1[];
      blockedResolutions: Partial<Record<PortableViewingActivityEnrollmentResolutionV1, string>>;
      confirmationKey: string;
    }
  | {
      state: 'needs-review';
      reason: 'local-invalid' | 'cloud-invalid' | 'profile-identity-mismatch' | 'no-safe-resolution';
      historyConflictKeys: string[];
      progressConflictKeys: string[];
    };

export type PortableViewingActivityOneShotExecutionV1 =
  | {
      state: 'verified';
      resolution: PortableViewingActivityEnrollmentResolutionV1;
      count: PortableViewingActivityCountsV1;
      checkpoint: PortableViewingActivitySyncCheckpointV1;
      cloudWasWritten: boolean;
    }
  | {
      state: 'needs-review';
      reason:
        | 'readiness-changed'
        | 'resolution-no-longer-safe'
        | 'cloud-conflict'
        | 'cloud-verification-failed'
        | 'cloud-changed-before-apply'
        | 'local-changed-during-sync'
        | 'local-apply-failed'
        | 'cancelled';
      cloudWasWritten: boolean;
    };

type FoundRead = Extract<CloudProfileReadResult, { state: 'found' }>;

interface ResolutionPlan {
  targetProfile: PortableProfileV3;
  cloudWriteRequired: boolean;
}

interface InternalInspection {
  publicResult: PortableViewingActivityOneShotInspectionV1;
  remote: CloudProfileReadResult;
  localPreview: PortableViewingActivityPreviewV1;
  localTruthSignature: string;
  cloudNamespaceSignature: string | null;
  resolutionPlans: Partial<Record<PortableViewingActivityEnrollmentResolutionV1, ResolutionPlan>>;
  confirmationKey: string | null;
}

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

function namespace(profile: PortableProfileV3, name: 'history' | 'progress'): PortableRecordNamespaceV3 {
  const value = profile.namespaces[name] as PortableRecordNamespaceV3 | undefined;
  return value ?? { schemaVersion: 1, revision: 0, updatedAt: profile.updatedAt, records: {} };
}

function counts(preview: Pick<PortableViewingActivityPreviewV1, 'history' | 'progress'>): PortableViewingActivityCountsV1 {
  return {
    history: Object.keys(preview.history).length,
    progress: Object.keys(preview.progress).length,
  };
}

function checkpointFor(
  profileId: string,
  localTruthSignature: string,
  cloudNamespaceSignature: string,
  verifiedAt = Date.now(),
): PortableViewingActivitySyncCheckpointV1 {
  return {
    schemaVersion: PORTABLE_VIEWING_ACTIVITY_SYNC_CHECKPOINT_SCHEMA_VERSION,
    profileId,
    localTruthSignature,
    cloudNamespaceSignature,
    verifiedAt,
  };
}

function targetFromMergedRecords(
  base: PortableProfileV3,
  historyRecords: PortableRecordNamespaceV3['records'],
  progressRecords: PortableRecordNamespaceV3['records'],
  now: number,
): PortableProfileV3 {
  const history = namespace(base, 'history');
  const progress = namespace(base, 'progress');
  const timestamp = Math.max(now, base.updatedAt + 1, history.updatedAt + 1, progress.updatedAt + 1);
  return {
    ...base,
    revision: base.revision + 1,
    updatedAt: timestamp,
    namespaces: {
      ...base.namespaces,
      history: {
        schemaVersion: 1,
        revision: history.revision + 1,
        updatedAt: timestamp,
        records: historyRecords,
      },
      progress: {
        schemaVersion: 1,
        revision: progress.revision + 1,
        updatedAt: timestamp,
        records: progressRecords,
      },
    },
  };
}

function makeLocalProfile(
  profileId: string,
  localPreview: PortableViewingActivityPreviewV1,
  updatedBy: string,
): PortableProfileV3 {
  const seed = createPortableProfileV3(profileId, 1);
  return buildPortableViewingActivitySteadyStateProfileV1(seed, localPreview, {
    profileId,
    updatedBy,
    now: Math.max(Date.now(), 2),
  });
}

function combineTarget(
  remote: PortableProfileV3,
  localPreview: PortableViewingActivityPreviewV1,
  profileId: string,
  updatedBy: string,
): { profile: PortableProfileV3 | null; historyConflictKeys: string[]; progressConflictKeys: string[] } {
  const localProfile = makeLocalProfile(profileId, localPreview, updatedBy);
  const merged = mergePortableViewingActivityRecordsV1(remote, localProfile);
  if (merged.state === 'needs-review') {
    return {
      profile: null,
      historyConflictKeys: merged.historyConflictKeys,
      progressConflictKeys: merged.progressConflictKeys,
    };
  }
  if (
    JSON.stringify(canonicalize(merged.historyRecords)) === JSON.stringify(canonicalize(namespace(remote, 'history').records))
    && JSON.stringify(canonicalize(merged.progressRecords)) === JSON.stringify(canonicalize(namespace(remote, 'progress').records))
  ) {
    return { profile: remote, historyConflictKeys: [], progressConflictKeys: [] };
  }
  const candidate = targetFromMergedRecords(
    remote,
    merged.historyRecords,
    merged.progressRecords,
    Date.now(),
  );
  return { profile: candidate, historyConflictKeys: [], progressConflictKeys: [] };
}

function makeConfirmationKey(input: {
  localTruthSignature: string;
  revisionTag: string | null;
  cloudNamespaceSignature: string | null;
  availableResolutions: PortableViewingActivityEnrollmentResolutionV1[];
}): string {
  return JSON.stringify({
    localTruthSignature: input.localTruthSignature,
    revisionTag: input.revisionTag,
    cloudNamespaceSignature: input.cloudNamespaceSignature,
    availableResolutions: [...input.availableResolutions].sort(),
  });
}

async function wait(delayMs: number): Promise<void> {
  if (delayMs <= 0) return;
  await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}

async function canProceed(callback?: () => boolean | Promise<boolean>): Promise<boolean> {
  return callback ? !!(await callback()) : true;
}

function localApplyState(
  target: PortableViewingActivityStateV1,
  local: PortableViewingActivityPreviewV1,
): PortableViewingActivityStateV1 {
  const historyTombstones = new Set(target.tombstones.history);
  const progressTombstones = new Set(target.tombstones.progress);
  for (const key of Object.keys(local.history)) {
    if (!target.history[key]) historyTombstones.add(key);
  }
  for (const key of Object.keys(local.progress)) {
    if (!target.progress[key]) progressTombstones.add(key);
  }
  return {
    ...target,
    tombstones: {
      history: [...historyTombstones].sort(),
      progress: [...progressTombstones].sort(),
    },
  };
}

async function inspectInternal(input: {
  store: CloudProfileStore;
  profileKey: string;
  profileId: string;
  updatedBy: string;
  localPreview: PortableViewingActivityPreviewV1;
}): Promise<InternalInspection> {
  const localTruthSignature = portableViewingActivityTruthSignatureV1(input.localPreview);
  if (input.localPreview.rejected.history.length || input.localPreview.rejected.progress.length) {
    return {
      publicResult: {
        state: 'needs-review',
        reason: 'local-invalid',
        historyConflictKeys: [...input.localPreview.rejected.history],
        progressConflictKeys: [...input.localPreview.rejected.progress],
      },
      remote: { state: 'missing', revisionTag: null },
      localPreview: input.localPreview,
      localTruthSignature,
      cloudNamespaceSignature: null,
      resolutionPlans: {},
      confirmationKey: null,
    };
  }

  const remote = await input.store.read(input.profileKey);
  if (remote.state === 'found' && remote.profile.profileId !== input.profileId) {
    return {
      publicResult: {
        state: 'needs-review',
        reason: 'profile-identity-mismatch',
        historyConflictKeys: [],
        progressConflictKeys: [],
      },
      remote,
      localPreview: input.localPreview,
      localTruthSignature,
      cloudNamespaceSignature: null,
      resolutionPlans: {},
      confirmationKey: null,
    };
  }

  if (remote.state === 'missing') {
    const targetProfile = buildPortableViewingActivitySteadyStateProfileV1(
      createPortableProfileV3(input.profileId),
      input.localPreview,
      { profileId: input.profileId, updatedBy: input.updatedBy },
    );
    const availableResolutions: PortableViewingActivityEnrollmentResolutionV1[] = ['device'];
    const confirmationKey = makeConfirmationKey({
      localTruthSignature,
      revisionTag: null,
      cloudNamespaceSignature: null,
      availableResolutions,
    });
    return {
      publicResult: {
        state: 'ready',
        localCount: counts(input.localPreview),
        cloudCount: { history: 0, progress: 0 },
        availableResolutions,
        blockedResolutions: {
          cloud: 'Orion Cloud does not have Viewing Activity for this account yet.',
          combine: 'There is no Orion Cloud Viewing Activity to combine yet.',
        },
        confirmationKey,
      },
      remote,
      localPreview: input.localPreview,
      localTruthSignature,
      cloudNamespaceSignature: null,
      resolutionPlans: { device: { targetProfile, cloudWriteRequired: true } },
      confirmationKey,
    };
  }

  const cloudState = buildPortableViewingActivityStateFromProfileV1(remote.profile);
  const cloudNamespaceSignature = portableViewingActivityNamespaceSignatureV1(remote.profile);
  if (!cloudState || !cloudNamespaceSignature) {
    return {
      publicResult: {
        state: 'needs-review',
        reason: 'cloud-invalid',
        historyConflictKeys: [],
        progressConflictKeys: [],
      },
      remote,
      localPreview: input.localPreview,
      localTruthSignature,
      cloudNamespaceSignature: null,
      resolutionPlans: {},
      confirmationKey: null,
    };
  }

  const cloudTruthSignature = portableViewingActivityTruthSignatureV1(cloudState);
  if (cloudTruthSignature === localTruthSignature) {
    return {
      publicResult: {
        state: 'aligned',
        localCount: counts(input.localPreview),
        cloudCount: counts(cloudState),
        checkpoint: checkpointFor(input.profileId, localTruthSignature, cloudNamespaceSignature),
      },
      remote,
      localPreview: input.localPreview,
      localTruthSignature,
      cloudNamespaceSignature,
      resolutionPlans: {},
      confirmationKey: null,
    };
  }

  const plans: Partial<Record<PortableViewingActivityEnrollmentResolutionV1, ResolutionPlan>> = {
    cloud: { targetProfile: remote.profile, cloudWriteRequired: false },
  };
  const blocked: Partial<Record<PortableViewingActivityEnrollmentResolutionV1, string>> = {};

  try {
    const deviceTarget = buildPortableViewingActivitySteadyStateProfileV1(
      remote.profile,
      input.localPreview,
      { profileId: input.profileId, updatedBy: input.updatedBy },
    );
    plans.device = { targetProfile: deviceTarget, cloudWriteRequired: !semanticallyEqual(deviceTarget, remote.profile) };
  } catch {
    blocked.device = 'This device contains older activity than a newer verified Orion Cloud record or removal.';
  }

  const combined = combineTarget(remote.profile, input.localPreview, input.profileId, input.updatedBy);
  if (combined.profile) {
    plans.combine = {
      targetProfile: combined.profile,
      cloudWriteRequired: !semanticallyEqual(combined.profile, remote.profile),
    };
  } else {
    blocked.combine = 'Some activity has the same verified time but different playback truth, so Orion cannot choose safely.';
  }

  const availableResolutions = (['device', 'cloud', 'combine'] as const).filter((resolution) => !!plans[resolution]);
  if (!availableResolutions.length) {
    return {
      publicResult: {
        state: 'needs-review',
        reason: 'no-safe-resolution',
        historyConflictKeys: combined.historyConflictKeys,
        progressConflictKeys: combined.progressConflictKeys,
      },
      remote,
      localPreview: input.localPreview,
      localTruthSignature,
      cloudNamespaceSignature,
      resolutionPlans: {},
      confirmationKey: null,
    };
  }

  const confirmationKey = makeConfirmationKey({
    localTruthSignature,
    revisionTag: remote.revisionTag,
    cloudNamespaceSignature,
    availableResolutions,
  });
  return {
    publicResult: {
      state: 'ready',
      localCount: counts(input.localPreview),
      cloudCount: counts(cloudState),
      availableResolutions,
      blockedResolutions: blocked,
      confirmationKey,
    },
    remote,
    localPreview: input.localPreview,
    localTruthSignature,
    cloudNamespaceSignature,
    resolutionPlans: plans,
    confirmationKey,
  };
}

export async function inspectPortableViewingActivityOneShotSyncV1(input: {
  store: CloudProfileStore;
  profileKey: string;
  profileId: string;
  updatedBy: string;
  localPreview: PortableViewingActivityPreviewV1;
}): Promise<PortableViewingActivityOneShotInspectionV1> {
  return (await inspectInternal(input)).publicResult;
}

export async function executePortableViewingActivityOneShotSyncV1(input: {
  store: CloudProfileStore;
  profileKey: string;
  profileId: string;
  updatedBy: string;
  resolution: PortableViewingActivityEnrollmentResolutionV1;
  expectedConfirmationKey: string;
  readLocalPreview: () => PortableViewingActivityPreviewV1 | Promise<PortableViewingActivityPreviewV1>;
  applyLocalState: (state: PortableViewingActivityStateV1) => void | Promise<void>;
  readBackDelaysMs?: readonly number[];
  shouldProceed?: () => boolean | Promise<boolean>;
}): Promise<PortableViewingActivityOneShotExecutionV1> {
  const startLocal = await input.readLocalPreview();
  const fresh = await inspectInternal({
    store: input.store,
    profileKey: input.profileKey,
    profileId: input.profileId,
    updatedBy: input.updatedBy,
    localPreview: startLocal,
  });
  if (
    fresh.publicResult.state !== 'ready'
    || !fresh.confirmationKey
    || fresh.confirmationKey !== input.expectedConfirmationKey
  ) {
    return { state: 'needs-review', reason: 'readiness-changed', cloudWasWritten: false };
  }
  const plan = fresh.resolutionPlans[input.resolution];
  if (!plan) {
    return { state: 'needs-review', reason: 'resolution-no-longer-safe', cloudWasWritten: false };
  }
  if (!(await canProceed(input.shouldProceed))) {
    return { state: 'needs-review', reason: 'cancelled', cloudWasWritten: false };
  }

  let verifiedRemote: FoundRead | null = null;
  let cloudWasWritten = false;

  if (plan.cloudWriteRequired) {
    const expectedRevisionTag = fresh.remote.state === 'found' ? fresh.remote.revisionTag : null;
    const write = await input.store.write(input.profileKey, {
      profile: plan.targetProfile,
      expectedRevisionTag,
    });
    if (write.state === 'conflict') {
      return { state: 'needs-review', reason: 'cloud-conflict', cloudWasWritten: false };
    }
    cloudWasWritten = true;
    const candidateNamespaceSignature = portableViewingActivityNamespaceSignatureV1(plan.targetProfile);
    const candidateState = buildPortableViewingActivityStateFromProfileV1(plan.targetProfile);
    const candidateTruthSignature = candidateState
      ? portableViewingActivityTruthSignatureV1(candidateState)
      : null;
    for (const delayMs of input.readBackDelaysMs || DEFAULT_READ_BACK_DELAYS_MS) {
      await wait(delayMs);
      const readBack = await input.store.read(input.profileKey);
      const readBackState = readBack.state === 'found'
        ? buildPortableViewingActivityStateFromProfileV1(readBack.profile)
        : null;
      if (
        readBack.state === 'found'
        && readBack.profile.profileId === input.profileId
        && candidateNamespaceSignature
        && candidateTruthSignature
        && portableViewingActivityNamespaceSignatureV1(readBack.profile) === candidateNamespaceSignature
        && readBackState != null
        && portableViewingActivityTruthSignatureV1(readBackState) === candidateTruthSignature
      ) {
        verifiedRemote = readBack;
        break;
      }
    }
    if (!verifiedRemote) {
      return { state: 'needs-review', reason: 'cloud-verification-failed', cloudWasWritten: true };
    }
  } else {
    if (fresh.remote.state !== 'found') {
      return { state: 'needs-review', reason: 'cloud-changed-before-apply', cloudWasWritten: false };
    }
    const stable = await input.store.read(input.profileKey);
    if (
      stable.state !== 'found'
      || stable.profile.profileId !== input.profileId
      || portableViewingActivityNamespaceSignatureV1(stable.profile) !== fresh.cloudNamespaceSignature
    ) {
      return { state: 'needs-review', reason: 'cloud-changed-before-apply', cloudWasWritten: false };
    }
    verifiedRemote = stable;
  }

  const latestLocal = await input.readLocalPreview();
  if (portableViewingActivityTruthSignatureV1(latestLocal) !== fresh.localTruthSignature) {
    return { state: 'needs-review', reason: 'local-changed-during-sync', cloudWasWritten };
  }
  if (!(await canProceed(input.shouldProceed))) {
    return { state: 'needs-review', reason: 'cancelled', cloudWasWritten };
  }

  const targetState = buildPortableViewingActivityStateFromProfileV1(verifiedRemote.profile);
  const cloudNamespaceSignature = portableViewingActivityNamespaceSignatureV1(verifiedRemote.profile);
  if (!targetState || !cloudNamespaceSignature) {
    return { state: 'needs-review', reason: 'cloud-verification-failed', cloudWasWritten };
  }
  const targetTruthSignature = portableViewingActivityTruthSignatureV1(targetState);
  if (fresh.localTruthSignature !== targetTruthSignature) {
    try {
      await input.applyLocalState(localApplyState(targetState, latestLocal));
    } catch {
      return { state: 'needs-review', reason: 'local-apply-failed', cloudWasWritten };
    }
  }

  const applied = await input.readLocalPreview();
  if (portableViewingActivityTruthSignatureV1(applied) !== targetTruthSignature) {
    return { state: 'needs-review', reason: 'local-apply-failed', cloudWasWritten };
  }

  return {
    state: 'verified',
    resolution: input.resolution,
    count: counts(targetState),
    checkpoint: checkpointFor(input.profileId, targetTruthSignature, cloudNamespaceSignature),
    cloudWasWritten,
  };
}
