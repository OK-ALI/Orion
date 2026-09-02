import {
  useEffect,
  useRef,
} from "react";

import {
  useNetworkStatus,
} from "./NetworkContext";

import {
  decideRemoteRecovery,
} from "./remoteRecoveryPolicy";

export interface RemoteRecoveryEffectOptions {
  enabled?: boolean;
}

export type RemoteRecoveryCallback =
  (
    recoveryEpoch: number,
  ) => void | Promise<void>;

export function useRemoteRecoveryEffect(
  onRecovery: RemoteRecoveryCallback,
  options: RemoteRecoveryEffectOptions = {},
): void {
  const {
    remoteReady,
    recoveryEpoch,
  } = useNetworkStatus();

  const enabled =
    options.enabled ?? true;

  const callbackRef =
    useRef(onRecovery);

  const lastConsumedEpochRef =
    useRef(recoveryEpoch);

  useEffect(() => {
    callbackRef.current =
      onRecovery;
  }, [onRecovery]);

  useEffect(() => {
    const decision =
      decideRemoteRecovery({
        recoveryEpoch,
        lastConsumedEpoch:
          lastConsumedEpochRef.current,
        remoteReady,
        enabled,
      });

    if (
      decision.action === "ignore" ||
      decision.action === "wait"
    ) {
      return;
    }

    lastConsumedEpochRef.current =
      decision.nextConsumedEpoch;

    if (
      decision.action !== "consume"
    ) {
      return;
    }

    try {
      const result =
        callbackRef.current(
          decision.nextConsumedEpoch,
        );

      void Promise.resolve(result)
        .catch(() => undefined);
    } catch {
      // The consuming screen owns its own bounded error state.
    }
  }, [
    enabled,
    recoveryEpoch,
    remoteReady,
  ]);
}