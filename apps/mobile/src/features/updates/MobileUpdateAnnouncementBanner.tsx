import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { spacing } from '@orion/shared/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  dismissMobileUpdateAnnouncementV1,
  getMobileUpdateAnnouncementV1,
  subscribeMobileUpdateAnnouncementV1,
  type MobileUpdateAnnouncementV1,
} from '../../services/mobileUpdateAnnouncement';

const DESKTOP_PARITY_RED = 'rgba(229, 9, 20, 0.94)';

// Keep the Desktop-style update strip below Mobile's floating Menu control.
// FloatingSidebarTrigger sits at (safe-area + 8), is 40dp tall, has 4dp hitSlop,
// and casts a 10dp-radius / 4dp-offset shadow. 80dp leaves a visible safety gap
// even when Android reports a zero top inset and the trigger uses its 12dp fallback.
const MENU_FLOAT_CLEARANCE = 80;

export function MobileUpdateAnnouncementBanner() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [announcement, setAnnouncement] = React.useState<MobileUpdateAnnouncementV1 | null>(
    getMobileUpdateAnnouncementV1(),
  );

  React.useEffect(() => subscribeMobileUpdateAnnouncementV1(setAnnouncement), []);

  if (!announcement) return null;

  const channelLabel = announcement.channel === 'preview' ? 'Preview' : 'Stable';
  const needsInstallPermission = announcement.installState === 'permission-required';
  const openUpdates = () => {
    router.push({ pathname: '/(tabs)/settings', params: { section: 'updates' } });
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.layer, { top: insets.top + MENU_FLOAT_CLEARANCE }]}
    >
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={`Orion Mobile ${announcement.version} ${channelLabel} update available`}
        accessibilityHint={
          needsInstallPermission
            ? 'View Update opens App Updates where installation permission can be allowed.'
            : 'View Update opens App Updates with the verified update details.'
        }
        style={styles.banner}
      >
        <View style={styles.row}>
          <Text numberOfLines={1} style={styles.message}>
            🎉 Orion v{announcement.version} is available!
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View Orion Mobile ${announcement.version} ${channelLabel} update`}
            onPress={openUpdates}
            style={({ pressed }) => [styles.viewButton, pressed && styles.viewButtonPressed]}
          >
            <Text style={styles.viewButtonText}>View Update</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss update announcement"
            hitSlop={8}
            onPress={() => dismissMobileUpdateAnnouncementV1(announcement)}
            style={({ pressed }) => [styles.dismiss, pressed && styles.dismissPressed]}
          >
            <Text style={styles.dismissText}>×</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999,
  },
  banner: {
    width: '100%',
    minHeight: 48,
    backgroundColor: DESKTOP_PARITY_RED,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 12,
  },
  row: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  message: {
    flex: 1,
    minWidth: 0,
    color: '#fff',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '500',
  },
  viewButton: {
    flexShrink: 0,
    minHeight: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  viewButtonPressed: {
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  viewButtonText: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  dismiss: {
    flexShrink: 0,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissPressed: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 6,
  },
  dismissText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '400',
  },
});
