import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MobilePlayerLoadingState } from '@orion/shared/types';
import { radii, spacing } from '@orion/shared/tokens';
import { useOrionTheme } from '../../context/ThemeContext';

const COPY: Record<Exclude<MobilePlayerLoadingState, null>, { title: string; body: string; icon: keyof typeof Ionicons.glyphMap }> = {
  preparing: { title: 'Preparing source', body: 'Orion is opening the selected playback source.', icon: 'sparkles-outline' },
  waiting: { title: 'Waiting for provider', body: 'The provider is getting its player ready.', icon: 'hourglass-outline' },
  buffering: { title: 'Buffering', body: 'Playback will continue when enough video is ready.', icon: 'pulse-outline' },
  switching: { title: 'Switching source', body: 'Your verified playback position is being carried over.', icon: 'swap-horizontal-outline' },
  offline: { title: 'You are offline', body: 'Reconnect to continue, or choose an available local source.', icon: 'cloud-offline-outline' },
  failed: { title: 'Playback needs attention', body: 'This source could not continue. Retry it or choose another source.', icon: 'warning-outline' },
};

interface PlayerStateOverlayProps {
  state: MobilePlayerLoadingState;
  onRetry?: () => void;
  onSwitchSource?: () => void;
}

export function PlayerStateOverlay({ state, onRetry, onSwitchSource }: PlayerStateOverlayProps) {
  const { theme } = useOrionTheme();
  if (!state) return null;
  const content = COPY[state];
  const busy = !['failed', 'offline'].includes(state);
  return (
    <View pointerEvents={busy ? 'none' : 'box-none'} style={styles.layer} accessibilityLiveRegion="polite">
      <View style={[styles.panel, { backgroundColor: theme.elevated, borderColor: theme.border }]}>
        {busy ? <ActivityIndicator size="small" color={theme.accent} /> : (
          <Ionicons name={content.icon} size={22} color={state === 'failed' ? theme.danger : theme.warning} />
        )}
        <View style={styles.copy}>
          <Text style={[styles.title, { color: theme.text }]}>{content.title}</Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>{content.body}</Text>
        </View>
        {!busy && (
          <View style={styles.actions}>
            {onRetry && <Pressable accessibilityRole="button" onPress={onRetry} style={[styles.action, { backgroundColor: theme.accent }]}><Text style={[styles.actionText, { color: theme.onAccent }]}>Retry</Text></Pressable>}
            {onSwitchSource && <Pressable accessibilityRole="button" onPress={onSwitchSource} style={[styles.action, { borderColor: theme.border, borderWidth: 1 }]}><Text style={[styles.actionText, { color: theme.text }]}>Switch source</Text></Pressable>}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 18, alignItems: 'center', justifyContent: 'center', padding: spacing[4] },
  panel: { width: '100%', maxWidth: 460, minHeight: 82, borderRadius: radii.xl, borderWidth: 1, padding: spacing[4], flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, fontWeight: '800' },
  body: { marginTop: 3, fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  action: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing[3], borderRadius: radii.full },
  actionText: { fontSize: 13, fontWeight: '800' },
});
