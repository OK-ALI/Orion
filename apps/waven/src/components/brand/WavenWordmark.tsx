import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { wavenColors, wavenTypography } from '../../theme/tokens';

interface WavenWordmarkProps {
  style?: StyleProp<TextStyle>;
}

export function WavenWordmark({ style }: WavenWordmarkProps) {
  return (
    <Text accessibilityLabel="WAVEN" accessibilityRole="header" style={[styles.wordmark, style]}>
      <Text>WA</Text>
      <Text style={styles.accent}>V</Text>
      <Text>EN</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  wordmark: {
    color: wavenColors.textPrimary,
    fontSize: wavenTypography.wordmark.fontSize,
    fontWeight: wavenTypography.wordmark.fontWeight,
    letterSpacing: wavenTypography.wordmark.letterSpacing,
    textAlign: 'center',
  },
  accent: {
    color: wavenColors.interactionBlue,
  },
});
