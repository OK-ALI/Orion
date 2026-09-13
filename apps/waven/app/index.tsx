import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SplitAccentHeading } from '../src/components/brand/SplitAccentHeading';
import { wavenColors } from '../src/theme/tokens';

export default function WavenFoundationScreen() {
  return (
    <LinearGradient
      colors={[wavenColors.black, wavenColors.surface, wavenColors.black]}
      style={styles.background}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Image
            accessibilityLabel="WAVEN brand mark"
            resizeMode="contain"
            source={require('../assets/icon.png')}
            style={styles.icon}
          />
          <Text style={styles.wordmark}>WAVEN</Text>
          <Text style={styles.subtitle}>Where Music Lives.</Text>
          <SplitAccentHeading lead="Foundation" accent="Ready" />
          <Text style={styles.note}>
            Expo and React Native are pinned to Orion Mobile&apos;s proven baseline. Music and Orion Cloud
            features will enter through explicit shared contracts in later checkpoints.
          </Text>
        </View>
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  icon: {
    width: 220,
    height: 220,
    marginBottom: 18,
  },
  wordmark: {
    color: wavenColors.coolWhite,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 8,
  },
  subtitle: {
    color: wavenColors.silver,
    fontSize: 15,
    letterSpacing: 1.5,
    marginTop: 8,
    marginBottom: 42,
  },
  note: {
    color: wavenColors.steelGray,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 14,
    maxWidth: 420,
    textAlign: 'center',
  },
});
