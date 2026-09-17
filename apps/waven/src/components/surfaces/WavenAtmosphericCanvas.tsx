import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

export type WavenAtmosphericVariant = 'default' | 'entry' | 'quiet';

interface WavenAtmosphericCanvasProps {
  variant?: WavenAtmosphericVariant;
}

const VARIANT_OPACITY: Record<WavenAtmosphericVariant, number> = {
  default: 0.74,
  entry: 0.82,
  quiet: 0.5,
};

const ENTRY_BASE = ['#000000', '#02050A', '#050C14', '#02050A', '#000000'] as const;
const ENTRY_BLUE = [
  'rgba(0,0,0,0)',
  'rgba(6,61,108,0.10)',
  'rgba(11,112,191,0.24)',
  'rgba(24,151,223,0.18)',
  'rgba(6,45,78,0.07)',
  'rgba(0,0,0,0)',
] as const;
const ENTRY_SILVER = [
  'rgba(0,0,0,0)',
  'rgba(111,128,145,0.035)',
  'rgba(197,207,217,0.085)',
  'rgba(244,247,249,0.12)',
  'rgba(146,160,174,0.045)',
  'rgba(0,0,0,0)',
] as const;

const PRIMARY_BASE = ['#000000', '#02070C', '#04101A', '#02070C', '#000000'] as const;
const PRIMARY_TOP_GLOW = [
  'rgba(0,0,0,0)',
  'rgba(44,174,236,0.10)',
  'rgba(69,191,239,0.22)',
  'rgba(31,133,210,0.15)',
  'rgba(0,0,0,0)',
] as const;
const PRIMARY_MID_GLOW = [
  'rgba(0,0,0,0)',
  'rgba(8,68,121,0.08)',
  'rgba(20,111,188,0.16)',
  'rgba(45,159,220,0.12)',
  'rgba(0,0,0,0)',
] as const;
const PRIMARY_LOWER_GLOW = [
  'rgba(0,0,0,0)',
  'rgba(188,207,221,0.035)',
  'rgba(102,178,221,0.085)',
  'rgba(34,133,201,0.10)',
  'rgba(0,0,0,0)',
] as const;

export function WavenAtmosphericCanvas({
  variant = 'default',
}: WavenAtmosphericCanvasProps) {
  const isEntry = variant === 'entry';

  return (
    <View
      accessible={false}
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        styles.canvas,
        { opacity: VARIANT_OPACITY[variant] },
      ]}
    >
      <LinearGradient
        colors={isEntry ? ENTRY_BASE : PRIMARY_BASE}
        end={{ x: 0.82, y: 1 }}
        locations={[0, 0.2, 0.5, 0.78, 1]}
        start={{ x: 0.18, y: 0 }}
        style={StyleSheet.absoluteFill}
      />

      <LinearGradient
        colors={isEntry ? ENTRY_BLUE : PRIMARY_TOP_GLOW}
        end={{ x: 0.96, y: 0.48 }}
        locations={isEntry ? [0, 0.16, 0.34, 0.52, 0.74, 1] : [0, 0.18, 0.46, 0.76, 1]}
        start={{ x: 0.02, y: 0.06 }}
        style={StyleSheet.absoluteFill}
      />

      <LinearGradient
        colors={isEntry ? ENTRY_SILVER : PRIMARY_MID_GLOW}
        end={{ x: 0.98, y: 0.82 }}
        locations={isEntry ? [0, 0.42, 0.61, 0.76, 0.88, 1] : [0, 0.26, 0.5, 0.74, 1]}
        start={{ x: 0.08, y: 0.28 }}
        style={StyleSheet.absoluteFill}
      />

      {!isEntry ? (
        <LinearGradient
          colors={PRIMARY_LOWER_GLOW}
          end={{ x: 0.12, y: 1 }}
          locations={[0, 0.34, 0.6, 0.82, 1]}
          start={{ x: 0.92, y: 0.55 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      <LinearGradient
        colors={[
          'rgba(0,0,0,0.94)',
          'rgba(0,0,0,0.18)',
          'rgba(0,0,0,0.035)',
          'rgba(0,0,0,0.20)',
          'rgba(0,0,0,0.94)',
        ]}
        end={{ x: 0.5, y: 1 }}
        locations={[0, 0.16, 0.46, 0.78, 1]}
        start={{ x: 0.5, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
});
