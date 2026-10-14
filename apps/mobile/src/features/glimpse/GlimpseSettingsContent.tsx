import { StyleSheet, Switch, Text, View, useWindowDimensions } from 'react-native';
import { fontSizes, spacing } from '@orion/shared/tokens';
import { useOrionTheme } from '../../context/ThemeContext';
import { useGlimpsePreferences, type GlimpsePreferences } from './glimpsePreferences';

const controls: ReadonlyArray<{ key: 'ambientGlow' | 'startMuted' | 'autoAdvance' | 'rememberPosition'; title: string; copy: string }> = [
  { key: 'startMuted', title: 'Start muted', copy: 'Open Glimpse with muted audio. You can unmute during a session.' },
  { key: 'autoAdvance', title: 'Auto-advance', copy: 'Move to the next reel when the current clip ends.' },
  { key: 'ambientGlow', title: 'Ambient glow', copy: 'Let clip colors glow around the edges. Uses artwork when unavailable. Off in Efficiency mode.' },
  { key: 'rememberPosition', title: 'Remember my place', copy: 'Restore your last tab and clip when you reopen Glimpse.' },
];
export function GlimpseSettingsContent() {
  const { theme } = useOrionTheme();
  const local = useGlimpsePreferences();
  const { height } = useWindowDimensions();
  // Leave scroll room for this final Settings section to align below the fixed navigator.
  return <View style={[styles.content, { minHeight: height * 0.7 }]}>
    {controls.map(control => <View key={control.key} style={[styles.row, { borderBottomColor: theme.border }]}>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: theme.text }]}>{control.title}</Text>
        <Text style={[styles.description, { color: theme.textSecondary }]}>{control.copy}</Text>
      </View>
      <Switch accessibilityRole="switch" accessibilityLabel={'Glimpse: ' + control.title}
        accessibilityState={{ checked: local.preferences[control.key], disabled: local.unavailable }}
        value={local.preferences[control.key]} disabled={local.unavailable}
        onValueChange={value => { local.update({ [control.key]: value } as Partial<GlimpsePreferences>); }}
        trackColor={{ false: theme.border, true: theme.accentSoft }} thumbColor={local.preferences[control.key] ? theme.accent : theme.textMuted} />
    </View>)}
    {(local.unavailable || local.saveError) && <Text accessibilityLiveRegion="polite" style={{ color: theme.accent }}>
      {local.unavailable ? 'Glimpse preferences are unavailable on this device.' : 'Your change could not be saved. Please try again.'}
    </Text>}
  </View>;
}
const styles = StyleSheet.create({
  content: { gap: spacing[2] }, row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing[4], paddingVertical: spacing[3], borderBottomWidth: StyleSheet.hairlineWidth },
  copy: { flex: 1, minWidth: 0 }, title: { fontSize: fontSizes.md, fontWeight: '800' }, description: { fontSize: fontSizes.sm, lineHeight: 20, marginTop: spacing[1] },
});