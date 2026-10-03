import { useEffect, useState } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';

/** One live Android/iOS accessibility subscription, owned by ThemeProvider. */
export function useSystemReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);
  useEffect(() => {
    let disposed = false, revision = 0;
    const read = () => {
      const query = ++revision;
      AccessibilityInfo.isReduceMotionEnabled().then((value) => {
        if (!disposed && query === revision) setReducedMotion(value);
      }).catch(() => { if (!disposed && query === revision) setReducedMotion(false); });
    };
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      revision++;
      if (!disposed) setReducedMotion(value);
    });
    const appState = AppState.addEventListener('change', (state) => { if (state === 'active') read(); });
    read();
    return () => { disposed = true; revision++; motion.remove(); appState.remove(); };
  }, []);
  return reducedMotion;
}
