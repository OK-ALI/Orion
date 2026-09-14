import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WavenWordmark } from '../brand/WavenWordmark';
import { useWavenLayout } from '../../hooks/useWavenLayout';
import { wavenColors, wavenSpacing } from '../../theme/tokens';

interface WavenAppShellProps {
  brandTagline?: boolean;
  children: React.ReactNode;
}

export function WavenAppShell({
  brandTagline = false,
  children,
}: WavenAppShellProps) {
  const layout = useWavenLayout();

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[wavenColors.canvas, '#020508', wavenColors.canvas]}
        end={{ x: 0.82, y: 1 }}
        pointerEvents="none"
        start={{ x: 0.18, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.ambientGlow} />

      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingHorizontal: layout.gutter,
            },
          ]}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.contentFrame, { maxWidth: layout.contentMaxWidth }]}>
            <View
              style={[
                styles.wordmarkRow,
                brandTagline ? styles.wordmarkRowWithTagline : null,
              ]}
            >
              <WavenWordmark />
              {brandTagline ? (
                <Text accessibilityRole="text" style={styles.tagline}>
                  <Text>Where </Text>
                  <Text style={styles.taglineAccent}>Music</Text>
                  <Text> Lives</Text>
                </Text>
              ) : null}
            </View>
            <View style={styles.pageContent}>{children}</View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: wavenColors.canvas,
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  ambientGlow: {
    backgroundColor: wavenColors.blueGlow,
    borderRadius: 999,
    height: 260,
    opacity: 0.1,
    position: 'absolute',
    right: -215,
    top: -210,
    width: 260,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: wavenSpacing.lg,
    paddingTop: 8,
  },
  contentFrame: {
    alignSelf: 'center',
    flex: 1,
    width: '100%',
  },
  wordmarkRow: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    paddingBottom: 40,
  },
  wordmarkRowWithTagline: {
    minHeight: 72,
    paddingBottom: 42,
  },
  tagline: {
    color: wavenColors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginTop: 7,
    textAlign: 'center',
  },
  taglineAccent: {
    color: wavenColors.interactionBlue,
    fontWeight: '700',
  },
  pageContent: {
    flex: 1,
  },
});
