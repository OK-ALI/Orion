import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { getSubtitleProviderKey, setSubtitleProviderKey } from '../../services/subtitles';

const QUALITY_OPTIONS: ReadonlyArray<{ id: MobileDownloadQualityV1; label: string }> = [
  { id: 'best', label: 'Best available' },
  { id: '1080p', label: '1080p' },
  { id: '720p', label: '720p' },
  { id: '480p', label: '480p' },
];
const SUBTITLE_OPTIONS: ReadonlyArray<{ id: MobileDownloadSubtitlePreferenceV1; label: string; description: string }> = [
  { id: 'preferred', label: 'Preferred subtitles', description: 'Search configured SubDL and Wyzie providers and attach the best English match.' },
  { id: 'none', label: 'No automatic subtitles', description: 'Download video without an automatic subtitle selection.' },
];

export function DownloadSettingsContent() {
  const { theme } = useOrionTheme();
  const [preferences, setPreferences] = useState<MobileDownloadPreferencesV1>(getMobileDownloadPreferencesV1);
  const [subdlKey, setSubdlKey] = useState('');
  const [wyzieKey, setWyzieKey] = useState('');
  const [keyStatus, setKeyStatus] = useState('Keys are stored in protected device storage.');
  const [savingKeys, setSavingKeys] = useState(false);

  useEffect(() => subscribeMobileDownloadPreferencesV1(setPreferences), []);
  useEffect(() => {
    let active = true;
    Promise.all([getSubtitleProviderKey('subdl'), getSubtitleProviderKey('wyzie')]).then(([subdl, wyzie]) => {
      if (!active) return;
      setSubdlKey(subdl || '');
      setWyzieKey(wyzie || '');
    });
    return () => { active = false; };
  }, []);

  const saveSubtitleKeys = async () => {
    if (savingKeys) return;
    setSavingKeys(true);
    try {
      await Promise.all([
        setSubtitleProviderKey('subdl', subdlKey || null),
        setSubtitleProviderKey('wyzie', wyzieKey || null),
      ]);
      setKeyStatus(subdlKey.trim() || wyzieKey.trim() ? 'Subtitle provider keys saved securely.' : 'No provider keys configured. Subtitle discovery will stay off.');
    } catch (error) {
      setKeyStatus(error instanceof Error ? error.message : 'Orion could not save subtitle provider keys.');
    } finally {
      setSavingKeys(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text accessibilityRole="header" style={[styles.groupTitle, { color: theme.text }]}>Offline storage</Text>
      <View style={[styles.destinationCard, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}>
        <View style={[styles.iconBox, { backgroundColor: theme.surface, borderColor: theme.border }]}><Ionicons name="albums-outline" size={20} color={theme.accent} /></View>
        <View style={styles.optionCopy}><Text style={[styles.optionTitle, { color: theme.text }]}>Orion Library</Text><Text style={[styles.description, { color: theme.textSecondary }]}>New downloads stay inside Orion for reliable offline playback.</Text></View>
        <Ionicons name="checkmark-circle" size={20} color={theme.accent} />
      </View>
      <Text style={[styles.explainer, { color: theme.textMuted }]}>Portable Device Storage files are no longer part of the normal download flow. Existing copies remain manageable; a dedicated export flow can reuse the preserved portable-media engine later.</Text>

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

      <View style={[styles.providerCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.optionTitle, { color: theme.text }]}>Subtitle providers</Text>
        <Text style={[styles.description, { color: theme.textSecondary }]}>Add your own SubDL and/or Wyzie key. Configured providers are searched automatically.</Text>
        <TextInput accessibilityLabel="SubDL API key" value={subdlKey} onChangeText={setSubdlKey} placeholder="SubDL API key" placeholderTextColor={theme.textMuted} secureTextEntry autoCapitalize="none" autoCorrect={false} style={[styles.keyInput, { color: theme.text, backgroundColor: theme.elevated, borderColor: theme.border }]} />
        <TextInput accessibilityLabel="Wyzie API key" value={wyzieKey} onChangeText={setWyzieKey} placeholder="wyzie-…" placeholderTextColor={theme.textMuted} secureTextEntry autoCapitalize="none" autoCorrect={false} style={[styles.keyInput, { color: theme.text, backgroundColor: theme.elevated, borderColor: theme.border }]} />
        <Text style={[styles.keyStatus, { color: theme.textMuted }]}>{keyStatus}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Save subtitle provider keys" disabled={savingKeys} onPress={() => void saveSubtitleKeys()} style={({ pressed }) => [styles.saveButton, { backgroundColor: pressed ? theme.accentSoft : theme.accent, borderColor: theme.accent }]}>
          <Ionicons name="key-outline" size={17} color={theme.onAccent} /><Text style={[styles.saveButtonText, { color: theme.onAccent }]}>{savingKeys ? 'Saving…' : 'Save provider keys'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[3] }, groupTitle: { fontSize: fontSizes.md, fontWeight: '900', marginTop: spacing[2] }, optionGrid: { gap: spacing[2] },
  destinationCard: { minHeight: 72, borderWidth: 1, borderRadius: radii.xl, padding: spacing[3], flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  compactRow: { minHeight: 66, borderWidth: 1, borderRadius: radii.xl, paddingHorizontal: spacing[3], paddingVertical: spacing[2], flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  iconBox: { width: 38, height: 38, borderRadius: radii.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, optionCopy: { flex: 1, minWidth: 0 },
  optionTitle: { fontSize: fontSizes.sm, fontWeight: '900' }, description: { fontSize: fontSizes.xs, lineHeight: 17, marginTop: 3 }, explainer: { fontSize: 11, lineHeight: 17 },
  notice: { borderWidth: 1, borderRadius: radii.lg, padding: spacing[3], flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] }, noticeText: { flex: 1, fontSize: fontSizes.xs, lineHeight: 18 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }, pill: { minHeight: 42, borderWidth: 1, borderRadius: radii.full, paddingHorizontal: spacing[3], alignItems: 'center', justifyContent: 'center' }, pillText: { fontSize: fontSizes.xs, fontWeight: '800' },
  providerCard: { borderWidth: 1, borderRadius: radii.xl, padding: spacing[3], gap: spacing[2] }, keyInput: { minHeight: 44, borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: spacing[3], fontSize: fontSizes.sm }, keyStatus: { fontSize: 11, lineHeight: 16 },
  saveButton: { minHeight: 44, borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: spacing[3], flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2] }, saveButtonText: { fontSize: fontSizes.xs, fontWeight: '900' },
});
