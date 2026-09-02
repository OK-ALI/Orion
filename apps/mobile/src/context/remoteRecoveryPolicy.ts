export type RemoteRecoveryAction =
  | "ignore"
  | "wait"
  | "acknowledge"
  | "consume";

export interface RemoteRecoveryDecisionInput {
  recoveryEpoch: number;
  lastConsumedEpoch: number;
  remoteReady: boolean;
  enabled: boolean;
}

export interface RemoteRecoveryDecision {
  action: RemoteRecoveryAction;
  nextConsumedEpoch: number;
}

export function normalizeRecoveryEpoch(
  value: number,
): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.floor(value);
}

export function decideRemoteRecovery(
  input: RemoteRecoveryDecisionInput,
): RemoteRecoveryDecision {
  const recoveryEpoch =
    normalizeRecoveryEpoch(
      input.recoveryEpoch,
    );

  const lastConsumedEpoch =
    normalizeRecoveryEpoch(
      input.lastConsumedEpoch,
    );

  if (
    recoveryEpoch <=
    lastConsumedEpoch
  ) {
    return {
      action: "ignore",
      nextConsumedEpoch:
        lastConsumedEpoch,
    };
  }

  if (!input.remoteReady) {
    return {
      action: "wait",
      nextConsumedEpoch:
        lastConsumedEpoch,
    };
  }

  if (!input.enabled) {
    return {
      action: "acknowledge",
      nextConsumedEpoch:
        recoveryEpoch,
    };
  }

  return {
    action: "consume",
    nextConsumedEpoch:
      recoveryEpoch,
  };
}