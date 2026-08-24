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
import { DownloadActivityList } from '../../src/features/downloads/DownloadActivityList';
import {
  listMobileDownloadAssetsV1,
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
  'paused',
  'recovering',
  'verifying',
  'finalizing',
]);

function formatStoredSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kib = bytes / 1024;
  if (kib < 1024) return `${kib.toFixed(kib >= 100 ? 0 : 1)} KB`;
  const mib = kib / 1024;
  if (mib < 1024) return `${mib.toFixed(mib >= 100 ? 0 : 1)} MB`;
  const gib = mib / 1024;
  return `${gib.toFixed(gib >= 10 ? 1 : 2)} GB`;
}

export default function DownloadsScreen() {
  const router = useRouter();
  const { theme } = useOrionTheme();
  const { isTablet } = useResponsiveLayout();
  const capability = getMobileDownloadCapability();
  const [jobs, setJobs] = useState(listMobileDownloadJobsV1);
  const [assets, setAssets] = useState(listMobileDownloadAssetsV1);
  const [offlineEntries, setOfflineEntries] = useState(listOfflineMediaEntriesV1);
  const [preferences, setPreferences] = useState<MobileDownloadPreferencesV1>(getMobileDownloadPreferencesV1);

  useEffect(() => subscribeMobileDownloadRepositoryV1((snapshot) => {
    setJobs(snapshot.jobs);
    setAssets(snapshot.assets);
    setOfflineEntries(snapshot.offlineEntries);
  }), []);

  useEffect(() => subscribeMobileDownloadPreferencesV1(setPreferences), []);

  const activeCount = useMemo(() => jobs.filter((job) => ACTIVE_STATES.has(job.state)).length, [jobs]);
  const completedTitleCount = useMemo(() => new Set(offlineEntries.map((entry) => entry.groupKey)).size, [offlineEntries]);
  const storedBytes = useMemo(
    () => assets.reduce((total, asset) => total + Math.max(0, asset.verifiedSizeBytes || 0), 0),
    [assets],
  );
  const destinationLabel = preferences.defaultDestination === 'device-storage' && preferences.deviceStorageTarget
    ? preferences.deviceStorageTarget.displayName
    : 'Orion Library';

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
        subtitle="Keep verified movies and episodes ready inside Orion."
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, isTablet && styles.contentTablet]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.summaryIcon, { backgroundColor: theme.accentSoft }]}>
              <Ionicons name="download-outline" size={19} color={theme.accent} />
            </View>
            <Text style={[styles.summaryValue, { color: theme.text }]}>{activeCount}</Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Active</Text>
          </View>

          <View style={[styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.summaryIcon, { backgroundColor: theme.accentSoft }]}>
              <Ionicons name="checkmark-circle-outline" size={19} color={theme.accent} />
            </View>
            <Text style={[styles.summaryValue, { color: theme.text }]}>{completedTitleCount}</Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Completed</Text>
          </View>

          <View style={[styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.summaryIcon, { backgroundColor: theme.accentSoft }]}>
              <Ionicons name="server-outline" size={19} color={theme.accent} />
            </View>
            <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.summaryStoredValue, { color: theme.text }]}>{formatStoredSize(storedBytes)}</Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Stored</Text>
          </View>
        </View>

        <View style={[styles.destinationCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.destinationIcon, { backgroundColor: theme.surfaceHover, borderColor: theme.border }]}>
            <Ionicons
              name="albums-outline"
              size={21}
              color={theme.accent}
            />
          </View>
          <View style={styles.destinationCopy}>
            <Text style={[styles.sectionEyebrow, { color: theme.textMuted }]}>DEFAULT LOCATION</Text>
            <Text style={[styles.destinationTitle, { color: theme.text }]}>{destinationLabel}</Text>
            <Text style={[styles.body, { color: theme.textSecondary }]}>Quality: {preferences.preferredQuality === 'best' ? 'Best available' : preferences.preferredQuality}</Text>
            <Text style={[styles.destinationNote, { color: theme.textMuted }]}>Orion Library keeps managed offline media. Device Storage creates a verified portable MP4 when the selected stream can be finalized safely.</Text>
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
            <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>Choose a movie or episode to see its download options. Completed media stays organized by title.</Text>

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
          <DownloadActivityList jobs={jobs} assets={assets} offlineEntries={offlineEntries} />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing[5], paddingBottom: 72, gap: spacing[4] },
  contentTablet: { maxWidth: 980, width: '100%', alignSelf: 'center' },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  summaryCard: { flexGrow: 1, flexBasis: 104, minWidth: 96, minHeight: 90, borderWidth: 1, borderRadius: radii.xl, padding: spacing[3], justifyContent: 'center' },
  summaryIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[2] },
  summaryValue: { fontSize: 21, fontWeight: '900' },
  summaryStoredValue: { fontSize: 18, fontWeight: '900' },
  summaryLabel: { fontSize: fontSizes.xs, fontWeight: '700', marginTop: 2 },
  destinationCard: { minHeight: 86, borderWidth: 1, borderRadius: radii.xl, padding: spacing[3], flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  destinationIcon: { width: 42, height: 42, borderRadius: radii.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  destinationCopy: { flex: 1, minWidth: 0 },
  sectionEyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  destinationTitle: { fontSize: fontSizes.md, fontWeight: '900', marginTop: 3 },
  body: { fontSize: fontSizes.xs, lineHeight: 18, marginTop: 3 },
  destinationNote: { fontSize: 10, lineHeight: 15, marginTop: 2 },
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
