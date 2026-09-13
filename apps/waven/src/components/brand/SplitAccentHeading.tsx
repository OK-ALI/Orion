import { StyleSheet, Text, type TextStyle } from 'react-native';
import { wavenColors } from '../../theme/tokens';

interface SplitAccentHeadingProps {
  lead: string;
  accent: string;
  style?: TextStyle;
}

export function SplitAccentHeading({ lead, accent, style }: SplitAccentHeadingProps) {
  return (
    <Text accessibilityRole="header" style={[styles.heading, style]}>
      {lead}{' '}
      <Text style={styles.accent}>{accent}</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: wavenColors.coolWhite,
    fontSize: 22,
    fontWeight: '700',
  },
  accent: {
    color: wavenColors.activeBlue,
  },
});
