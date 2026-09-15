import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { wavenColors, wavenRadii } from '../../theme/tokens';

interface WavenArtworkFallbackProps {
  size: number;
  accessibilityLabel?: string;
  seed?: string;
}

function signalHeights(seed: string) {
  const source = seed || 'WAVEN';
  let hash = 17;

  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }

  return Array.from({ length: 7 }, (_, index) => {
    const shift = (index * 5) % 24;
    const value = (hash >>> shift) & 0x1f;
    return 0.28 + (value / 31) * 0.52;
  });
}

export function WavenArtworkFallback({
  size,
  accessibilityLabel = 'WAVEN artwork',
  seed = 'WAVEN',
}: WavenArtworkFallbackProps) {
  const heights = signalHeights(seed);
  const barWidth = Math.max(3, Math.round(size * 0.034));
  const barGap = Math.max(3, Math.round(size * 0.022));

  return (
    <LinearGradient
      accessibilityLabel={accessibilityLabel}
      accessible
      colors={[wavenColors.surfaceRaised, '#071019', '#020406']}
      end={{ x: 1, y: 1 }}
      start={{ x: 0, y: 0 }}
      style={[
        styles.frame,
        {
          width: size,
          height: size,
          borderRadius: Math.max(wavenRadii.md, Math.round(size * 0.18)),
        },
      ]}
    >
      <View pointerEvents="none" style={styles.glow} />
      <View pointerEvents="none" style={styles.ringOuter} />
      <View pointerEvents="none" style={styles.ringInner} />
      <View style={[styles.signal, { gap: barGap }]}>
        {heights.map((height, index) => (
          <View
            key={`${index}-${height.toFixed(3)}`}
            style={[
              styles.bar,
              {
                width: barWidth,
                height: Math.max(8, Math.round(size * height * 0.35)),
                borderRadius: barWidth,
                opacity: index === 3 ? 1 : 0.62,
                backgroundColor:
                  index === 3 ? wavenColors.interactionBlue : wavenColors.textSecondary,
              },
            ]}
          />
        ))}
      </View>
      <View pointerEvents="none" style={styles.signalDot} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    borderColor: wavenColors.borderSubtle,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  glow: {
    backgroundColor: wavenColors.blueGlow,
    borderRadius: 999,
    height: '72%',
    opacity: 0.72,
    position: 'absolute',
    right: '-24%',
    top: '-18%',
    width: '72%',
  },
  ringOuter: {
    borderColor: 'rgba(197, 202, 209, 0.14)',
    borderRadius: 999,
    borderWidth: 1,
    height: '82%',
    position: 'absolute',
    transform: [{ rotate: '-18deg' }],
    width: '82%',
  },
  ringInner: {
    borderColor: 'rgba(38, 153, 223, 0.26)',
    borderRadius: 999,
    borderWidth: 1,
    height: '58%',
    position: 'absolute',
    transform: [{ rotate: '18deg' }],
    width: '58%',
  },
  signal: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    zIndex: 2,
  },
  bar: {
    minHeight: 8,
  },
  signalDot: {
    backgroundColor: wavenColors.interactionBlue,
    borderRadius: 999,
    bottom: '17%',
    height: 5,
    opacity: 0.9,
    position: 'absolute',
    right: '17%',
    width: 5,
  },
});
