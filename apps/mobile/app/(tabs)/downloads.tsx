import React from 'react';
import { View, Text, StyleSheet, Platform, Pressable } from 'react-native';
import { text, backgrounds, spacing, fontSizes, accent, radii } from '@orion/shared/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useOrionTheme } from '../../src/context/ThemeContext';
import { useResponsiveLayout } from '../../src/services/responsive';

export default function DownloadsScreen() {
  const router = useRouter();
  const { theme } = useOrionTheme();
  const { isTablet } = useResponsiveLayout();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={[theme.accentSoft, theme.background, theme.background, theme.elevated]}
        locations={[0, 0.35, 0.75, 1]}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Top Header — Padded past left floating sidebar trigger (≡) */}
      <View style={[styles.header, isTablet && styles.headerTablet]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Downloads</Text>
        <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Offline Media Vault</Text>
      </View>

      {/* Locked Downloader State Card */}
      <View style={styles.content}>
        <View style={[styles.lockedCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.iconContainer, { backgroundColor: theme.accentSoft }]}>
            <View style={[styles.iconGlow, { backgroundColor: theme.accentSoft }]} />
            <Ionicons name="construct-outline" size={44} color={theme.accent} />
          </View>

          <View style={[styles.badge, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}>
            <Text style={[styles.badgeText, { color: theme.accent }]}>STABILIZATION BOUNDARY</Text>
          </View>

          <Text style={[styles.cardTitle, { color: theme.text }]}>Mobile downloads are locked</Text>

          <Text style={[styles.message, { color: theme.textSecondary }]}>
            Protected and segmented streams require a resumable native engine that Orion Mobile does not yet ship. No simulated job will be created or marked complete.
          </Text>

          <Text style={[styles.subMessage, { color: theme.textMuted }]}>
            Desktop downloads remain available. Mobile support will unlock only after background execution, recovery and file integrity pass real-device testing.
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              { backgroundColor: theme.accent },
              pressed && { opacity: 0.85 },
            ]}
            onPress={() => router.push('/')}
          >
            <Ionicons name="compass-outline" size={18} color={theme.onAccent} />
            <Text style={[styles.actionBtnText, { color: theme.onAccent }]}>Explore Orion Catalog</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: backgrounds.base,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 36,
    paddingBottom: spacing[4],
    paddingLeft: 72,
    paddingRight: spacing[4],
  },
  headerTablet: { paddingLeft: spacing[8], paddingTop: spacing[8] },
  headerTitle: {
    color: '#ffffff',
    fontSize: fontSizes['2xl'],
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    color: text.muted,
    fontSize: fontSizes.xs,
    fontWeight: '600',
    marginTop: 2,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingBottom: 60,
  },
  lockedCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: 'rgba(13, 13, 22, 0.85)',
    borderRadius: radii['2xl'],
    padding: spacing[6],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.35)',
    boxShadow: '0 8px 32px rgba(229, 9, 20, 0.15)',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
    position: 'relative',
  },
  iconGlow: {
    position: 'absolute',
    inset: -8,
    borderRadius: 48,
    backgroundColor: 'rgba(229, 9, 20, 0.2)',
  },
  badge: {
    backgroundColor: 'rgba(229, 9, 20, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.4)',
    marginBottom: spacing[3],
  },
  badgeText: {
    color: '#f87171',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: spacing[3],
  },
  message: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: spacing[3],
  },
  subMessage: {
    color: text.muted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginBottom: spacing[6],
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: accent.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: radii.xl,
    width: '100%',
    shadowColor: accent.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
});
