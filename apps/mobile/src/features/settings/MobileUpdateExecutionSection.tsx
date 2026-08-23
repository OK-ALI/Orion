import React from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontSizes, radii, spacing } from '@orion/shared/tokens';
import { useOrionTheme } from '../../context/ThemeContext';
import {
  getMobileApplicationUpdatePresentationV1,
  isMobileApplicationUpdateInstallReadyV1,
  publishMobileApplicationUpdateEngineEventV1,
  refreshMobileApplicationUpdateEnvironmentV1,
  type MobileApplicationUpdateStateV1,
} from '../../services/mobileApplicationUpdateState';
import {
  installDirectApkV1,
  openDirectInstallPermissionSettingsV1,
  subscribeAndroidUpdateStateV1,
  type OrionNativeUpdateEventV1,
} from '../../services/nativeUpdateEngine';

function appUpdateFeedback(
  state: MobileApplicationUpdateStateV1,
  rawMessage: string | null,
): string | null {
  if (rawMessage === 'permission-required') {
    return 'Android needs permission before Orion can install this update.';
  }
  if (rawMessage === 'direct-build-required') {
    return 'App updates are not available in this build.';
  }
  if (state.result?.rollout.deferred) {
    const result = state.result;
    return result?.state === 'available' && result.rollout.offeredVersion
      ? `A newer Orion version is still rolling out. v${result.rollout.offeredVersion} is the newest update available to this device.`
      : 'A newer Orion version is rolling out and has not reached this device yet.';
  }
  if (state.result?.state === 'available' && state.result.integrity.status !== 'ready') {
    return 'This update is not ready to install safely yet.';
  }
  if (state.status === 'failed' || rawMessage) {
    return 'Orion could not finish the app update. Try again.';
  }
  return null;
}

export function MobileUpdateExecutionSection({ state }: { state: MobileApplicationUpdateStateV1 }) {
  const { theme } = useOrionTheme();
  const [message, setMessage] = React.useState<string | null>(null);
  const busy = ['downloading', 'verifying', 'installing'].includes(state.status);
  const presentation = getMobileApplicationUpdatePresentationV1(state);

  const refreshEnvironment = React.useCallback(async () => {
    await refreshMobileApplicationUpdateEnvironmentV1();
  }, []);

  React.useEffect(() => {
    void refreshEnvironment();
    const unsubscribe = subscribeAndroidUpdateStateV1((event: OrionNativeUpdateEventV1) => {
      publishMobileApplicationUpdateEngineEventV1(event);
      if (event.error) {
        setMessage(event.error);
      } else if (['downloading', 'verifying', 'ready', 'installing'].includes(event.state)) {
        setMessage(null);
      }
    });
    const appState = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void refreshEnvironment();
    });
    return () => {
      unsubscribe();
      appState.remove();
    };
  }, [refreshEnvironment]);

  const runDirectUpdate = async () => {
    const apk = state.result?.releaseTruth.mobile.apk;
    const integrity = state.result?.integrity.artifact;
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
        await refreshMobileApplicationUpdateEnvironmentV1();
      } else if (response.code === 'direct-build-required') {
        setMessage('direct-build-required');
        await refreshMobileApplicationUpdateEnvironmentV1();
      }
    } catch {
      publishMobileApplicationUpdateEngineEventV1({
        state: 'failed',
        error: 'Orion could not finish the app update. Try again.',
      });
    }
  };

  const showPermissionAction = state.status === 'permission-required';
  const directReady = isMobileApplicationUpdateInstallReadyV1(state)
    && !['downloading', 'verifying', 'installing'].includes(state.status);
  const feedback = appUpdateFeedback(state, message);

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
          <Text style={[styles.statusChipText, { color: state.status === 'failed' ? theme.warning : theme.accent }]}>{presentation.label}</Text>
        </View>
      </View>

      {busy ? (
        <View style={styles.progressRow}>
          <Text style={[styles.message, { color: theme.textSecondary }]}>{presentation.description}</Text>
          {state.progress !== null ? (
            <Text style={[styles.progress, { color: theme.accent }]}>{Math.round(state.progress * 100)}%</Text>
          ) : null}
        </View>
      ) : null}

      {feedback ? <Text style={[styles.message, { color: state.status === 'failed' ? theme.warning : theme.textSecondary }]}>{feedback}</Text> : null}

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
          label={state.status === 'failed' ? 'Retry update' : 'Download & install'}
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
