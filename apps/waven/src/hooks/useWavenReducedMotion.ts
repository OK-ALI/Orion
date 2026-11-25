import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useWavenReducedMotion(initialValue = false): boolean {
  const [reducedMotion, setReducedMotion] = useState(initialValue);

  useEffect(() => {
    let mounted = true;
    let preferenceChanged = false;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted && !preferenceChanged) setReducedMotion(enabled);
      })
      .catch(() => {
        // Accessibility state is advisory. Failure to read it must never block UI.
      });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => {
        preferenceChanged = true;
        if (mounted) setReducedMotion(enabled);
      },
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reducedMotion;
}
