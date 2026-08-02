import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PlaybackHandoffV1 } from '@orion/shared/types';
import { radii, spacing } from '@orion/shared/tokens';
import { useOrionTheme } from '../../context/ThemeContext';

export function HandoffNotice({
  handoff,
  onContinue,
  onReturn,
  recoveredPrevious = false,
}: {
  handoff: PlaybackHandoffV1;
  onContinue: () => void;
  onReturn: () => void;
  recoveredPrevious?: boolean;
}) {
  const { theme } = useOrionTheme();
  const pending = ['preparing', 'loading', 'seeking'].includes(handoff.status);
  const continueRestarts = !pending && handoff.strategy === 'url-param' && Number(handoff.requestedTime) > 0;
  const title = pending
    ? 'Carrying playback position'
    : recoveredPrevious
      ? 'No alternate source confirmed continuity'
      : 'This source could not restore your position';
  const detail = pending
    ? 'Orion is waiting for the new source to confirm its playback time.'
    : recoveredPrevious
      ? 'Orion returned to the last usable source at your verified position.'
      : continueRestarts
        ? 'Continue Here restarts this source without the carried position, or you can return to the previous source.'
        : 'You can continue here or return to the previous source.';

  return (
    <View
      accessibilityRole="alert"
      style={[styles.notice, { backgroundColor: theme.elevated, borderColor: theme.border }]}
    >
      <View style={styles.copy}>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.detail, { color: theme.textSecondary }]}>{detail}</Text>
      </View>
      {!pending && (
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={onContinue}
            style={[styles.button, { borderColor: theme.border }]}
          >
            <Text style={[styles.buttonText, { color: theme.text }]}>Continue Here</Text>
          </Pressable>
          {!recoveredPrevious && (
            <Pressable
              accessibilityRole="button"
              onPress={onReturn}
              style={[styles.button, { backgroundColor: theme.accent, borderColor: theme.accent }]}
            >
              <Text style={[styles.buttonText, { color: theme.onAccent }]}>Return to Previous</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    position: 'absolute',
    left: spacing[4],
    right: spacing[4],
    bottom: spacing[4],
    zIndex: 1400,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  copy: { flex: 1, gap: 3 },
  title: { fontSize: 14, fontWeight: '800' },
  detail: { fontSize: 11, lineHeight: 15 },
  actions: { flexDirection: 'row', gap: spacing[2] },
  button: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
    borderWidth: 1,
    borderRadius: radii.full,
  },
  buttonText: { fontSize: 11, fontWeight: '800' },
});
