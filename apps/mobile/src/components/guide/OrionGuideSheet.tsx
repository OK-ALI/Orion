import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, findNodeHandle, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOrionTheme } from '../../context/ThemeContext';
import { resolveMotionPolicy } from '../../services/motionPolicy';

const GUIDE_FADE_MS = 160;

export interface OrionGuideContent {
  readonly id: string;
  readonly title: string;
  readonly sections: readonly { readonly id: string; readonly title: string; readonly body: string }[];
  readonly actionLabel: string;
}

/** Public host focus APIs; never route, restore preferences, or touch page data. */
export function focusGuideNode(node: View | null) {
  if (!node) return;
  if (Platform.OS === 'web') node.focus();
  else {
    node.focus();
    const handle = findNodeHandle(node);
    if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle);
  }
}

export function OrionGuideSheet({ content, onClose }: {
  content: OrionGuideContent;
  onClose: () => void;
}) {
  const { theme, preferences, systemReducedMotion } = useOrionTheme();
  const { reduceMotion } = resolveMotionPolicy(preferences.reducedMotion, systemReducedMotion);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const heading = useRef<View>(null);
  const [closing, setClosing] = useState(false);
  const [opacity] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(closing ? 0 : 1);
      if (closing) onClose();
      return;
    }

    // Keep the native modal mounted through the exit fade so it still owns Back and focus.
    const fade = Animated.timing(opacity, {
      toValue: closing ? 0 : 1,
      duration: GUIDE_FADE_MS,
      useNativeDriver: Platform.OS !== 'web',
    });
    let active = true;
    fade.start(({ finished }) => {
      if (active && finished && closing) onClose();
    });
    return () => {
      active = false;
      fade.stop();
    };
  }, [closing, onClose, opacity, reduceMotion]);

  function requestClose() {
    if (reduceMotion) onClose();
    else setClosing(true);
  }

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent
      onRequestClose={requestClose} onShow={() => focusGuideNode(heading.current)}>
      <Animated.View style={[styles.overlay, { opacity, pointerEvents: closing ? 'none' : 'auto', backgroundColor: theme.mediaScrim,
        paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12,
        paddingLeft: insets.left + 16, paddingRight: insets.right + 16 }]}>
        <Pressable accessible={false} focusable={false} tabIndex={-1}
          importantForAccessibility="no" style={StyleSheet.absoluteFill} onPress={requestClose} />
        <View testID={`guide-sheet-${content.id}`} accessibilityViewIsModal onAccessibilityEscape={requestClose}
          style={[styles.sheet, { backgroundColor: theme.elevated, borderColor: theme.border,
            borderTopColor: theme.accent, maxHeight: Math.max(0, height - insets.top - insets.bottom - 24) }]}>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
            <View style={styles.header}>
              <View ref={heading} accessible accessibilityRole="header" accessibilityLabel={content.title}
                focusable tabIndex={-1} style={styles.heading}>
                <Text allowFontScaling style={[styles.title, { color: theme.text }]}>{content.title}</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={`Close ${content.title}`}
                accessibilityHint="Return to the current page." onPress={requestClose}
                style={({ pressed }) => [styles.close, { backgroundColor: pressed ? theme.surfaceHover : theme.surface }]}>
                <Text accessible={false} allowFontScaling style={[styles.closeText, { color: theme.text }]}>×</Text>
              </Pressable>
            </View>
            {content.sections.map((section) => (
              <View key={section.id} style={styles.section}>
                <Text allowFontScaling accessibilityRole="header" style={[styles.sectionTitle, { color: theme.text }]}>{section.title}</Text>
                <Text allowFontScaling style={[styles.body, { color: theme.textSecondary }]}>{section.body}</Text>
              </View>
            ))}
            <Pressable accessibilityRole="button" onPress={requestClose}
              accessibilityHint="Close the guide and return to the current page."
              style={({ pressed }) => [styles.action, { backgroundColor: pressed ? theme.surfaceHover : theme.accentSoft, borderColor: theme.border }]}>
              <Text allowFontScaling style={[styles.actionText, { color: theme.text }]}>{content.actionLabel}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center' },
  sheet: { width: '100%', maxWidth: 560, alignSelf: 'center', flexShrink: 1, borderWidth: 1, borderTopWidth: 3, borderRadius: 24, overflow: 'hidden' },
  scroll: { flexGrow: 0, flexShrink: 1, minHeight: 0 },
  content: { padding: 20, gap: 20 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  heading: { flex: 1, minWidth: 0, paddingVertical: 5 },
  title: { fontFamily: 'Outfit', fontSize: 24, lineHeight: 32, fontWeight: '700' },
  close: { minWidth: 44, minHeight: 44, padding: 8, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 24, lineHeight: 28 },
  section: { gap: 6 },
  sectionTitle: { fontFamily: 'Inter', fontSize: 16, lineHeight: 24, fontWeight: '700' },
  body: { fontFamily: 'Inter', fontSize: 15, lineHeight: 23 },
  action: { minHeight: 48, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontFamily: 'Inter', fontSize: 16, lineHeight: 24, fontWeight: '700', textAlign: 'center' },
});
