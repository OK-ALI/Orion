import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useOrionTheme } from '../context/ThemeContext';

const ORION_LETTERS = [...'ORION'];

interface StartupIntroProps {
  active: boolean;
  onComplete: () => void;
}

export function StartupIntro({ active, onComplete }: StartupIntroProps) {
  const { theme, preferences } = useOrionTheme();
  const { width, height } = useWindowDimensions();
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const markOpacity = useRef(new Animated.Value(0)).current;
  const markScale = useRef(new Animated.Value(0.86)).current;
  const auraOpacity = useRef(new Animated.Value(0)).current;
  const auraScale = useRef(new Animated.Value(0.76)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const letters = useRef(ORION_LETTERS.map(() => new Animated.Value(0))).current;
  const completionRef = useRef(onComplete);

  useEffect(() => {
    completionRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!active) return undefined;

    const finish = () => completionRef.current();
    let animation: Animated.CompositeAnimation;

    if (preferences.reducedMotion) {
      markOpacity.setValue(1);
      markScale.setValue(1);
      auraOpacity.setValue(0.2);
      auraScale.setValue(1);
      taglineOpacity.setValue(1);
      letters.forEach((value) => value.setValue(1));
      animation = Animated.sequence([
        Animated.delay(180),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 130,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]);
    } else {
      animation = Animated.sequence([
        Animated.parallel([
          Animated.timing(markOpacity, {
            toValue: 1,
            duration: 320,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.spring(markScale, {
            toValue: 1,
            speed: 16,
            bounciness: 4,
            useNativeDriver: true,
          }),
          Animated.timing(auraOpacity, {
            toValue: 0.34,
            duration: 520,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(auraScale, {
            toValue: 1,
            duration: 620,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.stagger(
          68,
          letters.map((value) => Animated.timing(value, {
            toValue: 1,
            duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          })),
        ),
        Animated.timing(taglineOpacity, {
          toValue: 1,
          duration: 240,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(250),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 260,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]);
    }

    animation.start(({ finished }) => {
      if (finished) finish();
    });
    return () => animation.stop();
  }, [
    active,
    auraOpacity,
    auraScale,
    letters,
    markOpacity,
    markScale,
    overlayOpacity,
    preferences.reducedMotion,
    taglineOpacity,
  ]);

  const geometry = useMemo(() => {
    const shortest = Math.min(width, height);
    return {
      aura: Math.max(210, Math.min(410, shortest * 0.68)),
      mark: Math.max(82, Math.min(126, shortest * 0.2)),
      title: Math.max(36, Math.min(56, width * 0.12)),
    };
  }, [height, width]);

  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel="Orion is starting"
      accessibilityViewIsModal
      style={[
        StyleSheet.absoluteFill,
        styles.overlay,
        { backgroundColor: theme.background, opacity: overlayOpacity },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.aura,
          {
            width: geometry.aura,
            height: geometry.aura,
            borderColor: theme.accentSoft,
            shadowColor: theme.accent,
            opacity: auraOpacity,
            transform: [{ scale: auraScale }],
          },
        ]}
      />
      <View style={styles.content} pointerEvents="none">
        <Animated.View
          style={{
            opacity: markOpacity,
            transform: [{ scale: markScale }],
          }}
        >
          <Image
            source={require('../../assets/brand-mark.png')}
            resizeMode="contain"
            style={{ width: geometry.mark, height: geometry.mark }}
          />
        </Animated.View>
        <View style={styles.word} accessibilityElementsHidden>
          {ORION_LETTERS.map((letter, index) => (
            <Animated.Text
              key={`${letter}-${index}`}
              allowFontScaling={false}
              style={[
                styles.letter,
                {
                  color: theme.text,
                  fontSize: geometry.title,
                  opacity: letters[index],
                  transform: [{
                    translateY: letters[index].interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  }],
                },
              ]}
            >
              {letter}
            </Animated.Text>
          ))}
        </View>
        <Animated.View style={{ opacity: taglineOpacity }}>
          <Text
            adjustsFontSizeToFit
            maxFontSizeMultiplier={1.6}
            numberOfLines={2}
            style={[styles.tagline, { color: theme.textSecondary }]}
          >
            A universe made to be felt.
          </Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    zIndex: 10000,
    elevation: 10000,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  aura: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
    shadowOpacity: 0.34,
    shadowRadius: 42,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  content: {
    width: '88%',
    maxWidth: 520,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  word: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  letter: {
    fontFamily: 'SpaceGrotesk_700Bold',
    lineHeight: 66,
    letterSpacing: 2,
  },
  tagline: {
    maxWidth: 390,
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: 1.1,
    textAlign: 'center',
  },
});
