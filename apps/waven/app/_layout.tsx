import 'react-native-reanimated';

import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WavenBottomNav } from '../src/components/shell/WavenBottomNav';
import { wavenColors } from '../src/theme/tokens';

const PRIMARY_PATHS = new Set(['/', '/search', '/library']);

function WavenRootNavigation() {
  const pathname = usePathname();
  const showPrimaryNavigation = PRIMARY_PATHS.has(pathname);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.stackFrame}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'fade',
            contentStyle: { backgroundColor: wavenColors.canvas },
          }}
        />
      </View>
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
    backgroundColor: wavenColors.canvas,
    flex: 1,
  },
});
