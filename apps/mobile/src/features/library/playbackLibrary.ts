import type {
  ContinueWatchingEntry,
  MediaIdentity,
  MobilePlaybackEvidence,
  PlaybackPresentationMetadata,
  PlaybackProgressV3,
} from '@orion/shared/types';
import {
  CONTINUE_MINIMUM_SECONDS,
  PLAYBACK_COMPLETION_PERCENT,
  isContinueWatchingProgressEligible,
} from '@orion/shared/api/continueWatchingPolicy';

export { CONTINUE_MINIMUM_SECONDS, PLAYBACK_COMPLETION_PERCENT };

const VERIFIED_EVIDENCE = new Set<MobilePlaybackEvidence>([
  'native-video-event',
  'provider-video-event',
  'provider-message',
]);

function finiteNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nullableText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeMediaType(value: unknown): 'movie' | 'tv' | null {
  return value === 'movie' || value === 'tv' ? value : null;
}

function normalizePresentation(raw: any = {}): PlaybackPresentationMetadata {
  const presentation = raw.presentation || {};
  return {
    posterPath: nullableText(presentation.posterPath ?? raw.poster_path),
    backdropPath: nullableText(presentation.backdropPath ?? raw.backdrop_path),
    seriesTitle: nullableText(presentation.seriesTitle ?? raw.series_title),
    episodeTitle: nullableText(presentation.episodeTitle ?? raw.episode_title),
  };
}

export function playbackProgressKey(
  mediaType: 'movie' | 'tv',
  id: string | number,
  season?: number | null,
  episode?: number | null,
): string {
  if (mediaType === 'tv' && Number(season) > 0 && Number(episode) > 0) {
    return `tv_${id}_s${Number(season)}_e${Number(episode)}`;
  }
  return `${mediaType}_${id}`;
}

export function normalizePlaybackProgress(
  key: string,
  raw: unknown,
): PlaybackProgressV3 | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as any;
  const identity = record.mediaIdentity || record.media || record;
  const id = identity.id ?? record.id;
  const mediaType = normalizeMediaType(
    identity.mediaType ?? record.media_type ?? record.mediaType,
  );
  if (id == null || !mediaType) return null;

  const season = finiteNumber(identity.season ?? record.season, 0) || null;
  const episode = finiteNumber(identity.episode ?? record.episode, 0) || null;
  const currentTime = Math.max(0, finiteNumber(record.currentTime));
  const duration = Math.max(0, finiteNumber(record.duration));
  const calculatedPercent = duration > 0
    ? Math.min(100, (currentTime / duration) * 100)
    : null;
  const storedPercent = Number.isFinite(Number(record.percent))
    ? Math.min(100, Math.max(0, Number(record.percent)))
    : null;
  const percent = duration > 0 ? calculatedPercent : storedPercent;
  const lastPlayedAt = Math.max(
    0,
    finiteNumber(record.lastPlayedAt ?? record.updatedAt ?? record.timestamp),
  );
  const startedAt = Math.max(
    0,
    finiteNumber(record.startedAt, lastPlayedAt),
  );
  const title = nullableText(identity.title ?? record.title ?? record.name) || 'Untitled';
  const mediaIdentity: MediaIdentity = {
    id,
    mediaType,
    title,
    year: finiteNumber(identity.year ?? record.year, 0) || null,
    season,
    episode,
  };
  const evidence = VERIFIED_EVIDENCE.has(record.evidence)
    || record.evidence === 'manual-watched'
    || record.evidence === 'opened-only'
    ? record.evidence as MobilePlaybackEvidence
    : null;
  const portableVerified = record.portableVerified === true ? true : undefined;

  return {
    schemaVersion: 3,
    key: key || playbackProgressKey(mediaType, id, season, episode),
    mediaIdentity,
    presentation: normalizePresentation(record),
    currentTime,
    duration,
    percent,
    sourceId: nullableText(record.sourceId),
    evidence,
    ...(portableVerified ? { portableVerified: true as const } : {}),
    sessionId: nullableText(record.sessionId),
    startedAt,
    lastPlayedAt,
    completed: Boolean(record.completed) || (percent != null && percent >= PLAYBACK_COMPLETION_PERCENT),
  };
}

export function normalizeProgressCollection(
  raw: Record<string, unknown> | null | undefined,
): Record<string, PlaybackProgressV3> {
  const normalized: Record<string, PlaybackProgressV3> = {};
  for (const [key, value] of Object.entries(raw || {})) {
    const entry = normalizePlaybackProgress(key, value);
    if (entry) normalized[key] = entry;
  }
  return normalized;
}

export function isVerifiedPlaybackEvidence(
  evidence: MobilePlaybackEvidence | null | undefined,
): boolean {
  return evidence != null && VERIFIED_EVIDENCE.has(evidence);
}

function isWatchedProgress(
  progress: PlaybackProgressV3,
  watched: Record<string, any>,
): boolean {
  if (watched[progress.key]) return true;
  const { id, mediaType, season, episode } = progress.mediaIdentity;
  if (watched[playbackProgressKey(mediaType, id, season, episode)]) return true;
  return Object.values(watched).some((value: any) => {
    if (!value || mediaType !== 'tv') return false;
    return String(value.series_id ?? value.seriesId ?? '') === String(id)
      && Number(value.season_number ?? value.season) === Number(season)
      && Number(value.episode_number ?? value.episode) === Number(episode);
  });
}

export function selectContinueWatching(
  progressRecords: Record<string, unknown>,
  watched: Record<string, any> = {},
): ContinueWatchingEntry[] {
  const candidates = Object.entries(normalizeProgressCollection(progressRecords))
    .map(([key, progress]) => ({
      key,
      progress,
      displayProgress: progress.duration > 0 ? 'percentage' as const : 'elapsed' as const,
    }))
    .filter(({ progress }) => (
      (isVerifiedPlaybackEvidence(progress.evidence) || progress.portableVerified === true)
      && isContinueWatchingProgressEligible(progress)
      && !isWatchedProgress(progress, watched)
    ));

  const latest = new Map<string, ContinueWatchingEntry>();
  for (const candidate of candidates) {
    const identity = candidate.progress.mediaIdentity;
    const groupKey = identity.mediaType === 'tv'
      ? `tv_${identity.id}`
      : candidate.key;
    const prior = latest.get(groupKey);
    if (!prior || prior.progress.lastPlayedAt < candidate.progress.lastPlayedAt) {
      latest.set(groupKey, candidate);
    }
  }
  return [...latest.values()].sort(
    (a, b) => b.progress.lastPlayedAt - a.progress.lastPlayedAt,
  );
}

export function historyEntryKey(entry: any): string | null {
  if (!entry || entry.id == null) return null;
  const mediaType = normalizeMediaType(entry.media_type ?? entry.mediaType) || 'movie';
  return playbackProgressKey(mediaType, entry.id, entry.season, entry.episode);
}

export function selectLatestHistory(history: unknown): any[] {
  if (!Array.isArray(history)) return [];
  const latest = new Map<string, any>();
  for (const entry of history) {
    const key = historyEntryKey(entry);
    if (!key) continue;
    const timestamp = Math.max(0, finiteNumber(entry.lastPlayedAt ?? entry.updatedAt ?? entry.timestamp));
    const prior = latest.get(key);
    const priorTimestamp = Math.max(0, finiteNumber(prior?.lastPlayedAt ?? prior?.updatedAt ?? prior?.timestamp));
    if (!prior || timestamp >= priorTimestamp) latest.set(key, { ...entry, _key: key, lastPlayedAt: timestamp });
  }
  return [...latest.values()].sort((a, b) => b.lastPlayedAt - a.lastPlayedAt);
}

export function withoutProgressRecord(records: Record<string, any>, key: string) {
  if (!records[key]) return records;
  const next = { ...records };
  delete next[key];
  return next;
}

export function withoutHistoryEntry(history: any[], key: string) {
  return history.filter((entry) => historyEntryKey(entry) !== key);
}

export function markProgressRecordWatched(
  progressRecords: Record<string, any>,
  watchedRecords: Record<string, any>,
  key: string,
  now = Date.now(),
) {
  const progress = normalizePlaybackProgress(key, progressRecords[key]);
  if (!progress) return null;
  const { mediaIdentity, presentation } = progress;
  const watchedRecord = {
    id: mediaIdentity.id,
    media_type: mediaIdentity.mediaType,
    title: mediaIdentity.title,
    name: mediaIdentity.mediaType === 'tv' ? (presentation.seriesTitle || mediaIdentity.title) : undefined,
    poster_path: presentation.posterPath,
    backdrop_path: presentation.backdropPath,
    year: mediaIdentity.year ? String(mediaIdentity.year) : '',
    season: mediaIdentity.season,
    episode: mediaIdentity.episode,
    episode_title: presentation.episodeTitle,
    is_episode: mediaIdentity.mediaType === 'tv' && mediaIdentity.season != null && mediaIdentity.episode != null,
    series_id: mediaIdentity.mediaType === 'tv' ? mediaIdentity.id : undefined,
    timestamp: now,
  };
  return {
    progress: withoutProgressRecord(progressRecords, key),
    watched: { ...watchedRecords, [key]: watchedRecord },
  };
}
