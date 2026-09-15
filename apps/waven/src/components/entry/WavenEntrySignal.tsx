import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useWavenReducedMotion } from '../../hooks/useWavenReducedMotion';
import { wavenColors, wavenMotion } from '../../theme/tokens';

interface WavenEntrySignalProps {
  width?: number;
}

const WAVEFORM = [
  0.08, 0.11, 0.16, 0.21, 0.18, 0.29, 0.38, 0.33, 0.49, 0.61,
  0.45, 0.57, 0.74, 0.52, 0.68, 0.86, 0.63, 0.48, 0.71, 0.91,
  0.76, 0.58, 0.83, 0.69, 0.95, 0.72, 0.55, 0.64, 0.82, 0.59,
  0.47, 0.78, 0.66, 0.88, 0.62, 0.51, 0.73, 1.0, 0.79, 0.56,
  0.68, 0.91, 0.74, 0.61, 0.84, 0.57, 0.49, 0.76, 0.93, 0.71,
  0.54, 0.67, 0.81, 0.60, 0.46, 0.72, 0.58, 0.43, 0.64, 0.51,
  0.39, 0.55, 0.42, 0.34, 0.46, 0.31, 0.25, 0.33, 0.22, 0.17,
  0.13, 0.10, 0.07,
] as const;

const SILVER_ACCENTS = new Set([15, 24, 37, 48, 56]);

export function WavenEntrySignal({ width }: WavenEntrySignalProps) {
  const reducedMotion = useWavenReducedMotion();
  const { width: windowWidth } = useWindowDimensions();

  const phaseA = useRef(new Animated.Value(reducedMotion ? 0.52 : 0)).current;
  const phaseB = useRef(new Animated.Value(reducedMotion ? 0.44 : 1)).current;
  const phaseC = useRef(new Animated.Value(reducedMotion ? 0.58 : 0.28)).current;
  const reveal = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  const resolvedWidth = useMemo(
    () => width ?? Math.min(460, Math.max(320, windowWidth - 4)),
    [width, windowWidth],
  );
  const barGap = useMemo(
    () => Math.max(1.9, resolvedWidth / 150),
    [resolvedWidth],
  );
  const barWidth = useMemo(
    () => Math.max(1.8, resolvedWidth / 205),
    [resolvedWidth],
  );

  useEffect(() => {
    if (reducedMotion) {
      phaseA.setValue(0.52);
      phaseB.setValue(0.44);
      phaseC.setValue(0.58);
      reveal.setValue(1);
      return undefined;
    }

    Animated.timing(reveal, {
      toValue: 1,
      duration: wavenMotion.deliberateMs,
      useNativeDriver: true,
    }).start();

    const motionA = Animated.loop(
      Animated.sequence([
        Animated.timing(phaseA, {
          toValue: 1,
          duration: wavenMotion.deliberateMs * 5,
          useNativeDriver: true,
        }),
        Animated.timing(phaseA, {
          toValue: 0,
          duration: wavenMotion.deliberateMs * 5,
          useNativeDriver: true,
        }),
      ]),
    );

    const motionB = Animated.loop(
      Animated.sequence([
        Animated.timing(phaseB, {
          toValue: 0,
          duration: wavenMotion.deliberateMs * 6,
          useNativeDriver: true,
        }),
        Animated.timing(phaseB, {
          toValue: 1,
          duration: wavenMotion.deliberateMs * 6,
          useNativeDriver: true,
        }),
      ]),
    );

    const motionC = Animated.loop(
      Animated.sequence([
        Animated.timing(phaseC, {
          toValue: 0.92,
          duration: wavenMotion.deliberateMs * 7,
          useNativeDriver: true,
        }),
        Animated.timing(phaseC, {
          toValue: 0.18,
          duration: wavenMotion.deliberateMs * 7,
          useNativeDriver: true,
        }),
      ]),
    );

    motionA.start();
    motionB.start();
    motionC.start();

    return () => {
      motionA.stop();
      motionB.stop();
      motionC.stop();
    };
  }, [phaseA, phaseB, phaseC, reducedMotion, reveal]);

  const waveformScale = reveal.interpolate({
    inputRange: [0, 1],
    outputRange: [0.97, 1],
  });

  const center = (WAVEFORM.length - 1) / 2;

  return (
    <Animated.View
      accessibilityLabel="WAVEN music waveform"
      accessibilityRole="image"
      style={[
        styles.frame,
        {
          opacity: reveal,
          transform: [{ scale: waveformScale }],
          width: resolvedWidth,
        },
      ]}
    >
      <View
        accessible={false}
        style={[
          styles.waveform,
          {
            gap: barGap,
          },
        ]}
      >
        {WAVEFORM.map((amplitude, index) => {
          const distance = Math.abs(index - center) / center;
          const edgeVignette = Math.pow(
            Math.max(0, 1 - Math.pow(distance, 3.1)),
            2.15,
          );

          const region = index % 6;
          const motion =
            region === 0 || region === 3
              ? phaseC
              : region === 1 || region === 4
                ? phaseA
                : phaseB;

          const scaleY = motion.interpolate({
            inputRange: [0, 1],
            outputRange:
              index % 5 === 0
                ? [0.84, 1.15]
                : index % 5 === 1
                  ? [1.1, 0.9]
                  : index % 5 === 2
                    ? [0.92, 1.08]
                    : index % 5 === 3
                      ? [1.05, 0.95]
                      : [0.96, 1.04],
          });

          const color = SILVER_ACCENTS.has(index)
            ? wavenColors.textPrimary
            : distance < 0.52
              ? wavenColors.interactionBlue
              : distance < 0.82
                ? wavenColors.skyBlue
                : wavenColors.textMuted;

          const height = Math.max(8, 138 * amplitude);
          const opacity = edgeVignette * (0.5 + amplitude * 0.47);

          return (
            <View
              key={`${index}-${amplitude}`}
              style={[
                styles.barSlot,
                {
                  width: barWidth,
                },
              ]}
            >
              <Animated.View
                style={[
                  styles.barGlow,
                  {
                    backgroundColor: color,
                    height: height * 1.16,
                    opacity: opacity * 0.1,
                    transform: [{ scaleY }],
                    width: barWidth * 3.1,
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.bar,
                  {
                    backgroundColor: color,
                    height,
                    opacity,
                    transform: [{ scaleY }],
                    width: barWidth,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    height: 198,
    justifyContent: 'center',
    position: 'relative',
  },
  waveform: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 176,
    justifyContent: 'center',
  },
  barSlot: {
    alignItems: 'center',
    height: 176,
    justifyContent: 'center',
    position: 'relative',
  },
  barGlow: {
    borderRadius: 999,
    position: 'absolute',
  },
  bar: {
    borderRadius: 999,
  },
});
