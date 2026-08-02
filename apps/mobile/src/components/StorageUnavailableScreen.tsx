import { DevSettings, Pressable, StyleSheet, Text, View } from 'react-native';
import { useOrionTheme } from '../context/ThemeContext';

interface StorageUnavailableScreenProps {
  errorCode: string;
}

export function StorageUnavailableScreen({ errorCode }: StorageUnavailableScreenProps) {
  const { theme } = useOrionTheme();

  const reload = () => {
    try {
      DevSettings.reload();
    } catch {
      // Closing and reopening the application remains the recovery path in production.
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <View
        accessibilityRole="alert"
        style={[
          styles.panel,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
          },
        ]}
      >
        <Text style={[styles.eyebrow, { color: theme.accent }]}>STORAGE NEEDS ATTENTION</Text>
        <Text style={[styles.title, { color: theme.text }]}>Orion could not open local storage</Text>
        <Text style={[styles.body, { color: theme.textSecondary }]}>
          Your existing profile has not been changed. Orion&apos;s private app storage could not
          initialize. This does not normally require Android file permission. Restart Orion after
          updating or reinstalling the app. Orion will not use temporary memory because saved data
          could otherwise appear to succeed and then disappear.
        </Text>
        <Text style={[styles.code, { color: theme.textSecondary }]}>Reference: {errorCode}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry storage initialization"
          onPress={reload}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.accent, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Text style={[styles.buttonText, { color: theme.onAccent }]}>Restart and retry</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  panel: {
    width: '100%',
    maxWidth: 520,
    borderWidth: 1,
    borderRadius: 28,
    padding: 28,
    gap: 14,
  },
  eyebrow: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    letterSpacing: 1.8,
  },
  title: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 28,
    lineHeight: 34,
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    lineHeight: 24,
  },
  code: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  button: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    marginTop: 6,
  },
  buttonText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
  },
});
