import React, { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SidebarDrawer } from './SidebarDrawer';
import { useResponsiveLayout } from '../services/responsive';

export function FloatingSidebarTrigger() {
  const insets = useSafeAreaInsets();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { isTablet } = useResponsiveLayout();

  if (isTablet) return null;

  return (
    <>
      <View style={[styles.triggerContainer, { top: (insets.top || 12) + 8 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open navigation"
          accessibilityHint="Opens the Orion navigation drawer"
          hitSlop={4}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          onPress={() => setDrawerOpen(true)}
        >
          <BlurView intensity={85} tint="dark" style={styles.blurInner}>
            <Ionicons name="menu-outline" size={22} color="#ffffff" />
          </BlurView>
        </Pressable>
      </View>

      <SidebarDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  triggerContainer: {
    position: 'absolute',
    left: 16,
    zIndex: 999,
  },
  button: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  blurInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(5, 5, 10, 0.65)',
  },
  pressed: {
    transform: [{ scale: 0.94 }],
    opacity: 0.85,
  },
});
