import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing } from '@orion/shared/tokens';
import { useOrionTheme } from '../../context/ThemeContext';
import { formatPlaybackTime, type ResumePlaybackChoice } from './resumeChoice';

export function ResumePlaybackPrompt({
  title,
  savedTime,
  targetSourceLabel = null,
  opensPaused = false,
  onChoose,
  onCancel,
}: {
  title: string;
  savedTime: number;
  targetSourceLabel?: string | null;
  opensPaused?: boolean;
  onChoose: (choice: ResumePlaybackChoice) => void;
  onCancel: () => void;
}) {
  const { theme } = useOrionTheme();
  const switching = Boolean(targetSourceLabel);
  return (
    <Modal transparent statusBarTranslucent animationType="fade" onRequestClose={onCancel}>
      <View style={[styles.backdrop, { backgroundColor: theme.mediaScrim }]}>
        <View style={[styles.card, { backgroundColor: theme.elevated, borderColor: theme.border }]}>
          <View style={[styles.icon, { backgroundColor: theme.accentSoft }]}>
            <Ionicons name="play-back" size={24} color={theme.accent} />
          </View>
          <Text style={[styles.eyebrow, { color: theme.accent }]}>PLAYBACK POSITION</Text>
          <Text style={[styles.heading, { color: theme.text }]}>Resume playback?</Text>
          <Text style={[styles.description, { color: theme.textSecondary }]}>
            {switching
              ? `Choose where ${targetSourceLabel} should begin.`
              : `You watched ${title} previously. Choose where to begin.`}
          </Text>
          <View style={[styles.timePanel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.timeLabel, { color: theme.textMuted }]}>VERIFIED POSITION</Text>
            <Text style={[styles.time, { color: theme.text }]}>{formatPlaybackTime(savedTime)}</Text>
          </View>
          {opensPaused && (
            <Text style={[styles.providerNote, { color: theme.warning }]}>
              VidKing will open paused at your choice to prevent an audio jump. Press Play in its player when ready.
            </Text>
          )}
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => onChoose('resume')}
              style={[styles.primary, { backgroundColor: theme.accent }]}
            >
              <Ionicons name="play" size={18} color={theme.onAccent} />
              <Text style={[styles.primaryText, { color: theme.onAccent }]}>Resume from {formatPlaybackTime(savedTime)}</Text>
            </Pressable>
            {savedTime > 45 && (
              <Pressable
                accessibilityRole="button"
                onPress={() => onChoose('replay-30')}
                style={[styles.secondary, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <Ionicons name="play-back" size={18} color={theme.text} />
                <Text style={[styles.secondaryText, { color: theme.text }]}>Replay last 30 seconds</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              onPress={() => onChoose('start-over')}
              style={[styles.secondary, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Ionicons name="refresh" size={18} color={theme.text} />
              <Text style={[styles.secondaryText, { color: theme.text }]}>Start over</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onCancel} style={styles.cancel}>
              <Text style={[styles.cancelText, { color: theme.textSecondary }]}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[5],
  },
  card: {
    width: '100%',
    maxWidth: 520,
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing[5],
    alignItems: 'center',
    gap: spacing[3],
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  heading: { fontSize: 26, fontWeight: '900', textAlign: 'center' },
  description: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  timePanel: {
    width: '100%',
    padding: spacing[3],
    borderWidth: 1,
    borderRadius: radii.lg,
    alignItems: 'center',
    gap: 4,
  },
  timeLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  time: { fontSize: 24, fontWeight: '900', fontVariant: ['tabular-nums'] },
  providerNote: { fontSize: 12, lineHeight: 17, textAlign: 'center' },
  actions: { width: '100%', gap: spacing[2] },
  primary: {
    minHeight: 50,
    borderRadius: radii.full,
    paddingHorizontal: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  primaryText: { fontSize: 14, fontWeight: '900' },
  secondary: {
    minHeight: 46,
    borderRadius: radii.full,
    borderWidth: 1,
    paddingHorizontal: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  secondaryText: { fontSize: 13, fontWeight: '800' },
  cancel: { minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 13, fontWeight: '700' },
});
