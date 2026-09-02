import { useEffect, useRef, useState } from 'react';
import { useNetworkStatus } from '../../context/NetworkContext';
import { useRemoteRecoveryEffect } from '../../context/useRemoteRecoveryEffect';

export function getDiscoverUnavailableCopy(state: string) {
  if (state === 'degraded') {
    return 'Cinema is temporarily unavailable. Orion will refresh when the service returns.';
  }

  if (state === 'reconnecting') {
    return 'Reconnecting to Orion Cinema. Results will refresh automatically.';
  }

  if (state === 'checking') {
    return 'Checking Cinema connection. Results will appear when it is ready.';
  }

  return 'Cinema browsing is unavailable offline. Your local Orion remains available.';
}

export function useDiscoverRemoteGate() {
  const network = useNetworkStatus();
  const [refreshKey, setRefreshKey] = useState(0);

  const generationRef = useRef(0);
  const remoteReadyRef = useRef(network.remoteReady);
  const previousReadyRef = useRef(network.remoteReady);
  const lastRefreshEpochRef = useRef(network.recoveryEpoch);

  remoteReadyRef.current = network.remoteReady;

  useEffect(() => {
    const wasReady = previousReadyRef.current;
    previousReadyRef.current = network.remoteReady;
    generationRef.current += 1;

    // Notify consumers on loss so pending work is cleaned up immediately.
    if (wasReady && !network.remoteReady) {
      setRefreshKey((value) => value + 1);
    }

    // Checking -> online need not emit a recovery epoch, even after a recovery.
    if (
      network.remoteReady &&
      !wasReady &&
      network.recoveryEpoch === lastRefreshEpochRef.current
    ) {
      setRefreshKey((value) => value + 1);
    }
  }, [network.recoveryEpoch, network.remoteReady]);

  useRemoteRecoveryEffect((recoveryEpoch) => {
    lastRefreshEpochRef.current = recoveryEpoch;
    setRefreshKey((value) => value + 1);
  });

  return {
    network,
    refreshKey,
    generationRef,
    remoteReadyRef,
  };
}