import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontSizes, radii, spacing } from '@orion/shared/tokens';
import { useOrionTheme } from '../../context/ThemeContext';
import {
  downloadExpoRuntimeUpdateV1,
  reloadExpoRuntimeUpdateV1,
  type OrionRuntimeUpdateStatusV1,
} from '../../services/expoRuntimeUpdates';

function runtimeStatusLabel(status: OrionRuntimeUpdateStatusV1): string {
  if (status.isEmergencyLaunch) return 'Recovery';
  if (!status.enabled) return 'Unavailable';
  if (status.state === 'checking') return 'Checking';
  if (status.state === 'downloading') return 'Downloading';
  if (status.state === 'installing') return 'Restarting';
  if (status.state === 'available') return status.rollbackToEmbedded ? 'Recovery ready' : 'Update ready';
  if (status.state === 'restart-required') return 'Restart needed';
  if (status.state === 'failed') return 'Needs attention';
  return 'Up to date';
}

function runtimeStatusMessage(status: OrionRuntimeUpdateStatusV1): string | null {
  if (status.isEmergencyLaunch) {
    return 'Orion returned to a working recovery version after a quick update could not start safely.';
  }
  if (!status.enabled) return 'Quick updates are not available in this build.';
  if (status.state === 'checking') return 'Checking for quick updates…';
  if (status.state === 'downloading') return 'Downloading quick update…';
  if (status.state === 'installing') return 'Restarting Orion…';
  if (status.state === 'available') {
    return status.rollbackToEmbedded
      ? 'Orion can return to its built-in recovery version.'
      : 'A quick update is ready to download.';
  }
  if (status.state === 'restart-required') {
    return status.rollbackToEmbedded
      ? 'Recovery is ready. Restart Orion to use the working version.'
      : 'Your quick update is ready. Restart Orion to finish.';
  }
  if (status.state === 'failed') {
    if (status.retryAction === 'download') return 'The quick update could not be downloaded. Check your connection and try again.';
    if (status.retryAction === 'restart') return 'Orion could not restart to finish the update. Try again.';
    return 'Orion could not check for quick updates. Check your connection and try again.';
  }
  return null;
}

export function RuntimeUpdateExecutionSection({
  status,
  onStatusChange,
  onRetryCheck,
  showRetryAction = true,
}: {
  status: OrionRuntimeUpdateStatusV1;
  onStatusChange: (status: OrionRuntimeUpdateStatusV1) => void;
  onRetryCheck: () => void | Promise<void>;
  showRetryAction?: boolean;
}) {
  const { theme } = useOrionTheme();
  const busy = status.state === 'checking' || status.state === 'downloading' || status.state === 'installing';

  const download = async () => {
    onStatusChange({ ...status, state: 'downloading', retryAction: null, message: 'Downloading runtime update…' });
    const next = await downloadExpoRuntimeUpdateV1(status.channel);
    onStatusChange(next);
  };

  const restart = async () => {
    onStatusChange({
      ...status,
      state: 'installing',
      retryAction: null,
      message: status.rollbackToEmbedded
        ? 'Restarting Orion with the built-in recovery runtime…'
        : 'Restarting Orion with the downloaded runtime…',
    });
    try {
      await reloadExpoRuntimeUpdateV1();
    } catch (error) {
      onStatusChange({
        ...status,
        state: 'failed',
        retryAction: 'restart',
        message: error instanceof Error ? error.message : 'Unable to restart Orion.',
      });
    }
  };

  const retry = async () => {
    if (status.retryAction === 'restart') {
      await restart();
      return;
    }
    if (status.retryAction === 'download') {
      await download();
      return;
    }
    await onRetryCheck();
  };

  const statusMessage = runtimeStatusMessage(status);

  return (
    <View style={styles.root}>
      <View style={styles.heading}>
        <View style={[styles.iconTile, { backgroundColor: theme.accentSoft }]}>
          <Ionicons name={status.isEmergencyLaunch ? 'medkit-outline' : 'flash-outline'} size={20} color={theme.accent} />
        </View>
        <View style={styles.headingCopy}>
          <Text style={[styles.title, { color: theme.text }]}>Quick updates</Text>
          <Text style={[styles.description, { color: theme.textSecondary }]}>Small fixes can arrive without downloading the full app again.</Text>
        </View>
        <View style={[styles.statusChip, { backgroundColor: theme.surfaceHover, borderColor: theme.border }]}>
          <Text style={[styles.statusChipText, { color: status.state === 'failed' ? theme.warning : theme.accent }]}>{runtimeStatusLabel(status)}</Text>
        </View>
      </View>

      {statusMessage ? (
        <Text style={[styles.message, { color: status.state === 'failed' ? theme.warning : theme.textSecondary }]}>
          {statusMessage}
        </Text>
      ) : null}

      {status.state === 'available' ? (
        <ActionButton
          label={status.rollbackToEmbedded ? 'Use recovery version' : 'Get quick update'}
          icon={status.rollbackToEmbedded ? 'return-down-back-outline' : 'cloud-download-outline'}
          disabled={busy}
          onPress={download}
          theme={theme}
        />
      ) : status.state === 'restart-required' ? (
        <ActionButton
          label="Restart Orion"
          icon="refresh-outline"
          disabled={false}
          onPress={restart}
          theme={theme}
        />
      ) : status.state === 'failed' && status.retryAction && showRetryAction ? (
        <ActionButton
          label="Try again"
          icon="refresh-outline"
          disabled={busy}
          onPress={retry}
          theme={theme}
        />
      ) : null}
    </View>
  );
}

function ActionButton({ label, icon, disabled, onPress, theme }: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  disabled: boolean;
  onPress: () => void | Promise<void>;
  theme: ReturnType<typeof useOrionTheme>['theme'];
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: theme.accent, opacity: disabled ? 0.55 : pressed ? 0.84 : 1 },
      ]}
    >
      <Ionicons name={icon} size={17} color="#fff" />
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { padding: spacing[3], gap: spacing[3] },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  iconTile: { width: 40, height: 40, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center' },
  headingCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: fontSizes.sm, fontWeight: '900' },
  description: { fontSize: fontSizes.xs, marginTop: 3, lineHeight: 18 },
  statusChip: { minHeight: 28, borderRadius: 14, borderWidth: 1, paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center' },
  statusChipText: { fontSize: 10, fontWeight: '900' },
  message: { fontSize: fontSizes.xs, lineHeight: 18 },
  button: { minHeight: 44, borderRadius: radii.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: spacing[3] },
  buttonText: { color: '#fff', fontSize: fontSizes.sm, fontWeight: '900' },
});
