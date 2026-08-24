import { useEffect } from 'react';
import { initializeNativeDownloadEngineV1 } from './nativeDownloadEngine';

/** Keeps the React repository as a sanitized projection of durable native job truth. */
export function MobileDownloadEngineCoordinator() {
  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | null = null;
    void initializeNativeDownloadEngineV1().then((cleanup) => {
      if (disposed) cleanup();
      else unsubscribe = cleanup;
    }).catch(() => {});
    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, []);
  return null;
}
