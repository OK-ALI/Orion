import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { spacing, radii } from '@orion/shared/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useOrionTheme } from '../../src/context/ThemeContext';
import { useResponsiveLayout } from '../../src/services/responsive';
import { MobilePageHeader } from '../../src/components/MobilePageHeader';

export default function DownloadsScreen() {
  const router = useRouter();
  const { theme } = useOrionTheme();
  useResponsiveLayout();

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
      <MobilePageHeader eyebrow="OFFLINE" title="Downloads" subtitle="Your offline media vault and download availability." />

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
    borderRadius: radii['2xl'],
    padding: spacing[6],
    alignItems: 'center',
    borderWidth: 1,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
    position: 'relative',
  },
  iconGlow: {
    position: 'absolute',
    inset: -8,
    borderRadius: 48,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.full,
    borderWidth: 1,
    marginBottom: spacing[3],
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: spacing[3],
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: spacing[3],
  },
  subMessage: {
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
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: radii.xl,
    width: '100%',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
