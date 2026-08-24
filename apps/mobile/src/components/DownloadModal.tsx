import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontSizes, radii, spacing } from '@orion/shared/tokens';
import type { MobileDownloadPreferencesV1 } from '@orion/shared/types';
import { useOrionTheme } from '../context/ThemeContext';
import { useResponsiveLayout } from '../services/responsive';
import { getMobileDownloadCapability } from '../services/downloadManager';
import type { MobileDownloadTargetV1 } from '../features/downloads/downloadIdentity';
import {
  getMobileDownloadPreferencesV1,
  setMobileDownloadDefaultDestinationV1,
  subscribeMobileDownloadPreferencesV1,
} from '../features/downloads/downloadPreferences';

interface DownloadModalProps {
  visible: boolean;
  onClose: () => void;
  target: MobileDownloadTargetV1 | null;
}

export function DownloadModal({ visible, onClose, target }: DownloadModalProps) {
  const { theme } = useOrionTheme();
  const { isTablet } = useResponsiveLayout();
  const capability = getMobileDownloadCapability();
  const [preferences, setPreferences] = useState<MobileDownloadPreferencesV1>(getMobileDownloadPreferencesV1);

  useEffect(() => subscribeMobileDownloadPreferencesV1(setPreferences), []);

  const isEpisode = target?.media.mediaType === 'tv' && target.media.season !== null && target.media.episode !== null;
  const displayTitle = isEpisode
    ? `${target?.media.seriesTitle || target?.media.title} · S${target?.media.season} E${target?.media.episode}`
    : target?.media.title || 'Download';
  const supportingTitle = isEpisode ? target?.media.episodeTitle : null;
  const needsEpisode = target?.media.mediaType === 'tv' && !isEpisode;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close download options" style={styles.backdrop} onPress={onClose} />

        <View style={[styles.card, isTablet && styles.cardTablet, { backgroundColor: theme.elevated, borderColor: theme.border }]}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={[styles.eyebrow, { color: theme.textMuted }]}>DOWNLOAD</Text>
              <Text accessibilityRole="header" style={[styles.cardTitle, { color: theme.text }]} numberOfLines={2}>{displayTitle}</Text>
              {supportingTitle ? <Text style={[styles.mediaTitle, { color: theme.textSecondary }]} numberOfLines={2}>{supportingTitle}</Text> : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close download options"
              style={({ pressed }) => [styles.closeBtn, { backgroundColor: pressed ? theme.surfaceHover : theme.surface, borderColor: theme.border }]}
              onPress={onClose}
            >
              <Ionicons name="close" size={20} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {needsEpisode ? (
              <View style={[styles.notice, { backgroundColor: theme.surfaceHover, borderColor: theme.border }]}>
                <Ionicons name="list-outline" size={19} color={theme.accent} />
                <View style={styles.noticeCopy}>
                  <Text style={[styles.noticeTitle, { color: theme.text }]}>Choose an episode</Text>
                  <Text style={[styles.description, { color: theme.textSecondary }]}>Open an episode below this title to download it for offline playback.</Text>
                </View>
              </View>
            ) : null}

            <Text accessibilityRole="header" style={[styles.groupTitle, { color: theme.text }]}>Save to</Text>
            <View style={styles.optionGrid}>
              <Pressable
                accessibilityRole="radio"
                accessibilityLabel="Save to Orion Library"
                accessibilityState={{ checked: preferences.defaultDestination === 'orion-library' }}
                onPress={() => setPreferences(setMobileDownloadDefaultDestinationV1('orion-library'))}
                style={({ pressed }) => [
                  styles.optionCard,
                  {
                    backgroundColor: preferences.defaultDestination === 'orion-library' ? theme.accentSoft : pressed ? theme.surfaceHover : theme.surface,
                    borderColor: preferences.defaultDestination === 'orion-library' ? theme.accent : theme.border,
                  },
                ]}
              >
                <Ionicons name="albums-outline" size={21} color={preferences.defaultDestination === 'orion-library' ? theme.accent : theme.textSecondary} />
                <View style={styles.optionCopy}>
                  <Text style={[styles.optionTitle, { color: theme.text }]}>Orion Library</Text>
                  <Text style={[styles.description, { color: theme.textSecondary }]}>Managed by Orion and ready for offline playback.</Text>
                </View>
                <Ionicons name={preferences.defaultDestination === 'orion-library' ? 'radio-button-on' : 'radio-button-off'} size={20} color={preferences.defaultDestination === 'orion-library' ? theme.accent : theme.textMuted} />
              </Pressable>

              <Pressable
                accessibilityRole="radio"
                accessibilityLabel="Save to Device Storage"
                accessibilityState={{ checked: preferences.defaultDestination === 'device-storage' }}
                onPress={() => setPreferences(setMobileDownloadDefaultDestinationV1('device-storage'))}
                style={({ pressed }) => [
                  styles.optionCard,
                  {
                    backgroundColor: preferences.defaultDestination === 'device-storage' ? theme.accentSoft : pressed ? theme.surfaceHover : theme.surface,
                    borderColor: preferences.defaultDestination === 'device-storage' ? theme.accent : theme.border,
                  },
                ]}
              >
                <Ionicons name="folder-open-outline" size={21} color={preferences.defaultDestination === 'device-storage' ? theme.accent : theme.textSecondary} />
                <View style={styles.optionCopy}>
                  <Text style={[styles.optionTitle, { color: theme.text }]}>Device Storage</Text>
                  <Text style={[styles.description, { color: theme.textSecondary }]}>A user-visible file when the selected source supports it.</Text>
                </View>
                <Ionicons name={preferences.defaultDestination === 'device-storage' ? 'radio-button-on' : 'radio-button-off'} size={20} color={preferences.defaultDestination === 'device-storage' ? theme.accent : theme.textMuted} />
              </Pressable>
            </View>

            <View style={[styles.preferenceRow, { borderColor: theme.border }]}>
              <View style={styles.preferenceCopy}>
                <Text style={[styles.preferenceLabel, { color: theme.textMuted }]}>QUALITY</Text>
                <Text style={[styles.preferenceValue, { color: theme.text }]}>{preferences.preferredQuality === 'best' ? 'Best available' : preferences.preferredQuality}</Text>
              </View>
              <View style={styles.preferenceCopy}>
                <Text style={[styles.preferenceLabel, { color: theme.textMuted }]}>SUBTITLES</Text>
                <Text style={[styles.preferenceValue, { color: theme.text }]}>{preferences.subtitlePreference === 'preferred' ? 'Preferred' : 'Manual'}</Text>
              </View>
            </View>

            {!capability.available ? (
              <View style={[styles.notice, { backgroundColor: theme.surfaceHover, borderColor: theme.border }]}>
                <Ionicons name="time-outline" size={19} color={theme.textMuted} />
                <View style={styles.noticeCopy}>
                  <Text style={[styles.noticeTitle, { color: theme.text }]}>Waiting for download support</Text>
                  <Text style={[styles.description, { color: theme.textSecondary }]}>{capability.reason}</Text>
                </View>
              </View>
            ) : null}
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: theme.border }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel download options"
              onPress={onClose}
              style={({ pressed }) => [styles.secondaryButton, { borderColor: theme.border, backgroundColor: pressed ? theme.surfaceHover : theme.surface }]}
            >
              <Text style={[styles.secondaryButtonText, { color: theme.textSecondary }]}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={needsEpisode ? 'Choose an episode before downloading' : 'Start download unavailable on this build'}
              accessibilityState={{ disabled: true }}
              disabled
              style={[styles.primaryButton, { backgroundColor: theme.accentSoft, borderColor: theme.border }]}
            >
              <Text style={[styles.primaryButtonText, { color: theme.textMuted }]}>{needsEpisode ? 'Choose episode' : 'Start download'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing[4], paddingVertical: spacing[6] },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0, 0, 0, 0.78)' },
  card: { width: '100%', maxWidth: 460, maxHeight: '88%', borderRadius: radii['2xl'], borderWidth: 1, overflow: 'hidden' },
  cardTablet: { maxWidth: 560 },
  header: { padding: spacing[5], paddingBottom: spacing[3], flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  cardTitle: { fontSize: 21, lineHeight: 26, fontWeight: '900', marginTop: 3 },
  mediaTitle: { fontSize: fontSizes.sm, lineHeight: 19, marginTop: 3, fontWeight: '700' },
  closeBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: spacing[5], paddingBottom: spacing[4], gap: spacing[3] },
  groupTitle: { fontSize: fontSizes.sm, fontWeight: '900', marginTop: spacing[1] },
  optionGrid: { gap: spacing[2] },
  optionCard: { minHeight: 76, borderWidth: 1, borderRadius: radii.xl, padding: spacing[3], flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  optionCopy: { flex: 1, minWidth: 0 },
  optionTitle: { fontSize: fontSizes.sm, fontWeight: '900' },
  description: { fontSize: fontSizes.xs, lineHeight: 17, marginTop: 3 },
  preferenceRow: { borderWidth: 1, borderRadius: radii.xl, padding: spacing[3], flexDirection: 'row', gap: spacing[4] },
  preferenceCopy: { flex: 1, minWidth: 0 },
  preferenceLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  preferenceValue: { fontSize: fontSizes.sm, fontWeight: '800', marginTop: 4 },
  notice: { borderWidth: 1, borderRadius: radii.xl, padding: spacing[3], flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  noticeCopy: { flex: 1, minWidth: 0 },
  noticeTitle: { fontSize: fontSizes.sm, fontWeight: '900' },
  footer: { borderTopWidth: 1, padding: spacing[4], flexDirection: 'row', gap: spacing[3] },
  secondaryButton: { flex: 1, minHeight: 48, borderRadius: radii.xl, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { fontSize: fontSizes.sm, fontWeight: '800' },
  primaryButton: { flex: 1.25, minHeight: 48, borderRadius: radii.xl, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { fontSize: fontSizes.sm, fontWeight: '900' },
});
