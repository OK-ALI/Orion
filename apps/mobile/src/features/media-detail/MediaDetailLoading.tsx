import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOrionTheme } from '../../context/ThemeContext';

/** Stable, inert geometry; loading never implies metadata or playback readiness. */
export function MediaDetailLoading({ onBack }: { onBack(): void }) {
  const { theme } = useOrionTheme();
  const insets = useSafeAreaInsets();
  return <View style={{ flex: 1, backgroundColor: theme.background }} accessibilityState={{ busy: true }}>
    <View style={[styles.backdrop, { backgroundColor: theme.surface }]} />
    <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack}
      style={[styles.back, { top: insets.top + 12, backgroundColor: theme.elevated }]}>
      <Text style={{ color: theme.text }}>Back</Text>
    </Pressable>
    <View style={styles.content}>
      <View style={[styles.poster, { backgroundColor: theme.elevated }]} accessible={false} />
      <Text accessibilityLiveRegion="polite" style={[styles.label, { color: theme.textSecondary }]}>Loading title information…</Text>
    </View>
  </View>;
}

export function EpisodeListLoading() {
  const { theme } = useOrionTheme();
  return <View style={styles.episodes} accessibilityState={{ busy: true }}>
    <Text accessibilityLiveRegion="polite" style={{ color: theme.textSecondary }}>Loading episodes…</Text>
    {[0, 1, 2].map((row) => <View key={row} accessible={false} style={[styles.episode, { backgroundColor: theme.surface }]} />)}
  </View>;
}

const styles = StyleSheet.create({
  backdrop: { height: 280, width: '100%' },
  back: { position: 'absolute', left: 20, minWidth: 64, minHeight: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  content: { marginTop: -80, paddingHorizontal: 16, gap: 20 },
  poster: { width: 100, height: 150, borderRadius: 12 },
  label: { fontSize: 16, minHeight: 44 },
  episodes: { minHeight: 256, marginTop: 20, gap: 12 },
  episode: { height: 64, borderRadius: 12 },
});
