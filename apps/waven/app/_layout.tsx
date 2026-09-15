import 'react-native-reanimated';

import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WavenWordmark } from '../src/components/brand/WavenWordmark';
import { WavenBottomNav } from '../src/components/shell/WavenBottomNav';
import { WavenMiniPlayer } from '../src/components/player/WavenMiniPlayer';
import { WavenAtmosphericCanvas } from '../src/components/surfaces/WavenAtmosphericCanvas';
import {
  readWavenEntrySession,
  subscribeWavenEntrySession,
} from '../src/features/account/wavenEntrySession';
import { useWavenReducedMotion } from '../src/hooks/useWavenReducedMotion';
import { wavenColors, wavenMotion, wavenSpacing } from '../src/theme/tokens';

const PRIMARY_PATHS = new Set(['/', '/search', '/library']);

type StartupState = 'checking' | 'ready';

function WavenStartupHandoff() {
  return (
    <View accessibilityLabel="Opening WAVEN" style={styles.startupHandoff}>
      <WavenWordmark />
      <View accessible={false} style={styles.startupSignal}>
        <View style={[styles.startupBar, { height: 8 }]} />
        <View style={[styles.startupBar, styles.startupBarActive, { height: 18 }]} />
        <View style={[styles.startupBar, { height: 11 }]} />
      </View>
      <ActivityIndicator
        accessibilityLabel="Loading"
        color={wavenColors.interactionBlue}
        size="small"
        style={styles.startupSpinner}
      />
    </View>
  );
}

function WavenRootNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const reducedMotion = useWavenReducedMotion();
  const [startupState, setStartupState] = useState<StartupState>('checking');
  const [entryRequired, setEntryRequired] = useState(false);
  const [entryHandoffPending, setEntryHandoffPending] = useState(false);
  const entryHandoffOpacity = useRef(new Animated.Value(1)).current;
  const showPrimaryNavigation = PRIMARY_PATHS.has(pathname);

  useEffect(() => {
    let mounted = true;
    let sessionChangeSeen = false;

    const unsubscribe = subscribeWavenEntrySession((session) => {
      if (!mounted) return;

      // Entry completion owns this transition. Update the root gate before
      // Entry replaces its route with Home so stale startup state cannot
      // bounce a completed user back to Entry.
      sessionChangeSeen = true;
      setEntryRequired(!session);
      setEntryHandoffPending(Boolean(session));
      setStartupState('ready');
    });

    readWavenEntrySession()
      .then((session) => {
        if (!mounted || sessionChangeSeen) return;
        setEntryRequired(!session);
        setStartupState('ready');
      })
      .catch(() => {
        if (!mounted || sessionChangeSeen) return;

        // Local session persistence must never make WAVEN unusable.
        // Fail open into the local-first product shell.
        setEntryRequired(false);
        setStartupState('ready');
      });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (startupState !== 'ready' || !entryRequired || pathname !== '/') return;
    router.replace('/entry');
  }, [entryRequired, pathname, router, startupState]);

  useEffect(() => {
    if (!entryHandoffPending || !showPrimaryNavigation) return;

    entryHandoffOpacity.stopAnimation();
    entryHandoffOpacity.setValue(1);

    const reveal = Animated.timing(entryHandoffOpacity, {
      toValue: 0,
      duration: reducedMotion ? wavenMotion.quickMs : wavenMotion.deliberateMs,
      easing: reducedMotion ? Easing.linear : Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    reveal.start(({ finished }) => {
      if (finished) {
        setEntryHandoffPending(false);
        entryHandoffOpacity.setValue(1);
      }
    });

    return () => {
      reveal.stop();
    };
  }, [
    entryHandoffOpacity,
    entryHandoffPending,
    reducedMotion,
    showPrimaryNavigation,
  ]);

  const waitingForEntryRedirect =
    startupState === 'checking'
    || (startupState === 'ready' && entryRequired && pathname === '/');

  if (waitingForEntryRedirect) {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <WavenStartupHandoff />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {showPrimaryNavigation ? <WavenAtmosphericCanvas /> : null}
      <View style={styles.stackFrame}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: reducedMotion ? 'none' : 'fade',
            contentStyle: {
              backgroundColor: showPrimaryNavigation
                ? 'transparent'
                : wavenColors.canvas,
            },
          }}
        />
      </View>
      {showPrimaryNavigation ? <WavenMiniPlayer /> : null}
      {showPrimaryNavigation ? <WavenBottomNav /> : null}
      {entryHandoffPending && showPrimaryNavigation ? (
        <Animated.View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={[
            styles.entryHandoffOverlay,
            {
              opacity: entryHandoffOpacity,
            },
          ]}
        >
          <WavenAtmosphericCanvas variant="entry" />
        </Animated.View>
      ) : null}
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider style={styles.provider}>
      <WavenRootNavigation />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  provider: {
    backgroundColor: wavenColors.canvas,
    flex: 1,
  },
  root: {
    backgroundColor: wavenColors.canvas,
    flex: 1,
  },
  stackFrame: {
    flex: 1,
  },
  entryHandoffOverlay: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    backgroundColor: wavenColors.canvas,
    zIndex: 20,
  },
  startupHandoff: {
    alignItems: 'center',
    backgroundColor: wavenColors.canvas,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: wavenSpacing.lg,
  },
  startupSignal: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    height: 22,
    justifyContent: 'center',
    marginTop: wavenSpacing.md,
  },
  startupBar: {
    backgroundColor: wavenColors.textMuted,
    borderRadius: 2,
    opacity: 0.55,
    width: 3,
  },
  startupBarActive: {
    backgroundColor: wavenColors.interactionBlue,
    opacity: 1,
  },
  startupSpinner: {
    marginTop: wavenSpacing.lg,
  },
});
