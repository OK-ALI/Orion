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
import { formatMobileReleaseNotesV1 } from '../../services/mobileUpdateLifecycle';

function formatCheckedAt(value: number | null): string {
  if (!value) return 'Not checked yet';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return 'Checked previously';
  }
}

function friendlyAppCheckError(error: string | null): string | null {
  if (!error) return null;
  return 'Orion could not check for app updates. Check your connection and try again.';
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
    setRuntimeStatus((current) => ({
      ...current,
      channel: nextChannel,
      state: 'checking',
      retryAction: null,
      message: null,
    }));
    const [releaseOutcome, runtimeOutcome] = await Promise.allSettled([
      checkMobileReleaseTruthV1(nextChannel),
      checkExpoRuntimeUpdateV1(nextChannel),
    ]);

    if (releaseOutcome.status === 'fulfilled') {
      setResult(releaseOutcome.value);
      setLastCheckedAt(releaseOutcome.value.lastCheckedAt);
    } else {
      setError(releaseOutcome.reason instanceof Error ? releaseOutcome.reason.message : 'Unable to check for app updates.');
    }

    if (runtimeOutcome.status === 'fulfilled') {
      setRuntimeStatus(runtimeOutcome.value);
    } else {
      setRuntimeStatus({
        ...getExpoRuntimeUpdateStatusV1(nextChannel),
        state: 'failed',
        retryAction: 'check',
        message: runtimeOutcome.reason instanceof Error ? runtimeOutcome.reason.message : 'Unable to check runtime updates.',
      });
    }
    setChecking(false);
  }, [channel]);

  React.useEffect(() => {
    runCheck(channel);
  }, [channel, runCheck]);

  const retryRuntimeCheck = React.useCallback(async () => {
    setRuntimeStatus((current) => ({
      ...current,
      channel,
      state: 'checking',
      retryAction: null,
      message: 'Checking runtime compatibility…',
    }));
    try {
      setRuntimeStatus(await checkExpoRuntimeUpdateV1(channel));
    } catch (runtimeError) {
      setRuntimeStatus({
        ...getExpoRuntimeUpdateStatusV1(channel),
        state: 'failed',
        retryAction: 'check',
        message: runtimeError instanceof Error ? runtimeError.message : 'Unable to check runtime updates.',
      });
    }
  }, [channel]);

  const chooseChannel = (next: OrionReleaseChannelV1) => {
    setMobileUpdateChannelV1(next);
    setExpoRuntimeUpdateChannelV1(next);
    setChannel(next);
  };

  const currentVersion = result?.currentVersion || getMobileCurrentVersionV1();
  const mobileTruth = result?.releaseTruth.mobile || null;
  const published = result?.publishedRelease || mobileTruth?.release || null;
  const offeredRelease = mobileTruth?.release || null;
  const releaseNotes = formatMobileReleaseNotesV1(published?.notes);
  const displayError = friendlyAppCheckError(error);
  const selectedChannelDescription = channel === 'stable'
    ? 'Recommended for everyday use.'
    : 'Get newer test builds before they reach Stable.';

  const summaryState = error
    ? { label: 'Could not check', description: displayError || 'Try again in a moment.' }
    : checking
      ? { label: 'Checking', description: 'Looking for Orion updates…' }
      : runtimeStatus.state === 'restart-required'
        ? { label: 'Restart needed', description: 'A quick update is ready. Restart Orion to finish.' }
        : runtimeStatus.state === 'available'
          ? { label: 'Quick update ready', description: 'A small Orion update is ready for this device.' }
          : result?.state === 'available'
            ? { label: 'Update ready', description: offeredRelease ? `Orion Mobile v${offeredRelease.version} is ready to install.` : 'A new Orion Mobile version is ready to install.' }
            : result?.rollout.deferred
              ? { label: 'Rolling out', description: 'A newer Orion version is rolling out and has not reached this device yet.' }
              : result?.state === 'unsupported'
                ? { label: 'Unavailable', description: 'This device cannot install the latest Orion Mobile release.' }
                : result
                  ? { label: 'Up to date', description: `You are using the latest version available on ${channel === 'stable' ? 'Stable' : 'Preview'}.` }
                  : { label: 'Not checked', description: 'Check for Orion updates when you are ready.' };

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
            <View style={[styles.stateBadge, { backgroundColor: theme.surfaceHover, borderColor: error ? theme.warning : theme.border }]}>
              <Text style={[styles.stateBadgeText, { color: error ? theme.warning : theme.accent }]}>{summaryState.label}</Text>
            </View>
          </View>
          <Text style={[styles.summaryText, { color: theme.textSecondary }]}>{summaryState.description}</Text>
          <Text style={[styles.lastChecked, { color: theme.textMuted }]}>Last checked {formatCheckedAt(lastCheckedAt)}</Text>
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
        <MobileUpdateExecutionSection result={result} />
        <View style={[styles.updateDivider, { backgroundColor: theme.border }]} />
        <RuntimeUpdateExecutionSection
          status={runtimeStatus}
          onStatusChange={setRuntimeStatus}
          onRetryCheck={retryRuntimeCheck}
          showRetryAction={!error}
        />
      </View>

      {releaseNotes ? (
        <View style={[styles.notes, { borderTopColor: theme.border }]}>
          <View style={styles.notesHeading}>
            <Ionicons name="sparkles-outline" size={18} color={theme.accent} />
            <Text style={[styles.notesTitle, { color: theme.text }]}>What's new{published ? ` in v${published.version}` : ''}</Text>
          </View>
          <Text numberOfLines={6} style={[styles.notesText, { color: theme.textSecondary }]}>{releaseNotes}</Text>
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
        <Text style={styles.checkButtonText}>{checking ? 'Checking…' : error ? 'Try again' : 'Check for updates'}</Text>
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
  updateDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: spacing[3] },
  notes: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing[3], gap: spacing[2] },
  notesHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  notesTitle: { fontSize: fontSizes.sm, fontWeight: '900' },
  notesText: { fontSize: fontSizes.xs, lineHeight: 18 },
  checkButton: { minHeight: 48, borderRadius: radii.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: spacing[4] },
  checkButtonText: { color: '#fff', fontSize: fontSizes.sm, fontWeight: '900' },
});
