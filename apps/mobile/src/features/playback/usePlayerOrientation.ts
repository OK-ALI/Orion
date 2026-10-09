import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, type LayoutChangeEvent } from 'react-native';
import { useFocusEffect, useNavigation, type NativeStackNavigationProp } from 'expo-router';
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
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();
  const desiredMode = useRef<PlayerOrientationMode>('landscape');
  const [isLandscape, setIsLandscape] = useState(true);
  const owner = useRef(Symbol('player-orientation'));
  const revision = useRef(0);
  const mounted = useRef(false);
  const focused = useRef(false);
  const foreground = useRef(AppState.currentState === 'active');
  const windowFocused = useRef(true);
  const layout = useRef<{ width: number; height: number } | null>(null);
  const visualOwner = useRef(false);
  const appeared = useRef(Platform.OS === 'web');
  const entryFrame = useRef<number | null>(null);
  const entryRevision = useRef(0);
  const [entryReady, setEntryReady] = useState(false);

  const cancelEntryFrame = useCallback(() => {
    entryRevision.current++;
    if (entryFrame.current != null) cancelAnimationFrame(entryFrame.current);
    entryFrame.current = null;
  }, []);

  const syncOrientation = useCallback(() => {
    const active = mounted.current && focused.current && foreground.current && windowFocused.current;
    if (!active || desiredMode.current === 'released') cancelEntryFrame();
    const mode = active && visualOwner.current ? desiredMode.current : 'released';
    const commandRevision = ++revision.current;
    if (mode !== 'released') orientationOwner = owner.current;
    return applyOrientation(mode, () => orientationOwner === owner.current && revision.current === commandRevision);
  }, [cancelEntryFrame]);

  const confirmVisualOwnership = useCallback(() => {
    if (visualOwner.current || entryFrame.current != null || !appeared.current || !layout.current || !mounted.current
      || !focused.current || !foreground.current || !windowFocused.current || desiredMode.current === 'released') return;
    // Native appearance precedes this handshake; JS focus/layout alone can precede the screen transaction.
    const frameRevision = entryRevision.current;
    const currentEntryLayout = () => frameRevision === entryRevision.current && appeared.current && mounted.current && focused.current
      && foreground.current && windowFocused.current && desiredMode.current !== 'released' && layout.current;
    entryFrame.current = requestAnimationFrame(() => {
      if (!currentEntryLayout()) return;
      entryFrame.current = requestAnimationFrame(() => {
        const currentLayout = currentEntryLayout();
        if (!currentLayout) return;
        entryFrame.current = null;
        visualOwner.current = true;
        if (Platform.OS === 'web' || currentLayout.width >= currentLayout.height) setEntryReady(true);
        syncOrientation().catch(() => {
          if (currentEntryLayout()) setEntryReady(true);
        });
      });
    });
  }, [syncOrientation]);

  const onPlayerLayout = useCallback(({ nativeEvent: { layout: next } }: LayoutChangeEvent) => {
    if (desiredMode.current === 'released' || !Number.isFinite(next.width) || !Number.isFinite(next.height)
      || next.width <= 0 || next.height <= 0) return;
    layout.current = { width: next.width, height: next.height };
    if (visualOwner.current && next.width >= next.height) setEntryReady(true);
    confirmVisualOwnership();
  }, [confirmVisualOwnership]);

  useEffect(() => {
    mounted.current = true;
    foreground.current = AppState.currentState === 'active';
    confirmVisualOwnership();
    const removeAppearanceListener = navigation.addListener('transitionEnd', ({ data }) => {
      if (data.closing || !mounted.current) return;
      appeared.current = true;
      confirmVisualOwnership();
    });
    const subscription = AppState.addEventListener('change', (state) => {
      foreground.current = state === 'active';
      syncOrientation().catch(() => {});
      confirmVisualOwnership();
    });
    const blur = Platform.OS === 'android' ? AppState.addEventListener('blur', () => {
      windowFocused.current = false;
      syncOrientation().catch(() => {});
    }) : null;
    const focus = Platform.OS === 'android' ? AppState.addEventListener('focus', () => {
      windowFocused.current = true;
      syncOrientation().catch(() => {});
      confirmVisualOwnership();
    }) : null;
    return () => {
      removeAppearanceListener();
      subscription.remove();
      blur?.remove();
      focus?.remove();
      mounted.current = false;
      desiredMode.current = 'released';
      syncOrientation().catch(() => {});
    };
  }, [confirmVisualOwnership, navigation, syncOrientation]);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    syncOrientation().catch(() => {});
    confirmVisualOwnership();
    return () => {
      focused.current = false;
      syncOrientation().catch(() => {});
    };
  }, [confirmVisualOwnership, syncOrientation]));

  const toggleOrientation = useCallback(() => {
    if (!mounted.current || !focused.current || !foreground.current || !windowFocused.current
      || !visualOwner.current || desiredMode.current === 'released') return Promise.resolve();
    const next = desiredMode.current === 'landscape' ? 'portrait' : 'landscape';
    desiredMode.current = next;
    setIsLandscape(next === 'landscape');
    return syncOrientation().catch(() => {});
  }, [syncOrientation]);

  const releaseOrientation = useCallback(() => {
    desiredMode.current = 'released';
    return syncOrientation().catch(() => {});
  }, [syncOrientation]);

  return { isLandscape, toggleOrientation, releaseOrientation, entryReady, onPlayerLayout };
}