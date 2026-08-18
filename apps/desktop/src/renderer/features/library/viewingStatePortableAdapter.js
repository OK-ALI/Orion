import {
  PORTABLE_VIEWING_STATE_SCHEMA_VERSION,
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
    const identity = entry?.media_type === "movie"
      ? { mediaType: "movie", id: entry.id, season: null, episode: null }
      : entry?.media_type === "tv" && positive(entry.season) && positive(entry.episode)
        ? { mediaType: "tv", id: entry.id, season: positive(entry.season), episode: positive(entry.episode) }
        : null;
    const fallbackKey = `history_${index}`;
    if (!identity || identity.id == null) {
      result.rejected.history.push({ key: fallbackKey, reason: "non-portable-history-identity" });
      continue;
    }
    const key = portableViewingKey(identity.mediaType, identity.id, identity.season, identity.episode);
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
      media: toPortableIdentity(identity, entry),
      presentation: presentationFrom(entry),
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
    const metadata = findHistoryMetadata(history, identity);
    result.progress[key] = {
      schemaVersion: PORTABLE_VIEWING_STATE_SCHEMA_VERSION,
      media: toPortableIdentity(identity, metadata),
      presentation: presentationFrom(metadata),
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
