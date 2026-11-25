import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState, Easing, StyleSheet, View } from 'react-native';
import type { TrackRowState } from '../../features/playback/trackPresentation';
import { useWavenReducedMotion } from '../../hooks/useWavenReducedMotion';
import { wavenColors, wavenLivingWaveMotion, wavenSpacing, wavenTypography, type LivingWaveMotionTokens } from '../../theme/tokens';
import { WavenText as Text } from '../typography/WavenText';

/** Presentation only. It receives identity-filtered Media3 state, never owns audio. */
export function WavenLivingWave({ state, motion = wavenLivingWaveMotion }: {
  state: TrackRowState;
  motion?: LivingWaveMotionTokens;
}) {
  return state === 'available' ? null : <LivingWaveIndicator state={state} motion={motion} />;
}

function LivingWaveIndicator({ state, motion }: { state: TrackRowState; motion: LivingWaveMotionTokens }) {
  // Stay still until the system preference is known, including on first mount.
  const reducedMotion = useWavenReducedMotion(true);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const phase = useRef<Animated.Value | null>(null);
  if (!phase.current) phase.current = new Animated.Value(0);
  const progress = phase.current;
  const periodicPhase = useMemo(() => Animated.modulo(progress, 1), [progress]);
  const barScales = useMemo(() => {
    const inputRange = Array.from({ length: 193 }, (_, sample) => sample / 192);
    return motion.scales.map((_, index) => periodicPhase.interpolate({
      inputRange,
      outputRange: inputRange.map(value => {
        const position = value * motion.scales.length + index;
        const segment = Math.floor(position), fraction = position - segment;
        const from = motion.scales[segment % motion.scales.length];
        const to = motion.scales[(segment + 1) % motion.scales.length];
        // Periodic smoothstep joins have matching value and zero velocity.
        const eased = fraction * fraction * (3 - 2 * fraction);
        return from + (to - from) * eased;
      }),
    }));
  }, [periodicPhase, motion.scales]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', value => setActive(value === 'active'));
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (state !== 'playing' || reducedMotion || !active) return;
    let disposed = false;
    let animation: ReturnType<typeof Animated.loop> | undefined;
    progress.stopAnimation(value => {
      if (disposed) return;
      const start = ((value % 1) + 1) % 1;
      progress.setValue(start);
      // Android repeats from this captured start, including after pause/resume.
      // A full turn plus modulo preserves the same pose at every loop boundary.
      animation = Animated.loop(Animated.timing(progress, {
        toValue: start + 1, duration: motion.cycleMs, easing: Easing.linear,
        useNativeDriver: true, isInteraction: false,
      }));
      animation.start();
    });
    return () => {
      disposed = true;
      animation?.stop();
      // Keep the current pose when paused. No JS frame callbacks or state ticks.
      progress.stopAnimation();
    };
  }, [state, reducedMotion, active, progress, motion.cycleMs]);

  const label = state === 'playing' ? 'Currently playing' : state === 'paused' ? 'Paused'
    : state === 'preparing' ? 'Preparing audio' : state === 'buffering' ? 'Buffering audio' : 'Playback failed. Retry';
  const showBars = state === 'playing' || state === 'paused';
  return <View accessible accessibilityLabel={label} accessibilityLiveRegion="polite" style={styles.indicator}>
    {showBars ? <View accessible={false} style={[styles.bars, { gap: motion.barGap, height: motion.barHeight }]}>
      {barScales.map((scaleY, index) => <Animated.View key={index} style={{
        width: motion.barWidth, height: motion.barHeight, borderRadius: motion.barWidth,
        backgroundColor: wavenColors.interactionBlue,
        transform: [{ scaleY }],
      }} />)}
    </View> : null}
    {state !== 'playing' ? <Text style={styles.label}>{state === 'preparing' ? 'Preparing'
      : state === 'buffering' ? 'Buffering' : state === 'failed' ? 'Retry' : 'Paused'}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({
  indicator: { alignItems: 'center', justifyContent: 'center', gap: wavenSpacing.xxs },
  bars: { flexDirection: 'row', alignItems: 'center' },
  label: { ...wavenTypography.caption, color: wavenColors.interactionBlue },
});
