import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontSizes, radii, spacing } from '@orion/shared/tokens';
import { useOrionTheme } from '../../context/ThemeContext';
import { useResponsiveLayout } from '../../services/responsive';

export type AccountSyncStatus = 'Set up' | 'Checking' | 'Syncing' | 'Synced' | 'Paused' | 'Offline' | 'Needs review';

interface AccountSyncDomainRowProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  summary: string;
  status: AccountSyncStatus;
  autoSync?: {
    value: boolean;
    disabled: boolean;
    accessibilityLabel: string;
    accessibilityHint: string;
    onValueChange: (enabled: boolean) => void;
  };
  action?: {
    label: string;
    accessibilityLabel?: string;
    accessibilityHint?: string;
    disabled?: boolean;
    busy?: boolean;
    onPress: () => void;
  };
  children?: React.ReactNode;
}

export function AccountSyncDomainRow({
  icon,
  title,
  summary,
  status,
  autoSync,
  action,
  children,
}: AccountSyncDomainRowProps) {
  const { theme } = useOrionTheme();
  const { layout, fontScale } = useResponsiveLayout();
  const stackControls = layout === 'compact-phone' || fontScale > 1.15;
  const activeStatus = status === 'Synced' || status === 'Syncing';
  const warningStatus = status === 'Needs review';
  const statusBorder = warningStatus ? theme.warning : activeStatus ? theme.accent : theme.border;
  const statusText = warningStatus ? theme.warning : activeStatus ? theme.accent : theme.textMuted;
  const statusBackground = activeStatus ? theme.accentSoft : theme.surfaceHover;

  const controls = (
    <View style={[styles.controls, stackControls && styles.controlsStacked]}>
      <View style={[styles.statusChip, { backgroundColor: statusBackground, borderColor: statusBorder }]}>
        {status === 'Syncing' && <ActivityIndicator size="small" color={theme.accent} />}
        <Text style={[styles.statusText, { color: statusText }]}>{status}</Text>
      </View>
      {autoSync && (
        <Switch
          accessibilityLabel={autoSync.accessibilityLabel}
          accessibilityHint={autoSync.accessibilityHint}
          accessibilityState={{ disabled: autoSync.disabled, checked: autoSync.value }}
          disabled={autoSync.disabled}
          value={autoSync.value}
          onValueChange={autoSync.onValueChange}
          trackColor={{ false: theme.surfaceHover, true: theme.accentSoft }}
          thumbColor={autoSync.value ? theme.accent : theme.textMuted}
        />
      )}
    </View>
  );

  return (
    <View style={[styles.block, { borderTopColor: theme.border }]}>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: theme.accentSoft }]}>
          <Ionicons name={icon} size={20} color={theme.accent} />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.summary, { color: theme.textSecondary }]}>{summary}</Text>
        </View>
        {!stackControls && controls}
      </View>

      {stackControls && controls}

      {action && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.accessibilityLabel || action.label}
          accessibilityHint={action.accessibilityHint}
          accessibilityState={{ disabled: !!action.disabled }}
          disabled={action.disabled}
          onPress={action.onPress}
          style={({ pressed }) => [
            styles.action,
            { backgroundColor: theme.elevated, borderColor: theme.border },
            pressed && styles.pressed,
            action.disabled && styles.disabled,
          ]}
        >
          {action.busy ? (
            <ActivityIndicator size="small" color={theme.text} />
          ) : (
            <Ionicons name="sync-outline" size={16} color={theme.textSecondary} />
          )}
          <Text style={[styles.actionText, { color: theme.text }]}>{action.label}</Text>
        </Pressable>
      )}

      {children ? <View style={styles.details}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { borderTopWidth: 1, paddingTop: spacing[3], gap: spacing[2] },
  row: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  icon: { width: 40, height: 40, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: fontSizes.md, fontWeight: '800' },
  summary: { marginTop: 3, fontSize: fontSizes.xs, lineHeight: 17, fontWeight: '600' },
  controls: { minWidth: 76, alignItems: 'flex-end', justifyContent: 'center', gap: 5, flexShrink: 0 },
  controlsStacked: { minWidth: 0, marginLeft: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3] },
  statusChip: { minHeight: 28, borderRadius: 14, borderWidth: 1, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  statusText: { fontSize: 10, fontWeight: '900' },
  action: { minHeight: 44, alignSelf: 'flex-start', marginLeft: 52, borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  actionText: { fontSize: fontSizes.xs, fontWeight: '800' },
  details: { marginLeft: 52, gap: spacing[2] },
  pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.6 },
});
