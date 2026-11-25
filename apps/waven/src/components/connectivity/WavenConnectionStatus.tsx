import { useWavenHomeStyles } from '../../theme/homeMaterialPreview';
import { StyleSheet, View } from 'react-native';
import { WavenText as Text } from '../typography/WavenText';
import { WavenPressable } from '../interaction/WavenPressable';
import { checkWavenConnection } from '../../infrastructure/connectivity/connectivityRuntime';
import { useWavenConnectivity } from '../../infrastructure/connectivity/connectivityHooks';
import { offlineMetadata } from '../../infrastructure/connectivity/offlineMetadata';
import { wavenColors, wavenLayout, wavenSpacing, wavenTypography } from '../../theme/tokens';

export function WavenConnectionStatus() {
  const styles = useWavenHomeStyles(noirStyles, 'connection');

  const connection = useWavenConnectivity();
  const cacheNotice = offlineMetadata.getNotice();
  if (connection.state === 'ONLINE' && !cacheNotice) return null;
  const offline = connection.state === 'OFFLINE', recovering = connection.state === 'RECOVERING';
  const unavailable = Object.entries(connection.providers).filter(([, health]) => !health.available);
  const onlyDiscovery = unavailable.every(([key]) => key.startsWith('discovery:'));
  // A single destination/shelf owns its local retry status. Widespread/provider
  // failures stay visible globally; successful cache reads never invent health.
  if (!cacheNotice && connection.internetReady && onlyDiscovery && unavailable.length === 1) return null;
  if (!cacheNotice && recovering && connection.internetReady && !unavailable.length) return null;
  const title = connection.state === 'ONLINE' ? 'Discovery cache' : offline ? 'You’re offline'
    : recovering && !connection.internetReady ? 'Reconnecting' : onlyDiscovery ? 'Discovery is refreshing' : 'Some music services are unavailable';
  const message = connection.state === 'ONLINE' ? cacheNotice : offline ? 'Saved music stays available.'
    : recovering && !connection.internetReady ? 'Checking your connection.' : 'Available music still works. Retrying automatically.';
  return <View style={styles.panel}>
    <View style={styles.copy} accessibilityLiveRegion="polite" accessible accessibilityLabel={`${title}. ${message}`}>
      <Text style={styles.message}><Text style={styles.title}>{title}.</Text> {message}</Text>
    </View>
    <WavenPressable accessibilityRole="button" accessibilityLabel="Check connection" accessibilityState={{ disabled: recovering }} disabled={recovering}
      onPress={() => { void checkWavenConnection(); }} style={styles.action}><Text style={styles.actionText}>Check</Text></WavenPressable>
  </View>;
}
const styles = StyleSheet.create({
  panel: { flexDirection: 'row', alignItems: 'center', gap: wavenSpacing.xs, paddingVertical: wavenSpacing.xxs, marginBottom: wavenSpacing.xs },
  copy: { flex: 1 }, title: { color: wavenColors.textSecondary, fontWeight: '700' },
  message: { ...wavenTypography.caption, color: wavenColors.textSecondary, lineHeight: 19 },
  action: { minHeight: wavenLayout.minimumTouchTarget, minWidth: wavenLayout.minimumTouchTarget, paddingHorizontal: 10, justifyContent: 'center' },
  actionText: { color: wavenColors.interactionBlue, fontSize: 13, fontWeight: '700' },
});

const noirStyles = styles;
