import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WavenWordmark } from '../brand/WavenWordmark';
import { useWavenLayout } from '../../hooks/useWavenLayout';
import { wavenColors, wavenSpacing } from '../../theme/tokens';

interface WavenAppShellProps {
  brandTagline?: boolean;
  children: React.ReactNode;
  showBrand?: boolean;
}

export function WavenAppShell({
  brandTagline = false,
  children,
  showBrand = brandTagline,
}: WavenAppShellProps) {
  const layout = useWavenLayout();

  return (
    <View style={styles.root}>
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
            {showBrand ? (
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
            ) : null}
            <View style={styles.pageContent}>{children}</View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  safeArea: {
    flex: 1,
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
