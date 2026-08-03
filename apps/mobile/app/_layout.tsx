import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { backgrounds } from '@orion/shared/tokens';
import { initTmdbClient, initAnilistClient } from '@orion/shared/api';
import { getMobileStorageHealth, mmkvStorageAdapter } from '../src/services/storageAdapter';
import { useFonts } from 'expo-font';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { SpaceGrotesk_400Regular, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { Outfit_400Regular, Outfit_600SemiBold, Outfit_700Bold, Outfit_900Black } from '@expo-google-fonts/outfit';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LibraryProvider } from '../src/context/LibraryContext';
import { ThemeProvider, useOrionTheme } from '../src/context/ThemeContext';
import { NetworkProvider } from '../src/context/NetworkContext';
import { OfflineBanner } from '../src/components/OfflineBanner';
import { StorageUnavailableScreen } from '../src/components/StorageUnavailableScreen';
import { MobileDiagnosticsBridge } from '../src/components/MobileDiagnosticsBridge';


// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// Ensure web body is dark
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.body.style.backgroundColor = '#05050A';
}

// Initialize shared API clients with React Native MMKV for persistence
initAnilistClient(mmkvStorageAdapter);
const DEFAULT_TMDB_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI4ODllZDlmYjQxMzdlZmQ1ZTM3ODQzMTQ1MDY0OGRlNiIsIm5iZiI6MTc4MjE0MjUyNi4zNzQsInN1YiI6IjZhMzk1NjNlOTIzNmQzOTU1NWI5Mjk0MSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.XFF0uoMWj6aGsTRLfOhJHJzJPa9LCZOoCCC1DCwapEU';

initTmdbClient({ 
  apiToken: process.env.EXPO_PUBLIC_TMDB_READ_TOKEN || DEFAULT_TMDB_TOKEN, 
  storage: mmkvStorageAdapter 
});

import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
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

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <NetworkProvider>
          <ThemedApplication />
        </NetworkProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function ThemedApplication() {
  const { theme } = useOrionTheme();
  const storageHealth = getMobileStorageHealth();

  if (storageHealth.state === 'unavailable') {
    return <StorageUnavailableScreen errorCode={storageHealth.errorCode} />;
  }

  return (
      <LibraryProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View style={[styles.container, { backgroundColor: theme.background }]}>
        <MobileDiagnosticsBridge />
        {/* Background is now handled at the screen level for better compatibility */}
        
        <StatusBar style={theme.dark ? "light" : "dark"} />
        {/* Transparent stack that respects the background */}
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: 'transparent' },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
        <OfflineBanner />
      </View>
        </GestureHandlerRootView>
      </LibraryProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: backgrounds.base,
    maxWidth: Platform.OS === 'web' ? 480 : '100%',
    width: '100%',
    alignSelf: 'center',
    // Add shadow and border for web to look like a phone preview
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 0 30px rgba(0,0,0,0.8)',
      overflow: 'hidden',
    } : {}),
  },
});
