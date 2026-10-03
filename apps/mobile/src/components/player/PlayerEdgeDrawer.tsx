import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { Animated, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOrionTheme } from '../../context/ThemeContext';
import { resolveMotionPolicy } from '../../services/motionPolicy';
import { useMobilePlayerController } from '../../features/playback/MobilePlayerController';
import { PlayerChromeHandle } from './PlayerChromeHandle';
import { resolvePlayerDrawerLayout, type PlayerRect } from './playerDrawerLayout';

/** One drawer for every Orion surface; the existing controller still owns chrome intent. */
export function PlayerEdgeDrawer({ controlsVisible, onPress, occupied = [], contentWidth, children }: PropsWithChildren<{
  controlsVisible: boolean; onPress(open: boolean): void; occupied?: PlayerRect[]; contentWidth?: number;
}>) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { theme, preferences, systemReducedMotion } = useOrionTheme();
  const reducedMotion = resolveMotionPolicy(preferences?.reducedMotion === true, systemReducedMotion).reduceMotion;
  const controller = useMobilePlayerController();
  const blocked = controller.state.overlay !== 'none';
  const layout = resolvePlayerDrawerLayout(width, height, insets, occupied, contentWidth);
  const [openedFromGrip, setOpenedFromGrip] = useState(false);
  const visible = openedFromGrip && controlsVisible && !blocked;
  useEffect(() => {
    if (!controlsVisible || blocked) setOpenedFromGrip(false);
  }, [blocked, controlsVisible]);
  useEffect(() => { setOpenedFromGrip(false); }, [controller.state.activeSessionId]);
  const activateGrip = () => { const open = !visible; setOpenedFromGrip(open); onPress(open); };
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const [mounted, setMounted] = useState(visible);
  useEffect(() => {
    progress.stopAnimation();
    if (visible) setMounted(true);
    const animation = Animated.timing(progress, { toValue: visible ? 1 : 0, duration: reducedMotion ? 0 : 180, useNativeDriver: true });
    animation.start(({ finished }) => { if (finished && !visible) setMounted(false); });
    return () => animation.stop();
  }, [progress, reducedMotion, visible]);
  // Rotation changes interpolation geometry immediately; interrupted closure cannot leave a strip.
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [layout.closedTranslation, 0] });
  const tabTranslation = progress.interpolate({ inputRange: [0, 1], outputRange: [0,
    layout.edge === 'right' ? -layout.body.width : layout.body.width] });
  if (blocked || !layout.available) return null;
  return <View pointerEvents="box-none" style={[styles.host, { left: layout.safeLeft, right: layout.safeRight }]}>
    {mounted && <Animated.View pointerEvents={visible ? 'auto' : 'none'} accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'yes' : 'no-hide-descendants'}
      style={[styles.body, { left: layout.body.x - layout.safeLeft, top: layout.body.y, width: layout.body.width, height: layout.body.height,
        backgroundColor: theme.elevated, borderColor: theme.border, transform: [{ translateX }] }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} bounces={false}>{children}</ScrollView>
    </Animated.View>}
    {layout.available && <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { transform: [{ translateX: tabTranslation }] }]}>
      <PlayerChromeHandle controlsVisible={visible} onPress={activateGrip} edge={layout.edge} hit={{ ...layout.hit, x: layout.hit.x - layout.safeLeft }} />
    </Animated.View>}
  </View>;
}
const styles = StyleSheet.create({
  host: { ...StyleSheet.absoluteFill, overflow: 'hidden', zIndex: 200, pointerEvents: 'box-none' },
  body: { position: 'absolute', borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  content: { padding: 12, gap: 12 },
});
