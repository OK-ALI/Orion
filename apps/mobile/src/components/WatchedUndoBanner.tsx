import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOrionTheme } from '../context/ThemeContext';
import type { WatchedUndoNotice } from '../features/media-detail/useMediaDetailWatched';

interface WatchedUndoBannerProps {
  notice: WatchedUndoNotice;
  onDismiss: () => void;
}

export function WatchedUndoBanner({ notice, onDismiss }: WatchedUndoBannerProps) {
  const { theme } = useOrionTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(onDismiss, 4500);
    return () => clearTimeout(timer);
  }, [notice?.id, onDismiss]);

  if (!notice) return null;

  return (
    <View pointerEvents="box-none" style={[styles.host, { bottom: insets.bottom + 16 }]}>
      <View
        accessibilityLiveRegion="polite"
        style={[styles.banner, { backgroundColor: theme.elevated, borderColor: theme.border }]}
      >
        <Ionicons name="checkmark-circle" size={20} color={theme.accent} />
        <Text style={[styles.message, { color: theme.text }]} numberOfLines={2}>{notice.message}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Undo watched change"
          onPress={notice.onUndo}
          style={({ pressed }) => [styles.undo, { borderColor: theme.border, backgroundColor: theme.surface }, pressed && styles.pressed]}
        >
          <Text style={[styles.undoText, { color: theme.accent }]}>Undo</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 250,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  banner: {
    width: '100%',
    maxWidth: 560,
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 18,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 12,
  },
  message: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  undo: {
    minWidth: 72,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  undoText: { fontSize: 13, fontWeight: '900' },
  pressed: { opacity: 0.72 },
});
