import React from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontSizes, radii, spacing } from '@orion/shared/tokens';
import type { OrionUpdateStateV1 } from '@orion/shared/types';
import { useOrionTheme } from '../../context/ThemeContext';
import type { MobileReleaseCheckV1 } from '../../services/mobileReleaseTruth';
import {
  getAndroidUpdateEnvironmentV1,
  installDirectApkV1,
  openDirectInstallPermissionSettingsV1,
  subscribeAndroidUpdateStateV1,
  type OrionAndroidUpdateEnvironmentV1,
  type OrionNativeUpdateEventV1,
} from '../../services/nativeUpdateEngine';

function appUpdateStatusLabel(
  result: MobileReleaseCheckV1 | null,
  environment: OrionAndroidUpdateEnvironmentV1 | null,
  engineState: OrionUpdateStateV1,
): string {
  if (engineState === 'downloading') return 'Downloading';
  if (engineState === 'verifying') return 'Verifying';
  if (engineState === 'installing') return 'Installing';
  if (engineState === 'failed') return 'Needs attention';
  if (result?.state === 'current') return 'No update';
  if (result?.rollout.deferred && result.state !== 'available') return 'Rolling out';
  if (!environment) return 'Checking';
  if (!environment.productionSignerMatched || !environment.requestInstallPackagesDeclared) return 'Unavailable';
  if (result?.state === 'available' && result.integrity.status === 'ready') return 'Update ready';
  return 'Ready';
}

function appUpdateFeedback(
  result: MobileReleaseCheckV1 | null,
  engineState: OrionUpdateStateV1,
  hasRawMessage: boolean,
): string | null {
  if (result?.rollout.deferred) {
    return result.state === 'available' && result.rollout.offeredVersion
      ? `A newer Orion version is still rolling out. v${result.rollout.offeredVersion} is the newest update available to this device.`
      : 'A newer Orion version is rolling out and has not reached this device yet.';
  }
  if (result?.state === 'available' && result.integrity.status !== 'ready') {
    return 'This update is not ready to install safely yet.';
  }
  if (engineState === 'failed' || hasRawMessage) {
    return 'Orion could not finish the app update. Try again.';
  }
  return null;
}

export function MobileUpdateExecutionSection({ result }: { result: MobileReleaseCheckV1 | null }) {
  const { theme } = useOrionTheme();
  const [environment, setEnvironment] = React.useState<OrionAndroidUpdateEnvironmentV1 | null>(null);
  const [engineState, setEngineState] = React.useState<OrionUpdateStateV1>('idle');
  const [progress, setProgress] = React.useState<number | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const busy = ['downloading', 'verifying', 'installing'].includes(engineState);

  const refreshEnvironment = React.useCallback(async () => {
    try {
      setEnvironment(await getAndroidUpdateEnvironmentV1());
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to inspect Android update support.');
    }
  }, []);

  React.useEffect(() => {
    refreshEnvironment();
    const unsubscribe = subscribeAndroidUpdateStateV1((event: OrionNativeUpdateEventV1) => {
      setEngineState(event.state);
      setProgress(typeof event.progress === 'number' ? event.progress : null);
      if (event.error) {
        setMessage(event.error);
      } else if (['downloading', 'verifying', 'ready', 'installing'].includes(event.state)) {
        setMessage(null);
      }
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshEnvironment();
    });
    return () => {
      unsubscribe();
      appState.remove();
    };
  }, [refreshEnvironment]);

  const runDirectUpdate = async () => {
    const apk = result?.releaseTruth.mobile.apk;
    const integrity = result?.integrity.artifact;
    if (!apk || !integrity) return;
    setMessage(null);
    try {
      const response = await installDirectApkV1({
        url: apk.url,
        assetName: apk.name,
        expectedSize: integrity.size,
        expectedSha256: integrity.sha256,
        expectedSignerSha256: integrity.signerSha256 || '',
      });
      if (response.code === 'permission-required') {
        setMessage('permission-required');
      } else if (response.code === 'direct-build-required') {
        setMessage('direct-build-required');
      }
    } catch (error) {
      setEngineState('failed');
      setMessage(error instanceof Error ? error.message : 'Direct update failed.');
    }
  };

  const permissionRequired = !!environment
    && environment.requestInstallPackagesDeclared
    && !environment.canRequestPackageInstalls;
  const directReady = result?.state === 'available'
    && !!environment
    && environment.productionSignerMatched
    && environment.requestInstallPackagesDeclared
    && environment.canRequestPackageInstalls
    && result.integrity.status === 'ready';
  const showPermissionAction = result?.state === 'available' && permissionRequired;
  const statusLabel = appUpdateStatusLabel(result, environment, engineState);
  const feedback = message === 'permission-required'
    ? 'Android needs permission before Orion can install this update.'
    : message === 'direct-build-required'
      ? 'App updates are not available in this build.'
      : appUpdateFeedback(result, engineState, !!message);

  return (
    <View style={styles.root}>
      <View style={styles.heading}>
        <View style={[styles.iconTile, { backgroundColor: theme.accentSoft }]}>
          <Ionicons name="shield-checkmark-outline" size={20} color={theme.accent} />
        </View>
        <View style={styles.headingCopy}>
          <Text style={[styles.title, { color: theme.text }]}>App updates</Text>
          <Text style={[styles.description, { color: theme.textSecondary }]}>Orion verifies every app update before installation.</Text>
        </View>
        <View style={[styles.statusChip, { backgroundColor: theme.surfaceHover, borderColor: theme.border }]}>
          <Text style={[styles.statusChipText, { color: engineState === 'failed' ? theme.warning : theme.accent }]}>{statusLabel}</Text>
        </View>
      </View>

      {busy ? (
        <View style={styles.progressRow}>
          <Text style={[styles.message, { color: theme.textSecondary }]}>
            {engineState === 'downloading'
              ? 'Downloading update…'
              : engineState === 'verifying'
                ? 'Verifying update…'
                : 'Opening Android installer…'}
          </Text>
          {progress !== null ? (
            <Text style={[styles.progress, { color: theme.accent }]}>{Math.round(progress * 100)}%</Text>
          ) : null}
        </View>
      ) : null}

      {feedback ? <Text style={[styles.message, { color: engineState === 'failed' ? theme.warning : theme.textSecondary }]}>{feedback}</Text> : null}

      {showPermissionAction ? (
        <ActionButton
          label="Allow installs"
          icon="settings-outline"
          disabled={busy}
          onPress={async () => {
            await openDirectInstallPermissionSettingsV1();
          }}
          theme={theme}
        />
      ) : directReady ? (
        <ActionButton
          label={engineState === 'failed' ? 'Retry update' : 'Download & install'}
          icon="download-outline"
          disabled={busy}
          onPress={runDirectUpdate}
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
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3] },
  progress: { fontSize: fontSizes.xs, fontWeight: '900' },
  button: { minHeight: 44, borderRadius: radii.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: spacing[3] },
  buttonText: { color: '#fff', fontSize: fontSizes.sm, fontWeight: '900' },
});
