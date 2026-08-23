import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { radii, spacing } from '@orion/shared/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOrionTheme } from '../../context/ThemeContext';
import {
  dismissMobileUpdateAnnouncementV1,
  getMobileUpdateAnnouncementV1,
  subscribeMobileUpdateAnnouncementV1,
  type MobileUpdateAnnouncementV1,
} from '../../services/mobileUpdateAnnouncement';

export function MobileUpdateAnnouncementBanner() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useOrionTheme();
  const [announcement, setAnnouncement] = React.useState<MobileUpdateAnnouncementV1 | null>(
    getMobileUpdateAnnouncementV1(),
  );

  React.useEffect(() => subscribeMobileUpdateAnnouncementV1(setAnnouncement), []);

  if (!announcement) return null;

  const channelLabel = announcement.channel === 'preview' ? 'Preview' : 'Stable';
  const announcementCopy = announcement.installState === 'permission-required'
    ? `Orion Mobile ${announcement.version} · ${channelLabel} is available. Open Updates to allow installation.`
    : `Orion Mobile ${announcement.version} · ${channelLabel} is ready. View update details.`;
  const openUpdates = () => {
    router.push({ pathname: '/(tabs)/settings', params: { section: 'updates' } });
  };

  return (
    <View pointerEvents="box-none" style={[styles.layer, { top: insets.top + 56 }]}>
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[styles.banner, { backgroundColor: theme.elevated, borderColor: theme.border }]}
      >
        <View style={[styles.icon, { backgroundColor: theme.accentSoft }]}>
          <Ionicons name="cloud-download-outline" size={18} color={theme.accent} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View Orion Mobile ${announcement.version} ${channelLabel} update`}
          onPress={openUpdates}
          style={({ pressed }) => [styles.copyButton, pressed && { opacity: 0.76 }]}
        >
          <Text numberOfLines={1} style={[styles.title, { color: theme.text }]}>Update available</Text>
          <Text numberOfLines={2} style={[styles.body, { color: theme.textSecondary }]}>
            {announcementCopy}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss update announcement"
          hitSlop={8}
          onPress={() => dismissMobileUpdateAnnouncementV1(announcement)}
          style={({ pressed }) => [styles.dismiss, pressed && { backgroundColor: theme.surfaceHover }]}
        >
          <Ionicons name="close" size={18} color={theme.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: 'center',
  },
  banner: {
    width: '100%',
    maxWidth: 440,
    minHeight: 64,
    borderWidth: 1,
    borderRadius: radii.xl,
    paddingVertical: spacing[2],
    paddingLeft: spacing[3],
    paddingRight: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 12,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyButton: {
    flex: 1,
    minWidth: 0,
    paddingVertical: spacing[1],
  },
  title: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  body: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 1,
  },
  dismiss: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
