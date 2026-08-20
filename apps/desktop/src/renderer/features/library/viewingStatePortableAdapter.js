import {
  PORTABLE_VIEWING_STATE_SCHEMA_VERSION,
  normalizePortableViewingIdentityV1,
  normalizePortableViewingPresentationV1,
  portableViewingKey,
} from "@orion/shared/types";

export const DESKTOP_VIEWING_STATE_PORTABILITY = Object.freeze({
  watched: "portable-read-only",
  history: "portable-read-only-verified",
  progress: "portable-read-only-verified",
  continueWatching: "derived-from-progress",
  legacyCloudBackup: "viewing-state-fenced",
});

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function positive(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function year(value) {
  const parsed = Number(String(value ?? "").slice(0, 4));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseDesktopViewingKey(key) {
  const movie = /^movie_([^_]+)$/.exec(String(key || ""));
  if (movie?.[1]) {
    return { mediaType: "movie", id: movie[1], season: null, episode: null };
  }
  const episode = /^tv_([^_]+)_s(\d+)_?e(\d+)$/.exec(String(key || ""));
  if (!episode) return null;
  const season = positive(episode[2]);
  const ep = positive(episode[3]);
  if (season == null || ep == null) return null;
  return { mediaType: "tv", id: episode[1], season, episode: ep };
}

function findHistoryMetadata(history, identity) {
  return (Array.isArray(history) ? history : []).find((entry) => {
    if (!entry || String(entry.id) !== String(identity.id)) return false;
    if (entry.media_type !== identity.mediaType) return false;
    if (identity.mediaType === "movie") return true;
    return Number(entry.season) === identity.season && Number(entry.episode) === identity.episode;
  }) || null;
}

function toPortableIdentity(identity, metadata) {
  return {
    mediaType: identity.mediaType,
    id: identity.id,
    season: identity.season,
    episode: identity.episode,
    title: text(metadata?.media_type === "tv" ? (metadata?.name || metadata?.title) : (metadata?.title || metadata?.name)),
    year: year(metadata?.year || metadata?.release_date || metadata?.first_air_date),
  };
}

function presentationFrom(metadata) {
  return {
    posterPath: text(metadata?.poster_path),
    backdropPath: text(metadata?.backdrop_path),
    seriesTitle: text(metadata?.media_type === "tv" ? (metadata?.name || metadata?.title) : null),
    episodeTitle: text(metadata?.episodeName || metadata?.episode_title),
  };
}

function preservedPortableMetadata(raw) {
  if (raw?.playbackVerifiedOrigin !== "portable-profile-v3") return null;
  const media = normalizePortableViewingIdentityV1(raw?.portableViewingMedia);
  const presentation = normalizePortableViewingPresentationV1(raw?.portableViewingPresentation);
  if (!media || !presentation) return null;
  try {
    return {
      key: portableViewingKey(media.mediaType, media.id, media.season, media.episode),
      media,
      presentation,
    };
  } catch {
    return null;
  }
}

export function buildDesktopPortableWatchedPreviewV1({ watched = {}, history = [] } = {}) {
  const preview = buildDesktopPortableViewingStatePreview({ watched, history });
  return {
    records: preview.watched,
    rejectedKeys: preview.rejected.watched.map((entry) => entry.key).sort(),
  };
}

const DESKTOP_ACTIVITY_IGNORED_HISTORY_REASONS = new Set([
  "non-portable-history-identity",
  "legacy-unverified-history",
]);

const DESKTOP_ACTIVITY_IGNORED_PROGRESS_REASONS = new Set([
  "non-portable-progress-identity",
  "legacy-unverified-progress",
  "watched-truth-supersedes-progress",
]);

export function buildDesktopPortableViewingActivityPreviewV1(input = {}) {
  const preview = buildDesktopPortableViewingStatePreview(input);
  return {
    history: preview.history,
    progress: preview.progress,
    rejected: {
      history: preview.rejected.history
        .filter((entry) => !DESKTOP_ACTIVITY_IGNORED_HISTORY_REASONS.has(entry.reason))
        .map((entry) => entry.key)
        .sort(),
      progress: preview.rejected.progress
        .filter((entry) => !DESKTOP_ACTIVITY_IGNORED_PROGRESS_REASONS.has(entry.reason))
        .map((entry) => entry.key)
        .sort(),
    },
  };
}

export function buildDesktopPortableViewingStatePreview({
  watched = {},
  history = [],
  progress = {},
  progressDetails = {},
} = {}) {
  const result = {
    watched: {},
    history: {},
    progress: {},
    rejected: { watched: [], history: [], progress: [] },
    compatibility: DESKTOP_VIEWING_STATE_PORTABILITY,
  };

  for (const [localKey, value] of Object.entries(watched || {})) {
    if (!value) continue;
    const identity = parseDesktopViewingKey(localKey);
    if (!identity) {
      result.rejected.watched.push({ key: localKey, reason: "non-portable-watched-identity" });
      continue;
    }
    const metadata = findHistoryMetadata(history, identity);
    const media = toPortableIdentity(identity, metadata);
    const key = portableViewingKey(media.mediaType, media.id, media.season, media.episode);
    result.watched[key] = {
      schemaVersion: PORTABLE_VIEWING_STATE_SCHEMA_VERSION,
      kind: media.mediaType === "movie" ? "movie" : "episode",
      media,
    };
  }

  for (const [index, entry] of (Array.isArray(history) ? history : []).entries()) {
    const preserved = preservedPortableMetadata(entry);
    const identity = preserved?.media || (entry?.media_type === "movie"
      ? { mediaType: "movie", id: entry.id, season: null, episode: null }
      : entry?.media_type === "tv" && positive(entry.season) && positive(entry.episode)
        ? { mediaType: "tv", id: entry.id, season: positive(entry.season), episode: positive(entry.episode) }
        : null);
    const fallbackKey = `history_${index}`;
    if (!identity || identity.id == null) {
      result.rejected.history.push({ key: fallbackKey, reason: "non-portable-history-identity" });
      continue;
    }
    const key = preserved?.key || portableViewingKey(identity.mediaType, identity.id, identity.season, identity.episode);
    if (entry.playbackVerified !== true) {
      // Legacy Desktop history can represent an opened player only. Records
      // without durable playback evidence remain local.
      result.rejected.history.push({ key, reason: "legacy-unverified-history" });
      continue;
    }
    const lastPlayedAt = Number(entry.lastPlayedAt ?? entry.updatedAt);
    if (!Number.isFinite(lastPlayedAt) || lastPlayedAt <= 0) {
      result.rejected.history.push({ key, reason: "invalid-history-time" });
      continue;
    }
    result.history[key] = {
      schemaVersion: PORTABLE_VIEWING_STATE_SCHEMA_VERSION,
      media: preserved?.media || toPortableIdentity(identity, entry),
      presentation: preserved?.presentation || presentationFrom(entry),
      lastPlayedAt,
      verified: true,
    };
  }

  const progressKeys = new Set([
    ...Object.keys(progress || {}),
    ...Object.keys(progressDetails || {}),
  ]);
  for (const localKey of progressKeys) {
    const identity = parseDesktopViewingKey(localKey);
    if (!identity) {
      result.rejected.progress.push({ key: localKey, reason: "non-portable-progress-identity" });
      continue;
    }
    const key = portableViewingKey(identity.mediaType, identity.id, identity.season, identity.episode);
    const details = progressDetails?.[localKey];
    if (!details || details.playbackVerified !== true) {
      // Legacy percentage/currentTime/duration snapshots without a durable
      // verification marker remain local.
      result.rejected.progress.push({ key, reason: "legacy-unverified-progress" });
      continue;
    }
    const currentTime = Number(details.currentTime);
    const duration = Number(details.duration);
    const lastPlayedAt = Number(details.updatedAt);
    if (!Number.isFinite(currentTime) || currentTime < 0
      || !Number.isFinite(duration) || duration < 0
      || !Number.isFinite(lastPlayedAt) || lastPlayedAt <= 0
      || (duration > 0 && currentTime > duration + 5)) {
      result.rejected.progress.push({ key, reason: "invalid-progress-timing" });
      continue;
    }
    if (result.watched[key]) {
      result.rejected.progress.push({ key, reason: "watched-truth-supersedes-progress" });
      continue;
    }
    const preserved = preservedPortableMetadata(details);
    const metadata = findHistoryMetadata(history, identity);
    result.progress[key] = {
      schemaVersion: PORTABLE_VIEWING_STATE_SCHEMA_VERSION,
      media: preserved?.key === key ? preserved.media : toPortableIdentity(identity, metadata),
      presentation: preserved?.key === key ? preserved.presentation : presentationFrom(metadata),
      currentTime,
      duration,
      percent: duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : null,
      startedAt: Number(details.startedAt ?? details.playbackVerifiedAt) > 0
        ? Number(details.startedAt ?? details.playbackVerifiedAt)
        : lastPlayedAt,
      lastPlayedAt,
      verified: true,
    };
  }

  return result;
}

function desktopLocalViewingKey(portableKey) {
  const movie = /^movie_(.+)$/.exec(String(portableKey || ""));
  if (movie?.[1]) return `movie_${movie[1]}`;
  const episode = /^tv_(.+)_s(\d+)_e(\d+)$/.exec(String(portableKey || ""));
  if (!episode) return null;
  return `tv_${episode[1]}_s${Number(episode[2])}e${Number(episode[3])}`;
}

function desktopHistoryKey(entry) {
  if (!entry || entry.id == null) return null;
  const identity = entry.media_type === "movie"
    ? { mediaType: "movie", id: entry.id, season: null, episode: null }
    : entry.media_type === "tv" && positive(entry.season) && positive(entry.episode)
      ? { mediaType: "tv", id: entry.id, season: positive(entry.season), episode: positive(entry.episode) }
      : null;
  return identity
    ? portableViewingKey(identity.mediaType, identity.id, identity.season, identity.episode)
    : null;
}

function desktopHistoryFromPortable(value) {
  const { media, presentation } = value;
  return {
    id: media.id,
    media_type: media.mediaType,
    title: media.title || presentation.seriesTitle || "Untitled",
    ...(media.mediaType === "tv" ? { name: presentation.seriesTitle || media.title || "Untitled" } : {}),
    poster_path: presentation.posterPath,
    backdrop_path: presentation.backdropPath,
    year: media.year ? String(media.year) : "",
    season: media.season,
    episode: media.episode,
    episodeName: presentation.episodeTitle,
    playbackVerified: true,
    playbackVerifiedAt: value.lastPlayedAt,
    playbackVerifiedOrigin: "portable-profile-v3",
    portableViewingMedia: { ...media },
    portableViewingPresentation: { ...presentation },
    lastPlayedAt: value.lastPlayedAt,
    lastWatchedAt: value.lastPlayedAt,
    watchedAt: value.lastPlayedAt,
  };
}

/**
 * Pure Desktop apply adapter for future Viewing Activity sync. It updates the
 * existing Desktop storage shapes without performing storage/cloud I/O. Resume
 * times are returned separately because Desktop persists them as dlTime_<key>.
 */
export function buildLocalDesktopViewingActivitySnapshotV1(state, existing = {}) {
  const historyKeys = new Set([
    ...Object.keys(state?.history || {}),
    ...(state?.tombstones?.history || []),
  ]);
  const progressKeys = new Set([
    ...Object.keys(state?.progress || {}),
    ...(state?.tombstones?.progress || []),
  ]);

  const preservedHistory = (Array.isArray(existing.history) ? existing.history : [])
    .filter((entry) => {
      const key = desktopHistoryKey(entry);
      return !key || !historyKeys.has(key);
    });
  const history = [
    ...Object.values(state?.history || {}).map(desktopHistoryFromPortable),
    ...preservedHistory,
  ]
    .sort((a, b) => Number(b.lastPlayedAt || 0) - Number(a.lastPlayedAt || 0))
    .slice(0, 250);

  const progress = { ...(existing.progress || {}) };
  const progressDetails = { ...(existing.progressDetails || {}) };
  for (const portableKey of progressKeys) {
    const localKey = desktopLocalViewingKey(portableKey);
    if (!localKey) continue;
    delete progress[localKey];
    delete progressDetails[localKey];
  }

  const resumeTimes = {};
  for (const [portableKey, value] of Object.entries(state?.progress || {})) {
    const localKey = desktopLocalViewingKey(portableKey);
    if (!localKey) continue;
    if (value.percent != null) progress[localKey] = value.percent;
    progressDetails[localKey] = {
      currentTime: value.currentTime,
      duration: value.duration,
      percent: value.percent ?? 0,
      updatedAt: value.lastPlayedAt,
      startedAt: value.startedAt,
      playbackVerified: true,
      playbackVerifiedAt: value.lastPlayedAt,
      playbackVerifiedOrigin: "portable-profile-v3",
      portableViewingMedia: { ...value.media },
      portableViewingPresentation: { ...value.presentation },
    };
    resumeTimes[localKey] = value.currentTime;
  }

  return {
    history,
    progress,
    progressDetails,
    resumeTimes,
    resumeRemovedKeys: (state?.tombstones?.progress || [])
      .map(desktopLocalViewingKey)
      .filter(Boolean),
  };
}
