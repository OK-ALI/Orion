import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { spacing, radii, fontSizes } from '@orion/shared/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useIsFocused, useRouter } from 'expo-router';
import type { MobileDownloadPreferencesV1 } from '@orion/shared/types';
import { useOrionTheme } from '../../src/context/ThemeContext';
import { useResponsiveLayout } from '../../src/services/responsive';
import { MobilePageHeader } from '../../src/components/MobilePageHeader';
import { getMobileDownloadCapability } from '../../src/services/downloadManager';
import { DownloadActivityList } from '../../src/features/downloads/DownloadActivityList';
import { DownloadManagementSheet } from '../../src/features/downloads/DownloadManagementSheet';
import {
  deriveMobileDownloadLibrarySummaryV1,
  listMobileDownloadAssetsV1,
  listMobileDownloadJobsV1,
  listOfflineMediaEntriesV1,
  subscribeMobileDownloadRepositoryV1,
} from '../../src/features/downloads/downloadRepository';
import { reconcileNativeDownloadsV1 } from '../../src/features/downloads/nativeDownloadEngine';
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
  const isFocused = useIsFocused();
  const { theme } = useOrionTheme();
  const { isTablet } = useResponsiveLayout();
  const capability = getMobileDownloadCapability();
  const [jobs, setJobs] = useState(listMobileDownloadJobsV1);
  const [assets, setAssets] = useState(listMobileDownloadAssetsV1);
  const [offlineEntries, setOfflineEntries] = useState(listOfflineMediaEntriesV1);
  const [preferences, setPreferences] = useState<MobileDownloadPreferencesV1>(getMobileDownloadPreferencesV1);
  const [management, setManagement] = useState<{ mode: 'manage' | 'free-space'; assetIds: string[] } | null>(null);

  useEffect(() => subscribeMobileDownloadRepositoryV1((snapshot) => {
    setJobs(snapshot.jobs);
    setAssets(snapshot.assets);
    setOfflineEntries(snapshot.offlineEntries);
  }), []);

  useEffect(() => subscribeMobileDownloadPreferencesV1(setPreferences), []);

  useFocusEffect(useCallback(() => {
    void reconcileNativeDownloadsV1();
    return undefined;
  }, []));

  const activeCount = useMemo(() => jobs.filter((job) => ACTIVE_STATES.has(job.state)).length, [jobs]);
  const librarySummary = useMemo(() => deriveMobileDownloadLibrarySummaryV1(assets, offlineEntries), [assets, offlineEntries]);
  const destinationLabel = 'Orion Library';

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
        subtitle="Keep verified movies and episodes ready."
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
            <Text style={[styles.summaryValue, { color: theme.text }]}>{librarySummary.completedTitleCount}</Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Completed</Text>
          </View>

          <View style={[styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.summaryIcon, { backgroundColor: theme.accentSoft }]}>
              <Ionicons name="server-outline" size={19} color={theme.accent} />
            </View>
            <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.summaryStoredValue, { color: theme.text }]}>{formatStoredSize(librarySummary.storedBytes)}</Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Stored</Text>
          </View>
        </View>

        {assets.length ? (
          <View style={styles.managementRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="Manage completed downloads" onPress={() => setManagement({ mode: 'manage', assetIds: [] })} style={({ pressed }) => [styles.managementButton, { borderColor: theme.border, backgroundColor: pressed ? theme.surfaceHover : theme.surface }]}>
              <Ionicons name="checkbox-outline" size={18} color={theme.textSecondary} />
              <Text style={[styles.managementText, { color: theme.textSecondary }]}>Manage</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Free up download storage" onPress={() => setManagement({ mode: 'free-space', assetIds: [] })} style={({ pressed }) => [styles.managementButton, { borderColor: theme.border, backgroundColor: pressed ? theme.surfaceHover : theme.surface }]}>
              <Ionicons name="server-outline" size={18} color={theme.textSecondary} />
              <Text style={[styles.managementText, { color: theme.textSecondary }]}>Free Up Space</Text>
            </Pressable>
            {librarySummary.needsAttentionCount ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`Needs attention, ${librarySummary.needsAttentionCount}`} onPress={() => setManagement({ mode: 'manage', assetIds: assets.filter((asset) => asset.availability === 'missing' || asset.availability === 'unavailable').map((asset) => asset.assetId) })} style={({ pressed }) => [styles.managementButton, { borderColor: theme.warning, backgroundColor: pressed ? theme.surfaceHover : theme.surface }]}>
                <Ionicons name="warning-outline" size={18} color={theme.warning} />
                <Text style={[styles.managementText, { color: theme.warning }]}>Needs attention · {librarySummary.needsAttentionCount}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

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
            <Text style={[styles.body, { color: theme.textSecondary }]}>Quality · {preferences.preferredQuality === 'best' ? 'Best available' : preferences.preferredQuality}</Text>
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
          <DownloadActivityList
            jobs={jobs}
            assets={assets}
            offlineEntries={offlineEntries}
            active={isFocused}
            onManageAssets={(assetIds) => setManagement({ mode: 'manage', assetIds: [...assetIds] })}
            onPlayOffline={(entry, assetId) => router.push({
              pathname: '/player/[id]',
              params: {
                id: String(entry.media.id),
                type: entry.media.mediaType,
                title: entry.media.episodeTitle || entry.media.title,
                year: entry.media.year ?? undefined,
                seriesTitle: entry.media.seriesTitle || undefined,
                season: entry.media.season ?? undefined,
                episode: entry.media.episode ?? undefined,
                episodeTitle: entry.media.episodeTitle || undefined,
                posterPath: entry.posterPath || entry.media.posterPath || undefined,
                backdropPath: entry.backdropPath || entry.media.backdropPath || undefined,
                isOffline: 'true',
                offlineAssetId: assetId,
              },
            })}
          />
        )}
      </ScrollView>

      <DownloadManagementSheet
        visible={management !== null}
        mode={management?.mode || 'manage'}
        assets={assets}
        initialAssetIds={management?.assetIds || []}
        onClose={() => setManagement(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing[5], paddingBottom: 72, gap: spacing[4] },
  contentTablet: { maxWidth: 980, width: '100%', alignSelf: 'center' },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  summaryCard: { flexGrow: 1, flexBasis: 92, minWidth: 88, minHeight: 72, borderWidth: 1, borderRadius: radii.xl, paddingHorizontal: spacing[3], paddingVertical: spacing[2], justifyContent: 'center' },
  summaryIcon: { width: 27, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  summaryValue: { fontSize: 19, fontWeight: '900' },
  summaryStoredValue: { fontSize: 16, fontWeight: '900' },
  summaryLabel: { fontSize: fontSizes.xs, fontWeight: '700', marginTop: 2 },
  destinationCard: { minHeight: 68, borderWidth: 1, borderRadius: radii.xl, paddingHorizontal: spacing[3], paddingVertical: spacing[2], flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  destinationIcon: { width: 36, height: 36, borderRadius: radii.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  destinationCopy: { flex: 1, minWidth: 0 },
  sectionEyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  destinationTitle: { fontSize: fontSizes.md, fontWeight: '900', marginTop: 3 },
  body: { fontSize: fontSizes.xs, lineHeight: 18, marginTop: 3 },
  iconButton: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  managementRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  managementButton: { minHeight: 48, borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: spacing[3], flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  managementText: { fontSize: fontSizes.xs, fontWeight: '900' },
  emptyCard: { borderWidth: 1, borderRadius: radii['2xl'], padding: spacing[6], alignItems: 'center' },
  emptyIcon: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[4] },
  emptyTitle: { fontSize: 20, fontWeight: '900', textAlign: 'center' },
  emptyBody: { maxWidth: 520, fontSize: fontSizes.sm, lineHeight: 21, textAlign: 'center', marginTop: spacing[2] },
  statusRow: { width: '100%', borderWidth: 1, borderRadius: radii.lg, padding: spacing[3], marginTop: spacing[4], flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  statusText: { fontSize: fontSizes.xs, fontWeight: '700', textAlign: 'center' },
  primaryButton: { minHeight: 48, width: '100%', borderRadius: radii.xl, paddingHorizontal: spacing[4], marginTop: spacing[4], flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  primaryButtonText: { fontSize: fontSizes.sm, fontWeight: '900' },
});
