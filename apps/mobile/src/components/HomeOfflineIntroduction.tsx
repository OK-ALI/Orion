import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing } from '@orion/shared/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOrionTheme } from '../context/ThemeContext';
import { useResponsiveLayout } from '../services/responsive';

export function HomeOfflineIntroduction({ onOpenDownloads, onOpenLibrary }: {
  onOpenDownloads: () => void;
  onOpenLibrary: () => void;
}) {
  const { theme } = useOrionTheme();
  const insets = useSafeAreaInsets();
  const { width, isTablet, fontScale } = useResponsiveLayout();

  return (
    <View style={[
      styles.introduction,
      {
        // Reserve the shared floating-control lane even when Home has no Hero.
        paddingTop: insets.top + 96 * Math.max(1, fontScale),
        paddingHorizontal: width < 360 ? 12 : isTablet ? 32 : 20,
      },
    ]}>
      <Text style={[styles.eyebrow, { color: theme.accent }]}>AVAILABLE OFFLINE</Text>
      <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>Your local Orion is ready.</Text>
      <Text style={[styles.body, { color: theme.textSecondary }]}>
        Your Library and verified Downloads stay available without internet.
      </Text>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Downloads"
          onPress={onOpenDownloads}
          style={({ pressed }) => [styles.action, { backgroundColor: theme.accent }, pressed && styles.pressed]}
        >
          <Ionicons name="download-outline" size={17} color={theme.onAccent} />
          <Text style={[styles.actionText, { color: theme.onAccent }]}>Downloads</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Library"
          onPress={onOpenLibrary}
          style={({ pressed }) => [styles.action, { backgroundColor: theme.elevated, borderColor: theme.border, borderWidth: 1 }, pressed && styles.pressed]}
        >
          <Ionicons name="library-outline" size={17} color={theme.text} />
          <Text style={[styles.actionText, { color: theme.text }]}>Library</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  introduction: { paddingBottom: spacing[6] },
  eyebrow: { fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 1.7, marginBottom: 6 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '900', letterSpacing: -0.6 },
  body: { fontSize: 14, lineHeight: 20, marginTop: 6, maxWidth: 560 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  action: { minHeight: 44, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  actionText: { fontSize: 13, fontWeight: '800' },
  pressed: { opacity: 0.76 },
});
