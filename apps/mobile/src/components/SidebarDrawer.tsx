import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Platform, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { accent, fontFamilies, fontSizes, radii, spacing, text } from '@orion/shared/tokens';
import { useOrionTheme } from '../context/ThemeContext';
import { useNetworkStatus } from '../context/NetworkContext';
import { getMobileConnectionPresentation } from './mobileConnectionPresentationPolicy';
import { useOrionAccount } from '../context/AccountContext';

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
  const { state: accountState } = useOrionAccount();

  const accountProfile = accountState.profile;
  const accountName = accountState.phase === 'restoring'
    ? 'Orion profile'
    : accountProfile?.displayName?.trim()
      || accountProfile?.givenName?.trim()
      || (accountProfile ? accountProfile.email : 'Local profile');
  const accountStatus = accountState.phase === 'restoring'
    ? 'Checking connection...'
    : accountState.phase === 'signing-in'
      ? 'Connecting Google...'
      : accountState.phase === 'signing-out'
        ? 'Disconnecting Google...'
        : accountProfile
          ? 'Google connected'
          : 'Google not connected';

  const network = useNetworkStatus();
  const presentation = getMobileConnectionPresentation(network.productState);
  const pingMs = network.latencyMs;
  const connectionLabel = network.productState === 'online'
    ? `Online${pingMs !== null ? ` · ${pingMs} ms` : ''}`
    : presentation.footer;

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
                  const localAvailable = item.id === 'downloads' && presentation.localDownloads;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={localAvailable ? 'Downloads. Local media remains available.' : item.name}
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
                      <View style={styles.menuCopy}>
                        <Text style={[styles.menuText, { color: theme.textSecondary }, isActive && styles.menuTextActive, isActive && { color: theme.text }]}>{item.name}</Text>
                        {localAvailable && (
                          <Text style={[styles.localBadge, { color: theme.text, backgroundColor: theme.elevated, borderColor: theme.border }]}>LOCAL</Text>
                        )}
                      </View>
                      {isActive ? <View style={[styles.activeDot, { backgroundColor: theme.accent, shadowColor: theme.accent }]} /> : <Ionicons name="chevron-forward" size={14} color={theme.textMuted} />}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${accountName}. ${accountStatus}. Open Account settings`}
            accessibilityHint="Opens Orion Account settings"
            onPress={() => handleNavigate('/settings')}
            style={({ pressed }) => [
              styles.accountCard,
              { backgroundColor: theme.elevated, borderColor: theme.border },
              pressed && { backgroundColor: theme.surfaceHover },
            ]}
          >
            <View style={[styles.accountAvatarShell, { backgroundColor: theme.accentSoft, borderColor: theme.border }]}>
              {accountProfile?.avatarUrl ? (
                <Image source={{ uri: accountProfile.avatarUrl }} style={styles.accountAvatarImage} />
              ) : (
                <Ionicons name="person-circle-outline" size={28} color={theme.accent} />
              )}
            </View>
            <View style={styles.accountCopy}>
              <Text numberOfLines={2} style={[styles.accountName, { color: theme.text }]}>{accountName}</Text>
              <Text numberOfLines={2} style={[styles.accountStatus, { color: theme.textMuted }]}>{accountStatus}</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={theme.textMuted} />
          </Pressable>
          <View accessible accessibilityLabel={`Orion Mobile. ${connectionLabel}`} style={[styles.footerCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: theme[presentation.tone], shadowColor: theme[presentation.tone] }]} />
              <Text style={[styles.statusText, { color: theme.text }]}>Orion Mobile</Text>
            </View>
            <Text style={[styles.versionText, { color: theme.textMuted }]}>
              {connectionLabel}
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
  menuCopy: { flex: 1, minWidth: 0 },
  localBadge: {
    alignSelf: 'flex-start',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  menuText: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: fontSizes.sm,
    fontFamily: fontFamilies.heading,
    fontWeight: '600',
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
  accountCard: {
    minHeight: 60,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: spacing[3],
  },
  accountAvatarShell: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  accountAvatarImage: {
    width: '100%',
    height: '100%',
  },
  accountCopy: {
    flex: 1,
    minWidth: 0,
  },
  accountName: {
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  accountStatus: {
    fontSize: 10.5,
    fontWeight: '500',
    lineHeight: 14,
    marginTop: 1,
  },
  footerCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: Platform.OS === 'ios' ? 30 : 20,
    marginTop: spacing[2],
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
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  statusText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  versionText: {
    fontSize: 11,
    paddingLeft: 16,
    fontWeight: '500',
  },
});
