import { useCallback, useEffect, useState } from 'react';
import { useWavenConnectivity } from '../infrastructure/connectivity/connectivityHooks';
import {
  hasWavenArtworkRendered,
  markWavenArtworkRendered,
  readWavenArtworkBackupSource,
  reportWavenArtworkRenderFailure,
} from '../features/artwork/wavenArtworkLifecycle';

export function useWavenArtworkLease({
  leaseKey,
  sourceKey,
}: {
  leaseKey: string;
  sourceKey?: string | null;
}) {
  const connection = useWavenConnectivity();
  const [waitingForConnection, setWaitingForConnection] = useState(false);
  const normalizedSourceKey = sourceKey?.trim() || null;
  const [retryNonce, setRetryNonce] = useState(0);
  const [hasRendered, setHasRendered] = useState(() =>
    hasWavenArtworkRendered(leaseKey, normalizedSourceKey),
  );
  const [retryExhausted, setRetryExhausted] = useState(false);
  const [backupSourceKey, setBackupSourceKey] = useState(() =>
    readWavenArtworkBackupSource(leaseKey, normalizedSourceKey),
  );

  useEffect(() => {
    setRetryNonce(0);
    setWaitingForConnection(false);
    setRetryExhausted(false);
    setHasRendered(hasWavenArtworkRendered(leaseKey, normalizedSourceKey));
    setBackupSourceKey(readWavenArtworkBackupSource(leaseKey, normalizedSourceKey));
  }, [leaseKey, normalizedSourceKey]);

  useEffect(() => {
    if (connection.remoteReady && waitingForConnection) {
      setWaitingForConnection(false);
      setRetryNonce(value => value + 1);
    }
  }, [connection.remoteReady, waitingForConnection]);

  const onLoad = useCallback(() => {
    if (!normalizedSourceKey) return;
    markWavenArtworkRendered(leaseKey, normalizedSourceKey);
    setHasRendered(true);
    setBackupSourceKey(null);
    setRetryExhausted(false);
  }, [leaseKey, normalizedSourceKey]);

  const onError = useCallback(() => {
    if (!normalizedSourceKey) return;
    if (!connection.remoteReady) { setWaitingForConnection(true); return; }
    const result = reportWavenArtworkRenderFailure(
      leaseKey,
      normalizedSourceKey,
    );
    // Never turn a source that already rendered successfully into canonical
    // fallback state. The image remains authoritative and gets one bounded
    // remount attempt; failure state belongs to this renderer instance only.
    if (result.hadRendered) setHasRendered(true);
    if (result.shouldRetry) {
      setRetryNonce((value) => value + 1);
      return;
    }
    setRetryExhausted(true);
  }, [leaseKey, normalizedSourceKey, connection.remoteReady]);

  return {
    backupSourceKey,
    hasRendered,
    imageKey: `${leaseKey}:${normalizedSourceKey || 'missing'}:${retryNonce}`,
    onError,
    onLoad,
    retryExhausted,
    showFallback: !normalizedSourceKey || (!hasRendered && !backupSourceKey),
  };
}
