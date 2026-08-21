import type { CloudProfileStore } from './cloudProfileStore';
import {
  buildPortableMyListPreviewFromProfileV1,
  buildPortableMyListSteadyStateProfileV1,
  portableMyListActiveMatchesPreviewV1,
  portableMyListNamespaceSignatureV1,
  portableMyListPreviewSignatureV1,
  type PortableMyListPreviewV1,
} from '../types/portableMyList';
import type { PortableProfileV3 } from '../types/portableProfile';

const DEFAULT_READ_BACK_DELAYS_MS = [0, 250, 750, 1500] as const;

export type PortableMyListSteadyStateConflictResolutionV1 = 'keep-local' | 'keep-cloud';

export interface PortableMyListCheckpointEvidenceV1 {
  profileId: string;
  localSignature: string;
  cloudNamespaceSignature: string;
  verifiedAt: number;
}

export type PortableMyListSteadyStateConflictResolutionResultV1 =
  | {
      state: 'verified';
      resolution: PortableMyListSteadyStateConflictResolutionV1;
      count: number;
      checkpoint: PortableMyListCheckpointEvidenceV1;
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

function canonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (!value || typeof value !== 'object') return value;
  const source = value as Record<string, unknown>;
  const normalized: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort()) normalized[key] = canonicalJson(source[key]);
  return normalized;
}

async function wait(delayMs: number): Promise<void> {
  if (delayMs <= 0) return;
  await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}

async function canProceed(callback?: () => boolean | Promise<boolean>): Promise<boolean> {
  return callback ? !!(await callback()) : true;
}

function checkpointFor(
  profileId: string,
  localSignature: string,
  cloudNamespaceSignature: string,
): PortableMyListCheckpointEvidenceV1 {
  return {
    profileId,
    localSignature,
    cloudNamespaceSignature,
    verifiedAt: Date.now(),
  };
}

/**
 * Explicit recovery for an already-enrolled My List that reached a genuine
 * two-sided steady-state divergence. This function never auto-merges because
 * the v1 checkpoint stores signatures rather than the prior record set, so it
 * cannot safely infer which removals were intentional from signature-only checkpoint evidence.
 *
 * The caller must ask the user to choose which complete copy wins. The choice
 * is then revalidated against fresh local and cloud state before any mutation.
 */
export async function resolvePortableMyListSteadyStateConflictV1(input: {
  store: CloudProfileStore;
  profileKey: string;
  profileId: string;
  updatedBy: string;
  checkpoint: PortableMyListCheckpointEvidenceV1;
  resolution: PortableMyListSteadyStateConflictResolutionV1;
  readLocalPreview: () => PortableMyListPreviewV1 | Promise<PortableMyListPreviewV1>;
  applyLocalPreview: (preview: PortableMyListPreviewV1) => void | Promise<void>;
  readBackDelaysMs?: readonly number[];
  shouldProceed?: () => boolean | Promise<boolean>;
}): Promise<PortableMyListSteadyStateConflictResolutionResultV1> {
  if (input.checkpoint.profileId !== input.profileId) {
    return { state: 'needs-review', reason: 'readiness-changed', cloudWasWritten: false };
  }

  const startLocal = await input.readLocalPreview();
  if (startLocal.rejectedKeys.length > 0) {
    return { state: 'needs-review', reason: 'readiness-changed', cloudWasWritten: false };
  }
  const startLocalSignature = portableMyListPreviewSignatureV1(startLocal);

  const remote = await input.store.read(input.profileKey);
  if (remote.state !== 'found' || remote.profile.profileId !== input.profileId) {
    return { state: 'needs-review', reason: 'readiness-changed', cloudWasWritten: false };
  }
  const cloudPreview = buildPortableMyListPreviewFromProfileV1(remote.profile);
  const cloudNamespaceSignature = portableMyListNamespaceSignatureV1(remote.profile);
  if (!cloudPreview || !cloudNamespaceSignature) {
    return { state: 'needs-review', reason: 'readiness-changed', cloudWasWritten: false };
  }

  if (portableMyListActiveMatchesPreviewV1(remote.profile, startLocal)) {
    return { state: 'needs-review', reason: 'readiness-changed', cloudWasWritten: false };
  }
  const localChanged = startLocalSignature !== input.checkpoint.localSignature;
  const cloudChanged = cloudNamespaceSignature !== input.checkpoint.cloudNamespaceSignature;
  if (!localChanged || !cloudChanged) {
    return { state: 'needs-review', reason: 'readiness-changed', cloudWasWritten: false };
  }

  if (!(await canProceed(input.shouldProceed))) return { state: 'cancelled' };

  if (input.resolution === 'keep-cloud') {
    const stable = await input.store.read(input.profileKey);
    const stableSignature = stable.state === 'found'
      ? portableMyListNamespaceSignatureV1(stable.profile)
      : null;
    if (
      stable.state !== 'found'
      || stable.profile.profileId !== input.profileId
      || stableSignature !== cloudNamespaceSignature
      || !portableMyListActiveMatchesPreviewV1(stable.profile, cloudPreview)
    ) {
      return { state: 'needs-review', reason: 'cloud-changed-before-pull', cloudWasWritten: false };
    }
    const latestLocal = await input.readLocalPreview();
    if (portableMyListPreviewSignatureV1(latestLocal) !== startLocalSignature) {
      return { state: 'needs-review', reason: 'local-changed-during-resolution', cloudWasWritten: false };
    }
    if (!(await canProceed(input.shouldProceed))) return { state: 'cancelled' };

    await input.applyLocalPreview(cloudPreview);
    const applied = await input.readLocalPreview();
    const appliedSignature = portableMyListPreviewSignatureV1(applied);
    const targetSignature = portableMyListPreviewSignatureV1(cloudPreview);
    if (appliedSignature !== targetSignature || !stableSignature) {
      throw new Error('Portable My List local conflict resolution could not be verified.');
    }
    return {
      state: 'verified',
      resolution: input.resolution,
      count: cloudPreview.orderedKeys.length,
      checkpoint: checkpointFor(input.profileId, targetSignature, stableSignature),
    };
  }

  const latestLocal = await input.readLocalPreview();
  if (portableMyListPreviewSignatureV1(latestLocal) !== startLocalSignature) {
    return { state: 'needs-review', reason: 'local-changed-during-resolution', cloudWasWritten: false };
  }

  const candidate = buildPortableMyListSteadyStateProfileV1(remote.profile, startLocal, {
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

  const candidateNamespaceSignature = portableMyListNamespaceSignatureV1(candidate);
  if (!candidateNamespaceSignature) throw new Error('Portable My List conflict candidate could not be verified.');

  let verifiedProfile: PortableProfileV3 | null = null;
  for (const delayMs of input.readBackDelaysMs || DEFAULT_READ_BACK_DELAYS_MS) {
    await wait(delayMs);
    const readBack = await input.store.read(input.profileKey);
    const readBackNamespaceSignature = readBack.state === 'found'
      ? portableMyListNamespaceSignatureV1(readBack.profile)
      : null;
    if (
      readBack.state === 'found'
      && readBack.profile.profileId === input.profileId
      && readBackNamespaceSignature === candidateNamespaceSignature
      && portableMyListActiveMatchesPreviewV1(readBack.profile, startLocal)
    ) {
      verifiedProfile = readBack.profile;
      break;
    }
  }
  if (!verifiedProfile) {
    return { state: 'needs-review', reason: 'cloud-verification-failed', cloudWasWritten: true };
  }

  const finalLocal = await input.readLocalPreview();
  if (portableMyListPreviewSignatureV1(finalLocal) !== startLocalSignature) {
    return { state: 'needs-review', reason: 'local-changed-during-resolution', cloudWasWritten: true };
  }
  const verifiedNamespaceSignature = portableMyListNamespaceSignatureV1(verifiedProfile);
  if (!verifiedNamespaceSignature) {
    return { state: 'needs-review', reason: 'cloud-verification-failed', cloudWasWritten: true };
  }

  return {
    state: 'verified',
    resolution: input.resolution,
    count: startLocal.orderedKeys.length,
    checkpoint: checkpointFor(input.profileId, startLocalSignature, verifiedNamespaceSignature),
  };
}
