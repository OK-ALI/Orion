export const DESKTOP_SERIES_WATCHED_SUMMARY_STORAGE_KEY = "seriesWatchedSummariesV1";
export const DESKTOP_SERIES_WATCHED_ACTIVE_SUMMARY_TTL_MS = 24 * 60 * 60 * 1000;
export const DESKTOP_SERIES_WATCHED_REQUEST_TIMEOUT_MS = 8000;
export const DESKTOP_SERIES_WATCHED_REQUEST_CONCURRENCY = 2;

const DESKTOP_TV_EPISODE_KEY = /^tv_(.+)_s(\d+)e(\d+)$/;

function positiveNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function parseDesktopWatchedEpisodeKey(key) {
  const match = DESKTOP_TV_EPISODE_KEY.exec(String(key || ""));
  if (!match) return null;
  return {
    seriesId: String(match[1]),
    season: Number(match[2]),
    episode: Number(match[3]),
  };
}

function watchedEpisodeIdentities(watched = {}, seriesId) {
  const target = String(seriesId);
  const identities = new Map();
  for (const [key, value] of Object.entries(watched || {})) {
    if (!value) continue;
    const identity = parseDesktopWatchedEpisodeKey(key);
    if (!identity || identity.seriesId !== target) continue;
    identities.set(`${identity.season}:${identity.episode}`, identity);
  }
  return [...identities.values()].sort(
    (left, right) => left.season - right.season || left.episode - right.episode,
  );
}

export function desktopSeriesEpisodeSignature(watched = {}, seriesId) {
  return watchedEpisodeIdentities(watched, seriesId)
    .map((identity) => `${identity.season}:${identity.episode}`)
    .join("|");
}

function watchedSeriesIds(watched = {}) {
  const ids = new Set();
  for (const [key, value] of Object.entries(watched || {})) {
    if (!value) continue;
    const identity = parseDesktopWatchedEpisodeKey(key);
    if (identity) ids.add(identity.seriesId);
  }
  return [...ids].sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

function seriesSummaryKey(seriesId) {
  return `tv_${seriesId}`;
}

function isDerivedSeriesSummary(record) {
  return Boolean(record?.complete && record?.derivedFromEpisodes);
}

export function isDesktopSeriesWatchedSummaryCurrent(
  summary,
  watched,
  seriesId,
  now = Date.now(),
) {
  if (!isDerivedSeriesSummary(summary)) return false;
  const signature = desktopSeriesEpisodeSignature(watched, seriesId);
  if (!signature || summary.episodeSignature !== signature) return false;
  if (summary.terminal === true) return true;
  const validUntil = Number(summary.validUntil);
  return Number.isFinite(validUntil) && validUntil > 0 && now < validUntil;
}

export function selectDesktopSeriesWatchedPresentationSummaries(
  watched = {},
  summaries = {},
  now = Date.now(),
) {
  const current = {};
  for (const seriesId of watchedSeriesIds(watched)) {
    const key = seriesSummaryKey(seriesId);
    const summary = summaries?.[key];
    if (isDesktopSeriesWatchedSummaryCurrent(summary, watched, seriesId, now)) {
      current[key] = summary;
    }
  }
  return current;
}

export function pruneDesktopSeriesWatchedSummaries(summaries = {}, watched = {}) {
  let next = summaries;
  for (const [key, summary] of Object.entries(summaries || {})) {
    const match = /^tv_(.+)$/.exec(key);
    if (!match) continue;
    const signature = desktopSeriesEpisodeSignature(watched, match[1]);
    if (signature && summary?.episodeSignature === signature) continue;
    if (next === summaries) next = { ...summaries };
    delete next[key];
  }
  return next;
}

export function selectDesktopSeriesWatchedReconciliationCandidates(
  watched = {},
  summaries = {},
  now = Date.now(),
) {
  return watchedSeriesIds(watched).flatMap((seriesId) => {
    const episodeSignature = desktopSeriesEpisodeSignature(watched, seriesId);
    if (!episodeSignature) return [];
    const key = seriesSummaryKey(seriesId);
    const summary = summaries?.[key];
    if (isDesktopSeriesWatchedSummaryCurrent(summary, watched, seriesId, now)) return [];
    const summarySignature = summary
      ? [
          Number(summary.updatedAt) || 0,
          Number(summary.validUntil) || 0,
          summary.terminal === true ? "terminal" : "active",
          summary.episodeSignature || "none",
        ].join(":")
      : "missing";
    return [{
      seriesId,
      episodeSignature,
      signature: `${episodeSignature}|summary:${summarySignature}`,
    }];
  });
}

function countWatchedEpisodesForSeason(watched, seriesId, seasonNumber) {
  return watchedEpisodeIdentities(watched, seriesId)
    .filter((identity) => identity.season === seasonNumber)
    .length;
}

function releasedEpisodeTarget(item, season, now = Date.now()) {
  const seasonNumber = positiveNumber(season?.season_number ?? season?.season);
  const episodeCount = positiveNumber(season?.episode_count);
  if (seasonNumber == null || episodeCount == null) return null;

  const airDate = season?.air_date ? Date.parse(season.air_date) : Number.NaN;
  if (Number.isFinite(airDate) && airDate > now) return 0;

  const nextEpisode = item?.next_episode_to_air;
  if (positiveNumber(nextEpisode?.season_number) === seasonNumber) {
    const nextNumber = positiveNumber(nextEpisode?.episode_number);
    if (nextNumber != null) return Math.max(0, Math.min(episodeCount, nextNumber - 1));
  }

  const lastEpisode = item?.last_episode_to_air;
  if (positiveNumber(lastEpisode?.season_number) === seasonNumber) {
    const lastNumber = positiveNumber(lastEpisode?.episode_number);
    const status = String(item?.status || "").trim().toLowerCase();
    if (lastNumber != null && status !== "ended" && status !== "canceled" && status !== "cancelled") {
      return Math.max(0, Math.min(episodeCount, lastNumber));
    }
  }

  return episodeCount;
}

export function evaluateDesktopSeriesFromEpisodeTruth(
  watched = {},
  item,
  now = Date.now(),
) {
  if (!item || item.id == null) return null;
  const regularSeasons = Array.isArray(item.seasons)
    ? item.seasons.filter((season) => positiveNumber(season?.season_number) != null)
    : [];

  if (regularSeasons.length > 0) {
    const releasedTargets = regularSeasons
      .map((season) => ({
        seasonNumber: positiveNumber(season?.season_number),
        target: releasedEpisodeTarget(item, season, now),
      }))
      .filter((entry) => entry.seasonNumber != null && entry.target != null && entry.target > 0);

    if (releasedTargets.length === 0) {
      return { complete: false, releasedEpisodeTarget: 0 };
    }

    return {
      complete: releasedTargets.every((entry) => (
        countWatchedEpisodesForSeason(watched, item.id, entry.seasonNumber) >= entry.target
      )),
      releasedEpisodeTarget: releasedTargets.reduce((total, entry) => total + entry.target, 0),
    };
  }

  const knownEpisodeTotal = positiveNumber(item.number_of_episodes);
  if (knownEpisodeTotal == null) return null;
  return {
    complete: watchedEpisodeIdentities(watched, item.id).length >= knownEpisodeTotal,
    releasedEpisodeTarget: knownEpisodeTotal,
  };
}

function nextEpisodeValidityBoundary(item) {
  const raw = item?.next_episode_to_air?.air_date;
  if (!raw) return null;
  const parsed = Date.parse(`${raw}T00:00:00Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

function isTerminalSeriesStatus(item) {
  const status = String(item?.status || "").trim().toLowerCase();
  return status === "ended" || status === "canceled" || status === "cancelled";
}

export function deriveDesktopSeriesWatchedSummaryValidity(item, now = Date.now()) {
  if (isTerminalSeriesStatus(item)) {
    return { terminal: true, validUntil: null };
  }
  return {
    terminal: false,
    validUntil: nextEpisodeValidityBoundary(item)
      ?? (now + DESKTOP_SERIES_WATCHED_ACTIVE_SUMMARY_TTL_MS),
  };
}

export function withDesktopSeriesWatchedSummary(
  summaries = {},
  watched = {},
  item,
  now = Date.now(),
  evaluationNow = Date.now(),
) {
  if (!item || item.id == null) return summaries;
  const key = seriesSummaryKey(item.id);
  const episodeSignature = desktopSeriesEpisodeSignature(watched, item.id);
  const evaluation = evaluateDesktopSeriesFromEpisodeTruth(watched, item, evaluationNow);

  if (!episodeSignature || evaluation == null || !evaluation.complete) {
    if (!summaries[key]) return summaries;
    const next = { ...summaries };
    delete next[key];
    return next;
  }

  const validity = deriveDesktopSeriesWatchedSummaryValidity(item, evaluationNow);
  if (validity.validUntil != null && validity.validUntil <= evaluationNow) {
    if (!summaries[key]) return summaries;
    const next = { ...summaries };
    delete next[key];
    return next;
  }

  const nextRecord = {
    seriesId: String(item.id),
    complete: true,
    derivedFromEpisodes: true,
    releasedEpisodeTarget: evaluation.releasedEpisodeTarget,
    terminal: validity.terminal,
    validUntil: validity.validUntil,
    episodeSignature,
    updatedAt: now,
  };
  const existing = summaries[key];
  if (
    existing?.complete === nextRecord.complete
    && existing?.derivedFromEpisodes === nextRecord.derivedFromEpisodes
    && existing?.releasedEpisodeTarget === nextRecord.releasedEpisodeTarget
    && existing?.terminal === nextRecord.terminal
    && existing?.validUntil === nextRecord.validUntil
    && existing?.episodeSignature === nextRecord.episodeSignature
  ) {
    return summaries;
  }
  return { ...summaries, [key]: nextRecord };
}

export function nextDesktopSeriesWatchedSummaryExpiry(
  watched = {},
  summaries = {},
  now = Date.now(),
) {
  let nearest = null;
  for (const seriesId of watchedSeriesIds(watched)) {
    const summary = summaries?.[seriesSummaryKey(seriesId)];
    if (!summary || summary.terminal === true) continue;
    const signature = desktopSeriesEpisodeSignature(watched, seriesId);
    if (!signature || summary.episodeSignature !== signature) continue;
    const validUntil = Number(summary.validUntil);
    if (!Number.isFinite(validUntil) || validUntil <= now) continue;
    if (nearest == null || validUntil < nearest) nearest = validUntil;
  }
  return nearest;
}

export async function runDesktopSeriesWatchedReconciliationBatch({
  candidates,
  fetchSeries,
  applySeries,
  isCurrent,
  createController = () => new AbortController(),
  timeoutMs = DESKTOP_SERIES_WATCHED_REQUEST_TIMEOUT_MS,
  concurrency = DESKTOP_SERIES_WATCHED_REQUEST_CONCURRENCY,
  onController,
}) {
  let cursor = 0;
  const worker = async () => {
    while (cursor < candidates.length) {
      const candidate = candidates[cursor++];
      const controller = createController();
      onController?.(controller, true);
      let timeout = null;

      const request = Promise.resolve()
        .then(() => fetchSeries(candidate.seriesId, controller.signal))
        .then(
          (series) => ({ status: "resolved", series }),
          () => ({ status: "rejected" }),
        );
      const deadline = new Promise((resolve) => {
        timeout = setTimeout(() => {
          controller.abort();
          resolve({ status: "timed-out" });
        }, timeoutMs);
      });

      try {
        const result = await Promise.race([request, deadline]);
        if (
          result.status === "resolved"
          && !controller.signal.aborted
          && isCurrent(candidate)
        ) {
          applySeries(result.series, candidate);
        }
      } finally {
        if (timeout !== null) clearTimeout(timeout);
        onController?.(controller, false);
      }
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(1, concurrency), candidates.length) },
      () => worker(),
    ),
  );
}
