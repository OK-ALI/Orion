import type { CloudProfileStore } from './cloudProfileStore';
import {
  executePortableWatchedOneShotSyncV1,
  inspectPortableWatchedOneShotSyncV1,
  type PortableWatchedOneShotExecutionV1,
} from './portableWatchedOneShotSync';
import type {
  PortableWatchedPreviewV1,
  PortableWatchedSyncCheckpointV1,
} from '../types/portableWatchedSync';

type ExecutionReviewReason = Extract<PortableWatchedOneShotExecutionV1, { state: 'needs-review' }>['reason'];

export type PortableWatchedSteadyStateReconcileV1 =
  | { state: 'unenrolled' }
  | {
      state: 'verified';
      action: 'aligned' | 'create' | 'push' | 'merge' | 'pull';
      count: number;
      checkpoint: PortableWatchedSyncCheckpointV1;
    }
  | {
      state: 'needs-review';
      reason: string;
      conflictKeys: string[];
      cloudWasWritten: boolean;
      localCount: number;
      cloudCount: number;
    }
  | { state: 'cancelled' };

/**
 * C3-D composes the locked C3-C planner/executor. It does not introduce a
 * second merge algorithm. Automatic work is checkpoint-gated, so first
 * enrollment remains an explicit C3-C action and performs no cloud read here.
 */
export async function reconcilePortableWatchedSteadyStateSyncV1(input: {
  store: CloudProfileStore;
  profileKey: string;
  profileId: string;
  updatedBy: string;
  checkpoint: PortableWatchedSyncCheckpointV1 | null;
  readLocalPreview: () => PortableWatchedPreviewV1 | Promise<PortableWatchedPreviewV1>;
  applyLocalPreview: (preview: PortableWatchedPreviewV1) => void | Promise<void>;
  readBackDelaysMs?: readonly number[];
  shouldProceed?: () => boolean | Promise<boolean>;
  onExecutionStart?: (action: 'create' | 'push' | 'merge' | 'pull') => void;
}): Promise<PortableWatchedSteadyStateReconcileV1> {
  if (!input.checkpoint) return { state: 'unenrolled' };

  const localPreview = await input.readLocalPreview();
  const inspection = await inspectPortableWatchedOneShotSyncV1({
    store: input.store,
    profileKey: input.profileKey,
    profileId: input.profileId,
    localPreview,
    checkpoint: input.checkpoint,
  });

  if (inspection.state === 'aligned') {
    return {
      state: 'verified',
      action: 'aligned',
      count: inspection.localCount,
      checkpoint: inspection.checkpoint,
    };
  }
  if (inspection.state === 'needs-review') {
    return {
      state: 'needs-review',
      reason: inspection.reason,
      conflictKeys: inspection.conflictKeys,
      cloudWasWritten: false,
      localCount: inspection.localCount,
      cloudCount: inspection.cloudCount,
    };
  }

  input.onExecutionStart?.(inspection.action);
  const execution = await executePortableWatchedOneShotSyncV1({
    store: input.store,
    profileKey: input.profileKey,
    profileId: input.profileId,
    updatedBy: input.updatedBy,
    expectedConfirmationKey: inspection.confirmationKey,
    checkpoint: input.checkpoint,
    readLocalPreview: input.readLocalPreview,
    applyLocalPreview: input.applyLocalPreview,
    readBackDelaysMs: input.readBackDelaysMs,
    shouldProceed: input.shouldProceed,
  });

  if (execution.state === 'verified') {
    return {
      state: 'verified',
      action: execution.action,
      count: execution.count,
      checkpoint: execution.checkpoint,
    };
  }
  if ((execution.reason as ExecutionReviewReason) === 'cancelled') return { state: 'cancelled' };
  return {
    state: 'needs-review',
    reason: execution.reason,
    conflictKeys: [],
    cloudWasWritten: execution.cloudWasWritten,
    localCount: inspection.localCount,
    cloudCount: inspection.cloudCount,
  };
}
