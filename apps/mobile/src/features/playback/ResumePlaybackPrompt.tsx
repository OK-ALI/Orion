import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing } from '@orion/shared/tokens';
import { useOrionTheme } from '../../context/ThemeContext';
import { formatPlaybackTime, type ResumePlaybackChoice } from './resumeChoice';

export function ResumePlaybackPrompt({
  title,
  savedTime,
  targetSourceLabel = null,
  resumeRestricted = false,
  onChoose,
  onCancel,
}: {
  title: string;
  savedTime: number;
  targetSourceLabel?: string | null;
  resumeRestricted?: boolean;
  onChoose: (choice: ResumePlaybackChoice) => void;
  onCancel: () => void;
}) {
  const { theme } = useOrionTheme();
  const { width, height } = useWindowDimensions();
  const switching = Boolean(targetSourceLabel);
  const compactLandscape = width > height && height < 600;
  const sourceName = targetSourceLabel || 'VidKing';

  return (
    <Modal transparent statusBarTranslucent animationType="fade" onRequestClose={onCancel}>
      <ScrollView
        style={[styles.backdrop, { backgroundColor: theme.mediaScrim }]}
        contentContainerStyle={[
          styles.backdropContent,
          compactLandscape && styles.backdropContentCompact,
        ]}
        bounces={false}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.card,
            compactLandscape && styles.cardCompact,
            { backgroundColor: theme.elevated, borderColor: theme.border },
          ]}
        >
          {!compactLandscape && (
            <View style={[styles.icon, { backgroundColor: theme.accentSoft }]}>
              <Ionicons name={resumeRestricted ? 'alert-circle-outline' : 'play-back'} size={24} color={theme.accent} />
            </View>
          )}
          <Text style={[styles.eyebrow, compactLandscape && styles.eyebrowCompact, { color: theme.accent }]}>
            {resumeRestricted ? 'SOURCE LIMITATION' : 'PLAYBACK POSITION'}
          </Text>
          <Text style={[styles.heading, compactLandscape && styles.headingCompact, { color: theme.text }]}>
            {resumeRestricted ? `Start ${sourceName}?` : 'Resume playback?'}
          </Text>
          <Text style={[styles.description, compactLandscape && styles.descriptionCompact, { color: theme.textSecondary }]}>
            {resumeRestricted
              ? `${sourceName} cannot reliably restore a carried position yet. Start from the beginning, or cancel to keep your current source.`
              : switching
                ? `Choose where ${targetSourceLabel} should begin.`
                : `You watched ${title} previously. Choose where to begin.`}
          </Text>
          <View
            style={[
              styles.timePanel,
              compactLandscape && styles.timePanelCompact,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.timeLabel, { color: theme.textMuted }]}>
              {resumeRestricted ? 'POSITION AVAILABLE IN OTHER SOURCES' : 'VERIFIED POSITION'}
            </Text>
            <Text style={[styles.time, compactLandscape && styles.timeCompact, { color: theme.text }]}>
              {formatPlaybackTime(savedTime)}
            </Text>
          </View>
          <View style={[styles.actions, compactLandscape && styles.actionsCompact]}>
            {!resumeRestricted && (
              <Pressable
                accessibilityRole="button"
                onPress={() => onChoose('resume')}
                style={[styles.actionButton, styles.primary, { backgroundColor: theme.accent }]}
              >
                <Ionicons name="play" size={18} color={theme.onAccent} />
                <Text style={[styles.primaryText, { color: theme.onAccent }]}>Resume from {formatPlaybackTime(savedTime)}</Text>
              </Pressable>
            )}
            {!resumeRestricted && savedTime > 45 && (
              <Pressable
                accessibilityRole="button"
                onPress={() => onChoose('replay-30')}
                style={[styles.actionButton, styles.secondary, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <Ionicons name="play-back" size={18} color={theme.text} />
                <Text style={[styles.secondaryText, { color: theme.text }]}>Replay last 30 seconds</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              onPress={() => onChoose('start-over')}
              style={[
                styles.actionButton,
                resumeRestricted ? styles.primary : styles.secondary,
                resumeRestricted
                  ? { backgroundColor: theme.accent }
                  : { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Ionicons name="refresh" size={18} color={resumeRestricted ? theme.onAccent : theme.text} />
              <Text style={[
                resumeRestricted ? styles.primaryText : styles.secondaryText,
                { color: resumeRestricted ? theme.onAccent : theme.text },
              ]}>
                Start over
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={[
                styles.actionButton,
                styles.secondary,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.secondaryText, { color: theme.textSecondary }]}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  backdropContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[5],
  },
  backdropContentCompact: { padding: spacing[2] },
  card: {
    width: '100%',
    maxWidth: 560,
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing[5],
    alignItems: 'center',
    gap: spacing[3],
  },
  cardCompact: {
    maxWidth: 760,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    gap: spacing[1],
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  eyebrowCompact: { fontSize: 9, letterSpacing: 1.5 },
  heading: { fontSize: 26, fontWeight: '900', textAlign: 'center' },
  headingCompact: { fontSize: 21 },
  description: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  descriptionCompact: { fontSize: 12, lineHeight: 16 },
  timePanel: {
    width: '100%',
    padding: spacing[3],
    borderWidth: 1,
    borderRadius: radii.lg,
    alignItems: 'center',
    gap: 4,
  },
  timePanelCompact: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing[2],
  },
  timeLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, textAlign: 'center' },
  time: { fontSize: 24, fontWeight: '900', fontVariant: ['tabular-nums'] },
  timeCompact: { fontSize: 18 },
  actions: { width: '100%', gap: spacing[2] },
  actionsCompact: { flexDirection: 'row', flexWrap: 'wrap' },
  actionButton: {
    minHeight: 46,
    borderRadius: radii.full,
    paddingHorizontal: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    flexGrow: 1,
    minWidth: 210,
  },
  primary: { minHeight: 50 },
  primaryText: { fontSize: 14, fontWeight: '900', textAlign: 'center' },
  secondary: { borderWidth: 1 },
  secondaryText: { fontSize: 13, fontWeight: '800', textAlign: 'center' },
});
