import { useCallback, useEffect, useRef } from 'react';
import { Animated } from 'react-native';

/** Presentation owns its animation; route/filter and keyboard intent stay in Discover. */
export function useSearchArrivalAnimation(value: Animated.Value, reduceMotion: boolean) {
  const active = useRef<Animated.CompositeAnimation | null>(null);
  useEffect(() => {
    if (reduceMotion) { active.current?.stop(); value.setValue(1); }
    return () => active.current?.stop();
  }, [reduceMotion, value]);
  const animate = useCallback(() => {
    active.current?.stop();
    value.setValue(reduceMotion ? 1 : 0);
    if (!reduceMotion) {
      active.current = Animated.timing(value, { toValue: 1, duration: 190, useNativeDriver: true });
      active.current.start();
    }
  }, [reduceMotion, value]);
  return { animate, style: {
    opacity: reduceMotion ? 1 : value.interpolate({ inputRange: [0, 1], outputRange: [0.84, 1] }),
    transform: [{ scale: reduceMotion ? 1 : value.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) }],
  } };
}
