import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';

type PlayerOrientationMode = 'landscape' | 'portrait' | 'released';

let orientationQueue: Promise<void> = Promise.resolve();
let orientationOwner: symbol | null = null;

function enqueueOrientation(command: () => Promise<void>): Promise<void> {
  const next = orientationQueue.catch(() => {}).then(command);
  orientationQueue = next.catch(() => {});
  return next;
}

function applyOrientation(mode: PlayerOrientationMode, isCurrent: () => boolean): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  return enqueueOrientation(async () => {
    if (!isCurrent()) return;
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
  const owner = useRef(Symbol('player-orientation'));
  const revision = useRef(0);
  const mounted = useRef(false);
  const focused = useRef(false);
  const foreground = useRef(AppState.currentState === 'active');
  const windowFocused = useRef(true);

  const syncOrientation = useCallback(() => {
    const active = mounted.current && focused.current && foreground.current && windowFocused.current;
    const mode = active ? desiredMode.current : 'released';
    const commandRevision = ++revision.current;
    if (mode !== 'released') orientationOwner = owner.current;
    return applyOrientation(mode, () => orientationOwner === owner.current && revision.current === commandRevision);
  }, []);

  useEffect(() => {
    mounted.current = true;
    foreground.current = AppState.currentState === 'active';
    const subscription = AppState.addEventListener('change', (state) => {
      foreground.current = state === 'active';
      syncOrientation().catch(() => {});
    });
    const blur = Platform.OS === 'android' ? AppState.addEventListener('blur', () => {
      windowFocused.current = false;
      syncOrientation().catch(() => {});
    }) : null;
    const focus = Platform.OS === 'android' ? AppState.addEventListener('focus', () => {
      windowFocused.current = true;
      syncOrientation().catch(() => {});
    }) : null;
    return () => {
      subscription.remove();
      blur?.remove();
      focus?.remove();
      mounted.current = false;
      desiredMode.current = 'released';
      syncOrientation().catch(() => {});
    };
  }, [syncOrientation]);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    syncOrientation().catch(() => {});
    return () => {
      focused.current = false;
      syncOrientation().catch(() => {});
    };
  }, [syncOrientation]));

  const toggleOrientation = useCallback(() => {
    if (!mounted.current || !focused.current || !foreground.current || !windowFocused.current
      || desiredMode.current === 'released') return Promise.resolve();
    const next = desiredMode.current === 'landscape' ? 'portrait' : 'landscape';
    desiredMode.current = next;
    setIsLandscape(next === 'landscape');
    return syncOrientation().catch(() => {});
  }, [syncOrientation]);

  const releaseOrientation = useCallback(() => {
    desiredMode.current = 'released';
    return syncOrientation().catch(() => {});
  }, [syncOrientation]);

  return { isLandscape, toggleOrientation, releaseOrientation };
}