import { useEffect, useRef } from 'react';
import { AccessibilityInfo, findNodeHandle, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radii, spacing } from '@orion/shared/tokens';
import { useOrionTheme } from '../../context/ThemeContext';
import { usePerformanceProfile } from '../../context/PerformanceContext';
import { resolveMotionPolicy } from '../../services/motionPolicy';
export function OrionContentDialog({ visible, title, eyebrow, onClose, children }: { visible: boolean; title: string; eyebrow?: string; onClose: () => void; children: React.ReactNode }) {
  const { theme, preferences, systemReducedMotion } = useOrionTheme(); const { resolvedProfile } = usePerformanceProfile();
  const motion = resolveMotionPolicy(preferences.reducedMotion, systemReducedMotion);
  const { height, width } = useWindowDimensions(); const insets = useSafeAreaInsets(); const heading = useRef<Text>(null);
  const focus = () => { const node = findNodeHandle(heading.current); if (node) AccessibilityInfo.setAccessibilityFocus(node); };
  useEffect(() => { if (visible) AccessibilityInfo.announceForAccessibility(title); }, [visible, title]);
  return <Modal visible={visible} transparent statusBarTranslucent animationType={motion.reduceMotion || resolvedProfile === 'efficiency' ? 'none' : 'fade'} onRequestClose={onClose} onShow={focus}>
    <View style={[styles.backdrop, { backgroundColor: theme.mediaScrim, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12, paddingHorizontal: Math.max(insets.left, insets.right) + 12 }]}>
      <View accessibilityViewIsModal style={[styles.shell, { backgroundColor: theme.elevated, borderColor: theme.border, width: Math.min(width - Math.max(insets.left, insets.right) * 2 - 24, 720), height: Math.max(180, Math.min(height - insets.top - insets.bottom - 24, 820)) }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}><View style={{ flex: 1, minWidth: 0 }}>{!!eyebrow && <Text style={[styles.eyebrow, { color: theme.accent }]}>{eyebrow}</Text>}<Text ref={heading} accessible accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{title}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Close ${title}`} onPress={onClose} style={styles.close}><Ionicons name="close" size={24} color={theme.text}/></Pressable></View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body}>{children}</ScrollView>
        <Pressable accessibilityRole="button" onPress={onClose} style={[styles.footer, { borderTopColor: theme.border }]}><Text style={[styles.label, { color: theme.accent }]}>Close</Text></Pressable>
      </View>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({backdrop:{flex:1,alignItems:'center',justifyContent:'center'},shell:{borderWidth:1,borderRadius:radii.xl,overflow:'hidden'},header:{flexDirection:'row',alignItems:'center',gap:12,padding:spacing[4],borderBottomWidth:StyleSheet.hairlineWidth},eyebrow:{fontFamily:'Inter',fontSize:12,letterSpacing:1.6},title:{fontFamily:'Outfit',fontSize:26,lineHeight:34},close:{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center'},body:{padding:spacing[4],gap:spacing[3]},footer:{minHeight:52,padding:spacing[3],alignItems:'center',justifyContent:'center',borderTopWidth:StyleSheet.hairlineWidth},label:{fontFamily:'Inter',fontSize:16,fontWeight:'700'}});
