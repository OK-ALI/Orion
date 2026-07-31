import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing } from '@orion/shared/tokens';
import { useOrionTheme } from '../context/ThemeContext';

interface DownloadModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  tmdbId?: string;
  type?: 'movie' | 'tv';
  posterPath?: string;
  season?: number;
  episode?: number;
  streamUrl?: string;
}

export function DownloadModal({
  visible,
  onClose,
  title,
}: DownloadModalProps) {
  const { theme } = useOrionTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={[styles.card, { backgroundColor: theme.elevated, borderColor: theme.border }]}>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={20} color={theme.text} />
          </Pressable>

          <View style={[styles.iconContainer, { backgroundColor: theme.accentSoft }]}>
            <View style={[styles.iconGlow, { backgroundColor: theme.accentSoft }]} />
            <Ionicons name="lock-closed-outline" size={38} color={theme.accent} />
          </View>

          <View style={[styles.badge, { backgroundColor: theme.accentSoft, borderColor: theme.border }]}>
            <Text style={[styles.badgeText, { color: theme.accent }]}>LOCKED DURING STABILIZATION</Text>
          </View>

          <Text style={[styles.cardTitle, { color: theme.text }]}>Mobile downloads unavailable</Text>
          {title && <Text style={[styles.mediaTitle, { color: theme.textMuted }]}>Selected: {title}</Text>}

          <Text style={[styles.message, { color: theme.textSecondary }]}>
            Protected and segmented streams need a real native, resumable background engine. Orion will not create a simulated job or report a false completion.
          </Text>

          <Pressable style={[styles.actionBtn, { backgroundColor: theme.accent }]} onPress={onClose}>
            <Text style={[styles.actionBtnText, { color: theme.onAccent }]}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: radii['2xl'],
    padding: spacing[6],
    alignItems: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 6,
  },
  iconContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[3],
    position: 'relative',
  },
  iconGlow: {
    position: 'absolute',
    inset: -6,
    borderRadius: 40,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    marginBottom: spacing[3],
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 4,
  },
  mediaTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
  },
  message: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: spacing[5],
  },
  actionBtn: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: radii.xl,
    width: '100%',
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
