import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';

type PlayerOrientationMode = 'landscape' | 'portrait' | 'released';

let orientationQueue: Promise<void> = Promise.resolve();

function enqueueOrientation(command: () => Promise<void>): Promise<void> {
  const next = orientationQueue.catch(() => {}).then(command);
  orientationQueue = next.catch(() => {});
  return next;
}

function applyOrientation(mode: PlayerOrientationMode): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  return enqueueOrientation(async () => {
    if (mode === 'released') {
      await ScreenOrientation.unlockAsync();
      return;
    }
    await ScreenOrientation.lockAsync(
      mode === 'landscape'
        ? ScreenOrientation.OrientationLock.LANDSCAPE
        : ScreenOrientation.OrientationLock.PORTRAIT_UP,
    );
  });
}

export function usePlayerOrientation() {
  const desiredMode = useRef<PlayerOrientationMode>('landscape');
  const [isLandscape, setIsLandscape] = useState(true);

  useEffect(() => {
    desiredMode.current = 'landscape';
    setIsLandscape(true);
    applyOrientation('landscape').catch(() => {});
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && desiredMode.current !== 'released') {
        applyOrientation(desiredMode.current).catch(() => {});
      }
    });
    return () => {
      subscription.remove();
      desiredMode.current = 'released';
      applyOrientation('released').catch(() => {});
    };
  }, []);

  const toggleOrientation = useCallback(() => {
    const next = desiredMode.current === 'landscape' ? 'portrait' : 'landscape';
    desiredMode.current = next;
    setIsLandscape(next === 'landscape');
    return applyOrientation(next).catch(() => {});
  }, []);

  const releaseOrientation = useCallback(() => {
    desiredMode.current = 'released';
    return applyOrientation('released').catch(() => {});
  }, []);

  return { isLandscape, toggleOrientation, releaseOrientation };
}