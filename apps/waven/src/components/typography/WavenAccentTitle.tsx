import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { wavenColors, wavenTypography } from '../../theme/tokens';

interface WavenAccentTitleProps {
  before?: string;
  accent: string;
  after?: string;
  style?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}

export function WavenAccentTitle({
  before = '',
  accent,
  after = '',
  style,
  accessibilityLabel,
}: WavenAccentTitleProps) {
  return (
    <Text
      accessibilityLabel={accessibilityLabel ?? `${before}${accent}${after}`}
      accessibilityRole="header"
      style={[styles.title, style]}
    >
      {before}
      <Text style={styles.accent}>{accent}</Text>
      {after}
    </Text>
  );
}

const styles = StyleSheet.create({
  title: {
    color: wavenColors.textPrimary,
    fontSize: wavenTypography.display.fontSize,
    fontWeight: wavenTypography.display.fontWeight,
    lineHeight: wavenTypography.display.lineHeight,
  },
  accent: {
    color: wavenColors.interactionBlue,
  },
});
