import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { useOrionTheme } from '../../context/ThemeContext';
import { useResponsiveLayout } from '../../services/responsive';
import { focusGuideNode, OrionGuideSheet, type OrionGuideContent } from './OrionGuideSheet';

export type { OrionGuideContent } from './OrionGuideSheet';

/** Presentation state stays here, separate from the page's query and filters. */
export function OrionGuide({ content }: { content: OrionGuideContent }) {
  const { theme } = useOrionTheme();
  const { isTablet, isLandscape } = useResponsiveLayout();
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  const trigger = useRef<View>(null);
  const wasVisible = useRef(false);
  const close = useCallback(() => setVisible(false), []);

  useEffect(() => {
    const closing = wasVisible.current && !visible;
    wasVisible.current = visible;
    if (!closing) return;
    const frame = requestAnimationFrame(() => focusGuideNode(trigger.current));
    return () => cancelAnimationFrame(frame);
  }, [visible]);

  return (
    <>
      <Pressable ref={trigger} testID={`guide-trigger-${content.id}`} accessibilityRole="button"
        accessibilityLabel={`Open ${content.title}`} accessibilityHint="Show help for this page without leaving it."
        aria-expanded={visible} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        onPress={() => { Keyboard.dismiss(); setVisible(true); }}
        style={[styles.trigger, { marginTop: isTablet || isLandscape ? 64 : 16 }]}>
        {({ pressed }) => (
          <View testID={`guide-badge-${content.id}`} accessible={false} pointerEvents="none"
            style={[styles.badge, { backgroundColor: pressed ? theme.surfaceHover : theme.surface,
              borderColor: focused ? theme.text : theme.border }]}>
            <Text accessible={false} allowFontScaling={false} style={[styles.question, { color: theme.text }]}>?</Text>
          </View>
        )}
      </Pressable>
      {visible && <OrionGuideSheet content={content} onClose={close} />}
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', outlineWidth: 0 },
  badge: { width: 26, height: 26, borderWidth: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  question: { fontFamily: 'Inter', fontSize: 14, lineHeight: 18, fontWeight: '700', textAlign: 'center', textAlignVertical: 'center', includeFontPadding: false },
});
