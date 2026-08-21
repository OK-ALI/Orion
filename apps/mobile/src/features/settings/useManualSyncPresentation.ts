import { useCallback, useEffect, useRef, useState } from 'react';

export function useManualSyncPresentation(runSync: () => void) {
  const [manualBusy, setManualBusy] = useState(false);
  const runSyncRef = useRef(runSync);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  runSyncRef.current = runSync;

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const runManualSync = useCallback(() => {
    if (manualBusy) return;

    setManualBusy(true);
    runSyncRef.current();

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setManualBusy(false);
    }, 600);
  }, [manualBusy]);

  return { manualBusy, runManualSync };
}
