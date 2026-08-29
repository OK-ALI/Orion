import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontSizes, radii, spacing } from '@orion/shared/tokens';
import type { OrionReleaseChannelV1 } from '@orion/shared/types';
import { useOrionTheme } from '../../context/ThemeContext';
import { MobileUpdateExecutionSection } from './MobileUpdateExecutionSection';
import { MobileReleaseNotes } from './MobileReleaseNotes';
import {
  getMobileUpdateChannelV1,
  setMobileUpdateChannelV1,
} from '../../services/mobileReleaseTruth';
import { formatMobileReleaseNotesV1 } from '../../services/mobileUpdateLifecycle';
import {
  checkMobileApplicationUpdateStateV1,
  getMobileApplicationCurrentVersionV1,
  getMobileApplicationUpdatePresentationV1,
  getMobileApplicationUpdateStateV1,
  subscribeMobileApplicationUpdateStateV1,
  type MobileApplicationUpdateStateV1,
} from '../../services/mobileApplicationUpdateState';

function formatCheckedAt(value: number | null): string {
  if (!value) return 'Not checked yet';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return 'Checked previously';
  }
}

export function UpdatesSettingsContent() {
  const { theme } = useOrionTheme();
  const [channel, setChannel] = React.useState<OrionReleaseChannelV1>(() => getMobileUpdateChannelV1());
  const [checking, setChecking] = React.useState(false);
  const [appUpdateState, setAppUpdateState] = React.useState<MobileApplicationUpdateStateV1>(() =>
    getMobileApplicationUpdateStateV1(),
  );

  const runCheck = React.useCallback(async (nextChannel: OrionReleaseChannelV1 = channel) => {
    setChecking(true);
    try {
      await checkMobileApplicationUpdateStateV1(nextChannel);
    } finally {
      setChecking(false);
    }
  }, [channel]);


  React.useEffect(() => subscribeMobileApplicationUpdateStateV1(setAppUpdateState), []);
  React.useEffect(() => {
    runCheck(channel);
  }, [channel, runCheck]);


  const chooseChannel = (next: OrionReleaseChannelV1) => {
    setMobileUpdateChannelV1(next);
    setChannel(next);
  };

  const currentVersion = getMobileApplicationCurrentVersionV1();
  const result = appUpdateState.result;
  const mobileTruth = result?.releaseTruth.mobile || null;
  const published = result?.publishedRelease || mobileTruth?.release || null;
  const releaseNotes = formatMobileReleaseNotesV1(published?.notes);
  const appPresentation = getMobileApplicationUpdatePresentationV1(appUpdateState);
  const selectedChannelDescription = channel === 'stable'
    ? 'Recommended for everyday use.'
    : 'Try newer Orion versions before they reach Stable.';

  const summaryState = checking
    ? { label: 'Checking', description: 'Looking for Orion updates…' }
    : appPresentation;


  return (
    <View style={styles.root}>
      <View style={[styles.summary, { borderBottomColor: theme.border }]}>
        <View style={[styles.summaryIcon, { backgroundColor: theme.accentSoft }]}>
          <Ionicons name="cloud-download-outline" size={21} color={theme.accent} />
        </View>
        <View style={styles.summaryCopy}>
          <Text style={[styles.eyebrow, { color: theme.textMuted }]}>ORION MOBILE</Text>
          <View style={styles.versionRow}>
            <Text style={[styles.currentVersion, { color: theme.text }]}>v{currentVersion}</Text>
            <View style={[styles.stateBadge, { backgroundColor: theme.surfaceHover, borderColor: appUpdateState.status === 'failed' ? theme.warning : theme.border }]}>
              <Text style={[styles.stateBadgeText, { color: appUpdateState.status === 'failed' ? theme.warning : theme.accent }]}>{summaryState.label}</Text>
            </View>
          </View>
          <Text style={[styles.summaryText, { color: theme.textSecondary }]}>{summaryState.description}</Text>
          <Text style={[styles.lastChecked, { color: theme.textMuted }]}>Last checked {formatCheckedAt(appUpdateState.lastCheckedAt)}</Text>
        </View>
      </View>

      <Text accessibilityRole="header" style={[styles.groupTitle, { color: theme.text }]}>Update channel</Text>
      <View style={styles.channelPanel}>
        <View accessibilityRole="radiogroup" accessibilityLabel="Orion update channel" style={[styles.channelSelector, { backgroundColor: theme.elevated }]}>
          {(['stable', 'preview'] as const).map((id) => {
            const selected = channel === id;
            const label = id === 'stable' ? 'Stable' : 'Preview';
            return (
              <Pressable
                key={id}
                accessibilityRole="radio"
                accessibilityLabel={`${label} update channel`}
                accessibilityState={{ checked: selected }}
                onPress={() => chooseChannel(id)}
                style={({ pressed }) => [
                  styles.channelButton,
                  {
                    backgroundColor: selected ? theme.accentSoft : pressed ? theme.surfaceHover : 'transparent',
                    borderColor: selected ? theme.accent : 'transparent',
                  },
                ]}
              >
                <Text style={[styles.channelButtonText, { color: selected ? theme.accent : theme.textSecondary }]}>{label}</Text>
                {selected ? <Ionicons name="checkmark-circle" size={17} color={theme.accent} /> : null}
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.channelDescription, { color: theme.textSecondary }]}>{selectedChannelDescription}</Text>
      </View>

      <Text accessibilityRole="header" style={[styles.groupTitle, { color: theme.text }]}>Update options</Text>
      <View style={[styles.updateGroup, { borderTopColor: theme.border, borderBottomColor: theme.border }]}>
        <MobileUpdateExecutionSection state={appUpdateState} />
      </View>

      {releaseNotes ? (
        <View style={[styles.notes, { borderTopColor: theme.border }]}>
          <View style={styles.notesHeading}>
            <Ionicons name="sparkles-outline" size={18} color={theme.accent} />
            <Text style={[styles.notesTitle, { color: theme.text }]}>What's new{published ? ` in v${published.version}` : ''}</Text>
          </View>
          <MobileReleaseNotes notes={releaseNotes} />
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Check for Orion Mobile updates"
        disabled={checking}
        onPress={() => runCheck(channel)}
        style={({ pressed }) => [
          styles.checkButton,
          { backgroundColor: theme.accent, opacity: checking ? 0.65 : 1 },
          pressed && !checking && { opacity: 0.85 },
        ]}
      >
        <Ionicons name={checking ? 'sync-outline' : 'refresh-outline'} size={18} color="#fff" />
        <Text style={styles.checkButtonText}>{checking ? 'Checking…' : appUpdateState.status === 'failed' ? 'Try again' : 'Check for updates'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[4] },
  summary: { paddingBottom: spacing[4], borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  summaryIcon: { width: 42, height: 42, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center' },
  summaryCopy: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  versionRow: { flexDirection: 'row', alignItems: 'center', columnGap: spacing[4], rowGap: spacing[2], marginTop: 5, flexWrap: 'wrap' },
  currentVersion: { fontSize: fontSizes.xl, fontWeight: '900' },
  stateBadge: { minHeight: 28, borderWidth: 1, borderRadius: 14, paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center' },
  stateBadgeText: { fontSize: 10, fontWeight: '900' },
  summaryText: { fontSize: fontSizes.xs, lineHeight: 18, marginTop: 5 },
  lastChecked: { fontSize: 10, lineHeight: 15, marginTop: 7 },
  groupTitle: { fontSize: fontSizes.sm, fontWeight: '900' },
  channelPanel: { gap: spacing[2] },
  channelSelector: { flexDirection: 'row', borderRadius: radii.lg, padding: 3 },
  channelButton: { flex: 1, minHeight: 42, borderWidth: 1, borderRadius: radii.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  channelButtonText: { fontSize: fontSizes.sm, fontWeight: '900' },
  channelDescription: { fontSize: fontSizes.xs, lineHeight: 18, paddingHorizontal: 2 },
  updateGroup: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  notes: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing[3], gap: spacing[2] },
  notesHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  notesTitle: { fontSize: fontSizes.sm, fontWeight: '900' },
  checkButton: { minHeight: 48, borderRadius: radii.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: spacing[4] },
  checkButtonText: { color: '#fff', fontSize: fontSizes.sm, fontWeight: '900' },
});
