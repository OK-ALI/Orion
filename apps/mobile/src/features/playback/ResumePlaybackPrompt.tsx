import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing } from '@orion/shared/tokens';
import { useOrionTheme } from '../../context/ThemeContext';
import { formatPlaybackTime, type ResumePlaybackChoice } from './resumeChoice';
import type { MobileContinuityMode } from './mobileSources';

export function ResumePlaybackPrompt({
  title,
  savedTime,
  targetSourceLabel = null,
  continuityMode = 'seamless',
  onChoose,
  onCancel,
}: {
  title: string;
  savedTime: number;
  targetSourceLabel?: string | null;
  continuityMode?: MobileContinuityMode;
  onChoose: (choice: ResumePlaybackChoice) => void;
  onCancel: () => void;
}) {
  const { theme } = useOrionTheme();
  const { width, height } = useWindowDimensions();
  const switching = Boolean(targetSourceLabel);
  const compactLandscape = width > height && height < 600;
  const sourceName = targetSourceLabel || 'This source';
  const unpredictable = continuityMode === 'unpredictable';
  const resumeRestricted = continuityMode === 'outgoing-only' || continuityMode === 'start-over-only' || unpredictable;
  const limitedResume = continuityMode === 'limited-resume';
  const resumeUnverified = continuityMode === 'resume-unverified';

  const eyebrow = resumeRestricted
    ? unpredictable ? 'MAY BE UNAVAILABLE' : 'STARTS FROM BEGINNING'
    : limitedResume ? 'LIMITED RESUME'
      : resumeUnverified ? 'RESUME MAY VARY'
        : 'YOUR SAVED PLACE';
  const heading = unpredictable
    ? `Open ${sourceName} anyway?`
    : resumeRestricted
      ? `Start ${sourceName} from the beginning?`
      : limitedResume
        ? `Resume on ${sourceName}?`
        : resumeUnverified
          ? `Try resuming on ${sourceName}?`
          : switching ? `Resume on ${sourceName}?` : 'Resume playback?';
  const description = resumeRestricted
    ? unpredictable
      ? `${sourceName} may not load or may stop unexpectedly. Your current place will stay saved in Orion if you decide to try it.`
      : continuityMode === 'outgoing-only'
        ? `${sourceName} can't continue from your current spot. Your place is still saved in Orion, so you can return to it on another compatible source.`
        : `${sourceName} starts from the beginning. Your current place will stay saved in Orion.`
    : limitedResume
      ? `${sourceName} can usually continue near your saved place, but it may briefly jump while loading. Starting over may still use ${sourceName}'s own saved place.`
      : resumeUnverified
        ? `${sourceName}'s resume behavior hasn't been confirmed yet. You can try to continue, or start from the beginning.`
        : switching
          ? `${sourceName} can continue from your saved place. Choose how you'd like to start.`
          : `You watched ${title} before. Choose how you'd like to continue.`;

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
            compactLandscape && { width: Math.min(width - spacing[6], 640) },
            { backgroundColor: theme.elevated, borderColor: theme.border },
          ]}
        >
          {!compactLandscape && (
            <View style={[styles.icon, { backgroundColor: theme.accentSoft }]}>
              <Ionicons
                name={resumeRestricted || limitedResume ? 'alert-circle-outline' : resumeUnverified ? 'help-circle-outline' : 'play-back'}
                size={24}
                color={resumeRestricted || limitedResume ? theme.warning : theme.accent}
              />
            </View>
          )}
          <Text style={[
            styles.eyebrow,
            compactLandscape && styles.eyebrowCompact,
            { color: resumeRestricted || limitedResume ? theme.warning : theme.accent },
          ]}>
            {eyebrow}
          </Text>
          <Text style={[styles.heading, compactLandscape && styles.headingCompact, { color: theme.text }]}>
            {heading}
          </Text>
          <Text style={[styles.description, compactLandscape && styles.descriptionCompact, { color: theme.textSecondary }]}>
            {description}
          </Text>
          <View
            style={[
              styles.timePanel,
              compactLandscape && styles.timePanelCompact,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.timeLabel, { color: theme.textMuted }]}>
              {resumeRestricted ? 'YOUR CURRENT PLACE STAYS SAVED' : 'YOUR SAVED PLACE'}
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
                {unpredictable ? 'Open anyway' : limitedResume ? 'Try from beginning' : 'Start from beginning'}
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
    maxWidth: 640,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[2],
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
  actionsCompact: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  actionButton: {
    minHeight: 46,
    borderRadius: radii.full,
    paddingHorizontal: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    flexGrow: 1,
    minWidth: 0,
    flexBasis: 220,
  },
  primary: { minHeight: 50 },
  primaryText: { fontSize: 14, fontWeight: '900', textAlign: 'center' },
  secondary: { borderWidth: 1 },
  secondaryText: { fontSize: 13, fontWeight: '800', textAlign: 'center' },
});
