import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import {
  getWavenEntityRevealTransition,
  registerWavenEntityRevealAnchor,
  subscribeWavenEntityReveal,
  updateWavenEntityRevealAnchorFallback,
  type WavenEntityRevealRect,
  type WavenEntityRevealRole,
} from '../../features/navigation/wavenEntityReveal';

interface WavenEntityRevealAnchorProps {
  borderRadius?: number;
  children: ReactNode;
  entityKey: string;
  role: WavenEntityRevealRole;
  style?: StyleProp<ViewStyle>;
}

export function WavenEntityRevealAnchor({
  borderRadius = 0,
  children,
  entityKey,
  role,
  style,
}: WavenEntityRevealAnchorProps) {
  const ref = useRef<View>(null);
  const [fallback, setFallback] = useState<WavenEntityRevealRect | null>(null);
  const [transition, setTransition] = useState(getWavenEntityRevealTransition());

  const capture = useCallback(
    () =>
      new Promise<WavenEntityRevealRect | null>((resolve) => {
        requestAnimationFrame(() => {
          ref.current?.measureInWindow((x, y, width, height) => {
            if (width <= 1 || height <= 1) {
              resolve(null);
              return;
            }
            resolve({ x, y, width, height, borderRadius });
          });
        });
      }),
    [borderRadius],
  );

  useEffect(
    () => registerWavenEntityRevealAnchor(role, entityKey, capture, fallback),
    [capture, entityKey, fallback, role],
  );

  useEffect(
    () =>
      subscribeWavenEntityReveal(() => {
        setTransition(getWavenEntityRevealTransition());
      }),
    [],
  );

  const onLayout = useCallback(
    (_event: LayoutChangeEvent) => {
      void capture().then((rect) => {
        if (!rect) return;
        setFallback(rect);
        updateWavenEntityRevealAnchorFallback(role, entityKey, rect);
      });
    },
    [capture, entityKey, role],
  );

  const overlayOwnsOrigin =
    role === 'origin' &&
    transition?.entityKey === entityKey &&
    (
      (transition.phase === 'enter' && transition.visualReady) ||
      (transition.phase === 'exit' && transition.visualReady && !transition.originHandoffReady)
    );

  return (
    <View
      collapsable={false}
      onLayout={onLayout}
      ref={ref}
      style={[styles.anchor, style, overlayOwnsOrigin ? styles.overlayOwnedOrigin : null]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    alignSelf: 'stretch',
  },
  overlayOwnedOrigin: {
    opacity: 0,
  },
});
