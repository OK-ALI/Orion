import {
  StyleSheet,
  Text as NativeText,
  type TextProps,
  type TextStyle,
} from 'react-native';
import { wavenFonts } from '../../theme/tokens';

const WAVEN_MANAGED_FAMILIES = new Set<string>(Object.values(wavenFonts));

function familyForWeight(weight: TextStyle['fontWeight']): string {
  if (weight === 'bold') return wavenFonts.bold;
  if (weight === 'normal' || weight == null) return wavenFonts.regular;
  const numeric = typeof weight === 'number' ? weight : Number.parseInt(String(weight ?? '400'), 10);
  if (Number.isFinite(numeric)) {
    if (numeric >= 800) return wavenFonts.extraBold;
    if (numeric >= 700) return wavenFonts.bold;
    if (numeric >= 600) return wavenFonts.semiBold;
    if (numeric >= 500) return wavenFonts.medium;
  }
  return wavenFonts.regular;
}

export function WavenText({ style, ...props }: TextProps) {
  const flattened = StyleSheet.flatten(style) as TextStyle | undefined;
  const explicitFamily = flattened?.fontFamily;
  const fontFamily = explicitFamily ?? familyForWeight(flattened?.fontWeight);
  const wavenManaged = !explicitFamily || WAVEN_MANAGED_FAMILIES.has(explicitFamily);

  return (
    <NativeText
      {...props}
      style={wavenManaged ? [style, { fontFamily, fontWeight: 'normal' }] : style}
    />
  );
}
