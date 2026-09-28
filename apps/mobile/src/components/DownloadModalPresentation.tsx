import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontSizes, radii, spacing } from '@orion/shared/tokens';
import { useOrionTheme } from '../context/ThemeContext';

export function ChoicePill({
  label,
  icon,
  selected,
  ready = false,
  note,
  onPress,
  theme,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  selected: boolean;
  ready?: boolean;
  note?: string;
  onPress: () => void;
  theme: ReturnType<typeof useOrionTheme>['theme'];
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${label}${ready ? ', ready' : ''}`}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [downloadModalStyles.choicePill, {
        backgroundColor: selected ? theme.accentSoft : pressed ? theme.surfaceHover : theme.surface,
        borderColor: selected ? theme.accent : theme.border,
      }]}
    >
      <Ionicons name={ready ? 'checkmark-circle' : icon} size={18} color={ready ? theme.success : selected ? theme.accent : theme.textSecondary} />
      <View style={downloadModalStyles.choiceCopy}>
        <Text style={[downloadModalStyles.choiceLabel, { color: theme.text }]} numberOfLines={1}>{label}{ready ? ' · Ready ✓' : ''}</Text>
        {note ? <Text style={[downloadModalStyles.choiceNote, { color: theme.textMuted }]} numberOfLines={1}>{note}</Text> : null}
      </View>
    </Pressable>
  );
}

export function SummaryRow({
  label,
  value,
  last = false,
  theme,
}: {
  label: string;
  value: string;
  last?: boolean;
  theme: ReturnType<typeof useOrionTheme>['theme'];
}) {
  return (
    <View style={[downloadModalStyles.summaryRow, !last && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <Text style={[downloadModalStyles.summaryLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[downloadModalStyles.summaryValue, { color: theme.text }]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

export function StatusCard({
  icon,
  color,
  title,
  detail,
  theme,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  title: string;
  detail: string;
  theme: ReturnType<typeof useOrionTheme>['theme'];
}) {
  return (
    <View style={[downloadModalStyles.notice, { backgroundColor: theme.surfaceHover, borderColor: color }]}>
      <Ionicons name={icon} size={20} color={color} />
      <View style={downloadModalStyles.noticeCopy}>
        <Text style={[downloadModalStyles.noticeTitle, { color }]}>{title}</Text>
        <Text style={[downloadModalStyles.description, { color: theme.textSecondary }]}>{detail}</Text>
      </View>
    </View>
  );
}

export const downloadModalStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing[4], paddingVertical: spacing[6] },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0, 0, 0, 0.78)' },
  card: { width: '100%', maxWidth: 460, maxHeight: '88%', borderRadius: radii['2xl'], borderWidth: 1, overflow: 'hidden' },
  cardTablet: { maxWidth: 560 },
  header: { padding: spacing[5], paddingBottom: spacing[3], flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  cardTitle: { fontSize: 21, lineHeight: 26, fontWeight: '900', marginTop: 3 },
  mediaTitle: { fontSize: fontSizes.sm, lineHeight: 19, marginTop: 3, fontWeight: '700' },
  closeBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  railWrap: { paddingHorizontal: spacing[5], paddingBottom: spacing[3] },
  stepRail: { flexDirection: 'row', alignItems: 'flex-start' },
  stepItem: { alignItems: 'center', width: 72 },
  stepDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepNumber: { fontSize: 10, fontWeight: '900' },
  stepLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.6, marginTop: 5 },
  stepLine: { flex: 1, height: 1, marginTop: 12, minWidth: 20 },
  scrollContent: { paddingHorizontal: spacing[5], paddingBottom: spacing[4], gap: spacing[3] },
  groupTitle: { fontSize: fontSizes.sm, fontWeight: '900', marginTop: spacing[1] },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  choicePill: { minHeight: 48, minWidth: '47%', flexGrow: 1, flexBasis: '47%', borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: spacing[3], paddingVertical: spacing[2], flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  choiceCopy: { flex: 1, minWidth: 0 },
  choiceLabel: { fontSize: fontSizes.xs, fontWeight: '900' },
  choiceNote: { fontSize: 10, lineHeight: 14, marginTop: 2 },
  optionCard: { minHeight: 68, borderWidth: 1, borderRadius: radii.xl, padding: spacing[3], flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  optionCopy: { flex: 1, minWidth: 0 },
  optionTitle: { fontSize: fontSizes.sm, fontWeight: '900' },
  description: { fontSize: fontSizes.xs, lineHeight: 17, marginTop: 3 },
  inlineAction: { fontSize: fontSizes.xs, fontWeight: '900', paddingVertical: 5 },
  prepareHero: { minHeight: 108, borderWidth: 1, borderRadius: radii.xl, padding: spacing[4], flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  prepareIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  prepareCopy: { flex: 1, minWidth: 0 },
  prepareTitle: { fontSize: 16, fontWeight: '900' },
  quietHint: { fontSize: fontSizes.xs, lineHeight: 17, textAlign: 'center', paddingHorizontal: spacing[2] },
  summaryCard: { borderWidth: 1, borderRadius: radii.xl, overflow: 'hidden' },
  summaryRow: { minHeight: 54, paddingHorizontal: spacing[3], paddingVertical: spacing[2], flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  summaryLabel: { width: 84, fontSize: 10, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
  summaryValue: { flex: 1, textAlign: 'right', fontSize: fontSizes.sm, fontWeight: '800' },
  subtitleSection: { gap: spacing[2] },
  subtitleSectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing[3] },
  subtitleSectionCopy: { flex: 1, minWidth: 0 },
  subtitleHint: { fontSize: fontSizes.xs, lineHeight: 17, marginTop: 2 },
  subtitleOptionGrid: { gap: spacing[2] },
  subtitleOption: { minHeight: 56, borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: spacing[3], paddingVertical: spacing[2], flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  subtitleOptionCopy: { flex: 1, minWidth: 0 },
  subtitleOptionTitle: { fontSize: fontSizes.xs, fontWeight: '800' },
  subtitleOptionMeta: { fontSize: 10, lineHeight: 15, marginTop: 2 },
  notice: { borderWidth: 1, borderRadius: radii.xl, padding: spacing[3], flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  noticeCopy: { flex: 1, minWidth: 0 },
  noticeTitle: { fontSize: fontSizes.sm, fontWeight: '900' },
  footer: { borderTopWidth: 1, padding: spacing[4], flexDirection: 'row', gap: spacing[3] },
  secondaryButton: { flex: 1, minHeight: 48, borderRadius: radii.xl, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { fontSize: fontSizes.sm, fontWeight: '800' },
  primaryButton: { flex: 1.25, minHeight: 48, borderRadius: radii.xl, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { fontSize: fontSizes.sm, fontWeight: '900' },
});
