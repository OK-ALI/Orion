import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useState } from 'react';
import { BlurView } from 'expo-blur';
import { fontFamilies } from '@orion/shared/tokens';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SidebarDrawer } from './SidebarDrawer';

export function CustomHeader() {
  const insets = useSafeAreaInsets();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
        <BlurView intensity={75} tint="dark" style={styles.blurBackground}>
          <View style={styles.content}>
            {/* Hamburger Sidebar Trigger */}
            <Pressable 
              onPress={() => setDrawerOpen(true)} 
              style={({ pressed }) => [styles.menuBtn, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="menu-outline" size={24} color="#fff" />
            </Pressable>

            {/* Logo */}
            <Text style={styles.logo}>ORION</Text>
            
            {/* Status Bubble */}
            <View style={styles.statusBubble}>
              <View style={styles.statusDot} />
              <Ionicons name="cloud-outline" size={14} color="#67e8f9" />
            </View>
          </View>
          <View style={styles.bottomBorder} />
        </BlurView>
      </View>

      {/* Collapsible Sidebar Drawer */}
      <SidebarDrawer 
        visible={drawerOpen} 
        onClose={() => setDrawerOpen(false)} 
      />
    </>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  blurBackground: {
    width: '100%',
  },
  content: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  menuBtn: {
    padding: 6,
  },
  logo: {
    fontFamily: fontFamilies.display,
    fontWeight: '900',
    fontSize: 22,
    color: '#ffffff',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(103, 232, 249, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  statusBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(103, 232, 249, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(103, 232, 249, 0.25)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#67e8f9',
    shadowColor: '#67e8f9',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  bottomBorder: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
});
