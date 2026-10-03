import { PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useOrionTheme } from '../../context/ThemeContext';
import type { DrawerEdge, PlayerRect } from './playerDrawerLayout';

interface PlayerChromeHandleProps {
  controlsVisible: boolean;
  onPress(): void;
  edge: DrawerEdge;
  hit: PlayerRect;
}

/**
 * Small edge grip with a bounded accessible target. The shared drawer supplies
 * current safe geometry; no provider owns or duplicates this control.
 */
export function PlayerChromeHandle({ controlsVisible, onPress, edge, hit }: PlayerChromeHandleProps) {
  const { theme } = useOrionTheme();
  const swipe = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderRelease: (_, gesture) => {
      const inward = edge === 'right' ? -gesture.dx : gesture.dx;
      if ((!controlsVisible && inward > 18) || (controlsVisible && inward < -18)) onPress();
    },
  }), [controlsVisible, edge, onPress]);
  return (
    <Pressable
      {...swipe.panHandlers}
      accessibilityRole="button"
      accessibilityLabel={controlsVisible ? 'Hide player controls' : 'Show player controls'}
      accessibilityState={{ expanded: controlsVisible }}
      onPress={onPress}
      style={[styles.handle, { left: hit.x, top: hit.y, width: hit.width, height: hit.height,
        alignItems: edge === 'right' ? 'flex-end' : 'flex-start' }]}
    >
      <View style={[styles.tab, { backgroundColor: theme.elevated, borderColor: theme.border,
        borderTopLeftRadius: edge === 'right' ? 10 : 0, borderBottomLeftRadius: edge === 'right' ? 10 : 0,
        borderTopRightRadius: edge === 'left' ? 10 : 0, borderBottomRightRadius: edge === 'left' ? 10 : 0 }]}>
        <Ionicons name={(edge === 'right') !== controlsVisible ? 'chevron-back' : 'chevron-forward'} size={12} color={theme.textSecondary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  handle: {
    position: 'absolute',
    zIndex: 1200,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tab: {
    width: 14,
    height: 28,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
});
