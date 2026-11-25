import { WavenPreviewChromeContext } from './previewChromeMaterials';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { AppState } from 'react-native';

import {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useWavenReducedMotion } from '../hooks/useWavenReducedMotion';
import { resolveCelestialPolicy } from './celestialShift';
import { celestialDuration } from './celestialTimeline';

/**
 * Development-only root-scoped animation owner.
 * Survives Home navigation without creating a second timeline.
 * Persistent appearance preferences remain separately owned.
 */
function usePreviewCelestialController() {
  const reducedMotion = useWavenReducedMotion(true);
  const progress = useSharedValue(0);
  const destination = useRef<0 | 1>(0);
  const [night, setNight] = useState(false);
  const [materialStep, setMaterialStep] = useState(0);
  const policy = resolveCelestialPolicy({
    preference: 'enhanced',
    motion: 'expressive',
    systemReducedMotion: reducedMotion,
  });
  function toggleTheme() {
    const next: 0 | 1 =
      destination.current === 0 ? 1 : 0;

    destination.current = next;
    setNight(next === 1);

    cancelAnimation(progress);

    const duration = celestialDuration(
      policy.transition,
      next - progress.value,
    );

    if (duration === 0) {
      progress.value = next;
      return;
    }

    progress.value = withTiming(next, {
      duration,
      easing: Easing.inOut(Easing.cubic),
    });
  }
  useEffect(() => {
    if (reducedMotion) {
      cancelAnimation(progress);
      progress.value = destination.current;
    }
  }, [reducedMotion, progress]);
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      state => {
        if (state !== 'active') {
          cancelAnimation(progress);
          progress.value = destination.current;
        }
      },
    );

    return () => {
      subscription.remove();
      cancelAnimation(progress);
    };
  }, [progress]);

  useAnimatedReaction(
    () => Math.round(Math.max(0, Math.min(1, progress.value)) * 48),
    (current, previous) => {
      if (current !== previous) {
        runOnJS(setMaterialStep)(current);
      }
    },
  );

  return {
    progress,
    night,
    materialStep,
    toggleTheme,
  };
}

type PreviewCelestialController =
  ReturnType<typeof usePreviewCelestialController>;

const PreviewCelestialContext =
  createContext<PreviewCelestialController | null>(null);

export function WavenPreviewCelestialProvider({
  children,
}: {
  children: ReactNode;
}) {
  const controller = usePreviewCelestialController();

  return (
    <PreviewCelestialContext.Provider value={controller}>
      <WavenPreviewChromeContext.Provider value={controller.materialStep / 48}>
        {children}
      </WavenPreviewChromeContext.Provider>
    </PreviewCelestialContext.Provider>
  );
}

/**
 * Null outside the explicitly enabled development preview.
 * Future chrome consumers can preserve their normal NOIR path.
 */
export function useOptionalPreviewCelestial() {
  return useContext(PreviewCelestialContext);
}

export function useRequiredPreviewCelestial() {
  const controller = useOptionalPreviewCelestial();

  if (!controller) {
    throw new Error('WAVEN_PREVIEW_CELESTIAL_PROVIDER_REQUIRED');
  }

  return controller;
}
