import 'react-native-reanimated';

import { Stack, usePathname, useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import { Sora_700Bold, Sora_800ExtraBold } from '@expo-google-fonts/sora';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { startWavenConnectivity } from '../src/infrastructure/connectivity/connectivityRuntime';
import { ActivityIndicator, Animated, Easing, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WavenWordmark } from '../src/components/brand/WavenWordmark';
import { WavenBottomNav } from '../src/components/shell/WavenBottomNav';
import { WavenMiniPlayer } from '../src/components/player/WavenMiniPlayer';
import { WavenAtmosphericCanvas } from '../src/components/surfaces/WavenAtmosphericCanvas';
import { WavenEntityRevealOverlay } from '../src/components/navigation/WavenEntityRevealOverlay';
import {
  readWavenEntrySession,
  subscribeWavenEntrySession,
} from '../src/features/account/wavenEntrySession';
import { useWavenReducedMotion } from '../src/hooks/useWavenReducedMotion';
import { WavenAppearanceProvider } from '../src/theme/appearanceProvider';
import { bindLibrarySession, startLibraryPlaybackObservation } from '../src/features/library/libraryRuntime';
import { wavenConnectivity } from '../src/infrastructure/connectivity/connectivityService';
import { clearControlledNoOpWriteState } from '../src/infrastructure/orionCloud/orionCloudControlledNoOpWriteGate';
import { trackPlayback } from '../src/features/playback/trackPlaybackRuntime';
import { wavenColors, wavenMotion, wavenSpacing } from '../src/theme/tokens';


const useChromeBacking:
  typeof import('../src/theme/previewChromeMaterials').usePreviewChromeBacking =
  typeof __DEV__ !== 'undefined' &&
  __DEV__ &&
  process.env.EXPO_PUBLIC_WAVEN_HOME_ANIME_PREVIEW === '1'
    ? (
        require('../src/theme/previewChromeMaterials') as
          typeof import('../src/theme/previewChromeMaterials')
      ).usePreviewChromeBacking
    : () => null;

const PRIMARY_PATHS = new Set(['/', '/search', '/library']);
const PRIMARY_ROUTE_NAMES = new Set(['index', 'search', 'library']);
const ENTITY_DETAIL_ROUTE_NAMES = new Set([
  'artist/[provider]/[id]',
  'album/[provider]/[id]',
]);

export const unstable_settings = {
  initialRouteName: 'index',
};

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
  if (
    typeof __DEV__ !== 'undefined' &&
    __DEV__ &&
    process.env.EXPO_PUBLIC_WAVEN_HOME_ANIME_PREVIEW === '1'
  ) {
    const { WavenPreviewCelestialProvider } =
      require('../src/theme/previewCelestialController') as
        typeof import('../src/theme/previewCelestialController');

    return (
      <WavenPreviewCelestialProvider>
        <WavenRootNavigationContent />
      </WavenPreviewCelestialProvider>
    );
  }

  return <WavenRootNavigationContent />;
}

function WavenRootNavigationContent() {
  const pathname = usePathname();
  const chromeBacking = useChromeBacking();
  const homeBacking = pathname === '/' ? chromeBacking : null;
  const router = useRouter();
  const reducedMotion = useWavenReducedMotion();
  const [startupState, setStartupState] = useState<StartupState>('checking');
  const [entryRequired, setEntryRequired] = useState(false);
  const [entryHandoffPending, setEntryHandoffPending] = useState(false);
  const entryHandoffOpacity = useRef(new Animated.Value(1)).current;
  const showPrimaryNavigation = PRIMARY_PATHS.has(pathname);
  const showAtmosphericCanvas =
    showPrimaryNavigation ||
    pathname.startsWith('/artist/') ||
    pathname.startsWith('/album/');

  useEffect(() => {
    let mounted = true;
    let sessionChangeSeen = false;
    let libraryObservation: ReturnType<typeof startLibraryPlaybackObservation> | null = null;
    const bindLibrary = (session: Parameters<typeof bindLibrarySession>[0]) => {
      libraryObservation?.accountChanged();
      trackPlayback.cancel();
      bindLibrarySession(session);
      libraryObservation ??= startLibraryPlaybackObservation();
    };

    const unsubscribe = subscribeWavenEntrySession((session) => {
      if (!mounted) return;

      // Entry completion owns this transition. Update the root gate before
      // Entry replaces its route with Home so stale startup state cannot
      // bounce a completed user back to Entry.
      sessionChangeSeen = true;
      wavenConnectivity.cancelAccountWork();
      clearControlledNoOpWriteState();
      bindLibrary(session);
      setEntryRequired(!session);
      setEntryHandoffPending(Boolean(session));
      setStartupState('ready');
    });

    readWavenEntrySession()
      .then((session) => {
        if (!mounted || sessionChangeSeen) return;
        bindLibrary(session);
        setEntryRequired(!session);
        setStartupState('ready');
      })
      .catch(() => {
        if (!mounted || sessionChangeSeen) return;

        // Local session persistence must never make WAVEN unusable.
        // Fail open into the local-first product shell.
        setEntryRequired(false);
        bindLibrary(null);
        setStartupState('ready');
      });

    return () => {
      mounted = false;
      unsubscribe();
      libraryObservation?.stop();
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
    <View style={[
      styles.root,
      homeBacking ? { backgroundColor: homeBacking.base } : null,
    ]}>
      <StatusBar style="light" />
      {homeBacking ? null : showAtmosphericCanvas ? <WavenAtmosphericCanvas cacheStatic /> : null}
      <View style={styles.stackFrame}>
        <Stack
          screenOptions={({ route }) => ({
            headerShown: false,
            animation:
              reducedMotion || ENTITY_DETAIL_ROUTE_NAMES.has(route.name) || PRIMARY_ROUTE_NAMES.has(route.name)
                ? 'none'
                : 'fade',
            contentStyle: {
              backgroundColor: showAtmosphericCanvas
                ? 'transparent'
                : wavenColors.canvas,
            },
          })}
        />
      </View>
      {showPrimaryNavigation ? <WavenMiniPlayer /> : null}
      {showPrimaryNavigation ? <WavenBottomNav /> : null}
      <WavenEntityRevealOverlay />
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
  useEffect(() => startWavenConnectivity(), []);
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    BebasNeue_400Regular,
    Sora_700Bold,
    Sora_800ExtraBold,
  });

  if (!fontsLoaded && !fontError) {
    return (
      <SafeAreaProvider style={styles.provider}>
        <View accessibilityLabel="Preparing WAVEN typography" style={styles.fontGate}>
          <StatusBar style="light" />
          <ActivityIndicator color={wavenColors.interactionBlue} size="small" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider style={styles.provider}>
      <WavenAppearanceProvider>
        <WavenRootNavigation />
      </WavenAppearanceProvider>
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
  fontGate: {
    alignItems: 'center',
    backgroundColor: wavenColors.canvas,
    flex: 1,
    justifyContent: 'center',
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
