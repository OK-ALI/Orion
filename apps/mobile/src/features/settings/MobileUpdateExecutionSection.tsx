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
        setMessage('Allow Orion as an install source, then return here and try again.');
      } else if (response.code === 'direct-build-required') {
        setMessage('This build is not configured for direct APK installation.');
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

  const pathLabel = !environment
    ? 'Unavailable in this build'
    : environment.productionSignerMatched
      ? 'Verified direct APK'
      : 'Direct updates require a production build';

  return (
    <View style={[styles.root, { backgroundColor: theme.elevated, borderColor: theme.border }]}>
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <Text style={[styles.title, { color: theme.text }]}>Update engine</Text>
          <Text style={[styles.description, { color: theme.textSecondary }]}>{pathLabel}</Text>
        </View>
        <Ionicons
          name="shield-checkmark-outline"
          size={21}
          color={theme.accent}
        />
      </View>

      {result?.rollout.deferred ? (
        <Text style={[styles.message, { color: theme.textSecondary }]}>
          {result.state === 'available' && result.rollout.offeredVersion
            ? `Orion Mobile ${result.rollout.latestVersion} is still rolling out. Version ${result.rollout.offeredVersion} is the newest update currently offered to this device.`
            : `Orion Mobile ${result.rollout.latestVersion} is rolling out gradually and has not reached this device yet.`}
        </Text>
      ) : null}

      {result?.state === 'available' && result.integrity.status !== 'ready' ? (
        <Text style={[styles.message, { color: theme.textSecondary }]}>
          Automatic installation is locked. {result.integrity.reason}
        </Text>
      ) : null}

      {busy ? (
        <View style={styles.progressRow}>
          <Text style={[styles.message, { color: theme.textSecondary }]}>
            {engineState === 'downloading'
              ? 'Downloading update…'
              : engineState === 'verifying'
                ? 'Verifying APK integrity…'
                : 'Opening Android installer…'}
          </Text>
          {progress !== null ? (
            <Text style={[styles.progress, { color: theme.accent }]}>
              {Math.round(progress * 100)}%
            </Text>
          ) : null}
        </View>
      ) : null}

      {message ? <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text> : null}

      {permissionRequired ? (
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
  root: { borderWidth: 1, borderRadius: radii.xl, padding: spacing[3], gap: spacing[2] },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  headingCopy: { flex: 1 },
  title: { fontSize: fontSizes.sm, fontWeight: '900' },
  description: { fontSize: fontSizes.xs, marginTop: 3, lineHeight: 18 },
  message: { fontSize: fontSizes.xs, lineHeight: 18 },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3] },
  progress: { fontSize: fontSizes.xs, fontWeight: '900' },
  button: { minHeight: 44, borderRadius: radii.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: spacing[3] },
  buttonText: { color: '#fff', fontSize: fontSizes.sm, fontWeight: '900' },
});
