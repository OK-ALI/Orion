import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontSizes, radii, spacing } from '@orion/shared/tokens';
import type { MobileDownloadPreferencesV1, MobileDownloadQualityV1, MobileDownloadSubtitlePreferenceV1 } from '@orion/shared/types';
import { useOrionTheme } from '../../context/ThemeContext';
import {
  getMobileDownloadPreferencesV1,
  setMobileDownloadPreferredQualityV1,
  setMobileDownloadSubtitlePreferenceV1,
  subscribeMobileDownloadPreferencesV1,
} from './downloadPreferences';

const QUALITY_OPTIONS: ReadonlyArray<{ id: MobileDownloadQualityV1; label: string }> = [
  { id: 'best', label: 'Best available' },
  { id: '1080p', label: '1080p' },
  { id: '720p', label: '720p' },
  { id: '480p', label: '480p' },
];
const SUBTITLE_OPTIONS: ReadonlyArray<{ id: MobileDownloadSubtitlePreferenceV1; label: string; description: string }> = [
  { id: 'preferred', label: 'Preferred subtitles', description: 'Check SubDL and Wyzie and attach the best English match when available.' },
  { id: 'none', label: 'No automatic subtitles', description: 'Download the video without an automatic subtitle selection.' },
];

export function DownloadSettingsContent() {
  const { theme } = useOrionTheme();
  const [preferences, setPreferences] = useState<MobileDownloadPreferencesV1>(getMobileDownloadPreferencesV1);
  useEffect(() => subscribeMobileDownloadPreferencesV1(setPreferences), []);

  return (
    <View style={styles.root}>
      <Text accessibilityRole="header" style={[styles.groupTitle, { color: theme.text }]}>Default location</Text>
      <View style={[styles.destinationCard, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}>
        <View style={[styles.iconBox, { backgroundColor: theme.surface, borderColor: theme.border }]}><Ionicons name="albums-outline" size={20} color={theme.accent} /></View>
        <View style={styles.optionCopy}>
          <Text style={[styles.optionTitle, { color: theme.text }]}>Orion Library</Text>
          <Text style={[styles.description, { color: theme.textSecondary }]}>HLS and DASH downloads stay managed inside Orion for verified offline playback.</Text>
        </View>
        <Ionicons name="checkmark-circle" size={20} color={theme.success} />
      </View>
      <View style={[styles.notice, { backgroundColor: theme.surfaceHover, borderColor: theme.border }]}>
        <Ionicons name="folder-open-outline" size={18} color={theme.textMuted} />
        <Text style={[styles.noticeText, { color: theme.textSecondary }]}>Device Storage is paused until Orion can finalize fragmented streams into a safe portable file.</Text>
      </View>

      <Text accessibilityRole="header" style={[styles.groupTitle, { color: theme.text }]}>Preferred quality</Text>
      <View accessibilityRole="radiogroup" style={styles.pillRow}>
        {QUALITY_OPTIONS.map((option) => {
          const selected = preferences.preferredQuality === option.id;
          return <Pressable key={option.id} accessibilityRole="radio" accessibilityLabel={`${option.label} preferred download quality`} accessibilityState={{ checked: selected }} onPress={() => setPreferences(setMobileDownloadPreferredQualityV1(option.id))} style={({ pressed }) => [styles.pill, { backgroundColor: selected ? theme.accentSoft : pressed ? theme.surfaceHover : theme.elevated, borderColor: selected ? theme.accent : theme.border }]}><Text style={[styles.pillText, { color: selected ? theme.accent : theme.textSecondary }]}>{option.label}</Text></Pressable>;
        })}
      </View>

      <Text accessibilityRole="header" style={[styles.groupTitle, { color: theme.text }]}>Subtitles</Text>
      <View style={styles.optionGrid}>
        {SUBTITLE_OPTIONS.map((option) => {
          const selected = preferences.subtitlePreference === option.id;
          return <Pressable key={option.id} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ checked: selected }} onPress={() => setPreferences(setMobileDownloadSubtitlePreferenceV1(option.id))} style={({ pressed }) => [styles.compactRow, { backgroundColor: selected ? theme.accentSoft : pressed ? theme.surfaceHover : 'transparent', borderColor: selected ? theme.accent : theme.border }]}><View style={styles.optionCopy}><Text style={[styles.optionTitle, { color: theme.text }]}>{option.label}</Text><Text style={[styles.description, { color: theme.textSecondary }]}>{option.description}</Text></View><Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? theme.accent : theme.textMuted} /></Pressable>;
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[3] }, groupTitle: { fontSize: fontSizes.md, fontWeight: '900', marginTop: spacing[2] }, optionGrid: { gap: spacing[2] },
  destinationCard: { minHeight: 82, borderWidth: 1, borderRadius: radii.xl, padding: spacing[3], flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  compactRow: { minHeight: 72, borderWidth: 1, borderRadius: radii.xl, paddingHorizontal: spacing[3], paddingVertical: spacing[2], flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  iconBox: { width: 40, height: 40, borderRadius: radii.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, optionCopy: { flex: 1, minWidth: 0 },
  optionTitle: { fontSize: fontSizes.sm, fontWeight: '900' }, description: { fontSize: fontSizes.xs, lineHeight: 17, marginTop: 3 },
  notice: { borderWidth: 1, borderRadius: radii.lg, padding: spacing[3], flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] }, noticeText: { flex: 1, fontSize: fontSizes.xs, lineHeight: 18 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }, pill: { minHeight: 42, borderWidth: 1, borderRadius: radii.full, paddingHorizontal: spacing[3], alignItems: 'center', justifyContent: 'center' }, pillText: { fontSize: fontSizes.xs, fontWeight: '800' },
});
