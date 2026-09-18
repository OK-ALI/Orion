import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import {
  WAVEN_DETAIL_HERO_BLUR_OVERFLOW,
  WAVEN_DETAIL_HERO_BLUR_OPACITY,
  WAVEN_DETAIL_HERO_BLUR_SCALE,
  WAVEN_DETAIL_HERO_COPY_MAX_WIDTH,
  WavenDetailHeroGradients,
  wavenDetailHeroCopyBottom,
  wavenDetailHeroCopyStyles,
} from '../detail/WavenDetailHeroVisual';
import {
  commitWavenEntityRevealEnter,
  commitWavenEntityRevealExit,
  completeWavenEntityReveal,
  getWavenEntityRevealTransition,
  markWavenEntityRevealHandoffReady,
  markWavenEntityRevealOriginHandoffReady,
  refreshWavenEntityRevealExitOrigin,
  subscribeWavenEntityReveal,
  type WavenEntityRevealRect,
} from '../../features/navigation/wavenEntityReveal';
import { useWavenLayout } from '../../hooks/useWavenLayout';
import { useWavenReducedMotion } from '../../hooks/useWavenReducedMotion';
import { wavenColors } from '../../theme/tokens';

const ENTER_TRAVEL_MS = 520;
const EXIT_OWNERSHIP_MS = 72;
const EXIT_DEPARTURE_PROGRESS = 0.08;
const EXIT_DEPARTURE_MS = 140;
const EXIT_TRAVEL_MS = 500;
const ENTER_HANDOFF_MS = 140;
const EXIT_LANDING_HANDOFF_MS = 96;
const ENTER_DESTINATION_TIMEOUT_MS = 1200;

function commitEnterTransition(transitionToken: number) {
  commitWavenEntityRevealEnter(transitionToken);
}

function commitExitTransition(transitionToken: number) {
  commitWavenEntityRevealExit(transitionToken);
}

function completeTransition(transitionToken: number) {
  completeWavenEntityReveal(transitionToken);
}

function revealEnterDestination(transitionToken: number) {
  markWavenEntityRevealHandoffReady(transitionToken);
}

function revealExitOrigin(transitionToken: number) {
  markWavenEntityRevealOriginHandoffReady(transitionToken);
}

function refreshExitOrigin(transitionToken: number) {
  void refreshWavenEntityRevealExitOrigin(transitionToken);
}

function coverScale(
  frameWidth: number,
  frameHeight: number,
  artworkWidth: number,
  artworkHeight: number,
): number {
  'worklet';
  return Math.max(
    frameWidth / Math.max(1, artworkWidth),
    frameHeight / Math.max(1, artworkHeight),
  );
}


function normalizedRadius(
  radius: number,
  width: number,
  height: number,
): number {
  'worklet';
  return Math.min(0.5, radius / Math.max(1, Math.min(width, height)));
}

function artistRadiusMorphProgress(progress: number, exiting: boolean): number {
  'worklet';

  if (exiting) {
    return interpolate(
      progress,
      [0, 0.5, 0.72, 0.9, 1],
      [0, 0.04, 0.28, 0.78, 1],
      Extrapolation.CLAMP,
    );
  }

  return interpolate(
    progress,
    [0, 0.12, 0.5, 0.72, 1],
    [0, 0.04, 0.76, 0.96, 1],
    Extrapolation.CLAMP,
  );
}

export function WavenEntityRevealOverlay() {
  const layout = useWavenLayout();
  const insets = useSafeAreaInsets();
  const reducedMotion = useWavenReducedMotion();
  const [transition, setTransition] = useState(getWavenEntityRevealTransition());

  const sceneTarget = useMemo<WavenEntityRevealRect>(() => {
    const width = Math.max(
      280,
      Math.min(layout.width, layout.contentMaxWidth + layout.gutter * 2),
    );
    const height =
      transition?.kind === 'artist'
        ? Math.max(layout.isCompact ? 500 : 548, Math.min(650, width * 1.28))
        : Math.max(layout.isCompact ? 420 : 456, Math.min(560, width * 1.04));

    return {
      x: Math.max(0, (layout.width - width) / 2),
      y: insets.top + 8,
      width,
      height,
      borderRadius: 0,
    };
  }, [
    insets.top,
    layout.contentMaxWidth,
    layout.gutter,
    layout.isCompact,
    layout.width,
    transition?.kind,
  ]);

  const travelProgress = useSharedValue(0);
  const ownershipProgress = useSharedValue(0);
  const handoffProgress = useSharedValue(0);
  const phase = useSharedValue<0 | 1>(0);
  const fromX = useSharedValue(0);
  const fromY = useSharedValue(0);
  const fromWidth = useSharedValue(1);
  const fromHeight = useSharedValue(1);
  const fromRadius = useSharedValue(0);
  const toX = useSharedValue(0);
  const toY = useSharedValue(0);
  const toWidth = useSharedValue(1);
  const toHeight = useSharedValue(1);
  const toRadius = useSharedValue(0);
  const artworkWidth = useSharedValue(1);
  const artworkHeight = useSharedValue(1);

  useEffect(
    () =>
      subscribeWavenEntityReveal(() => {
        setTransition(getWavenEntityRevealTransition());
      }),
    [],
  );

  useEffect(() => {
    cancelAnimation(travelProgress);
    cancelAnimation(ownershipProgress);
    cancelAnimation(handoffProgress);
    travelProgress.value = 0;
    ownershipProgress.value = 0;
    handoffProgress.value = 0;

    if (!transition) return;

    phase.value = transition.phase === 'exit' ? 1 : 0;
    artworkWidth.value = transition.artworkWidth;
    artworkHeight.value = transition.artworkHeight;
    fromX.value = transition.from.x;
    fromY.value = transition.from.y;
    fromWidth.value = transition.from.width;
    fromHeight.value = transition.from.height;
    fromRadius.value = transition.from.borderRadius;

    const target =
      transition.phase === 'enter'
        ? sceneTarget
        : transition.to || transition.from;

    toX.value = target.x;
    toY.value = target.y;
    toWidth.value = target.width;
    toHeight.value = target.height;
    toRadius.value = target.borderRadius;

    if (reducedMotion) {
      if (transition.phase === 'enter') {
        commitWavenEntityRevealEnter(transition.token);
      } else {
        commitWavenEntityRevealExit(transition.token);
        completeWavenEntityReveal(transition.token);
      }
      return;
    }

    if (transition.phase === 'enter') {
      travelProgress.value = withTiming(
        1,
        {
          duration: ENTER_TRAVEL_MS,
          easing: Easing.inOut(Easing.cubic),
        },
        (finished) => {
          if (finished) scheduleOnRN(commitEnterTransition, transition.token);
        },
      );
      return () => cancelAnimation(travelProgress);
    }

    travelProgress.value = withTiming(
      EXIT_DEPARTURE_PROGRESS,
      {
        duration: EXIT_DEPARTURE_MS,
        easing: Easing.out(Easing.cubic),
      },
    );

    ownershipProgress.value = withTiming(
      1,
      {
        duration: EXIT_OWNERSHIP_MS,
        easing: Easing.out(Easing.cubic),
      },
      (finished) => {
        if (finished) scheduleOnRN(commitExitTransition, transition.token);
      },
    );

    return () => {
      cancelAnimation(travelProgress);
      cancelAnimation(ownershipProgress);
    };
  }, [
    artworkHeight,
    artworkWidth,
    fromHeight,
    fromRadius,
    fromWidth,
    fromX,
    fromY,
    handoffProgress,
    ownershipProgress,
    phase,
    reducedMotion,
    sceneTarget,
    toHeight,
    toRadius,
    toWidth,
    toX,
    toY,
    transition?.phase,
    transition?.token,
    travelProgress,
  ]);

  useEffect(() => {
    if (
      !transition ||
      transition.phase !== 'exit' ||
      !transition.navigationCommitted ||
      transition.exitOriginReady ||
      reducedMotion
    ) {
      return;
    }

    refreshExitOrigin(transition.token);
  }, [
    reducedMotion,
    transition?.exitOriginReady,
    transition?.navigationCommitted,
    transition?.phase,
    transition?.token,
  ]);

  useEffect(() => {
    if (
      !transition ||
      transition.phase !== 'exit' ||
      !transition.navigationCommitted ||
      !transition.exitOriginReady ||
      !transition.to ||
      reducedMotion
    ) {
      return;
    }

    cancelAnimation(travelProgress);
    cancelAnimation(handoffProgress);
    handoffProgress.value = 0;
    toX.value = transition.to.x;
    toY.value = transition.to.y;
    toWidth.value = transition.to.width;
    toHeight.value = transition.to.height;
    toRadius.value = transition.to.borderRadius;

    travelProgress.value = withTiming(
      1,
      {
        duration: EXIT_TRAVEL_MS,
        easing: Easing.inOut(Easing.cubic),
      },
      (finished) => {
        if (!finished) return;
        scheduleOnRN(revealExitOrigin, transition.token);
        handoffProgress.value = withTiming(
          1,
          {
            duration: EXIT_LANDING_HANDOFF_MS,
            easing: Easing.out(Easing.cubic),
          },
          (handoffFinished) => {
            if (handoffFinished) {
              scheduleOnRN(completeTransition, transition.token);
            }
          },
        );
      },
    );

    return () => {
      cancelAnimation(travelProgress);
      cancelAnimation(handoffProgress);
    };
  }, [
    handoffProgress,
    reducedMotion,
    toHeight,
    toRadius,
    toWidth,
    toX,
    toY,
    transition?.exitOriginReady,
    transition?.navigationCommitted,
    transition?.phase,
    transition?.to,
    transition?.token,
    travelProgress,
  ]);

  useEffect(() => {
    if (
      !transition ||
      transition.phase !== 'enter' ||
      !transition.navigationCommitted ||
      reducedMotion
    ) {
      return;
    }

    let completed = false;
    const beginHandoff = () => {
      if (completed) return;
      completed = true;
      revealEnterDestination(transition.token);
      handoffProgress.value = 0;
      handoffProgress.value = withTiming(
        1,
        {
          duration: ENTER_HANDOFF_MS,
          easing: Easing.out(Easing.cubic),
        },
        (finished) => {
          if (finished) scheduleOnRN(completeTransition, transition.token);
        },
      );
    };

    if (transition.destinationReady) {
      requestAnimationFrame(() => requestAnimationFrame(beginHandoff));
      return () => cancelAnimation(handoffProgress);
    }

    const timeout = setTimeout(beginHandoff, ENTER_DESTINATION_TIMEOUT_MS);
    return () => {
      clearTimeout(timeout);
      cancelAnimation(handoffProgress);
    };
  }, [
    handoffProgress,
    reducedMotion,
    transition?.destinationReady,
    transition?.navigationCommitted,
    transition?.phase,
    transition?.token,
  ]);

  const frameStyle = useAnimatedStyle(() => {
    const progress = travelProgress.value;
    const width = interpolate(
      progress,
      [0, 1],
      [fromWidth.value, toWidth.value],
      Extrapolation.CLAMP,
    );
    const height = interpolate(
      progress,
      [0, 1],
      [fromHeight.value, toHeight.value],
      Extrapolation.CLAMP,
    );

    const radiusMorphProgress =
      transition?.kind === 'artist'
        ? artistRadiusMorphProgress(progress, phase.value === 1)
        : progress;
    const radiusRatio = interpolate(
      radiusMorphProgress,
      [0, 1],
      [
        normalizedRadius(
          fromRadius.value,
          fromWidth.value,
          fromHeight.value,
        ),
        normalizedRadius(toRadius.value, toWidth.value, toHeight.value),
      ],
      Extrapolation.CLAMP,
    );

    return {
      borderRadius: Math.min(width, height) * radiusRatio,
      height,
      opacity: 1 - handoffProgress.value,
      transform: [
        {
          translateX: interpolate(
            progress,
            [0, 1],
            [fromX.value, toX.value],
            Extrapolation.CLAMP,
          ),
        },
        {
          translateY: interpolate(
            progress,
            [0, 1],
            [fromY.value, toY.value],
            Extrapolation.CLAMP,
          ),
        },
      ],
      width,
    };
  });

  const artworkStyle = useAnimatedStyle(() => {
    const progress = travelProgress.value;
    const frameWidth = interpolate(
      progress,
      [0, 1],
      [fromWidth.value, toWidth.value],
      Extrapolation.CLAMP,
    );
    const frameHeight = interpolate(
      progress,
      [0, 1],
      [fromHeight.value, toHeight.value],
      Extrapolation.CLAMP,
    );
    const sourceScale = coverScale(
      fromWidth.value,
      fromHeight.value,
      artworkWidth.value,
      artworkHeight.value,
    );
    const destinationScale = coverScale(
      toWidth.value,
      toHeight.value,
      artworkWidth.value,
      artworkHeight.value,
    );
    const scale = interpolate(
      progress,
      [0, 1],
      [sourceScale, destinationScale],
      Extrapolation.CLAMP,
    );
    const renderedWidth = artworkWidth.value * scale;
    const renderedHeight = artworkHeight.value * scale;

    return {
      height: renderedHeight,
      transform: [
        { translateX: (frameWidth - renderedWidth) / 2 },
        { translateY: (frameHeight - renderedHeight) / 2 },
      ],
      width: renderedWidth,
    };
  });

  const sceneBackdropStyle = useAnimatedStyle(() => {
    const progress = travelProgress.value;
    const opacity =
      phase.value === 0
        ? interpolate(
            progress,
            [0, 0.22, 0.5, 0.78, 1],
            [0, 0.01, 0.24, 0.76, 1],
            Extrapolation.CLAMP,
          )
        : interpolate(
            progress,
            [0, 0.18, 0.46, 0.76, 1],
            [1, 0.96, 0.68, 0.22, 0],
            Extrapolation.CLAMP,
          );

    const ownership = phase.value === 1 ? ownershipProgress.value : 1;
    return {
      opacity: opacity * ownership * (1 - handoffProgress.value),
    };
  });

  const heroOverlayStyle = useAnimatedStyle(() => {
    const progress = travelProgress.value;
    const opacity =
      phase.value === 0
        ? interpolate(progress, [0.48, 0.74, 1], [0, 0.45, 1], Extrapolation.CLAMP)
        : interpolate(progress, [0, 0.28, 0.58], [1, 0.6, 0], Extrapolation.CLAMP);

    return { opacity: opacity * (1 - handoffProgress.value) };
  });

  const kindStyle = useAnimatedStyle(() => {
    const progress = travelProgress.value;
    const opacity =
      phase.value === 0
        ? interpolate(progress, [0.6, 0.74, 0.88], [0, 0.5, 1], Extrapolation.CLAMP)
        : interpolate(progress, [0, 0.2, 0.38], [1, 0.45, 0], Extrapolation.CLAMP);
    const translateY =
      phase.value === 0
        ? interpolate(progress, [0.6, 0.88], [12, 0], Extrapolation.CLAMP)
        : interpolate(progress, [0, 0.38], [0, -8], Extrapolation.CLAMP);

    return {
      opacity: opacity * (1 - handoffProgress.value),
      transform: [{ translateY }],
    };
  });

  const titleStyle = useAnimatedStyle(() => {
    const progress = travelProgress.value;
    const opacity =
      phase.value === 0
        ? interpolate(progress, [0.68, 0.82, 0.96], [0, 0.52, 1], Extrapolation.CLAMP)
        : interpolate(progress, [0, 0.24, 0.44], [1, 0.48, 0], Extrapolation.CLAMP);
    const translateY =
      phase.value === 0
        ? interpolate(progress, [0.68, 0.96], [24, 0], Extrapolation.CLAMP)
        : interpolate(progress, [0, 0.44], [0, -12], Extrapolation.CLAMP);

    return {
      opacity: opacity * (1 - handoffProgress.value),
      transform: [{ translateY }],
    };
  });

  if (!transition) return null;

  const blurOverflow = WAVEN_DETAIL_HERO_BLUR_OVERFLOW;
  const targetBlurStyle = {
    height: sceneTarget.height + blurOverflow * 2,
    left: sceneTarget.x - blurOverflow,
    top: sceneTarget.y - blurOverflow,
    width: sceneTarget.width + blurOverflow * 2,
  };
  const targetHeroStyle = {
    height: sceneTarget.height,
    left: sceneTarget.x,
    top: sceneTarget.y,
    width: sceneTarget.width,
  };
  const copyLeft = sceneTarget.x + layout.gutter;
  const copyWidth = Math.max(
    1,
    Math.min(
      WAVEN_DETAIL_HERO_COPY_MAX_WIDTH,
      sceneTarget.width - layout.gutter * 2,
    ),
  );
  const copyBottom = wavenDetailHeroCopyBottom(
    transition.kind === 'artist' ? 'Artist' : 'Album',
  );

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={styles.layer}
    >
      <Animated.View style={[styles.sceneBackdrop, sceneBackdropStyle]}>
        <Animated.Image
          blurRadius={transition.kind === 'artist' ? 36 : 30}
          fadeDuration={0}
          resizeMode="cover"
          source={{ uri: transition.artworkUrl }}
          style={[styles.sceneBlur, targetBlurStyle]}
        />
      </Animated.View>

      <Animated.View style={[styles.frame, frameStyle]}>
        <Animated.Image
          fadeDuration={0}
          resizeMode="stretch"
          source={{ uri: transition.artworkUrl }}
          style={[styles.artworkCanvas, artworkStyle]}
        />
      </Animated.View>

      <Animated.View style={[styles.heroOverlay, targetHeroStyle, heroOverlayStyle]}>
        <WavenDetailHeroGradients />
      </Animated.View>

      <View
        style={[
          styles.sceneCopy,
          {
            height: sceneTarget.height,
            left: copyLeft,
            paddingBottom: copyBottom,
            top: sceneTarget.y,
            width: copyWidth,
          },
        ]}
      >
        <Animated.Text style={[wavenDetailHeroCopyStyles.kindLabel, kindStyle]}>
          {transition.kind.toUpperCase()}
        </Animated.Text>
        <Animated.Text
          numberOfLines={transition.kind === 'artist' ? 2 : 3}
          style={[
            wavenDetailHeroCopyStyles.heroTitle,
            transition.kind === 'artist'
              ? wavenDetailHeroCopyStyles.artistHeroTitle
              : null,
            titleStyle,
          ]}
        >
          {transition.title}
        </Animated.Text>
        <View style={wavenDetailHeroCopyStyles.heroSubtitleSlot} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 80,
  },
  sceneBackdrop: {
    backgroundColor: wavenColors.canvas,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  sceneBlur: {
    opacity: WAVEN_DETAIL_HERO_BLUR_OPACITY,
    position: 'absolute',
    transform: [{ scale: WAVEN_DETAIL_HERO_BLUR_SCALE }],
  },
  frame: {
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
  },
  artworkCanvas: {
    left: 0,
    position: 'absolute',
    top: 0,
  },
  heroOverlay: {
    overflow: 'hidden',
    position: 'absolute',
  },
  sceneCopy: {
    justifyContent: 'flex-end',
    maxWidth: WAVEN_DETAIL_HERO_COPY_MAX_WIDTH,
    position: 'absolute',
    zIndex: 5,
  },
});
