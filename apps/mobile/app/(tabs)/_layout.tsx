import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { FloatingSidebarTrigger } from '../../src/components/FloatingSidebarTrigger';
import { SidebarDrawer } from '../../src/components/SidebarDrawer';
import { useResponsiveLayout } from '../../src/services/responsive';
import { useOrionTheme } from '../../src/context/ThemeContext';

export default function TabLayout() {
  const { isTablet } = useResponsiveLayout();
  const { theme } = useOrionTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Floating Hamburger Sidebar Trigger */}
      <FloatingSidebarTrigger />
      {isTablet && <SidebarDrawer visible persistent onClose={() => {}} />}

      <View style={styles.routeContainer}>
       <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: {
            display: 'none',
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
          }}
        />
        <Tabs.Screen
          name="discover"
          options={{
            title: 'Discover',
          }}
        />
        <Tabs.Screen
          name="downloads"
          options={{
            title: 'Downloads',
          }}
        />
        <Tabs.Screen
          name="connect"
          options={{
            title: 'Connect',
          }}
        />
        <Tabs.Screen
          name="library"
          options={{
            title: 'Library',
          }}
        />
        <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      </Tabs>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  routeContainer: { flex: 1, minWidth: 0 },
});
