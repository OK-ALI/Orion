import React, { useEffect, useMemo, useState } from 'react';
import { AppState, Linking, Modal, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontSizes, radii, spacing } from '@orion/shared/tokens';
import { useOrionTheme } from '../../context/ThemeContext';
import {
  MOBILE_NOTIFICATION_CATEGORY_COPY_V1,
  getMobileNotificationPermissionV1,
  getMobileNotificationPreferencesV1,
  isValidNotificationTimeV1,
  requestMobileNotificationPermissionV1,
  sendMobileNotificationSelfTestV1,
  setMobileNotificationCategoryV1,
  setMobileNotificationQuietHoursV1,
  setMobileNotificationsEnabledV1,
  subscribeMobileNotificationPreferencesV1,
  type MobileNotificationCategoryV1,
  type MobileNotificationPermissionV1,
  type MobileNotificationPreferencesV1,
} from '../../services/mobileNotifications';

const CATEGORY_ORDER: readonly MobileNotificationCategoryV1[] = [
  'appUpdates',
  'syncFailures',
  'offlineRecovery',
  'providerHealth',
  'watchlist',
];

function permissionLabel(permission: MobileNotificationPermissionV1): string {
  if (permission === 'granted') return 'Allowed by device';
  if (permission === 'denied') return 'Blocked by device';
  if (permission === 'unsupported') return 'Unavailable here';
  return 'Not requested';
}

type QuietTimeField = 'start' | 'end';

function notificationTimeToMinutes(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  return (hour * 60) + minute;
}

function notificationMinutesToTime(value: number): string {
  const normalized = ((value % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function adjustNotificationTime(value: string, deltaMinutes: number): string {
  return notificationMinutesToTime(notificationTimeToMinutes(value) + deltaMinutes);
}

function formatNotificationClockForDisplay(value: string): string {
  const [hour24, minute] = value.split(':').map(Number);
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, '0')}`;
}

function formatNotificationTimeForDisplay(value: string): string {
  const meridiem = notificationTimeToMinutes(value) >= 720 ? 'PM' : 'AM';
  return `${formatNotificationClockForDisplay(value)} ${meridiem}`;
}

function setNotificationMeridiem(value: string, meridiem: 'AM' | 'PM'): string {
  const [hour24, minute] = value.split(':').map(Number);
  const currentlyPm = hour24 >= 12;
  if ((meridiem === 'PM') === currentlyPm) return value;
  const nextHour = meridiem === 'PM' ? hour24 + 12 : hour24 - 12;
  return notificationMinutesToTime((nextHour * 60) + minute);
}

function QuietHoursTimePicker({
  visible,
  label,
  value,
  theme,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  label: string;
  value: string;
  theme: ReturnType<typeof useOrionTheme>['theme'];
  onCancel: () => void;
  onConfirm: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (visible) setDraft(value);
  }, [value, visible]);

  const adjust = (deltaMinutes: number) => setDraft((current) => adjustNotificationTime(current, deltaMinutes));
  const setMeridiem = (meridiem: 'AM' | 'PM') => setDraft((current) => setNotificationMeridiem(current, meridiem));
  const draftMeridiem = notificationTimeToMinutes(draft) >= 720 ? 'PM' : 'AM';

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onCancel}
    >
      <View
        accessibilityViewIsModal
        style={styles.pickerBackdrop}
      >
        <View style={[styles.pickerCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text accessibilityRole="header" style={[styles.pickerTitle, { color: theme.text }]}>{label}</Text>
          <Text style={[styles.pickerHint, { color: theme.textSecondary }]}>
            Set the time without opening the keyboard.
          </Text>

          <View style={styles.pickerTimeRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Move ${label.toLowerCase()} back one hour`}
              onPress={() => adjust(-60)}
              style={({ pressed }) => [
                styles.pickerAdjustButton,
                { borderColor: theme.border, backgroundColor: pressed ? theme.surfaceHover : theme.elevated },
              ]}
            >
              <Ionicons name="remove" size={22} color={theme.text} />
              <Text style={[styles.pickerAdjustCaption, { color: theme.textSecondary }]}>1 hour</Text>
            </Pressable>

            <View
              accessible
              accessibilityRole="text"
              accessibilityLabel={`Selected time ${formatNotificationTimeForDisplay(draft)}`}
              style={[styles.pickerTimeDisplay, { backgroundColor: theme.input, borderColor: theme.border }]}
            >
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.82}
                numberOfLines={1}
                style={[styles.pickerTimeClockText, { color: theme.text }]}
              >
                {formatNotificationClockForDisplay(draft)}
              </Text>
              <Text style={[styles.pickerTimeMeridiemText, { color: theme.textSecondary }]}>
                {draftMeridiem}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Move ${label.toLowerCase()} forward one hour`}
              onPress={() => adjust(60)}
              style={({ pressed }) => [
                styles.pickerAdjustButton,
                { borderColor: theme.border, backgroundColor: pressed ? theme.surfaceHover : theme.elevated },
              ]}
            >
              <Ionicons name="add" size={22} color={theme.text} />
              <Text style={[styles.pickerAdjustCaption, { color: theme.textSecondary }]}>1 hour</Text>
            </Pressable>
          </View>

          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={`${label} AM or PM`}
            style={[styles.pickerMeridiemRow, { backgroundColor: theme.elevated, borderColor: theme.border }]}
          >
            {(['AM', 'PM'] as const).map((meridiem) => {
              const selected = draftMeridiem === meridiem;
              return (
                <Pressable
                  key={meridiem}
                  accessibilityRole="radio"
                  accessibilityLabel={`Set ${label.toLowerCase()} to ${meridiem}`}
                  accessibilityState={{ checked: selected }}
                  onPress={() => setMeridiem(meridiem)}
                  style={({ pressed }) => [
                    styles.pickerMeridiemButton,
                    {
                      backgroundColor: selected ? theme.accentSoft : pressed ? theme.surfaceHover : 'transparent',
                      borderColor: selected ? theme.accent : 'transparent',
                    },
                  ]}
                >
                  <Text style={[styles.pickerMeridiemText, { color: selected ? theme.accent : theme.textSecondary }]}>{meridiem}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.pickerMinuteRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Move ${label.toLowerCase()} back five minutes`}
              onPress={() => adjust(-5)}
              style={({ pressed }) => [
                styles.pickerMinuteButton,
                { borderColor: theme.border, backgroundColor: pressed ? theme.surfaceHover : theme.elevated },
              ]}
            >
              <Text style={[styles.pickerMinuteButtonText, { color: theme.text }]}>−5 min</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Move ${label.toLowerCase()} forward five minutes`}
              onPress={() => adjust(5)}
              style={({ pressed }) => [
                styles.pickerMinuteButton,
                { borderColor: theme.border, backgroundColor: pressed ? theme.surfaceHover : theme.elevated },
              ]}
            >
              <Text style={[styles.pickerMinuteButtonText, { color: theme.text }]}>+5 min</Text>
            </Pressable>
          </View>

          <View style={styles.pickerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel quiet hour time change"
              onPress={onCancel}
              style={({ pressed }) => [
                styles.pickerActionButton,
                { borderColor: theme.border, backgroundColor: pressed ? theme.surfaceHover : theme.elevated },
              ]}
            >
              <Text style={[styles.pickerActionText, { color: theme.textSecondary }]}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Set ${label.toLowerCase()} to ${formatNotificationTimeForDisplay(draft)}`}
              onPress={() => onConfirm(draft)}
              style={({ pressed }) => [
                styles.pickerActionButton,
                { borderColor: theme.accent, backgroundColor: pressed ? theme.surfaceHover : theme.accentSoft },
              ]}
            >
              <Text style={[styles.pickerActionText, { color: theme.accent }]}>Set time</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function NotificationSettingsContent() {
  const { theme } = useOrionTheme();
  const [preferences, setPreferences] = useState<MobileNotificationPreferencesV1>(getMobileNotificationPreferencesV1);
  const [permission, setPermission] = useState<MobileNotificationPermissionV1>('undetermined');
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [activeTimeField, setActiveTimeField] = useState<QuietTimeField | null>(null);

  useEffect(() => subscribeMobileNotificationPreferencesV1(setPreferences), []);

  useEffect(() => {
    let active = true;
    const refreshPermission = () => {
      void getMobileNotificationPermissionV1().then((next) => {
        if (active) setPermission(next);
      });
    };
    refreshPermission();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshPermission();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const statusTone = useMemo(() => {
    if (permission === 'granted' && preferences.enabled) return theme.accent;
    if (permission === 'denied') return theme.warning;
    return theme.textMuted;
  }, [permission, preferences.enabled, theme.accent, theme.textMuted, theme.warning]);

  const handleEnabledChange = async (enabled: boolean) => {
    if (!enabled) {
      setPreferences(setMobileNotificationsEnabledV1(false));
      return;
    }
    setPermissionBusy(true);
    try {
      const nextPermission = await requestMobileNotificationPermissionV1();
      setPermission(nextPermission);
      setPreferences(setMobileNotificationsEnabledV1(nextPermission === 'granted'));
    } finally {
      setPermissionBusy(false);
    }
  };

  const commitQuietHourTime = (field: QuietTimeField, value: string) => {
    if (!isValidNotificationTimeV1(value)) return;
    setPreferences(setMobileNotificationQuietHoursV1({ [field]: value }));
    setActiveTimeField(null);
  };

  const sendTestNotification = async () => {
    setTestBusy(true);
    setTestMessage(null);
    try {
      const delivered = await sendMobileNotificationSelfTestV1();
      setTestMessage(delivered
        ? 'Test notification sent. Tap it to verify the Notifications deep link.'
        : 'Orion could not show the test notification. Check the device permission and try again.');
    } finally {
      setTestBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.summary, { backgroundColor: theme.elevated, borderColor: theme.border }]}>
        <View style={[styles.summaryIcon, { backgroundColor: theme.surfaceHover }]}>
          <Ionicons name="notifications-outline" size={22} color={statusTone} />
        </View>
        <View style={styles.summaryCopy}>
          <Text style={[styles.title, { color: theme.text }]}>Local notifications</Text>
          <Text style={[styles.description, { color: theme.textSecondary }]}>
            Orion checks on this device and does not register a remote push token for these alerts.
          </Text>
          <Text style={[styles.status, { color: statusTone }]}>{permissionLabel(permission)}</Text>
        </View>
        <Switch
          accessibilityRole="switch"
          accessibilityLabel="Enable Orion local notifications"
          accessibilityHint="Requests notification permission only when you turn this on"
          accessibilityState={{ checked: preferences.enabled, disabled: permissionBusy || permission === 'unsupported' }}
          disabled={permissionBusy || permission === 'unsupported'}
          value={preferences.enabled}
          onValueChange={handleEnabledChange}
          trackColor={{ false: theme.border, true: theme.accentSoft }}
          thumbColor={preferences.enabled ? theme.accent : theme.textMuted}
        />
      </View>

      {permission === 'granted' && preferences.enabled && Platform.OS !== 'web' && (
        <View style={[styles.testRow, { borderColor: theme.border }]}>
          <View style={styles.rowCopy}>
            <Text style={[styles.rowTitle, { color: theme.text }]}>Test this device</Text>
            <Text style={[styles.description, { color: theme.textSecondary }]}>
              Send one user-requested local notification and verify that tapping it returns here.
            </Text>
            {testMessage && <Text accessibilityLiveRegion="polite" style={[styles.testMessage, { color: theme.textSecondary }]}>{testMessage}</Text>}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send Orion test notification"
            accessibilityState={{ disabled: testBusy }}
            disabled={testBusy}
            onPress={() => void sendTestNotification()}
            style={({ pressed }) => [
              styles.smallButton,
              { borderColor: theme.border, backgroundColor: pressed ? theme.surface : theme.elevated },
            ]}
          >
            <Text style={[styles.smallButtonText, { color: theme.text }]}>{testBusy ? 'Sending…' : 'Send test'}</Text>
          </Pressable>
        </View>
      )}

      {permission === 'denied' && Platform.OS !== 'web' && (
        <View style={[styles.notice, { backgroundColor: theme.surfaceHover, borderColor: theme.border }]}>
          <Ionicons name="alert-circle-outline" size={18} color={theme.warning} />
          <View style={styles.noticeCopy}>
            <Text style={[styles.noticeTitle, { color: theme.text }]}>Android is blocking Orion notifications</Text>
            <Text style={[styles.description, { color: theme.textSecondary }]}>Your Orion preferences stay local. Allow notifications in system settings to use them.</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open system notification settings"
            onPress={() => void Linking.openSettings()}
            style={({ pressed }) => [
              styles.smallButton,
              { borderColor: theme.border, backgroundColor: pressed ? theme.surface : theme.elevated },
            ]}
          >
            <Text style={[styles.smallButtonText, { color: theme.text }]}>Open settings</Text>
          </Pressable>
        </View>
      )}

      <Text accessibilityRole="header" style={[styles.groupTitle, { color: theme.text }]}>Categories</Text>
      <View style={[styles.group, { borderColor: theme.border }]}>
        {CATEGORY_ORDER.map((category, index) => {
          const copy = MOBILE_NOTIFICATION_CATEGORY_COPY_V1[category];
          const enabled = preferences.categories[category];
          return (
            <View
              key={category}
              style={[
                styles.row,
                index > 0 && styles.rowDivider,
                index > 0 && { borderTopColor: theme.border },
              ]}
            >
              <View style={styles.rowCopy}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>{copy.label}</Text>
                <Text style={[styles.description, { color: theme.textSecondary }]}>{copy.description}</Text>
              </View>
              <Switch
                accessibilityRole="switch"
                accessibilityLabel={`${copy.label} notifications`}
                accessibilityState={{ checked: enabled }}
                value={enabled}
                onValueChange={(value) => setPreferences(setMobileNotificationCategoryV1(category, value))}
                trackColor={{ false: theme.border, true: theme.accentSoft }}
                thumbColor={enabled ? theme.accent : theme.textMuted}
              />
            </View>
          );
        })}
      </View>

      <Text accessibilityRole="header" style={[styles.groupTitle, { color: theme.text }]}>Quiet hours</Text>
      <View style={[styles.group, { borderColor: theme.border }]}>
        <View style={styles.row}>
          <View style={styles.rowCopy}>
            <Text style={[styles.rowTitle, { color: theme.text }]}>Silence Orion notifications</Text>
            <Text style={[styles.description, { color: theme.textSecondary }]}>
              Events found during quiet hours are suppressed instead of being replayed later.
            </Text>
          </View>
          <Switch
            accessibilityRole="switch"
            accessibilityLabel="Enable notification quiet hours"
            accessibilityState={{ checked: preferences.quietHours.enabled }}
            value={preferences.quietHours.enabled}
            onValueChange={(enabled) => setPreferences(setMobileNotificationQuietHoursV1({ enabled }))}
            trackColor={{ false: theme.border, true: theme.accentSoft }}
            thumbColor={preferences.quietHours.enabled ? theme.accent : theme.textMuted}
          />
        </View>

        <View style={[styles.timeRow, { borderTopColor: theme.border }]}>
          <View style={styles.timeField}>
            <Text style={[styles.timeLabel, { color: theme.textSecondary }]}>From</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Quiet hours start time ${formatNotificationTimeForDisplay(preferences.quietHours.start)}`}
              accessibilityHint="Opens the quiet hours start time picker"
              onPress={() => setActiveTimeField('start')}
              style={({ pressed }) => [
                styles.timeButton,
                {
                  backgroundColor: pressed ? theme.surfaceHover : theme.input,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text style={[styles.timeButtonText, { color: theme.text }]}>{formatNotificationTimeForDisplay(preferences.quietHours.start)}</Text>
              <Ionicons name="time-outline" size={18} color={theme.textMuted} />
            </Pressable>
          </View>
          <View style={styles.timeField}>
            <Text style={[styles.timeLabel, { color: theme.textSecondary }]}>Until</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Quiet hours end time ${formatNotificationTimeForDisplay(preferences.quietHours.end)}`}
              accessibilityHint="Opens the quiet hours end time picker"
              onPress={() => setActiveTimeField('end')}
              style={({ pressed }) => [
                styles.timeButton,
                {
                  backgroundColor: pressed ? theme.surfaceHover : theme.input,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text style={[styles.timeButtonText, { color: theme.text }]}>{formatNotificationTimeForDisplay(preferences.quietHours.end)}</Text>
              <Ionicons name="time-outline" size={18} color={theme.textMuted} />
            </Pressable>
          </View>
        </View>
      </View>

      <QuietHoursTimePicker
        visible={activeTimeField === 'start'}
        label="Quiet hours start"
        value={preferences.quietHours.start}
        theme={theme}
        onCancel={() => setActiveTimeField(null)}
        onConfirm={(value) => commitQuietHourTime('start', value)}
      />
      <QuietHoursTimePicker
        visible={activeTimeField === 'end'}
        label="Quiet hours end"
        value={preferences.quietHours.end}
        theme={theme}
        onCancel={() => setActiveTimeField(null)}
        onConfirm={(value) => commitQuietHourTime('end', value)}
      />

      <Text style={[styles.footer, { color: theme.textMuted }]}>
        Watchlist checks are bounded and rotate through My List while Orion is active. Initial availability is treated as a baseline, so enabling the feature does not flood the notification tray.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[4] },
  summary: { borderWidth: 1, borderRadius: radii.xl, padding: spacing[4], flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  summaryIcon: { width: 42, height: 42, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center' },
  summaryCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: fontSizes.md, fontWeight: '900' },
  description: { fontSize: fontSizes.xs, lineHeight: 18, marginTop: 3 },
  status: { fontSize: fontSizes.xs, fontWeight: '900', marginTop: 7 },
  notice: { borderWidth: 1, borderRadius: radii.xl, padding: spacing[3], flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  testRow: { borderWidth: 1, borderRadius: radii.xl, padding: spacing[3], flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  noticeCopy: { flex: 1 },
  noticeTitle: { fontSize: fontSizes.sm, fontWeight: '900' },
  smallButton: { minHeight: 38, borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' },
  smallButtonText: { fontSize: fontSizes.xs, fontWeight: '900' },
  testMessage: { fontSize: fontSizes.xs, lineHeight: 18, marginTop: 7 },
  groupTitle: { fontSize: fontSizes.sm, fontWeight: '900', marginTop: spacing[1] },
  group: { borderWidth: 1, borderRadius: radii.xl, overflow: 'hidden' },
  row: { minHeight: 72, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth },
  rowCopy: { flex: 1 },
  rowTitle: { fontSize: fontSizes.sm, fontWeight: '800' },
  timeRow: { borderTopWidth: StyleSheet.hairlineWidth, padding: 14, flexDirection: 'row', gap: spacing[3] },
  timeField: { flex: 1 },
  timeLabel: { fontSize: fontSizes.xs, fontWeight: '800', marginBottom: 6 },
  timeButton: { minHeight: 50, borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  timeButtonText: { fontSize: fontSizes.md, fontWeight: '900' },
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', alignItems: 'center', justifyContent: 'center', padding: spacing[5] },
  pickerCard: { width: '100%', maxWidth: 420, borderWidth: 1, borderRadius: radii['2xl'], padding: spacing[5] },
  pickerTitle: { fontSize: fontSizes.lg, fontWeight: '900' },
  pickerHint: { fontSize: fontSizes.xs, lineHeight: 18, marginTop: 4 },
  pickerTimeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[5] },
  pickerAdjustButton: { width: 76, minHeight: 72, borderWidth: 1, borderRadius: radii.xl, alignItems: 'center', justifyContent: 'center' },
  pickerAdjustCaption: { fontSize: 10, fontWeight: '800', marginTop: 2 },
  pickerTimeDisplay: { flex: 1, minHeight: 82, borderWidth: 1, borderRadius: radii.xl, paddingHorizontal: 6, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  pickerTimeClockText: { width: '100%', fontSize: 25, lineHeight: 30, fontWeight: '900', letterSpacing: 0.25, textAlign: 'center' },
  pickerTimeMeridiemText: { fontSize: fontSizes.xs, lineHeight: 16, fontWeight: '900', letterSpacing: 1, marginTop: 1 },
  pickerMeridiemRow: { flexDirection: 'row', borderWidth: 1, borderRadius: radii.lg, padding: 3, marginTop: spacing[3] },
  pickerMeridiemButton: { flex: 1, minHeight: 42, borderWidth: 1, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  pickerMeridiemText: { fontSize: fontSizes.sm, fontWeight: '900' },
  pickerMinuteRow: { flexDirection: 'row', gap: spacing[3], marginTop: spacing[3] },
  pickerMinuteButton: { flex: 1, minHeight: 46, borderWidth: 1, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center' },
  pickerMinuteButtonText: { fontSize: fontSizes.sm, fontWeight: '900' },
  pickerActions: { flexDirection: 'row', gap: spacing[3], marginTop: spacing[5] },
  pickerActionButton: { flex: 1, minHeight: 48, borderWidth: 1, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center' },
  pickerActionText: { fontSize: fontSizes.sm, fontWeight: '900' },
  footer: { fontSize: fontSizes.xs, lineHeight: 18 },
});
