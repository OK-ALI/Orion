import 'react-native-reanimated';

import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WavenWordmark } from '../src/components/brand/WavenWordmark';
import { WavenBottomNav } from '../src/components/shell/WavenBottomNav';
import { WavenMiniPlayer } from '../src/components/player/WavenMiniPlayer';
import { WavenAtmosphericCanvas } from '../src/components/surfaces/WavenAtmosphericCanvas';
import {
  readWavenEntrySession,
  subscribeWavenEntrySession,
} from '../src/features/account/wavenEntrySession';
import { wavenColors, wavenSpacing } from '../src/theme/tokens';

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
  const [startupState, setStartupState] = useState<StartupState>('checking');
  const [entryRequired, setEntryRequired] = useState(false);

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

  const showPrimaryNavigation = PRIMARY_PATHS.has(pathname);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {showPrimaryNavigation ? <WavenAtmosphericCanvas /> : null}
      <View style={styles.stackFrame}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'fade',
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
