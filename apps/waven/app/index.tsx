import { LinearGradient } from 'expo-linear-gradient';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SplitAccentHeading } from '../src/components/brand/SplitAccentHeading';
import { OrionCloudReadOnlyGateCard } from '../src/features/orion-cloud/OrionCloudReadOnlyGateCard';
import { wavenColors } from '../src/theme/tokens';

export default function WavenFoundationScreen() {
  return (
    <LinearGradient
      colors={[wavenColors.black, wavenColors.surface, wavenColors.black]}
      style={styles.background}
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandBlock}>
            <Image
              accessibilityLabel="WAVEN brand mark"
              resizeMode="contain"
              source={require('../assets/icon.png')}
              style={styles.icon}
            />
            <Text accessibilityLabel="WAVEN" style={styles.wordmark}>
              <Text>WA</Text>
              <Text style={styles.wordmarkAccent}>V</Text>
              <Text>EN</Text>
            </Text>
            <Text style={styles.subtitle}>Where Music Lives.</Text>
            <SplitAccentHeading lead="Foundation" accent="Ready" />
            <Text style={styles.note}>
              Phase 2.2 wires WAVEN to the shared Orion Cloud Android adapter under a read-only
              preservation gate. No primary-profile create or write path is available here.
            </Text>
          </View>

          <OrionCloudReadOnlyGateCard />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 48,
  },
  brandBlock: {
    alignItems: 'center',
    width: '100%',
  },
  icon: {
    width: 180,
    height: 180,
    marginBottom: 14,
  },
  wordmark: {
    color: wavenColors.coolWhite,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 8,
  },
  wordmarkAccent: {
    color: wavenColors.activeBlue,
  },
  subtitle: {
    color: wavenColors.silver,
    fontSize: 15,
    letterSpacing: 1.5,
    marginTop: 8,
    marginBottom: 32,
  },
  note: {
    color: wavenColors.steelGray,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 14,
    maxWidth: 520,
    textAlign: 'center',
  },
});
