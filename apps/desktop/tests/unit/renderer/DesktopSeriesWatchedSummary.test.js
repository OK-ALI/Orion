import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DESKTOP_SERIES_WATCHED_ACTIVE_SUMMARY_TTL_MS,
  DESKTOP_SERIES_WATCHED_REQUEST_CONCURRENCY,
  DESKTOP_SERIES_WATCHED_REQUEST_TIMEOUT_MS,
  desktopSeriesEpisodeSignature,
  nextDesktopSeriesWatchedSummaryExpiry,
  runDesktopSeriesWatchedReconciliationBatch,
  selectDesktopSeriesWatchedPresentationSummaries,
  selectDesktopSeriesWatchedReconciliationCandidates,
  withDesktopSeriesWatchedSummary,
} from "../../../src/renderer/features/library/desktopSeriesWatchedSummary";
import {
  attachDesktopSeriesWatchedPresentation,
  isMediaItemWatched,
} from "../../../src/renderer/shared/utils/library";
import { buildDesktopPortableViewingStatePreview } from "../../../src/renderer/features/library/viewingStatePortableAdapter";

const watchedEpisodes = (seriesId, count) => Object.fromEntries(
  Array.from({ length: count }, (_, index) => [`tv_${seriesId}_s1e${index + 1}`, true]),
);

const endedSeries = (id, episodeCount) => ({
  id,
  name: `Series ${id}`,
  status: "Ended",
  number_of_episodes: episodeCount,
  seasons: [{ season_number: 1, episode_count: episodeCount, air_date: "2025-01-01" }],
});

describe("Desktop route-independent TV watched summary", () => {
  it("builds a lightweight-card tick from exact episode truth without polluting portable Watched", () => {
    const exact = watchedEpisodes(11, 2);
    const summaries = withDesktopSeriesWatchedSummary({}, exact, endedSeries(11, 2), Date.parse("2026-01-01T00:00:00Z"), Date.parse("2026-01-01T00:00:00Z"));
    const current = selectDesktopSeriesWatchedPresentationSummaries(exact, summaries, Date.parse("2026-01-02T00:00:00Z"));
    const presentation = attachDesktopSeriesWatchedPresentation(exact, current);

    expect(isMediaItemWatched({ id: 11, media_type: "tv", name: "Eleven" }, presentation)).toBe(true);
    expect(Object.keys(presentation)).toEqual(["tv_11_s1e1", "tv_11_s1e2"]);
    expect(JSON.stringify(presentation)).not.toContain('"tv_11"');

    const portable = buildDesktopPortableViewingStatePreview({ watched: presentation });
    expect(Object.keys(portable.watched)).toEqual(["tv_11_s1_e1", "tv_11_s1_e2"]);
    expect(portable.rejected.watched).toEqual([]);
  });

  it("turns exact watched episodes into one route-independent reconciliation candidate", () => {
    const exact = watchedEpisodes(12, 2);
    const candidates = selectDesktopSeriesWatchedReconciliationCandidates(exact, {}, 100);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toEqual(expect.objectContaining({
      seriesId: "12",
      episodeSignature: "1:1|1:2",
    }));

    const summaries = withDesktopSeriesWatchedSummary({}, exact, endedSeries(12, 2), Date.parse("2026-01-01T00:00:00Z"), Date.parse("2026-01-01T00:00:00Z"));
    expect(selectDesktopSeriesWatchedReconciliationCandidates(exact, summaries, Date.parse("2026-01-02T00:00:00Z"))).toEqual([]);
  });

  it("uses released episode truth for an active series and expires at the announced next episode", () => {
    const now = Date.parse("2030-01-01T12:00:00Z");
    const exact = watchedEpisodes(13, 2);
    const series = {
      id: 13,
      name: "Returning",
      status: "Returning Series",
      seasons: [{ season_number: 1, episode_count: 4, air_date: "2029-01-01" }],
      last_episode_to_air: { season_number: 1, episode_number: 2 },
      next_episode_to_air: { season_number: 1, episode_number: 3, air_date: "2030-01-03" },
    };
    const summaries = withDesktopSeriesWatchedSummary({}, exact, series, now, now);

    expect(summaries.tv_13).toEqual(expect.objectContaining({
      complete: true,
      releasedEpisodeTarget: 2,
      terminal: false,
      validUntil: Date.parse("2030-01-03T00:00:00Z"),
    }));
    expect(nextDesktopSeriesWatchedSummaryExpiry(exact, summaries, now))
      .toBe(Date.parse("2030-01-03T00:00:00Z"));
    expect(selectDesktopSeriesWatchedReconciliationCandidates(
      exact,
      summaries,
      Date.parse("2030-01-03T00:00:00Z"),
    )).toHaveLength(1);
  });

  it("uses a finite fallback TTL for active series and keeps ended summaries durable", () => {
    const now = Date.parse("2026-01-01T00:00:00Z");
    const activeExact = watchedEpisodes(14, 1);
    const active = withDesktopSeriesWatchedSummary({}, activeExact, {
      id: 14,
      status: "Returning Series",
      seasons: [{ season_number: 1, episode_count: 1, air_date: "1970-01-01" }],
    }, now, now);
    expect(active.tv_14.validUntil).toBe(now + DESKTOP_SERIES_WATCHED_ACTIVE_SUMMARY_TTL_MS);
    expect(active.tv_14.terminal).toBe(false);

    const endedExact = watchedEpisodes(15, 1);
    const ended = withDesktopSeriesWatchedSummary({}, endedExact, endedSeries(15, 1), now, now);
    expect(ended.tv_15.validUntil).toBeNull();
    expect(ended.tv_15.terminal).toBe(true);
    expect(nextDesktopSeriesWatchedSummaryExpiry(endedExact, ended, now)).toBeNull();
  });

  it("invalidates a title tick immediately when exact episode truth changes", () => {
    const complete = watchedEpisodes(16, 2);
    const summaries = withDesktopSeriesWatchedSummary({}, complete, endedSeries(16, 2), Date.parse("2026-01-01T00:00:00Z"), Date.parse("2026-01-01T00:00:00Z"));
    const changed = { tv_16_s1e1: true };

    expect(desktopSeriesEpisodeSignature(changed, 16)).toBe("1:1");
    expect(selectDesktopSeriesWatchedPresentationSummaries(changed, summaries, Date.parse("2026-01-02T00:00:00Z"))).toEqual({});
    const presentation = attachDesktopSeriesWatchedPresentation(changed, {});
    expect(isMediaItemWatched({ id: 16, media_type: "tv", name: "Sixteen" }, presentation)).toBe(false);
  });

  it("bounds metadata reconciliation to two requests and fences stale episode truth", async () => {
    const candidates = [1, 2, 3, 4].map((seriesId) => ({
      seriesId: String(seriesId),
      episodeSignature: "1:1",
      signature: `1:1|${seriesId}`,
    }));
    let active = 0;
    let peak = 0;
    const applied = [];

    await runDesktopSeriesWatchedReconciliationBatch({
      candidates,
      fetchSeries: async (seriesId) => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 4));
        active -= 1;
        return { id: Number(seriesId) };
      },
      applySeries: (series) => applied.push(series.id),
      isCurrent: (candidate) => candidate.seriesId !== "3",
    });

    expect(DESKTOP_SERIES_WATCHED_REQUEST_CONCURRENCY).toBe(2);
    expect(DESKTOP_SERIES_WATCHED_REQUEST_TIMEOUT_MS).toBe(8000);
    expect(peak).toBe(2);
    expect(applied).toEqual([1, 2, 4]);
  });

  it("has a root hook coordinator that retries on expiry/online/foreground without Media Detail navigation", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const hook = fs.readFileSync(
      path.resolve(here, "../../../src/renderer/app/hooks/useLibraryState.js"),
      "utf8",
    );
    expect(hook).toMatch(/selectDesktopSeriesWatchedReconciliationCandidates/);
    expect(hook).toMatch(/nextDesktopSeriesWatchedSummaryExpiry/);
    expect(hook).toMatch(/window\.addEventListener\("online"/);
    expect(hook).toMatch(/document\.addEventListener\("visibilitychange"/);
    expect(hook).toMatch(/tmdbFetch\(\s*`\/tv\/\$\{encodeURIComponent\(seriesId\)\}`/);
    expect(hook).toMatch(/watched: watchedPresentation/);
    expect(hook).not.toMatch(/MediaDetail/);
  });
});
