import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontSizes, radii, spacing } from '@orion/shared/tokens';
import { imgUrl } from '@orion/shared/api';
import type { MobileDownloadAssetV1, MobileDownloadJobV1, OfflineMediaEntryV1 } from '@orion/shared/types';
import { useOrionTheme } from '../../context/ThemeContext';
import { createMobileDownloadProgressSnapshotV1 } from './contracts';
import { downloadElapsedSecondsV1 } from './downloadTelemetry';
import { cancelNativeDownloadJobV1, pauseNativeDownloadJobV1, resumeNativeDownloadJobV1, retryNativeDownloadJobV1 } from './nativeDownloadEngine';

interface DownloadActivityListProps {
  jobs: MobileDownloadJobV1[];
  assets: MobileDownloadAssetV1[];
  offlineEntries: OfflineMediaEntryV1[];
  active?: boolean;
  onManageAssets?: (assetIds: readonly string[]) => void;
  onPlayInOrion?: (entry: OfflineMediaEntryV1, assetId: string) => void;
  onPlayLocally?: (assetId: string) => void;
}

type DownloadTab = 'all' | 'active' | 'completed' | 'attention' | 'failed';
type DownloadMediaFilter = 'all' | 'movies' | 'series';
type DownloadSort = 'newest' | 'oldest' | 'name' | 'progress' | 'size';

const ACTIVE_STATES = new Set<MobileDownloadJobV1['state']>([
  'queued', 'preflighting', 'downloading', 'paused', 'recovering', 'verifying', 'finalizing',
]);
const FAILED_STATES = new Set<MobileDownloadJobV1['state']>([
  'failed', 'unsupported', 'protected', 'expired', 'storage-blocked', 'action-required',
]);

const TABS: ReadonlyArray<{ id: DownloadTab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' },
  { id: 'attention', label: 'Needs attention' },
  { id: 'failed', label: 'Failed' },
];
const FILTERS: ReadonlyArray<{ id: DownloadMediaFilter; label: string }> = [
  { id: 'all', label: 'All media' },
  { id: 'movies', label: 'Movies' },
  { id: 'series', label: 'Series' },
];
const SORTS: ReadonlyArray<{ id: DownloadSort; label: string }> = [
  { id: 'newest', label: 'Newest' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'name', label: 'A–Z' },
  { id: 'progress', label: 'Progress' },
  { id: 'size', label: 'Largest' },
];

function sortOptionsForTab(tab: DownloadTab): ReadonlyArray<{ id: DownloadSort; label: string }> {
  if (tab === 'active' || tab === 'failed') return SORTS;
  return SORTS.filter((item) => item.id !== 'progress');
}

function formatBytes(value: number | null): string | null {
  if (value === null || !Number.isFinite(value) || value < 0) return null;
  if (value < 1024) return `${Math.round(value)} B`;
  const kib = value / 1024;
  if (kib < 1024) return `${kib.toFixed(kib >= 100 ? 0 : 1)} KB`;
  const mib = kib / 1024;
  if (mib < 1024) return `${mib.toFixed(mib >= 100 ? 0 : 1)} MB`;
  const gib = mib / 1024;
  return `${gib.toFixed(gib >= 10 ? 1 : 2)} GB`;
}

function formatDurationSeconds(value: number | null): string | null {
  if (value === null || !Number.isFinite(value) || value < 0) return null;
  const seconds = Math.max(0, Math.round(value));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export function downloadElapsedTextV1(job: MobileDownloadJobV1, nowMs: number): string | null {
  return formatDurationSeconds(downloadElapsedSecondsV1(job, nowMs));
}

function finalizationStageLabel(stage: ReturnType<typeof createMobileDownloadProgressSnapshotV1>['finalizationStage']): string {
  switch (stage) {
    case 'preparing': return 'Preparing offline video';
    case 'remuxing': return 'Preparing offline video';
    case 'verifying-output': return 'Checking saved video';
    case 'publishing-media': return 'Saving to Orion Library';
    case 'confirming-publication': return 'Confirming saved video';
    case 'publishing-subtitles': return 'Saving subtitles';
    default: return 'Finishing download';
  }
}


interface DownloadFailurePresentation {
  detail: string | null;
  retryLabel: string;
}

function downloadFailurePresentation(job: MobileDownloadJobV1): DownloadFailurePresentation {
  const code = job.failure?.code || '';

  if (job.state === 'recovering') {
    return {
      detail: 'The connection was interrupted. Orion will retry automatically when it can continue.',
      retryLabel: 'Retry now',
    };
  }

  if (job.state === 'storage-blocked' || code === 'storage-insufficient' || code === 'storage-destination-insufficient') {
    return {
      detail: 'Free up space on this device or in the selected Orion Library location, then retry.',
      retryLabel: 'Retry',
    };
  }

  if (code === 'request-context-refresh-required' || code === 'request-context-rejected') {
    return {
      detail: 'Open this title and start playback again to refresh its download source. Then return here and retry.',
      retryLabel: 'Retry after refresh',
    };
  }

  if (
    code === 'storage-destination-unavailable' ||
    code === 'finalized-artifact-document-unavailable' ||
    code === 'finalized-artifact-descriptor-unavailable'
  ) {
    return {
      detail: 'Choose the Orion Library folder again in Download settings, then retry.',
      retryLabel: 'Retry after folder',
    };
  }

  if (code.includes('integrity') || code.includes('verification') || code.includes('digest-mismatch') || code.includes('proof-mismatch')) {
    return {
      detail: job.failure?.retryable
        ? 'The downloaded media did not pass Orion’s safety check. Retry the download.'
        : 'The downloaded media could not be verified. Try another source for this title.',
      retryLabel: 'Retry',
    };
  }

  if (job.state === 'unsupported') {
    return { detail: 'This source cannot be saved for offline viewing. Try another source.', retryLabel: 'Retry' };
  }

  if (job.state === 'protected') {
    return { detail: 'This protected source cannot be saved for offline viewing. Try another source.', retryLabel: 'Retry' };
  }

  if (job.state === 'expired') {
    return {
      detail: 'Open this title and start playback again to refresh its download source.',
      retryLabel: 'Retry after refresh',
    };
  }

  if (job.state === 'action-required') {
    return {
      detail: 'Orion needs one step from you before this download can continue.',
      retryLabel: 'Retry',
    };
  }

  if (job.state === 'failed') {
    return {
      detail: job.failure?.retryable
        ? 'This download was interrupted. Retry to continue.'
        : 'This download could not finish. Try another source if one is available.',
      retryLabel: 'Retry',
    };
  }

  return { detail: null, retryLabel: 'Retry' };
}

function mediaPrimaryTitle(media: MobileDownloadJobV1['media']): string {
  return media.mediaType === 'tv' ? media.seriesTitle || media.title : media.title;
}

function mediaSecondaryTitle(media: MobileDownloadJobV1['media']): string | null {
  if (media.mediaType === 'tv' && media.season !== null && media.episode !== null) {
    const episode = `S${media.season} E${media.episode}`;
    return media.episodeTitle ? `${episode} · ${media.episodeTitle}` : episode;
  }
  return media.year ? String(media.year) : null;
}

function mediaMatchesFilter(media: MobileDownloadJobV1['media'], filter: DownloadMediaFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'movies') return media.libraryKind === 'movie';
  return media.libraryKind === 'series' || media.libraryKind === 'anime';
}

function mediaMatchesQuery(media: MobileDownloadJobV1['media'], query: string): boolean {
  if (!query) return true;
  const haystack = [
    media.title,
    media.seriesTitle,
    media.episodeTitle,
    media.year,
    media.season,
    media.episode,
  ].filter((value) => value !== null && value !== undefined).join(' ').toLowerCase();
  return haystack.includes(query);
}

function entrySize(entry: OfflineMediaEntryV1, assetById: Map<string, MobileDownloadAssetV1>): number {
  return entry.assetIds.reduce((total, assetId) => total + (assetById.get(assetId)?.verifiedSizeBytes || 0), 0);
}

function verifiedOrionLibraryAssetId(
  entry: OfflineMediaEntryV1,
  assetById: Map<string, MobileDownloadAssetV1>,
): string | null {
  const primary = assetById.get(entry.primaryAssetId);
  if (primary?.destination === 'orion-library' && primary.availability === 'verified') return primary.assetId;
  for (const assetId of entry.assetIds) {
    const asset = assetById.get(assetId);
    if (asset?.destination === 'orion-library' && asset.availability === 'verified') return asset.assetId;
  }
  return null;
}

function assetLocationLabel(asset: MobileDownloadAssetV1 | undefined): string {
  if (!asset) return 'Orion Library';
  if (asset.destination === 'device-storage') return 'On device';
  return asset.storageTarget.mode === 'user-folder'
    ? `Orion Library · ${asset.storageTarget.displayName}`
    : 'Orion Library';
}

function jobSortValue(job: MobileDownloadJobV1, sort: DownloadSort): number | string {
  if (sort === 'oldest') return job.createdAt;
  if (sort === 'name') return mediaPrimaryTitle(job.media).toLocaleLowerCase();
  if (sort === 'progress') return createMobileDownloadProgressSnapshotV1(job).percent ?? -1;
  if (sort === 'size') return job.progress.totalBytes ?? job.progress.bytesDownloaded;
  return job.updatedAt;
}

function sortJobs(jobs: MobileDownloadJobV1[], sort: DownloadSort): MobileDownloadJobV1[] {
  return [...jobs].sort((a, b) => {
    const left = jobSortValue(a, sort);
    const right = jobSortValue(b, sort);
    if (typeof left === 'string' && typeof right === 'string') return left.localeCompare(right);
    if (sort === 'oldest') return Number(left) - Number(right);
    return Number(right) - Number(left);
  });
}

interface CompletedGroup {
  groupKey: string;
  entries: OfflineMediaEntryV1[];
  representative: OfflineMediaEntryV1;
  sizeBytes: number;
  updatedAt: number;
}

function buildCompletedGroups(entries: OfflineMediaEntryV1[], assetById: Map<string, MobileDownloadAssetV1>): CompletedGroup[] {
  const groups = new Map<string, OfflineMediaEntryV1[]>();
  for (const entry of entries) groups.set(entry.groupKey, [...(groups.get(entry.groupKey) || []), entry]);
  return [...groups.entries()].map(([groupKey, grouped]) => {
    const sorted = [...grouped].sort((a, b) => b.updatedAt - a.updatedAt);
    return {
      groupKey,
      entries: sorted,
      representative: sorted[0],
      sizeBytes: sorted.reduce((total, entry) => total + entrySize(entry, assetById), 0),
      updatedAt: sorted[0].updatedAt,
    };
  });
}

function sortGroups(groups: CompletedGroup[], sort: DownloadSort): CompletedGroup[] {
  return [...groups].sort((a, b) => {
    if (sort === 'oldest') return a.updatedAt - b.updatedAt;
    if (sort === 'name') return mediaPrimaryTitle(a.representative.media).localeCompare(mediaPrimaryTitle(b.representative.media));
    if (sort === 'size') return b.sizeBytes - a.sizeBytes;
    return b.updatedAt - a.updatedAt;
  });
}

interface CompletedSeasonGroup {
  season: number | null;
  entries: OfflineMediaEntryV1[];
  sizeBytes: number;
}

function buildCompletedSeasonGroups(
  entries: OfflineMediaEntryV1[],
  assetById: Map<string, MobileDownloadAssetV1>,
): CompletedSeasonGroup[] {
  const groups = new Map<string, OfflineMediaEntryV1[]>();
  for (const entry of entries) {
    const key = entry.media.season === null ? 'unknown' : String(entry.media.season);
    groups.set(key, [...(groups.get(key) || []), entry]);
  }
  return [...groups.values()]
    .map((grouped) => ({
      season: grouped[0]?.media.season ?? null,
      entries: [...grouped].sort((a, b) => (a.media.episode ?? 0) - (b.media.episode ?? 0)),
      sizeBytes: grouped.reduce((total, entry) => total + entrySize(entry, assetById), 0),
    }))
    .sort((a, b) => {
      if (a.season === null) return 1;
      if (b.season === null) return -1;
      return a.season - b.season;
    });
}

function seasonDisplayTitle(season: number | null): string {
  if (season === 0) return 'Specials';
  if (season === null) return 'Episodes';
  return `Season ${season}`;
}

export function DownloadActivityList({ jobs, assets, offlineEntries, active = true, onManageAssets, onPlayInOrion, onPlayLocally }: DownloadActivityListProps) {
  const { theme } = useOrionTheme();
  const [busyJob, setBusyJob] = useState<string | null>(null);
  const [tab, setTab] = useState<DownloadTab>('all');
  const [mediaFilter, setMediaFilter] = useState<DownloadMediaFilter>('all');
  const [sort, setSort] = useState<DownloadSort>('newest');
  const [query, setQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());
  const [nowMs, setNowMs] = useState(Date.now());

  const hasFinalizingWork = jobs.some((job) => job.state === 'finalizing');
  useEffect(() => {
    if (!active || !hasFinalizingWork) return undefined;
    setNowMs(Date.now());
    const timer = setInterval(() => setNowMs(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [active, hasFinalizingWork]);

  const assetById = useMemo(() => new Map(assets.map((asset) => [asset.assetId, asset])), [assets]);
  const normalizedQuery = query.trim().toLowerCase();
  const operationalJobs = useMemo(() => jobs.filter((job) => job.state !== 'completed' && job.state !== 'cancelled'), [jobs]);
  const activeJobs = useMemo(() => operationalJobs.filter((job) => ACTIVE_STATES.has(job.state)), [operationalJobs]);
  const failedJobs = useMemo(() => operationalJobs.filter((job) => FAILED_STATES.has(job.state)), [operationalJobs]);
  const verifiedEntries = useMemo(() => offlineEntries.filter((entry) => entry.assetIds.some((assetId) => assetById.get(assetId)?.availability === 'verified')), [assetById, offlineEntries]);
  const attentionAssets = useMemo(() => assets.filter((asset) => asset.availability === 'missing' || asset.availability === 'unavailable'), [assets]);
  const completedGroups = useMemo(() => buildCompletedGroups(verifiedEntries, assetById), [assetById, verifiedEntries]);

  const visibleAttentionAssets = useMemo(() => {
    if (tab !== 'all' && tab !== 'attention') return [];
    return attentionAssets.filter((asset) => (
      mediaMatchesFilter(asset.media, mediaFilter)
      && mediaMatchesQuery(asset.media, normalizedQuery)
    ));
  }, [attentionAssets, mediaFilter, normalizedQuery, tab]);

  const visibleJobs = useMemo(() => {
    const source = tab === 'active' ? activeJobs : tab === 'failed' ? failedJobs : tab === 'completed' || tab === 'attention' ? [] : operationalJobs;
    return sortJobs(source.filter((job) => mediaMatchesFilter(job.media, mediaFilter) && mediaMatchesQuery(job.media, normalizedQuery)), sort);
  }, [activeJobs, failedJobs, mediaFilter, normalizedQuery, operationalJobs, sort, tab]);

  const visibleGroups = useMemo(() => {
    if (tab === 'active' || tab === 'failed' || tab === 'attention') return [];
    return sortGroups(completedGroups.filter((group) => (
      mediaMatchesFilter(group.representative.media, mediaFilter)
      && group.entries.some((entry) => mediaMatchesQuery(entry.media, normalizedQuery))
    )), sort);
  }, [completedGroups, mediaFilter, normalizedQuery, sort, tab]);

  const counts: Record<DownloadTab, number> = {
    all: operationalJobs.length + completedGroups.length + attentionAssets.length,
    active: activeJobs.length,
    completed: completedGroups.length,
    attention: attentionAssets.length,
    failed: failedJobs.length,
  };

  const sortOptions = sortOptionsForTab(tab);
  const selectedFilterLabel = FILTERS.find((item) => item.id === mediaFilter)?.label || 'All media';
  const selectedSortLabel = sortOptions.find((item) => item.id === sort)?.label || 'Newest';

  const runAsync = async (jobId: string, action: () => Promise<void>) => {
    if (busyJob) return;
    setBusyJob(jobId);
    try { await action(); } finally { setBusyJob(null); }
  };

  const cycleFilter = () => {
    const index = FILTERS.findIndex((item) => item.id === mediaFilter);
    setMediaFilter(FILTERS[(index + 1) % FILTERS.length].id);
  };
  const cycleSort = () => {
    const index = sortOptions.findIndex((item) => item.id === sort);
    setSort(sortOptions[(index + 1 + sortOptions.length) % sortOptions.length].id);
  };
  const selectTab = (nextTab: DownloadTab) => {
    setTab(nextTab);
    if (sort === 'progress' && nextTab !== 'active' && nextTab !== 'failed') setSort('newest');
  };
  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupKey)) next.delete(groupKey); else next.add(groupKey);
      return next;
    });
  };

  return (
    <View style={styles.root}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {TABS.map((item) => {
          const selected = tab === item.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityLabel={`${item.label} downloads, ${counts[item.id]}`}
              accessibilityState={{ selected }}
              onPress={() => selectTab(item.id)}
              style={({ pressed }) => [
                styles.tab,
                { backgroundColor: selected ? theme.accentSoft : pressed ? theme.surfaceHover : theme.elevated, borderColor: selected ? theme.accent : theme.border },
              ]}
            >
              <Text numberOfLines={1} style={[styles.tabText, { color: selected ? theme.accent : theme.textSecondary }]}>{item.label}</Text>
              <View style={[styles.countBadge, { backgroundColor: selected ? theme.accent : theme.surfaceHover }]}>
                <Text style={[styles.countText, { color: selected ? theme.onAccent : theme.textMuted }]}>{counts[item.id]}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={[styles.searchBox, { backgroundColor: theme.input, borderColor: theme.border }]}>
        <Ionicons name="search-outline" size={18} color={theme.textMuted} />
        <TextInput
          accessibilityLabel="Search downloads"
          value={query}
          onChangeText={setQuery}
          placeholder="Search downloads"
          placeholderTextColor={theme.textMuted}
          style={[styles.searchInput, { color: theme.text }]}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear download search" onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={theme.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.controlRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Media filter: ${selectedFilterLabel}. Tap for next filter.`} onPress={cycleFilter} style={({ pressed }) => [styles.control, { backgroundColor: pressed ? theme.surfaceHover : theme.elevated, borderColor: theme.border }]}>
          <Ionicons name="filter-outline" size={15} color={theme.textMuted} />
          <Text numberOfLines={1} style={[styles.controlText, { color: theme.textSecondary }]}>{selectedFilterLabel}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Sort: ${selectedSortLabel}. Tap for next sort.`} onPress={cycleSort} style={({ pressed }) => [styles.control, { backgroundColor: pressed ? theme.surfaceHover : theme.elevated, borderColor: theme.border }]}>
          <Ionicons name="swap-vertical-outline" size={15} color={theme.textMuted} />
          <Text numberOfLines={1} style={[styles.controlText, { color: theme.textSecondary }]}>{selectedSortLabel}</Text>
        </Pressable>
      </ScrollView>

      {visibleJobs.map((job) => {
        const progress = createMobileDownloadProgressSnapshotV1(job);
        const finalizing = job.state === 'finalizing';
        const percent = finalizing || progress.percent === null ? null : Math.max(0, Math.min(99, Math.round(progress.percent)));
        const warning = FAILED_STATES.has(job.state) || job.state === 'recovering';
        const tone = warning ? theme.warning : job.state === 'paused' ? theme.textMuted : theme.accent;
        const canPause = job.state === 'downloading' || job.state === 'recovering';
        const canResume = job.state === 'paused';
        const canRetry = FAILED_STATES.has(job.state) && job.failure?.retryable;
        const failurePresentation = downloadFailurePresentation(job);
        const poster = imgUrl(job.media.posterPath ?? null, 'w342');
        const downloaded = progress.bytesDownloaded > 0 ? formatBytes(progress.bytesDownloaded) : null;
        const total = formatBytes(progress.totalBytes);
        const speed = formatBytes(progress.bytesPerSecond);
        const eta = formatDurationSeconds(progress.etaSeconds);
        const elapsed = downloadElapsedTextV1(job, nowMs);
        const fragmentText = progress.completedFragments !== null && progress.totalFragments !== null
          ? `${progress.completedFragments}/${progress.totalFragments} fragments`
          : null;
        const metrics = finalizing
          ? [
              'Transfer complete · preparing offline video',
              elapsed ? `${elapsed} elapsed` : null,
            ].filter(Boolean)
          : [
              downloaded ? (total ? `${downloaded} / ${total}` : downloaded) : null,
              speed ? `${speed}/s` : null,
              eta ? `${eta} left` : null,
              elapsed ? `${elapsed} elapsed` : null,
              fragmentText,
            ].filter(Boolean);
        const statusLabel = finalizing ? finalizationStageLabel(progress.finalizationStage) : progress.statusLabel;

        return (
          <View key={job.jobId} style={[styles.downloadItem, { borderBottomColor: theme.border }]}>
            <View style={styles.mediaRow}>
              <View style={[styles.posterShell, { backgroundColor: theme.surfaceHover, borderColor: theme.border }]}>
                {poster ? <Image accessible={false} source={{ uri: poster }} style={styles.poster} /> : <Ionicons name={job.media.mediaType === 'movie' ? 'film-outline' : 'tv-outline'} size={24} color={theme.textMuted} />}
              </View>
              <View style={styles.copy}>
                <Text numberOfLines={1} style={[styles.title, { color: theme.text }]}>{mediaPrimaryTitle(job.media)}</Text>
                {mediaSecondaryTitle(job.media) ? <Text numberOfLines={1} style={[styles.secondaryTitle, { color: theme.textSecondary }]}>{mediaSecondaryTitle(job.media)}</Text> : null}
                <Text style={[styles.meta, { color: tone }]}>{statusLabel}{percent !== null ? ` · ${percent}%` : ''}</Text>
                {failurePresentation.detail ? <Text numberOfLines={3} style={[styles.failureText, { color: theme.textSecondary }]}>{failurePresentation.detail}</Text> : null}
                {metrics.length ? <Text numberOfLines={2} style={[styles.metrics, { color: theme.textSecondary }]}>{metrics.join(' · ')}</Text> : null}
              </View>
            </View>

            {percent !== null ? <View style={[styles.track, { backgroundColor: theme.surfaceHover }]}><View style={[styles.fill, { backgroundColor: tone, width: `${percent}%` as `${number}%` }]} /></View> : null}

            <View style={styles.actions}>
              {canPause ? <ActionButton label="Pause" icon="pause" disabled={busyJob === job.jobId} onPress={() => pauseNativeDownloadJobV1(job.jobId)} /> : null}
              {canResume ? <ActionButton label="Resume" icon="play" disabled={busyJob === job.jobId} onPress={() => runAsync(job.jobId, () => resumeNativeDownloadJobV1(job.jobId))} /> : null}
              {canRetry ? <ActionButton label={failurePresentation.retryLabel} icon="refresh" disabled={busyJob === job.jobId} onPress={() => runAsync(job.jobId, () => retryNativeDownloadJobV1(job.jobId))} /> : null}
              <ActionButton label="Cancel" icon="close" disabled={busyJob === job.jobId} onPress={() => cancelNativeDownloadJobV1(job.jobId)} />
            </View>
          </View>
        );
      })}

      {visibleAttentionAssets.map((asset) => {
        const missing = asset.availability === 'missing';
        const poster = imgUrl(asset.media.posterPath ?? null, 'w342');
        return (
          <View key={asset.assetId} style={[styles.downloadItem, styles.attentionItem, { borderBottomColor: theme.border, borderLeftColor: theme.warning }]}>
            <View style={styles.mediaRow}>
              <View style={[styles.posterShell, { backgroundColor: theme.surfaceHover, borderColor: theme.border }]}>
                {poster ? <Image accessible={false} source={{ uri: poster }} style={styles.poster} /> : <Ionicons name={asset.media.mediaType === 'movie' ? 'film-outline' : 'tv-outline'} size={24} color={theme.textMuted} />}
              </View>
              <View style={styles.copy}>
                <Text numberOfLines={2} style={[styles.title, { color: theme.text }]}>{mediaPrimaryTitle(asset.media)}</Text>
                {mediaSecondaryTitle(asset.media) ? <Text numberOfLines={2} style={[styles.secondaryTitle, { color: theme.textSecondary }]}>{mediaSecondaryTitle(asset.media)}</Text> : null}
                <Text style={[styles.meta, { color: theme.warning }]}>{missing ? 'Missing' : 'Unavailable'} · {assetLocationLabel(asset)}</Text>
                <Text style={[styles.metrics, { color: theme.textSecondary }]}>{missing ? 'This saved copy is no longer on the device. Remove its stale record or download it again.' : 'Orion cannot verify this saved copy right now. Reconnect storage or choose the folder again, then refresh.'}</Text>
              </View>
            </View>
            {onManageAssets ? (
              <View style={styles.actions}>
                <ActionButton label={missing ? 'Review download' : 'Storage options'} icon={missing ? 'document-text-outline' : 'folder-open-outline'} onPress={() => onManageAssets([asset.assetId])} />
              </View>
            ) : null}
          </View>
        );
      })}

      {visibleGroups.map((group) => {
        const entry = group.representative;
        const episodic = entry.media.libraryKind !== 'movie';
        const expanded = expandedGroups.has(group.groupKey);
        const poster = imgUrl(entry.posterPath ?? entry.media.posterPath ?? null, 'w342');
        const size = formatBytes(group.sizeBytes);
        const playableAssetId = verifiedOrionLibraryAssetId(entry, assetById);
        const seasonGroups = episodic ? buildCompletedSeasonGroups(group.entries, assetById) : [];
        const seasonCount = seasonGroups.length;
        return (
          <View key={group.groupKey} style={[styles.downloadItem, { borderBottomColor: theme.border }]}>
            <Pressable
              accessibilityRole={episodic ? 'button' : undefined}
              accessibilityLabel={episodic ? `${mediaPrimaryTitle(entry.media)}, ${group.entries.length} downloaded episode${group.entries.length === 1 ? '' : 's'}` : undefined}
              accessibilityHint={episodic ? 'Shows or hides downloaded episodes.' : undefined}
              onPress={episodic ? () => toggleGroup(group.groupKey) : undefined}
              style={({ pressed }) => [styles.mediaRow, episodic && pressed && { opacity: 0.82 }]}
            >
              <View style={[styles.posterShell, { backgroundColor: theme.surfaceHover, borderColor: theme.border }]}>
                {poster ? <Image accessible={false} source={{ uri: poster }} style={styles.poster} /> : <Ionicons name={entry.media.libraryKind === 'movie' ? 'film-outline' : 'tv-outline'} size={24} color={theme.textMuted} />}
              </View>
              <View style={styles.copy}>
                <Text numberOfLines={1} style={[styles.title, { color: theme.text }]}>{mediaPrimaryTitle(entry.media)}</Text>
                <Text numberOfLines={1} style={[styles.secondaryTitle, { color: theme.textSecondary }]}>
                  {episodic
                    ? `${seasonCount} season${seasonCount === 1 ? '' : 's'} · ${group.entries.length} episode${group.entries.length === 1 ? '' : 's'}`
                    : (entry.media.year ? String(entry.media.year) : 'Movie')}
                </Text>
                <Text style={[styles.meta, { color: theme.success }]}>Ready offline</Text>
                {size ? <Text style={[styles.metrics, { color: theme.textSecondary }]}>{episodic ? `${size} total` : size}</Text> : null}
              </View>
              {episodic ? <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={theme.textMuted} /> : <Ionicons name="checkmark-circle" size={20} color={theme.success} />}
            </Pressable>

            {episodic && expanded ? (
              <View style={[styles.episodeList, { borderTopColor: theme.border }]}>
                {seasonGroups.map((seasonGroup) => {
                  const seasonSize = formatBytes(seasonGroup.sizeBytes);
                  return (
                    <View key={`${group.groupKey}:${seasonGroup.season ?? 'unknown'}`} style={styles.seasonGroup}>
                      <View style={styles.seasonHeader}>
                        <Text style={[styles.seasonTitle, { color: theme.text }]}>{seasonDisplayTitle(seasonGroup.season)}</Text>
                        <Text style={[styles.seasonMeta, { color: theme.textSecondary }]}>
                          {seasonGroup.entries.length} episode{seasonGroup.entries.length === 1 ? '' : 's'}{seasonSize ? ` · ${seasonSize}` : ''}
                        </Text>
                      </View>
                      {seasonGroup.entries.map((episode) => {
                        const episodeSize = formatBytes(entrySize(episode, assetById));
                        const episodePlayableAssetId = verifiedOrionLibraryAssetId(episode, assetById);
                        return (
                          <View key={episode.entryId} style={styles.episodeRow}>
                            <View style={[styles.episodeBadge, { backgroundColor: theme.accentSoft }]}>
                              <Text style={[styles.episodeBadgeText, { color: theme.accent }]}>E{episode.media.episode ?? '-'}</Text>
                            </View>
                            <View style={styles.copy}>
                              <Text numberOfLines={1} style={[styles.episodeTitle, { color: theme.text }]}>{episode.episodeTitle || `Episode ${episode.media.episode ?? ''}`}</Text>
                              <Text style={[styles.episodeMeta, { color: theme.textSecondary }]}>{[episodeSize, 'Ready offline'].filter(Boolean).join(' · ')}</Text>
                            </View>
                            {episodePlayableAssetId && onPlayInOrion ? <Pressable accessibilityRole="button" accessibilityLabel={`Play ${episode.episodeTitle || `episode ${episode.media.episode ?? ''}`} in Orion`} onPress={() => onPlayInOrion(episode, episodePlayableAssetId)} style={({ pressed }) => [styles.moreButton, { borderColor: theme.accent, backgroundColor: pressed ? theme.accentSoft : theme.elevated }]}><Ionicons name="play" size={18} color={theme.accent} /></Pressable> : null}
                            {episodePlayableAssetId && onPlayLocally && assetById.get(episodePlayableAssetId)?.actions.open ? <Pressable accessibilityRole="button" accessibilityLabel={`Play ${episode.episodeTitle || `episode ${episode.media.episode ?? ''}`} locally`} onPress={() => onPlayLocally(episodePlayableAssetId)} style={({ pressed }) => [styles.moreButton, { borderColor: theme.border, backgroundColor: pressed ? theme.surfaceHover : theme.elevated }]}><Ionicons name="open-outline" size={18} color={theme.textSecondary} /></Pressable> : null}
                            {onManageAssets ? <Pressable accessibilityRole="button" accessibilityLabel={`Manage ${episode.episodeTitle || `episode ${episode.media.episode ?? ''}`}`} onPress={() => onManageAssets(episode.assetIds)} style={({ pressed }) => [styles.moreButton, { borderColor: theme.border, backgroundColor: pressed ? theme.surfaceHover : theme.elevated }]}><Ionicons name="ellipsis-horizontal" size={19} color={theme.textSecondary} /></Pressable> : null}
                          </View>
                        );
                      })}
                    </View>
                  );
                })}
              </View>
            ) : null}
            {((!episodic && playableAssetId && (onPlayInOrion || onPlayLocally)) || onManageAssets) ? (
              <View style={styles.actions}>
                {!episodic && playableAssetId && onPlayInOrion ? (
                  <ActionButton primary label="Play in Orion" icon="play" accessibilityLabel={`Play ${mediaPrimaryTitle(entry.media)} in Orion`} onPress={() => onPlayInOrion(entry, playableAssetId)} />
                ) : null}
                {!episodic && playableAssetId && onPlayLocally && assetById.get(playableAssetId)?.actions.open ? <ActionButton label="Play Locally" icon="open-outline" accessibilityLabel={`Play ${mediaPrimaryTitle(entry.media)} locally`} onPress={() => onPlayLocally(playableAssetId)} /> : null}
                {onManageAssets ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Manage ${mediaPrimaryTitle(entry.media)}`}
                    hitSlop={5}
                    onPress={() => onManageAssets(group.entries.flatMap((candidate) => candidate.assetIds))}
                    style={({ pressed }) => [
                      styles.actionOverflow,
                      { borderColor: theme.border, backgroundColor: pressed ? theme.surfaceHover : theme.elevated },
                    ]}
                  >
                    <Ionicons name="ellipsis-horizontal" size={18} color={theme.textSecondary} />
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        );
      })}

      {visibleJobs.length === 0 && visibleGroups.length === 0 && visibleAttentionAssets.length === 0 ? (
        <View style={styles.noResults}>
          <Ionicons name="search-outline" size={22} color={theme.textMuted} />
          <Text style={[styles.noResultsTitle, { color: theme.text }]}>No downloads here</Text>
          <Text style={[styles.noResultsText, { color: theme.textSecondary }]}>Try another tab, media filter, sort, or search.</Text>
        </View>
      ) : null}
    </View>
  );

  function ActionButton({ label, icon, accessibilityLabel, disabled, primary = false, onPress }: { label: string; icon: React.ComponentProps<typeof Ionicons>['name']; accessibilityLabel?: string; disabled?: boolean; primary?: boolean; onPress: () => void }) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || `${label} download`}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.action,
          {
            borderColor: primary ? theme.accent : theme.border,
            backgroundColor: primary ? (pressed ? theme.accentSoft : theme.accent) : (pressed ? theme.surfaceHover : theme.elevated),
            opacity: disabled ? 0.55 : 1,
          },
        ]}
      >
        <Ionicons name={icon} size={15} color={primary ? theme.onAccent : theme.textSecondary} />
        <Text style={[styles.actionText, { color: primary ? theme.onAccent : theme.textSecondary }]}>{label}</Text>
      </Pressable>
    );
  }
}

const styles = StyleSheet.create({
  root: { gap: 0 },
  tabs: { gap: spacing[2], paddingRight: spacing[2], marginBottom: spacing[3], alignItems: 'center' },
  tab: { flexShrink: 0, minHeight: 38, borderWidth: 1, borderRadius: radii.full, paddingLeft: spacing[3], paddingRight: spacing[2], flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  tabText: { flexShrink: 0, fontSize: fontSizes.xs, fontWeight: '900' },
  countBadge: { flexShrink: 0, minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  countText: { fontSize: 10, fontWeight: '900' },
  searchBox: { minHeight: 44, borderWidth: 1, borderRadius: radii.xl, paddingHorizontal: spacing[3], flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[2] },
  searchInput: { flex: 1, minWidth: 0, fontSize: fontSizes.sm, paddingVertical: 0 },
  controlRow: { gap: spacing[2], paddingRight: spacing[2], marginBottom: spacing[2], alignItems: 'center' },
  control: { flexShrink: 0, minHeight: 36, borderWidth: 1, borderRadius: radii.full, paddingHorizontal: spacing[3], flexDirection: 'row', alignItems: 'center', gap: 6 },
  controlText: { flexShrink: 0, fontSize: fontSizes.xs, fontWeight: '800' },
  downloadItem: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: spacing[3], gap: spacing[2] },
  attentionItem: { borderLeftWidth: 2, paddingLeft: spacing[3] },
  mediaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  posterShell: { width: 58, height: 82, borderRadius: radii.md, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  poster: { width: '100%', height: '100%', resizeMode: 'cover' },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: fontSizes.sm, fontWeight: '900', lineHeight: 19 },
  secondaryTitle: { fontSize: fontSizes.xs, lineHeight: 17, marginTop: 2, fontWeight: '700' },
  meta: { fontSize: fontSizes.xs, fontWeight: '900', marginTop: 4 },
  failureText: { fontSize: fontSizes.xs, lineHeight: 17, marginTop: 3 },
  metrics: { fontSize: 10, lineHeight: 15, marginTop: 3 },
  track: { height: 5, borderRadius: radii.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radii.full },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginLeft: 70 },
  action: { minHeight: 34, borderWidth: 1, borderRadius: radii.full, paddingHorizontal: spacing[3], flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  actionText: { fontSize: fontSizes.xs, fontWeight: '800' },
  actionOverflow: { width: 38, minHeight: 34, borderWidth: 1, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
  episodeList: { borderTopWidth: 1, paddingTop: spacing[3], marginLeft: 70, gap: spacing[4] },
  seasonGroup: { gap: spacing[2] },
  seasonHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing[2] },
  seasonTitle: { fontSize: fontSizes.xs, fontWeight: '900' },
  seasonMeta: { flexShrink: 1, fontSize: 10, textAlign: 'right' },
  episodeRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  episodeBadge: { minWidth: 58, minHeight: 28, borderRadius: radii.md, paddingHorizontal: spacing[2], alignItems: 'center', justifyContent: 'center' },
  episodeBadgeText: { fontSize: 10, fontWeight: '900' },
  episodeTitle: { fontSize: fontSizes.xs, fontWeight: '800' },
  episodeMeta: { fontSize: 10, marginTop: 2 },
  moreButton: { width: 48, height: 48, borderWidth: 1, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  noResults: { minHeight: 130, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing[5], paddingHorizontal: spacing[4] },
  noResultsTitle: { fontSize: fontSizes.sm, fontWeight: '900', marginTop: spacing[2] },
  noResultsText: { fontSize: fontSizes.xs, textAlign: 'center', marginTop: 3 },
});
