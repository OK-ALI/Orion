import { StyleSheet } from 'react-native';
import { radii } from '@orion/shared/tokens';
import type { MobileThemeTokens } from '../../context/ThemeContext';

export const createConnectRemoteStyles = (theme: MobileThemeTokens) => StyleSheet.create({
  hudFeatureGrid: { flexDirection: 'row', gap: 10, width: '100%', marginVertical: 12 },
  hudFeatureBtn: {
    flex: 1, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
    borderRadius: radii.xl, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  hudFeatureText: { color: theme.text, fontSize: 11, fontWeight: '700' },
  volumePresetRow: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 8 },
  volStepBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: theme.surface, paddingVertical: 10, borderRadius: radii.lg,
    borderWidth: 1, borderColor: theme.border,
  },
  volPresetBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: theme.accentSoft, paddingVertical: 10, borderRadius: radii.lg,
    borderWidth: 1, borderColor: theme.accent,
  },
  volStepText: { color: theme.text, fontSize: 12, fontWeight: '700' },
  quickLaunchRailContainer: { width: '100%', marginBottom: 12 },
  quickLaunchTitle: {
    color: theme.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 0.8, marginBottom: 8, paddingLeft: 4,
  },
  quickLaunchRail: { flexDirection: 'row', gap: 8, paddingHorizontal: 2 },
  quickPageChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.surface,
    borderWidth: 1, borderColor: theme.border, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: radii.xl,
  },
  quickPageChipText: { color: theme.text, fontSize: 12, fontWeight: '700' },
  focusModeSwitchRow: { flexDirection: 'row', gap: 10, width: '100%', marginBottom: 12 },
  focusModeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
    paddingVertical: 8, borderRadius: radii.lg,
  },
  focusModeBtnActive: { backgroundColor: theme.accentSoft, borderColor: theme.accent },
  focusModeText: { color: theme.textMuted, fontSize: 12, fontWeight: '700' },
  focusModeTextActive: { color: theme.text },
  scrubberContainer: { width: '100%', marginBottom: 16 },
  scrubberTimeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  scrubberTimeText: { color: theme.textMuted, fontSize: 12, fontWeight: '700' },
  scrubberTrack: {
    width: '100%', height: 8, borderRadius: 4, backgroundColor: theme.border,
    overflow: 'hidden', justifyContent: 'center',
  },
  scrubberFill: { height: '100%', backgroundColor: theme.accent, borderRadius: 4 },
  touchpadSection: { width: '100%', alignItems: 'center', marginVertical: 12 },
  touchpadSurface: {
    width: '100%', height: 240, backgroundColor: theme.surface, borderWidth: 1.5,
    borderColor: theme.border, borderRadius: radii.xl, justifyContent: 'center',
    alignItems: 'center', gap: 8,
  },
  touchpadPrompt: { color: theme.text, fontSize: 14, fontWeight: '700' },
  touchpadSubPrompt: { color: theme.textMuted, fontSize: 12 },
});
