import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { wavenColors, wavenRadii } from '../../theme/tokens';

interface WavenSurfaceProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function WavenSurface({ children, style }: WavenSurfaceProps) {
  return <View style={[styles.surface, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  surface: {
    backgroundColor: wavenColors.surfaceSoft,
    borderColor: wavenColors.borderSubtle,
    borderRadius: wavenRadii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
