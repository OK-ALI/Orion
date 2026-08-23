import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Platform } from 'react-native';
import { initTmdbClient, initAnilistClient } from '@orion/shared/api';
import { getMobileStorageHealth, mmkvStorageAdapter } from '../src/services/storageAdapter';
import { useFonts } from 'expo-font';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { SpaceGrotesk_400Regular, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { Outfit_400Regular, Outfit_600SemiBold, Outfit_700Bold, Outfit_900Black } from '@expo-google-fonts/outfit';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useRef, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LibraryProvider } from '../src/context/LibraryContext';
import { ThemeProvider, useOrionTheme } from '../src/context/ThemeContext';
import { PerformanceProvider } from '../src/context/PerformanceContext';
import { NetworkProvider } from '../src/context/NetworkContext';
import { AccountProvider } from '../src/context/AccountContext';
import { MyListSteadyStateSyncProvider } from '../src/features/account/MyListSteadyStateSync';
import { WatchedSteadyStateSyncProvider } from '../src/features/account/WatchedSteadyStateSync';
import { ViewingActivitySteadyStateSyncProvider } from '../src/features/account/ViewingActivitySteadyStateSync';
import { OrionSyncPolicyProvider } from '../src/features/account/SyncPolicyContext';
import { LibraryProfileProvider, useOrionLibraryProfile } from '../src/features/account/LibraryProfileContext';
import { OfflineBanner } from '../src/components/OfflineBanner';
import { StorageUnavailableScreen } from '../src/components/StorageUnavailableScreen';
import { MobileDiagnosticsBridge } from '../src/components/MobileDiagnosticsBridge';
import { StartupIntro } from '../src/components/StartupIntro';
import { GlobalSearchShortcut } from '../src/components/GlobalSearchShortcut';
import { MobileNotificationCoordinator } from '../src/features/notifications/MobileNotificationCoordinator';
import { MobileNotificationResponseRouter } from '../src/features/notifications/MobileNotificationResponseRouter';
import { MobileUpdateAnnouncementBanner } from '../src/features/updates/MobileUpdateAnnouncementBanner';


// Keep the splash screen visible while we fetch resources
void SplashScreen.preventAutoHideAsync().catch(() => {});

// Initialize shared API clients with React Native MMKV for persistence
initAnilistClient(mmkvStorageAdapter);
const DEFAULT_TMDB_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI4ODllZDlmYjQxMzdlZmQ1ZTM3ODQzMTQ1MDY0OGRlNiIsIm5iZiI6MTc4MjE0MjUyNi4zNzQsInN1YiI6IjZhMzk1NjNlOTIzNmQzOTU1NWI5Mjk0MSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.XFF0uoMWj6aGsTRLfOhJHJzJPa9LCZOoCCC1DCwapEU';

initTmdbClient({ 
  apiToken: process.env.EXPO_PUBLIC_TMDB_READ_TOKEN || DEFAULT_TMDB_TOKEN, 
  storage: mmkvStorageAdapter 
});

import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    Outfit_400Regular,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_900Black,
    // Alias to match our design system names exactly for React Native StyleSheet
    'Inter': Inter_400Regular,
    'Space Grotesk': SpaceGrotesk_700Bold, // Heading defaults to bold
    'Outfit': Outfit_700Bold, // Display defaults to bold
  });

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <PerformanceProvider>
          <NetworkProvider>
            <AccountProvider>
              <LibraryProfileProvider>
                <OrionSyncPolicyProvider>
                  <ThemedApplication />
                </OrionSyncPolicyProvider>
              </LibraryProfileProvider>
            </AccountProvider>
          </NetworkProvider>
        </PerformanceProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function ThemedApplication() {
  const { theme } = useOrionTheme();
  const storageHealth = getMobileStorageHealth();
  const libraryProfile = useOrionLibraryProfile();
  const [startupActive, setStartupActive] = useState(false);
  const [showStartup, setShowStartup] = useState(true);
  const didRevealRef = useRef(false);

  const revealApplication = useCallback(() => {
    if (didRevealRef.current) return;
    didRevealRef.current = true;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.body.style.backgroundColor = theme.background;
    }
    void SplashScreen.hideAsync()
      .catch(() => {})
      .finally(() => requestAnimationFrame(() => setStartupActive(true)));
  }, [theme.background]);

  const application = storageHealth.state === 'unavailable'
    ? <StorageUnavailableScreen errorCode={storageHealth.errorCode} />
    : libraryProfile.phase === 'error'
      ? <StorageUnavailableScreen errorCode={libraryProfile.errorCode || 'LIBRARY_PROFILE_INIT_FAILED'} />
      : !libraryProfile.ready || !libraryProfile.storage || !libraryProfile.scopeId
        ? null
        : (
      <LibraryProvider key={libraryProfile.scopeId} storage={libraryProfile.storage}>
        <MyListSteadyStateSyncProvider>
          <WatchedSteadyStateSyncProvider>
            <ViewingActivitySteadyStateSyncProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
              <View style={[styles.container, { backgroundColor: theme.background }]}>
                <MobileNotificationCoordinator />
                <MobileNotificationResponseRouter />
                <MobileDiagnosticsBridge />
                <StatusBar style={theme.dark ? 'light' : 'dark'} />
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: 'transparent' },
                  }}
                >
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                </Stack>
                <GlobalSearchShortcut />
                <MobileUpdateAnnouncementBanner />
                <OfflineBanner />
              </View>
              </GestureHandlerRootView>
            </ViewingActivitySteadyStateSyncProvider>
          </WatchedSteadyStateSyncProvider>
        </MyListSteadyStateSyncProvider>
      </LibraryProvider>
    );

  return (
    <View
      onLayout={revealApplication}
      style={[styles.application, { backgroundColor: theme.background }]}
    >
      {application}
      {showStartup && (
        <StartupIntro
          active={startupActive}
          onComplete={() => setShowStartup(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  application: {
    flex: 1,
  },
  container: {
    flex: 1,
    maxWidth: Platform.OS === 'web' ? 480 : '100%',
    width: '100%',
    alignSelf: 'center',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 0 30px rgba(0,0,0,0.8)',
      overflow: 'hidden',
    } : {}),
  },
});
