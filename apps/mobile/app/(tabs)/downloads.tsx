import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { spacing, radii, fontSizes } from '@orion/shared/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { MobileDownloadPreferencesV1 } from '@orion/shared/types';
import { useOrionTheme } from '../../src/context/ThemeContext';
import { useResponsiveLayout } from '../../src/services/responsive';
import { MobilePageHeader } from '../../src/components/MobilePageHeader';
import { getMobileDownloadCapability } from '../../src/services/downloadManager';
import {
  listMobileDownloadJobsV1,
  listOfflineMediaEntriesV1,
  subscribeMobileDownloadRepositoryV1,
} from '../../src/features/downloads/downloadRepository';
import {
  getMobileDownloadPreferencesV1,
  subscribeMobileDownloadPreferencesV1,
} from '../../src/features/downloads/downloadPreferences';

const ACTIVE_STATES = new Set([
  'queued',
  'preflighting',
  'downloading',
  'recovering',
  'verifying',
  'finalizing',
]);

export default function DownloadsScreen() {
  const router = useRouter();
  const { theme } = useOrionTheme();
  const { isTablet } = useResponsiveLayout();
  const capability = getMobileDownloadCapability();
  const [jobs, setJobs] = useState(listMobileDownloadJobsV1);
  const [offlineEntries, setOfflineEntries] = useState(listOfflineMediaEntriesV1);
  const [preferences, setPreferences] = useState<MobileDownloadPreferencesV1>(getMobileDownloadPreferencesV1);

  useEffect(() => subscribeMobileDownloadRepositoryV1((snapshot) => {
    setJobs(snapshot.jobs);
    setOfflineEntries(snapshot.offlineEntries);
  }), []);

  useEffect(() => subscribeMobileDownloadPreferencesV1(setPreferences), []);

  const activeCount = useMemo(() => jobs.filter((job) => ACTIVE_STATES.has(job.state)).length, [jobs]);
  const destinationLabel = preferences.defaultDestination === 'device-storage' ? 'Device Storage' : 'Orion Library';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={[theme.accentSoft, theme.background, theme.background, theme.elevated]}
        locations={[0, 0.34, 0.78, 1]}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />

      <MobilePageHeader
        eyebrow="OFFLINE"
        title="Downloads"
        subtitle="Keep movies and episodes ready for offline playback."
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, isTablet && styles.contentTablet]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.summaryIcon, { backgroundColor: theme.accentSoft }]}>
              <Ionicons name="download-outline" size={20} color={theme.accent} />
            </View>
            <Text style={[styles.summaryValue, { color: theme.text }]}>{activeCount}</Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Active</Text>
          </View>

          <View style={[styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.summaryIcon, { backgroundColor: theme.accentSoft }]}>
              <Ionicons name="albums-outline" size={20} color={theme.accent} />
            </View>
            <Text style={[styles.summaryValue, { color: theme.text }]}>{offlineEntries.length}</Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Offline</Text>
          </View>
        </View>

        <View style={[styles.destinationCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.destinationIcon, { backgroundColor: theme.surfaceHover, borderColor: theme.border }]}>
            <Ionicons
              name={preferences.defaultDestination === 'device-storage' ? 'folder-open-outline' : 'albums-outline'}
              size={21}
              color={theme.accent}
            />
          </View>
          <View style={styles.destinationCopy}>
            <Text style={[styles.sectionEyebrow, { color: theme.textMuted }]}>DEFAULT LOCATION</Text>
            <Text style={[styles.destinationTitle, { color: theme.text }]}>{destinationLabel}</Text>
            <Text style={[styles.body, { color: theme.textSecondary }]}>Quality: {preferences.preferredQuality === 'best' ? 'Best available' : preferences.preferredQuality}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open download settings"
            onPress={() => router.push({ pathname: '/(tabs)/settings', params: { section: 'downloads' } })}
            style={({ pressed }) => [
              styles.iconButton,
              { borderColor: theme.border, backgroundColor: pressed ? theme.surfaceHover : theme.elevated },
            ]}
          >
            <Ionicons name="settings-outline" size={19} color={theme.textSecondary} />
          </Pressable>
        </View>

        {jobs.length === 0 && offlineEntries.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.accentSoft }]}>
              <Ionicons name="arrow-down-circle-outline" size={38} color={theme.accent} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Your offline library starts here</Text>
            <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>Choose a movie or episode to see its download options. Completed media will stay organized by title.</Text>

            {!capability.available ? (
              <View style={[styles.statusRow, { backgroundColor: theme.surfaceHover, borderColor: theme.border }]}>
                <Ionicons name="time-outline" size={17} color={theme.textMuted} />
                <Text style={[styles.statusText, { color: theme.textSecondary }]}>Downloads are not available on this build yet.</Text>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Browse Orion catalog"
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: theme.accent },
                pressed && { opacity: 0.86 },
              ]}
              onPress={() => router.push('/')}
            >
              <Ionicons name="compass-outline" size={18} color={theme.onAccent} />
              <Text style={[styles.primaryButtonText, { color: theme.onAccent }]}>Browse Orion</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Download activity</Text>
            <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>Queue and Offline Library presentation will use the durable download repository as native engine stages land.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing[5], paddingBottom: 72, gap: spacing[4] },
  contentTablet: { maxWidth: 900, width: '100%', alignSelf: 'center' },
  summaryRow: { flexDirection: 'row', gap: spacing[3] },
  summaryCard: { flex: 1, minHeight: 112, borderWidth: 1, borderRadius: radii['2xl'], padding: spacing[4], justifyContent: 'center' },
  summaryIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[2] },
  summaryValue: { fontSize: 24, fontWeight: '900' },
  summaryLabel: { fontSize: fontSizes.xs, fontWeight: '700', marginTop: 2 },
  destinationCard: { minHeight: 86, borderWidth: 1, borderRadius: radii['2xl'], padding: spacing[4], flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  destinationIcon: { width: 44, height: 44, borderRadius: radii.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  destinationCopy: { flex: 1, minWidth: 0 },
  sectionEyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  destinationTitle: { fontSize: fontSizes.md, fontWeight: '900', marginTop: 3 },
  body: { fontSize: fontSizes.xs, lineHeight: 18, marginTop: 3 },
  iconButton: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emptyCard: { borderWidth: 1, borderRadius: radii['2xl'], padding: spacing[6], alignItems: 'center' },
  emptyIcon: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[4] },
  emptyTitle: { fontSize: 20, fontWeight: '900', textAlign: 'center' },
  emptyBody: { maxWidth: 520, fontSize: fontSizes.sm, lineHeight: 21, textAlign: 'center', marginTop: spacing[2] },
  statusRow: { width: '100%', borderWidth: 1, borderRadius: radii.lg, padding: spacing[3], marginTop: spacing[4], flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  statusText: { fontSize: fontSizes.xs, fontWeight: '700', textAlign: 'center' },
  primaryButton: { minHeight: 48, width: '100%', borderRadius: radii.xl, paddingHorizontal: spacing[4], marginTop: spacing[4], flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  primaryButtonText: { fontSize: fontSizes.sm, fontWeight: '900' },
});
