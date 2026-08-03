import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOrionTheme } from '../context/ThemeContext';

export type OrionDialogActionRole = 'primary' | 'secondary' | 'cancel' | 'destructive';

export interface OrionDialogAction {
  label: string;
  role?: OrionDialogActionRole;
  accessibilityLabel?: string;
  onPress: () => void;
}

interface OrionDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  actions: OrionDialogAction[];
  onDismiss: () => void;
}

export function OrionDialog({ visible, title, message, icon = 'alert-circle-outline', actions, onDismiss }: OrionDialogProps) {
  const { theme } = useOrionTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const titleRef = useRef<Text>(null);
  const stacked = width < 420 || height < 520;

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      const node = titleRef.current as any;
      if (node?._nativeTag) AccessibilityInfo.setAccessibilityFocus(node._nativeTag);
    }, 160);
    return () => clearTimeout(timer);
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onDismiss}>
      <View style={[styles.overlay, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <Pressable accessibilityLabel="Close dialog" style={StyleSheet.absoluteFill} onPress={onDismiss} />
        <View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: theme.elevated, borderColor: theme.border }]}>
          <View style={[styles.icon, { backgroundColor: theme.accentSoft }]}>
            <Ionicons name={icon} size={24} color={theme.accent} />
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.copy} showsVerticalScrollIndicator={false}>
            <Text ref={titleRef} accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{title}</Text>
            {!!message && <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>}
          </ScrollView>
          <View style={[styles.actions, stacked && styles.actionsStacked]}>
            {actions.map((action) => {
              const role = action.role || 'secondary';
              const filled = role === 'primary' || role === 'destructive';
              const backgroundColor = role === 'destructive' ? theme.danger : role === 'primary' ? theme.accent : theme.surface;
              const color = filled ? theme.onAccent : theme.text;
              return (
                <Pressable
                  key={`${role}-${action.label}`}
                  accessibilityRole="button"
                  accessibilityLabel={action.accessibilityLabel || action.label}
                  onPress={action.onPress}
                  style={({ pressed }) => [
                    styles.action,
                    stacked && styles.actionStacked,
                    { backgroundColor, borderColor: filled ? backgroundColor : theme.border },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.actionText, { color }]}>{action.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', justifyContent: 'center', paddingHorizontal: 18 },
  dialog: { width: '100%', maxWidth: 520, maxHeight: '86%', alignSelf: 'center', borderWidth: 1, borderRadius: 24, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.38, shadowRadius: 28, elevation: 18 },
  icon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  scroll: { flexGrow: 0 },
  copy: { paddingBottom: 20 },
  title: { fontSize: 24, lineHeight: 31, fontWeight: '900', letterSpacing: -0.5 },
  message: { marginTop: 9, fontSize: 15, lineHeight: 23 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 9, flexWrap: 'wrap' },
  actionsStacked: { flexDirection: 'column-reverse', alignItems: 'stretch' },
  action: { minWidth: 112, minHeight: 48, borderRadius: 24, borderWidth: 1, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  actionStacked: { width: '100%' },
  actionText: { fontSize: 14, fontWeight: '800', textAlign: 'center' },
  pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
});
