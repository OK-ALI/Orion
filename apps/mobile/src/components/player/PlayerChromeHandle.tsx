import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface PlayerChromeHandleProps {
  controlsVisible: boolean;
  onPress(): void;
}

/**
 * One stable, safe-area-aware control handle shared by native and embedded
 * playback. It is anchored to the viewport rather than a toolbar row, so its
 * position cannot drift when the surrounding chrome changes layout.
 */
export function PlayerChromeHandle({ controlsVisible, onPress }: PlayerChromeHandleProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const safeWidth = Math.max(76, width - insets.left - insets.right);
  const centeredLeft = insets.left + (safeWidth / 2) - 38;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={controlsVisible ? 'Hide player controls' : 'Show player controls'}
      hitSlop={4}
      onPress={onPress}
      style={[styles.handle, { left: centeredLeft, top: Math.max(insets.top, 8) }]}
    >
      <View style={styles.bar} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  handle: {
    position: 'absolute',
    zIndex: 1200,
    width: 76,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
});
