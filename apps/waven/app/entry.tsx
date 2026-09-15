import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WavenWordmark } from '../src/components/brand/WavenWordmark';
import { WavenEntrySignal } from '../src/components/entry/WavenEntrySignal';
import { WavenPressable } from '../src/components/interaction/WavenPressable';
import { WavenAtmosphericCanvas } from '../src/components/surfaces/WavenAtmosphericCanvas';
import { useWavenReducedMotion } from '../src/hooks/useWavenReducedMotion';
import {
  completeWavenEntryLocally,
  completeWavenEntryWithGoogle,
} from '../src/features/account/wavenEntrySession';
import {
  isNativeOrionGoogleIdentityAvailable,
  signInToOrionCloud,
} from '../src/infrastructure/orionCloud/nativeGoogleIdentity';
import {
  wavenColors,
  wavenMotion,
  wavenRadii,
  wavenSpacing,
  wavenTypography,
} from '../src/theme/tokens';

const GOOGLE_WEB_CLIENT_ID = (process.env.EXPO_PUBLIC_ORION_GOOGLE_WEB_CLIENT_ID || '').trim();

type EntryPhase = 'idle' | 'signing-in' | 'continuing-local' | 'error';

function entryErrorMessage(error: unknown): string {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';

  if (code === 'GOOGLE_CLIENT_ID_MISSING') {
    return 'Google Sign-In isn’t available right now. You can continue without an account.';
  }
  if (code === 'GOOGLE_IDENTITY_UNAVAILABLE') {
    return 'Google Sign-In isn’t available right now. You can continue without an account.';
  }

  return 'Google Sign-In didn’t finish. Please try again, or continue without an account.';
}



export default function WavenEntryScreen() {
  const router = useRouter();
  const reducedMotion = useWavenReducedMotion();
  const [phase, setPhase] = useState<EntryPhase>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const identityProgress = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const contentProgress = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const actionsProgress = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const handoffProgress = useRef(new Animated.Value(0)).current;

  const busy = phase === 'signing-in' || phase === 'continuing-local';

  useEffect(() => {
    if (reducedMotion) {
      identityProgress.setValue(1);
      contentProgress.setValue(1);
      actionsProgress.setValue(1);
      return;
    }

    Animated.stagger(90, [
      Animated.timing(identityProgress, {
        toValue: 1,
        duration: wavenMotion.standardMs,
        useNativeDriver: true,
      }),
      Animated.timing(contentProgress, {
        toValue: 1,
        duration: wavenMotion.deliberateMs,
        useNativeDriver: true,
      }),
      Animated.timing(actionsProgress, {
        toValue: 1,
        duration: wavenMotion.standardMs,
        useNativeDriver: true,
      }),
    ]).start();
  }, [actionsProgress, contentProgress, identityProgress, reducedMotion]);

  const contentTranslate = contentProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 0],
  });
  const actionsTranslate = actionsProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 0],
  });
  const handoffOpacity = handoffProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const handoffTranslate = handoffProgress.interpolate({
    inputRange: [0, 1],
    outputRange: reducedMotion ? [0, 0] : [0, -10],
  });

  const finishEntryHandoff = async () => {
    await new Promise<void>((resolve) => {
      Animated.timing(handoffProgress, {
        toValue: 1,
        duration: reducedMotion ? wavenMotion.quickMs : wavenMotion.deliberateMs,
        easing: reducedMotion ? Easing.linear : Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => resolve());
    });

    router.replace('/');
  };

  const continueWithGoogle = async () => {
    if (busy) return;

    setMessage(null);
    setPhase('signing-in');

    try {
      if (!GOOGLE_WEB_CLIENT_ID) {
        throw Object.assign(new Error('Missing Google client ID.'), {
          code: 'GOOGLE_CLIENT_ID_MISSING',
        });
      }
      if (!isNativeOrionGoogleIdentityAvailable()) {
        throw Object.assign(new Error('Google identity unavailable.'), {
          code: 'GOOGLE_IDENTITY_UNAVAILABLE',
        });
      }

      const profile = await signInToOrionCloud(GOOGLE_WEB_CLIENT_ID);
      await completeWavenEntryWithGoogle(profile);
      await finishEntryHandoff();
    } catch (error) {
      setPhase('error');
      setMessage(entryErrorMessage(error));
    }
  };

  const continueLocally = async () => {
    if (busy) return;

    setMessage(null);
    setPhase('continuing-local');

    try {
      await completeWavenEntryLocally();
      await finishEntryHandoff();
    } catch {
      setPhase('error');
      setMessage('WAVEN couldn’t continue. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <WavenAtmosphericCanvas variant="entry" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <Animated.View
          style={[
            styles.handoffFrame,
            {
              opacity: handoffOpacity,
              transform: [{ translateY: handoffTranslate }],
            },
          ]}
        >
          <Animated.View
            style={[
              styles.experience,
              {
                opacity: contentProgress,
                transform: [{ translateY: contentTranslate }],
              },
            ]}
          >
            <Animated.View style={[styles.identity, { opacity: identityProgress }]}>
              <WavenWordmark style={styles.wordmark} />
              <Text style={styles.tagline}>
                Where <Text style={styles.taglineAccent}>Music</Text> Lives
              </Text>
            </Animated.View>

            <WavenEntrySignal />

            <View style={styles.welcome}>
              <Text accessibilityRole="header" style={styles.title}>
                <Text style={styles.titleSilver}>Your </Text>
                <Text style={styles.titleBlue}>Sound</Text>
                <Text style={styles.titleSilver}>, Your </Text>
                <Text style={styles.titleBlue}>Way.</Text>
              </Text>
            </View>
          </Animated.View>

          <Animated.View
            style={[
              styles.actions,
              {
                opacity: actionsProgress,
                transform: [{ translateY: actionsTranslate }],
              },
            ]}
          >
            <WavenPressable
              accessibilityLabel="Continue with Google"
              accessibilityRole="button"
              containerStyle={styles.actionContainer}
              disabled={busy}
              onPress={continueWithGoogle}
            >
              <View style={[styles.primaryButton, busy ? styles.disabled : null]}>
                {phase === 'signing-in' ? (
                  <ActivityIndicator color={wavenColors.canvas} size="small" />
                ) : (
                  <View accessible={false} style={styles.googleBadge}>
                    <Text style={styles.googleBadgeText}>G</Text>
                  </View>
                )}
                <Text style={styles.primaryButtonText}>
                  {phase === 'signing-in' ? 'Connecting…' : 'Continue with Google'}
                </Text>
              </View>
            </WavenPressable>

            <WavenPressable
              accessibilityLabel="Continue without an account"
              accessibilityRole="button"
              containerStyle={styles.actionContainer}
              disabled={busy}
              onPress={continueLocally}
            >
              <View style={[styles.localButton, busy ? styles.disabled : null]}>
                {phase === 'continuing-local' ? (
                  <ActivityIndicator color={wavenColors.interactionBlue} size="small" />
                ) : null}
                <Text style={styles.localButtonText}>
                  {phase === 'continuing-local' ? 'Opening WAVEN…' : 'Continue without an account'}
                </Text>
              </View>
            </WavenPressable>

            {message ? (
              <Text accessibilityLiveRegion="polite" style={styles.message}>
                {message}
              </Text>
            ) : null}

            <Text style={styles.note}>Signing in is optional.</Text>
          </Animated.View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: wavenColors.canvas,
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingBottom: wavenSpacing.xl,
    paddingHorizontal: wavenSpacing.lg,
    paddingTop: wavenSpacing.lg,
  },
  handoffFrame: {
    flex: 1,
  },
  identity: {
    alignItems: 'center',
    marginBottom: 18,
  },
  wordmark: {
    fontSize: 30,
  },
  tagline: {
    color: wavenColors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginTop: 8,
  },
  taglineAccent: {
    color: wavenColors.interactionBlue,
    fontWeight: '800',
  },
  experience: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingTop: 18,
  },
  welcome: {
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: wavenSpacing.sm,
  },
  title: {
    fontSize: wavenTypography.title.fontSize,
    fontWeight: wavenTypography.title.fontWeight,
    lineHeight: wavenTypography.title.lineHeight,
    textAlign: 'center',
  },
  titleSilver: {
    color: wavenColors.textSecondary,
  },
  titleBlue: {
    color: wavenColors.interactionBlue,
  },
  actions: {
    alignItems: 'stretch',
  },
  actionContainer: {
    marginTop: 10,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: wavenColors.textPrimary,
    borderRadius: wavenRadii.pill,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 18,
  },
  googleBadge: {
    alignItems: 'center',
    backgroundColor: wavenColors.canvas,
    borderRadius: wavenRadii.pill,
    height: 23,
    justifyContent: 'center',
    width: 23,
  },
  googleBadgeText: {
    color: wavenColors.textPrimary,
    fontSize: 12,
    fontWeight: '900',
  },
  primaryButtonText: {
    color: wavenColors.canvas,
    fontSize: 14,
    fontWeight: '800',
  },
  localButton: {
    alignItems: 'center',
    backgroundColor: wavenColors.glassSoft,
    borderColor: wavenColors.borderSubtle,
    borderRadius: wavenRadii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 18,
  },
  localButtonText: {
    color: wavenColors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.56,
  },
  message: {
    color: wavenColors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: wavenSpacing.md,
    textAlign: 'center',
  },
  note: {
    color: wavenColors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 12,
    textAlign: 'center',
  },
});
