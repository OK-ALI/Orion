import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontSizes, radii, spacing } from '@orion/shared/tokens';
import type { OrionReleaseChannelV1 } from '@orion/shared/types';
import { useOrionTheme } from '../../context/ThemeContext';
import { MobileUpdateExecutionSection } from './MobileUpdateExecutionSection';
import { RuntimeUpdateExecutionSection } from './RuntimeUpdateExecutionSection';
import {
  checkMobileReleaseTruthV1,
  getMobileCurrentVersionV1,
  getMobileUpdateChannelV1,
  getMobileUpdateLastCheckedV1,
  setMobileUpdateChannelV1,
  type MobileReleaseCheckV1,
} from '../../services/mobileReleaseTruth';
import {
  checkExpoRuntimeUpdateV1,
  getExpoRuntimeUpdateStatusV1,
  setExpoRuntimeUpdateChannelV1,
  type OrionRuntimeUpdateStatusV1,
} from '../../services/expoRuntimeUpdates';

function formatCheckedAt(value: number | null): string {
  if (!value) return 'Not checked yet';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return 'Previously checked';
  }
}

export function UpdatesSettingsContent() {
  const { theme } = useOrionTheme();
  const [channel, setChannel] = React.useState<OrionReleaseChannelV1>(() => getMobileUpdateChannelV1());
  const [checking, setChecking] = React.useState(false);
  const [result, setResult] = React.useState<MobileReleaseCheckV1 | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = React.useState<number | null>(() => getMobileUpdateLastCheckedV1());
  const [runtimeStatus, setRuntimeStatus] = React.useState<OrionRuntimeUpdateStatusV1>(() =>
    getExpoRuntimeUpdateStatusV1(getMobileUpdateChannelV1()),
  );

  const runCheck = React.useCallback(async (nextChannel: OrionReleaseChannelV1 = channel) => {
    setChecking(true);
    setError(null);
    setRuntimeStatus((current) => ({ ...current, channel: nextChannel, state: 'checking', message: null }));
    const [releaseOutcome, runtimeOutcome] = await Promise.allSettled([
      checkMobileReleaseTruthV1(nextChannel),
      checkExpoRuntimeUpdateV1(nextChannel),
    ]);

    if (releaseOutcome.status === 'fulfilled') {
      setResult(releaseOutcome.value);
      setLastCheckedAt(releaseOutcome.value.lastCheckedAt);
    } else {
      setError(releaseOutcome.reason instanceof Error ? releaseOutcome.reason.message : 'Unable to check for APK updates.');
    }

    if (runtimeOutcome.status === 'fulfilled') {
      setRuntimeStatus(runtimeOutcome.value);
    } else {
      setRuntimeStatus({
        ...getExpoRuntimeUpdateStatusV1(nextChannel),
        state: 'failed',
        message: runtimeOutcome.reason instanceof Error ? runtimeOutcome.reason.message : 'Unable to check runtime updates.',
      });
    }
    setChecking(false);
  }, [channel]);

  React.useEffect(() => {
    runCheck(channel);
  }, [channel, runCheck]);

  const chooseChannel = (next: OrionReleaseChannelV1) => {
    setMobileUpdateChannelV1(next);
    setExpoRuntimeUpdateChannelV1(next);
    setChannel(next);
  };

  const mobileTruth = result?.releaseTruth.mobile || null;
  const published = mobileTruth?.release || null;
  const installerAvailable = !!mobileTruth?.apk;
  const stateLabel = error
    ? 'Unable to check'
    : checking
      ? 'Checking'
      : runtimeStatus.state === 'restart-required'
        ? 'Restart required'
        : runtimeStatus.state === 'available'
          ? 'Runtime update available'
          : result?.state === 'available'
            ? 'APK update available'
            : result?.state === 'unsupported'
              ? 'Unsupported'
              : result
                ? 'Current'
                : 'Not checked';

  return (
    <View style={styles.root}>
      <View style={[styles.summary, { backgroundColor: theme.elevated, borderColor: theme.border }]}>
        <View style={styles.summaryCopy}>
          <Text style={[styles.eyebrow, { color: theme.textMuted }]}>ORION MOBILE</Text>
          <Text style={[styles.currentVersion, { color: theme.text }]}>v{result?.currentVersion || getMobileCurrentVersionV1()}</Text>
          <Text style={[styles.summaryText, { color: theme.textSecondary }]}>
            {published
              ? `Latest published Mobile release: v${published.version}.`
              : 'No Mobile APK has been published in this channel yet.'}
          </Text>
        </View>
        <View style={[styles.stateBadge, { backgroundColor: theme.accentSoft, borderColor: error ? theme.border : theme.accent }]}>
          <Text style={[styles.stateBadgeText, { color: error ? theme.textSecondary : theme.accent }]}>{stateLabel}</Text>
        </View>
      </View>

      <Text accessibilityRole="header" style={[styles.groupTitle, { color: theme.text }]}>Release channel</Text>
      <View style={styles.channelGrid}>
        {([
          ['stable', 'Stable', 'Recommended. Fully released Orion builds.'],
          ['preview', 'Preview', 'Early Orion builds when they are newer than Stable.'],
        ] as const).map(([id, label, description]) => {
          const selected = channel === id;
          return (
            <Pressable
              key={id}
              accessibilityRole="radio"
              accessibilityLabel={`${label} update channel`}
              accessibilityHint={description}
              accessibilityState={{ checked: selected }}
              onPress={() => chooseChannel(id)}
              style={({ pressed }) => [
                styles.channelCard,
                { backgroundColor: selected ? theme.accentSoft : theme.elevated, borderColor: selected ? theme.accent : theme.border },
                pressed && { backgroundColor: theme.surfaceHover },
              ]}
            >
              <View style={styles.channelHeading}>
                <Text style={[styles.channelTitle, { color: theme.text }]}>{label}</Text>
                {selected && <Ionicons name="checkmark-circle" size={19} color={theme.accent} />}
              </View>
              <Text style={[styles.channelDescription, { color: theme.textSecondary }]}>{description}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.facts, { borderTopColor: theme.border }]}>
        <Fact label="Current version" value={`v${result?.currentVersion || getMobileCurrentVersionV1()}`} theme={theme} />
        <Fact label="Latest Mobile" value={published ? `v${published.version}` : 'Not published'} theme={theme} />
        <Fact label="Minimum Android" value={mobileTruth ? `${mobileTruth.minimumAndroidLabel} (API ${mobileTruth.minimumAndroidApi})` : 'Android 7.0+ (API 24)'} theme={theme} />
        <Fact label="Installer" value={installerAvailable ? 'Available' : 'Not published'} theme={theme} />
        <Fact label="Last checked" value={formatCheckedAt(lastCheckedAt)} theme={theme} />
      </View>

      {published?.notes ? (
        <View style={[styles.notes, { backgroundColor: theme.elevated, borderColor: theme.border }]}>
          <Text style={[styles.notesTitle, { color: theme.text }]}>Release notes</Text>
          <Text numberOfLines={6} style={[styles.notesText, { color: theme.textSecondary }]}>{published.notes}</Text>
        </View>
      ) : null}

      {error ? <Text style={[styles.error, { color: theme.textSecondary }]}>{error}</Text> : null}

      <MobileUpdateExecutionSection result={result} />

      <RuntimeUpdateExecutionSection status={runtimeStatus} onStatusChange={setRuntimeStatus} />

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
        <Text style={styles.checkButtonText}>{checking ? 'Checking…' : 'Check now'}</Text>
      </Pressable>

      <Text style={[styles.scopeNote, { color: theme.textMuted }]}>
        Signed APK updates remain the path for native changes. Runtime updates are limited to compatible JavaScript and assets, with Orion's embedded runtime kept as the recovery floor. Google Play distribution remains out of scope for the current release plan.
      </Text>
    </View>
  );
}

function Fact({ label, value, theme }: { label: string; value: string; theme: ReturnType<typeof useOrionTheme>['theme'] }) {
  return (
    <View style={styles.fact}>
      <Text style={[styles.factLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[styles.factValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[4] },
  summary: { borderWidth: 1, borderRadius: radii.xl, padding: spacing[4], flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  summaryCopy: { flex: 1 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  currentVersion: { fontSize: fontSizes.xl, fontWeight: '900', marginTop: 4 },
  summaryText: { fontSize: fontSizes.xs, lineHeight: 18, marginTop: 4 },
  stateBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  stateBadgeText: { fontSize: 11, fontWeight: '900' },
  groupTitle: { fontSize: fontSizes.sm, fontWeight: '900' },
  channelGrid: { gap: spacing[2] },
  channelCard: { borderWidth: 1, borderRadius: radii.xl, padding: spacing[3] },
  channelHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  channelTitle: { fontSize: fontSizes.sm, fontWeight: '900' },
  channelDescription: { fontSize: fontSizes.xs, lineHeight: 18, marginTop: 5 },
  facts: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing[3], gap: spacing[3] },
  fact: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing[4] },
  factLabel: { fontSize: fontSizes.xs, flex: 1 },
  factValue: { fontSize: fontSizes.xs, fontWeight: '800', textAlign: 'right', flex: 1.2 },
  notes: { borderWidth: 1, borderRadius: radii.xl, padding: spacing[3] },
  notesTitle: { fontSize: fontSizes.sm, fontWeight: '900', marginBottom: 6 },
  notesText: { fontSize: fontSizes.xs, lineHeight: 18 },
  error: { fontSize: fontSizes.xs, lineHeight: 18 },
  checkButton: { minHeight: 48, borderRadius: radii.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: spacing[4] },
  checkButtonText: { color: '#fff', fontSize: fontSizes.sm, fontWeight: '900' },
  scopeNote: { fontSize: 11, lineHeight: 17 },
});
