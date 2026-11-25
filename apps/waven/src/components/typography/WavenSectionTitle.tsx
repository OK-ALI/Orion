import { useWavenHomeStyles } from '../../theme/homeMaterialPreview';
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { WavenText as Text } from './WavenText';
import { wavenColors, wavenTypography } from '../../theme/tokens';

interface WavenSectionTitleProps {
  leading: string;
  accent?: string;
  accessibilityLabel?: string;
  style?: StyleProp<TextStyle>;
}

export function WavenSectionTitle({
  leading,
  accent,
  accessibilityLabel,
  style,
}: WavenSectionTitleProps) {
  const styles = useWavenHomeStyles(noirStyles, 'section');

  return (
    <Text
      accessibilityLabel={accessibilityLabel ?? [leading, accent].filter(Boolean).join(' ')}
      accessibilityRole="header"
      style={[styles.title, style]}
    >
      {leading}
      {accent ? (
        <>
          {' '}
          <Text style={styles.accent}>{accent}</Text>
        </>
      ) : null}
    </Text>
  );
}

export function splitWavenSectionAccent(value: string): {
  leading: string;
  accent?: string;
} {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    return { leading: '', accent: words[0] || '' };
  }
  return {
    leading: words.slice(0, -1).join(' '),
    accent: words[words.length - 1],
  };
}

const styles = StyleSheet.create({
  title: {
    color: wavenColors.textPrimary,
    fontFamily: wavenTypography.section.fontFamily,
    fontSize: wavenTypography.section.fontSize,
    fontWeight: wavenTypography.section.fontWeight,
    lineHeight: wavenTypography.section.lineHeight,
  },
  accent: {
    color: wavenColors.interactionBlue,
    fontFamily: wavenTypography.section.fontFamily,
    fontSize: wavenTypography.section.fontSize,
    fontWeight: wavenTypography.section.fontWeight,
  },
});

const noirStyles = styles;
