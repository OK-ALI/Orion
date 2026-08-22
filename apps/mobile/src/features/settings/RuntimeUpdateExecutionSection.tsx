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

export function RuntimeUpdateExecutionSection({
  status,
  onStatusChange,
}: {
  status: OrionRuntimeUpdateStatusV1;
  onStatusChange: (status: OrionRuntimeUpdateStatusV1) => void;
}) {
  const { theme } = useOrionTheme();
  const busy = status.state === 'checking' || status.state === 'downloading';
  const sourceLabel = status.enabled
    ? status.isEmbeddedLaunch
      ? 'Built-in runtime'
      : 'Downloaded runtime'
    : 'Embedded bundle only';

  const download = async () => {
    onStatusChange({ ...status, state: 'downloading', message: 'Downloading runtime update…' });
    const next = await downloadExpoRuntimeUpdateV1(status.channel);
    onStatusChange(next);
  };

  const restart = async () => {
    onStatusChange({ ...status, state: 'installing', message: 'Restarting Orion with the downloaded runtime…' });
    try {
      await reloadExpoRuntimeUpdateV1();
    } catch (error) {
      onStatusChange({
        ...status,
        state: 'failed',
        message: error instanceof Error ? error.message : 'Unable to restart Orion.',
      });
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.elevated, borderColor: theme.border }]}>
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <Text style={[styles.title, { color: theme.text }]}>Runtime updates</Text>
          <Text style={[styles.description, { color: theme.textSecondary }]}>
            {status.runtimeVersion ? `${status.runtimeVersion} · ${sourceLabel}` : sourceLabel}
          </Text>
        </View>
        <Ionicons
          name={status.isEmergencyLaunch ? 'medkit-outline' : 'flash-outline'}
          size={21}
          color={theme.accent}
        />
      </View>

      {status.isEmergencyLaunch ? (
        <View style={[styles.recovery, { borderColor: theme.accent, backgroundColor: theme.accentSoft }]}>
          <Text style={[styles.recoveryTitle, { color: theme.text }]}>Recovery mode</Text>
          <Text style={[styles.message, { color: theme.textSecondary }]}>
            Orion fell back to a working runtime instead of repeatedly launching a broken update.
          </Text>
        </View>
      ) : null}

      {status.message ? <Text style={[styles.message, { color: theme.textSecondary }]}>{status.message}</Text> : null}

      {status.state === 'available' ? (
        <ActionButton
          label={status.rollbackToEmbedded ? 'Download recovery' : 'Download runtime update'}
          icon="cloud-download-outline"
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
      ) : busy ? (
        <View style={styles.busyRow}>
          <Ionicons name="sync-outline" size={17} color={theme.accent} />
          <Text style={[styles.message, { color: theme.textSecondary }]}>
            {status.state === 'checking' ? 'Checking runtime compatibility…' : 'Downloading runtime update…'}
          </Text>
        </View>
      ) : null}

      <Text style={[styles.safety, { color: theme.textMuted }]}>
        Runtime updates can change JavaScript and assets only. Native changes still require a signed Orion APK.
      </Text>
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
  root: { borderWidth: 1, borderRadius: radii.xl, padding: spacing[3], gap: spacing[2] },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  headingCopy: { flex: 1 },
  title: { fontSize: fontSizes.sm, fontWeight: '900' },
  description: { fontSize: fontSizes.xs, marginTop: 3, lineHeight: 18 },
  message: { fontSize: fontSizes.xs, lineHeight: 18, flex: 1 },
  recovery: { borderWidth: 1, borderRadius: radii.lg, padding: spacing[3], gap: 4 },
  recoveryTitle: { fontSize: fontSizes.xs, fontWeight: '900' },
  busyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  button: { minHeight: 44, borderRadius: radii.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: spacing[3] },
  buttonText: { color: '#fff', fontSize: fontSizes.sm, fontWeight: '900' },
  safety: { fontSize: 11, lineHeight: 17 },
});
