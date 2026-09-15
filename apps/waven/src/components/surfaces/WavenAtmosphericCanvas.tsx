import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

export type WavenAtmosphericVariant = 'default' | 'entry' | 'quiet';

interface WavenAtmosphericCanvasProps {
  variant?: WavenAtmosphericVariant;
}

const VARIANT_OPACITY: Record<WavenAtmosphericVariant, number> = {
  default: 0.62,
  entry: 0.82,
  quiet: 0.44,
};

export function WavenAtmosphericCanvas({
  variant = 'default',
}: WavenAtmosphericCanvasProps) {
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
        colors={[
          '#000000',
          '#02050A',
          '#050C14',
          '#02050A',
          '#000000',
        ]}
        end={{ x: 0.82, y: 1 }}
        locations={[0, 0.2, 0.5, 0.78, 1]}
        start={{ x: 0.18, y: 0 }}
        style={StyleSheet.absoluteFill}
      />

      <LinearGradient
        colors={[
          'rgba(0,0,0,0)',
          'rgba(6,61,108,0.10)',
          'rgba(11,112,191,0.24)',
          'rgba(24,151,223,0.18)',
          'rgba(6,45,78,0.07)',
          'rgba(0,0,0,0)',
        ]}
        end={{ x: 0.96, y: 0.78 }}
        locations={[0, 0.16, 0.34, 0.52, 0.74, 1]}
        start={{ x: 0.02, y: 0.18 }}
        style={StyleSheet.absoluteFill}
      />

      <LinearGradient
        colors={[
          'rgba(0,0,0,0)',
          'rgba(111,128,145,0.035)',
          'rgba(197,207,217,0.085)',
          'rgba(244,247,249,0.12)',
          'rgba(146,160,174,0.045)',
          'rgba(0,0,0,0)',
        ]}
        end={{ x: 0.98, y: 0.94 }}
        locations={[0, 0.42, 0.61, 0.76, 0.88, 1]}
        start={{ x: 0.24, y: 0.3 }}
        style={StyleSheet.absoluteFill}
      />

      <LinearGradient
        colors={[
          'rgba(0,0,0,0.93)',
          'rgba(0,0,0,0.28)',
          'rgba(0,0,0,0.06)',
          'rgba(0,0,0,0.22)',
          'rgba(0,0,0,0.92)',
        ]}
        end={{ x: 0.5, y: 1 }}
        locations={[0, 0.18, 0.46, 0.76, 1]}
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
