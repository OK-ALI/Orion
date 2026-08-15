import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { accent, fontFamilies, fontSizes, radii, spacing, text } from '@orion/shared/tokens';
import { useOrionTheme } from '../context/ThemeContext';
import { useNetworkStatus } from '../context/NetworkContext';

interface SidebarDrawerProps {
  visible: boolean;
  onClose: () => void;
  persistent?: boolean;
}

const NAV_SECTIONS = [
  {
    id: 'browse',
    label: 'BROWSE',
    items: [
      { id: 'home', name: 'Home', icon: 'home-outline', activeIcon: 'home', route: '/' },
      { id: 'discover', name: 'Discover & Search', icon: 'compass-outline', activeIcon: 'compass', route: '/discover' },
    ],
  },
  {
    id: 'your-orion',
    label: 'YOUR ORION',
    items: [
      { id: 'library', name: 'Library', icon: 'library-outline', activeIcon: 'library', route: '/library' },
      { id: 'downloads', name: 'Downloads', icon: 'download-outline', activeIcon: 'download', route: '/downloads' },
    ],
  },
  {
    id: 'connect',
    label: 'CONNECT',
    items: [
      { id: 'connect', name: 'Smart Remote', icon: 'wifi-outline', activeIcon: 'wifi', route: '/connect' },
    ],
  },
  {
    id: 'system',
    label: 'SYSTEM',
    items: [
      { id: 'settings', name: 'Settings', icon: 'settings-outline', activeIcon: 'settings', route: '/settings' },
    ],
  },
] as const;

export function SidebarDrawer({ visible, onClose, persistent = false }: SidebarDrawerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme } = useOrionTheme();

  const network = useNetworkStatus();
  const isOnline = network.online && network.internetReachable !== false;
  const pingMs = network.latencyMs;

  const handleNavigate = (route: string) => {
    onClose();
    router.push(route as any);
  };

  const drawerContent = (
        <View accessibilityViewIsModal={!persistent} style={[styles.drawer, persistent && styles.drawerPersistent, { backgroundColor: theme.background }]}>
          <LinearGradient
            colors={[theme.accentSoft, theme.elevated, theme.background]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.rightGlowBorder, { backgroundColor: theme.border }]} />
          <View style={styles.header}>
            <View style={styles.brandRow}><Text style={[styles.logo, { color: theme.text }]}>ORION</Text></View>
            {!persistent && (
              <Pressable accessibilityRole="button" accessibilityLabel="Close navigation" accessibilityHint="Closes the Orion navigation drawer" hitSlop={6} onPress={onClose} style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}>
                <Ionicons name="close" size={20} color={theme.text} />
              </Pressable>
            )}
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={styles.menuContainer} contentContainerStyle={styles.menuContent}>
            {NAV_SECTIONS.map((section, sectionIndex) => (
              <View key={section.id} style={sectionIndex > 0 ? styles.sectionBlock : undefined}>
                <Text accessibilityRole="header" style={[styles.sectionTitle, { color: theme.textMuted }]}>{section.label}</Text>
                {section.items.map((item) => {
                  const isActive = pathname === item.route || (item.route !== '/' && pathname.startsWith(item.route));
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={item.name}
                      accessibilityState={{ selected: isActive }}
                      key={item.id}
                      style={({ pressed }) => [
                        styles.menuRow,
                        isActive && styles.menuRowActive,
                        isActive && { backgroundColor: theme.accentSoft, borderColor: theme.accent, shadowColor: theme.accent },
                        pressed && styles.menuRowHover,
                      ]}
                      onPress={() => handleNavigate(item.route)}
                    >
                      <View
                        style={[
                          styles.iconBadge,
                          isActive && styles.iconBadgeActive,
                          isActive && { backgroundColor: theme.accent, borderColor: theme.accent, shadowColor: theme.accent },
                        ]}
                      >
                        <Ionicons name={(isActive ? item.activeIcon : item.icon) as any} size={18} color={isActive ? theme.onAccent : theme.textSecondary} />
                      </View>
                      <Text style={[styles.menuText, { color: theme.textSecondary }, isActive && styles.menuTextActive, isActive && { color: theme.text }]}>{item.name}</Text>
                      {isActive ? <View style={[styles.activeDot, { backgroundColor: theme.accent, shadowColor: theme.accent }]} /> : <Ionicons name="chevron-forward" size={14} color={theme.textMuted} />}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>
          <View style={[styles.footerCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: isOnline ? '#10b981' : '#ef4444' }]} />
              <Text style={[styles.statusText, { color: theme.text }]}>Orion Mobile</Text>
            </View>
            <Text style={[styles.versionText, { color: theme.textMuted }]}>
              {isOnline ? `Online${pingMs !== null ? ` · ${pingMs} ms` : ''}` : 'Offline Mode'}
            </Text>
          </View>
        </View>
  );

  if (persistent) return visible ? drawerContent : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable accessible={false} importantForAccessibility="no-hide-descendants" style={styles.backdrop} onPress={onClose} />
        {drawerContent}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  drawer: {
    width: 285,
    height: '100%',
    backgroundColor: '#0d0918',
    paddingTop: Platform.OS === 'ios' ? 50 : 35,
    paddingHorizontal: spacing[4],
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 25,
    position: 'relative',
  },
  drawerPersistent: {
    width: 272,
    paddingTop: Platform.OS === 'ios' ? 54 : 32,
    shadowOpacity: 0.25,
    elevation: 8,
    flexShrink: 0,
  },
  rightGlowBorder: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing[4],
    marginBottom: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    fontFamily: fontFamilies.display,
    fontWeight: '900',
    fontSize: 24,
    color: '#ffffff',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(103, 232, 249, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  menuContainer: {
    flex: 1,
  },
  menuContent: {
    paddingBottom: spacing[2],
  },
  sectionBlock: {
    marginTop: spacing[3],
  },
  sectionTitle: {
    color: text.muted,
    fontSize: 10,
    fontFamily: fontFamilies.heading,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: spacing[3],
    paddingLeft: spacing[2],
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.xl,
    marginBottom: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  menuRowHover: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  menuRowActive: {
    backgroundColor: 'rgba(229, 9, 20, 0.18)',
    borderColor: 'rgba(229, 9, 20, 0.4)',
    shadowColor: accent.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  iconBadgeActive: {
    backgroundColor: accent.primary,
    borderColor: accent.primary,
    shadowColor: accent.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  menuText: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.heading,
    fontWeight: '600',
    flex: 1,
  },
  menuTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: accent.primary,
    shadowColor: accent.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  footerCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: Platform.OS === 'ios' ? 30 : 20,
    marginTop: spacing[3],
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  versionText: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 11,
    paddingLeft: 16,
    fontWeight: '500',
  },
});
