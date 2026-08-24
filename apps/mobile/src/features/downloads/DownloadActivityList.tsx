import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontSizes, radii, spacing } from '@orion/shared/tokens';
import type { MobileDownloadJobV1, OfflineMediaEntryV1 } from '@orion/shared/types';
import { useOrionTheme } from '../../context/ThemeContext';
import { cancelNativeDownloadJobV1, pauseNativeDownloadJobV1, resumeNativeDownloadJobV1, retryNativeDownloadJobV1 } from './nativeDownloadEngine';

interface DownloadActivityListProps {
  jobs: MobileDownloadJobV1[];
  offlineEntries: OfflineMediaEntryV1[];
}

const STATE_LABELS: Record<MobileDownloadJobV1['state'], string> = {
  queued: 'Queued', preflighting: 'Preparing', downloading: 'Downloading', paused: 'Paused', recovering: 'Recovering',
  verifying: 'Verifying', finalizing: 'Finalizing', completed: 'Completed', failed: 'Needs retry', unsupported: 'Unsupported',
  protected: 'Protected source', expired: 'Source expired', cancelled: 'Cancelled', 'storage-blocked': 'Storage needed', 'action-required': 'Action needed',
};

function displayTitle(job: MobileDownloadJobV1): string {
  if (job.media.mediaType === 'tv' && job.media.season !== null && job.media.episode !== null) {
    return `${job.media.seriesTitle || job.media.title} · S${job.media.season} E${job.media.episode}`;
  }
  return job.media.title;
}

function progressDetail(job: MobileDownloadJobV1): string {
  const { progress } = job;
  if (progress.completedFragments !== null && progress.totalFragments !== null) return `${progress.completedFragments} of ${progress.totalFragments} fragments`;
  if (progress.bytesDownloaded > 0) return `${Math.round(progress.bytesDownloaded / 1048576)} MB downloaded`;
  return STATE_LABELS[job.state];
}

export function DownloadActivityList({ jobs, offlineEntries }: DownloadActivityListProps) {
  const { theme } = useOrionTheme();
  const [busyJob, setBusyJob] = useState<string | null>(null);
  const operationalJobs = useMemo(() => jobs.filter((job) => job.state !== 'completed' && job.state !== 'cancelled'), [jobs]);

  const runAsync = async (jobId: string, action: () => Promise<void>) => {
    if (busyJob) return;
    setBusyJob(jobId);
    try { await action(); } finally { setBusyJob(null); }
  };

  return (
    <View style={styles.root}>
      {operationalJobs.length ? <Text accessibilityRole="header" style={[styles.sectionTitle, { color: theme.text }]}>Download activity</Text> : null}
      {operationalJobs.map((job) => {
        const percent = job.progress.percent === null ? null : Math.max(0, Math.min(99, Math.round(job.progress.percent)));
        const warning = ['recovering', 'failed', 'storage-blocked', 'action-required', 'expired'].includes(job.state);
        const tone = warning ? theme.warning : job.state === 'paused' ? theme.textMuted : theme.accent;
        const canPause = job.state === 'downloading' || job.state === 'recovering';
        const canResume = job.state === 'paused';
        const canRetry = ['failed', 'storage-blocked', 'action-required', 'expired'].includes(job.state) && job.failure?.retryable;
        return (
          <View key={job.jobId} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.row}>
              <View style={[styles.iconBox, { backgroundColor: theme.surfaceHover }]}><Ionicons name={job.state === 'paused' ? 'pause' : warning ? 'alert-circle-outline' : 'download-outline'} size={20} color={tone} /></View>
              <View style={styles.copy}>
                <Text numberOfLines={2} style={[styles.title, { color: theme.text }]}>{displayTitle(job)}</Text>
                <Text style={[styles.meta, { color: tone }]}>{STATE_LABELS[job.state]}{percent !== null ? ` · ${percent}%` : ''}</Text>
                <Text style={[styles.detail, { color: theme.textSecondary }]}>{job.failure?.message || progressDetail(job)}</Text>
              </View>
            </View>
            {percent !== null ? <View style={[styles.track, { backgroundColor: theme.surfaceHover }]}><View style={[styles.fill, { backgroundColor: tone, width: `${percent}%` as `${number}%` }]} /></View> : null}
            <View style={styles.actions}>
              {canPause ? <ActionButton label="Pause" icon="pause" disabled={busyJob === job.jobId} onPress={() => pauseNativeDownloadJobV1(job.jobId)} /> : null}
              {canResume ? <ActionButton label="Resume" icon="play" disabled={busyJob === job.jobId} onPress={() => runAsync(job.jobId, () => resumeNativeDownloadJobV1(job.jobId))} /> : null}
              {canRetry ? <ActionButton label="Retry" icon="refresh" disabled={busyJob === job.jobId} onPress={() => runAsync(job.jobId, () => retryNativeDownloadJobV1(job.jobId))} /> : null}
              <ActionButton label="Cancel" icon="close" disabled={busyJob === job.jobId} onPress={() => cancelNativeDownloadJobV1(job.jobId)} />
            </View>
          </View>
        );
      })}

      {offlineEntries.length ? <Text accessibilityRole="header" style={[styles.sectionTitle, { color: theme.text }]}>Offline Library</Text> : null}
      {offlineEntries.map((entry) => (
        <View key={entry.entryId} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: theme.surfaceHover }]}><Ionicons name="checkmark-circle" size={21} color={theme.success} /></View>
            <View style={styles.copy}>
              <Text numberOfLines={2} style={[styles.title, { color: theme.text }]}>{entry.media.mediaType === 'tv' && entry.media.season !== null && entry.media.episode !== null ? `${entry.seriesTitle || entry.title} · S${entry.media.season} E${entry.media.episode}` : entry.title}</Text>
              {entry.episodeTitle ? <Text numberOfLines={1} style={[styles.detail, { color: theme.textSecondary }]}>{entry.episodeTitle}</Text> : null}
              <Text style={[styles.meta, { color: theme.success }]}>Verified · Stored in Orion Library</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );

  function ActionButton({ label, icon, disabled, onPress }: { label: string; icon: React.ComponentProps<typeof Ionicons>['name']; disabled?: boolean; onPress: () => void }) {
    return <Pressable accessibilityRole="button" accessibilityLabel={`${label} download`} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.action, { borderColor: theme.border, backgroundColor: pressed ? theme.surfaceHover : theme.elevated, opacity: disabled ? 0.55 : 1 }]}><Ionicons name={icon} size={15} color={theme.textSecondary} /><Text style={[styles.actionText, { color: theme.textSecondary }]}>{label}</Text></Pressable>;
  }
}

const styles = StyleSheet.create({
  root: { gap: spacing[3] }, sectionTitle: { fontSize: fontSizes.md, fontWeight: '900', marginTop: spacing[1] },
  card: { borderWidth: 1, borderRadius: radii['2xl'], padding: spacing[4], gap: spacing[3] }, row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  iconBox: { width: 42, height: 42, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center' }, copy: { flex: 1, minWidth: 0 },
  title: { fontSize: fontSizes.sm, fontWeight: '900', lineHeight: 20 }, meta: { fontSize: fontSizes.xs, fontWeight: '800', marginTop: 3 }, detail: { fontSize: fontSizes.xs, lineHeight: 17, marginTop: 3 },
  track: { height: 5, borderRadius: radii.full, overflow: 'hidden' }, fill: { height: '100%', borderRadius: radii.full },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }, action: { minHeight: 38, borderWidth: 1, borderRadius: radii.full, paddingHorizontal: spacing[3], flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }, actionText: { fontSize: fontSizes.xs, fontWeight: '800' },
});
