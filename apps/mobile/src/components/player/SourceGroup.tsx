import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOrionTheme } from '../../context/ThemeContext';

/** Presentation only; routing and capabilities retain their existing owners. */
export function SourceGroup({ title, expanded, onToggle, children }: PropsWithChildren<{
  title: string; expanded: boolean; onToggle?: () => void;
}>) {
  const { theme } = useOrionTheme();
  return <View style={styles.group}>
    <Pressable accessibilityRole={onToggle ? 'button' : 'header'} accessibilityState={{ expanded }}
      disabled={!onToggle} onPress={onToggle} style={styles.header}>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      {onToggle && <Ionicons name={expanded ? 'chevron-down' : 'chevron-forward'} size={18} color={theme.textSecondary} />}
    </Pressable>
    {expanded && children}
  </View>;
}
const styles = StyleSheet.create({
  group: { gap: 8 }, header: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: 14, fontWeight: '800' },
});
