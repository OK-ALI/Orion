import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OrionCloudReadOnlyGateCard } from '../src/features/orion-cloud/OrionCloudReadOnlyGateCard';
import { wavenColors, wavenSpacing } from '../src/theme/tokens';

export default function OrionCloudDebugScreen() {
  if (!__DEV__) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <OrionCloudReadOnlyGateCard />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: wavenColors.black,
    flex: 1,
  },
  content: {
    padding: wavenSpacing.lg,
    paddingBottom: wavenSpacing.xxl,
  },
});
