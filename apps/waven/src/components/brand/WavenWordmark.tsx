import { useWavenHomeStyles } from '../../theme/homeMaterialPreview';
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { WavenText as Text } from '../typography/WavenText';
import { wavenColors, wavenTypography } from '../../theme/tokens';

interface WavenWordmarkProps {
  style?: StyleProp<TextStyle>;
}

export function WavenWordmark({ style }: WavenWordmarkProps) {
  const styles = useWavenHomeStyles(noirStyles, 'wordmark');

  return (
    <Text accessibilityLabel="WAVEN" accessibilityRole="header" style={[styles.wordmark, style]}>
      <Text style={styles.segment}>WA</Text>
      <Text style={styles.accent}>V</Text>
      <Text style={styles.segment}>EN</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  wordmark: {
    color: wavenColors.textPrimary,
    fontFamily: wavenTypography.wordmark.fontFamily,
    fontSize: wavenTypography.wordmark.fontSize,
    fontWeight: wavenTypography.wordmark.fontWeight,
    letterSpacing: wavenTypography.wordmark.letterSpacing,
    textAlign: 'center',
  },
  segment: {
    fontFamily: wavenTypography.wordmark.fontFamily,
    fontWeight: wavenTypography.wordmark.fontWeight,
  },
  accent: {
    color: wavenColors.interactionBlue,
    fontFamily: wavenTypography.wordmark.fontFamily,
    fontWeight: wavenTypography.wordmark.fontWeight,
  },
});

const noirStyles = styles;
