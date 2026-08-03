import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOrionTheme } from '../context/ThemeContext';
import { useResponsiveLayout } from '../services/responsive';

export interface MobilePageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  compact?: boolean;
  layoutMode?: 'regular' | 'compact';
}

export function MobilePageHeader({ eyebrow, title, subtitle, trailing, compact = false, layoutMode = 'regular' }: MobilePageHeaderProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useOrionTheme();
  const { isTablet, width } = useResponsiveLayout();
  const horizontal = width < 360 ? 12 : isTablet ? 32 : 18;
  const isCompact = compact || layoutMode === 'compact';

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: isTablet ? insets.top + 20 : insets.top + 64,
          paddingHorizontal: horizontal,
          paddingBottom: isCompact ? 12 : 18,
        },
      ]}
    >
      <View style={styles.topRow}>
        {!!eyebrow && <Text style={[styles.eyebrow, { color: theme.accent }]}>{eyebrow}</Text>}
        {!!trailing && <View style={styles.trailing}>{trailing}</View>}
      </View>
      <Text accessibilityRole="header" style={[styles.title, isCompact && styles.titleCompact, { color: theme.text }]}>{title}</Text>
      {!!subtitle && <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { width: '100%' },
  topRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  trailing: { flexShrink: 0, minHeight: 44, justifyContent: 'center' },
  eyebrow: { fontSize: 11, lineHeight: 16, fontWeight: '900', letterSpacing: 2.1, marginBottom: 2 },
  title: { fontSize: 36, lineHeight: 43, fontWeight: '900', letterSpacing: -1.2 },
  titleCompact: { fontSize: 30, lineHeight: 36 },
  subtitle: { maxWidth: 620, marginTop: 5, fontSize: 14, lineHeight: 21, fontWeight: '500' },
});
