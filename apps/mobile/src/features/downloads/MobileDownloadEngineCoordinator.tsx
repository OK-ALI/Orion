import { useEffect } from 'react';
import { AppState } from 'react-native';
import { initializeNativeDownloadEngineV1, reconcileNativeDownloadsV1 } from './nativeDownloadEngine';

/** Keeps the React repository as a sanitized projection of durable native job truth. */
export function MobileDownloadEngineCoordinator() {
  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | null = null;
    void initializeNativeDownloadEngineV1().then((cleanup) => {
      if (disposed) cleanup();
      else unsubscribe = cleanup;
    }).catch(() => {});
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void reconcileNativeDownloadsV1().catch(() => {});
    });
    return () => {
      disposed = true;
      unsubscribe?.();
      appState.remove();
    };
  }, []);
  return null;
}
