import { useEffect, useRef, useState } from 'react';
import { Animated, Keyboard, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOrionTheme } from '../context/ThemeContext';

/**
 * A single app-level express lane into Discover search.
 * Native Modals naturally render above this layer, and playback routes opt out
 * entirely so Orion never places browsing chrome over the streaming surface.
 */
export function GlobalSearchShortcut() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { theme, preferences } = useOrionTheme();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  const streaming = pathname.startsWith('/player');
  if (streaming || keyboardVisible) return null;

  const openSearch = () => {
    const request = String(Date.now());
    const navigate = () => {
      if (pathname === '/discover') {
        router.setParams({ focusSearch: request });
      } else {
        router.push({ pathname: '/discover', params: { focusSearch: request } } as any);
      }
      scale.setValue(1);
      opacity.setValue(1);
    };

    if (preferences.reducedMotion) {
      navigate();
      return;
    }

    Animated.parallel([
      Animated.timing(scale, { toValue: 0.88, duration: 105, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.42, duration: 105, useNativeDriver: true }),
    ]).start(navigate);
  };

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.layer,
        { right: Math.max(insets.right, 12) + 14, bottom: Math.max(insets.bottom, 8) + 18 },
      ]}
    >
      <Animated.View style={{ transform: [{ scale }], opacity }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search Orion"
          accessibilityHint="Opens Discover and focuses search"
          hitSlop={4}
          onPress={openSearch}
          style={({ pressed }) => [
            styles.button,
            {
              borderColor: theme.border,
              shadowColor: theme.dark ? '#000000' : theme.accent,
            },
            pressed && styles.pressed,
          ]}
        >
          <BlurView
            intensity={78}
            tint={theme.dark ? 'dark' : 'light'}
            pointerEvents="none"
            style={styles.glassInner}
          >
            <View
              style={[
                styles.glassWash,
                { backgroundColor: theme.dark ? 'rgba(5, 7, 12, 0.34)' : 'rgba(255, 255, 255, 0.30)' },
              ]}
            />
            <View
              style={[
                styles.accentHalo,
                { backgroundColor: theme.accentSoft, opacity: theme.dark ? 0.34 : 0.22 },
              ]}
            />
            <Ionicons name="search" size={20} color={theme.accent} />
          </BlurView>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    zIndex: 9000,
    elevation: 18,
  },
  button: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 14,
  },
  glassInner: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  glassWash: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  accentHalo: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  pressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.82,
  },
});
