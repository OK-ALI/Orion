import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing } from '@orion/shared/tokens';
import { useOrionTheme } from '../context/ThemeContext';
import type { NetworkProductState } from '../context/networkStatePolicy';
import { HomeOfflineIntroduction } from './HomeOfflineIntroduction';

interface HomeConnectionPanelProps {
  state: NetworkProductState;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenDownloads: () => void;
  onOpenLibrary: () => void;
}

export function HomeConnectionPanel({
  state,
  loading,
  error,
  onRetry,
  onOpenDownloads,
  onOpenLibrary,
}: HomeConnectionPanelProps) {
  const { theme } = useOrionTheme();

  if (state === 'offline') {
    return <HomeOfflineIntroduction onOpenDownloads={onOpenDownloads} onOpenLibrary={onOpenLibrary} />;
  }

  if (
    state === 'online' &&
    !loading &&
    !error
  ) {
    return null;
  }

  const degraded =
    state === 'degraded';

  const reconnecting =
    state === 'reconnecting';

  const checking =
    state === 'checking';

  const refreshing =
    state === 'online' &&
    loading;

  const failedOnlineRefresh =
    state === 'online' &&
    !!error;

  const eyebrow = degraded
      ? 'CINEMA DEGRADED'
      : reconnecting
        ? 'RECONNECTING'
        : checking
          ? 'CONNECTING'
          : failedOnlineRefresh
            ? 'CINEMA REFRESH'
            : 'CINEMA';

  const title = degraded
      ? 'Cinema is temporarily unavailable.'
      : reconnecting
        ? 'Reconnecting to Orion Cinema.'
        : checking
          ? 'Checking Cinema connection.'
          : failedOnlineRefresh
            ? 'Cinema did not refresh.'
            : 'Refreshing Orion Cinema.';

  const body = degraded
      ? 'Internet transport is available, but the Cinema catalog service is not. Your local Library and Downloads still work.'
      : reconnecting
        ? 'Local features remain available while Orion validates the restored connection.'
        : checking
          ? 'Local content is ready while Orion checks remote catalog availability.'
          : failedOnlineRefresh
            ? 'Your local Orion is still available. You can retry the remote catalog without restarting the app.'
            : 'Refreshing remote rails while local content remains usable.';

  const tone =
    degraded
      ? theme.warning
      : theme.accent;

  const iconName = degraded
      ? 'warning-outline'
      : failedOnlineRefresh
        ? 'refresh-outline'
        : 'cloud-outline';

  return (
    <View
      accessibilityRole="summary"
      style={[
        styles.panel,
        {
          backgroundColor:
            theme.surface,
          borderColor:
            tone,
        },
      ]}
    >
      <View
        style={[
          styles.icon,
          {
            backgroundColor:
              theme.accentSoft,
          },
        ]}
      >
        {reconnecting ||
        checking ||
        refreshing ? (
          <ActivityIndicator
            size="small"
            color={tone}
          />
        ) : (
          <Ionicons
            name={iconName as any}
            size={22}
            color={tone}
          />
        )}
      </View>

      <View style={styles.copy}>
        <Text
          style={[
            styles.eyebrow,
            { color: tone },
          ]}
        >
          {eyebrow}
        </Text>

        <Text
          style={[
            styles.title,
            { color: theme.text },
          ]}
        >
          {title}
        </Text>

        <Text
          style={[
            styles.body,
            {
              color:
                theme.textSecondary,
            },
          ]}
        >
          {body}
        </Text>

        {degraded && (
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open Downloads"
              onPress={onOpenDownloads}
              style={({ pressed }) => [
                styles.primaryAction,
                {
                  backgroundColor:
                    theme.accent,
                },
                pressed &&
                  styles.pressed,
              ]}
            >
              <Ionicons
                name="download-outline"
                size={17}
                color={theme.onAccent}
              />

              <Text
                style={[
                  styles.primaryText,
                  {
                    color:
                      theme.onAccent,
                  },
                ]}
              >
                Downloads
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open Library"
              onPress={onOpenLibrary}
              style={({ pressed }) => [
                styles.secondaryAction,
                {
                  borderColor:
                    theme.border,
                  backgroundColor:
                    theme.elevated,
                },
                pressed &&
                  styles.pressed,
              ]}
            >
              <Ionicons
                name="library-outline"
                size={17}
                color={
                  theme.textSecondary
                }
              />

              <Text
                style={[
                  styles.secondaryText,
                  {
                    color:
                      theme.textSecondary,
                  },
                ]}
              >
                Library
              </Text>
            </Pressable>
          </View>
        )}

        {failedOnlineRefresh && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry Cinema refresh"
            onPress={onRetry}
            style={({ pressed }) => [
              styles.retryAction,
              {
                borderColor:
                  theme.border,
              },
              pressed &&
                styles.pressed,
            ]}
          >
            <Ionicons
              name="refresh-outline"
              size={16}
              color={theme.accent}
            />

            <Text
              style={[
                styles.retryText,
                {
                  color:
                    theme.accent,
                },
              ]}
            >
              Retry Cinema
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginHorizontal: spacing[5],
    marginTop: spacing[2],
    marginBottom: spacing[5],
    borderWidth: 1,
    borderRadius: 20,
    padding: spacing[4],
    flexDirection: 'row',
    gap: spacing[3],
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
    letterSpacing: -0.35,
  },
  body: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    marginTop: spacing[3],
  },
  primaryAction: {
    minHeight: 42,
    borderRadius: 21,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  secondaryAction: {
    minHeight: 42,
    borderRadius: 21,
    borderWidth: 1,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  primaryText: {
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryText: {
    fontSize: 13,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.76,
  },
  retryAction: {
    alignSelf: 'flex-start',
    minHeight: 40,
    marginTop: spacing[3],
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '800',
  },
});