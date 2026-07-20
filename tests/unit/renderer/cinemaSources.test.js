import { describe, expect, it } from "vitest";
import {
  ALL_CINEMA_SOURCES,
  PLAYER_SOURCES,
  getRegisteredSource,
  getNextHealthyNonAsyncSource,
  getSourceResumeParams,
  getSourceUrl,
  normalizeSelectableSourceId,
  resolveSourceMediaId,
  updateCinemaSourceHealth,
} from "../../../src/renderer/features/player/sources/registry";
import { validateSourceDescriptor } from "../../../src/renderer/features/player/sources/contracts";

describe("Cinema source registry", () => {
  it("contains unique, valid descriptors", () => {
    expect(new Set(ALL_CINEMA_SOURCES.map((source) => source.id)).size).toBe(ALL_CINEMA_SOURCES.length);
    for (const source of ALL_CINEMA_SOURCES) expect(validateSourceDescriptor(source)).toEqual([]);
  });

  it("keeps disabled and quarantined providers out of normal choices", () => {
    expect(PLAYER_SOURCES.map((source) => source.id)).not.toContain("vidfast");
    expect(PLAYER_SOURCES.map((source) => source.id)).not.toContain("vidify");
    expect(PLAYER_SOURCES.map((source) => source.id)).not.toContain("2embed");
    expect(PLAYER_SOURCES.map((source) => source.id)).not.toContain("superembed");
    expect(getRegisteredSource("2embed")?.releaseStatus).toBe("disabled");
  });

  it("migrates obsolete saved sources to a selectable default", () => {
    expect(normalizeSelectableSourceId("vidfast")).toBe("videasy");
    expect(normalizeSelectableSourceId("allmanga", { anime: true })).toBe("allmanga");
    expect(normalizeSelectableSourceId("videasy", { anime: true })).toBe("allmanga");
  });

  it("routes provider IDs according to their declared policy", () => {
    const ids = { tmdbId: 533535, imdbId: "tt6263850" };
    expect(resolveSourceMediaId("videasy", "movie", ids)).toBe(533535);
    expect(resolveSourceMediaId("vidsrc", "movie", ids)).toBe("tt6263850");
    expect(resolveSourceMediaId("vidlink", "tv", ids)).toBe(533535);
  });

  it.each([
    ["videasy", "movie", "https://player.videasy.net/movie/533535?overlay=true&color=e50914"],
    ["vidsrc", "movie", "https://vidsrc.to/embed/movie/tt6263850?ds_lang=en"],
    ["vidking", "movie", "https://www.vidking.net/embed/movie/533535?autoPlay=true&color=e50914"],
    ["vidsrccc", "movie", "https://vidsrc.cc/v2/embed/movie/tt6263850?autoPlay=true&color=e50914"],
    ["vidlink", "movie", "https://vidlink.pro/movie/533535?autoplay=true&primaryColor=e50914"],
    ["autoembed", "movie", "https://autoembed.co/movie/imdb/tt6263850"],
    ["vsembed", "movie", "https://vidsrc-embed.ru/embed/movie/tt6263850?ds_lang=en"],
    ["111movies", "movie", "https://111movies.com/movie/tt6263850"],
    ["vixsrc", "movie", "https://vixsrc.to/movie/tt6263850?autoplay=true&primaryColor=e50914&lang=en"],
  ])("builds the verified %s movie contract", (sourceId, type, expected) => {
    expect(getSourceUrl(sourceId, type, { tmdbId: 533535, imdbId: "tt6263850" }, null, null, {}, "#e50914", "en")).toBe(expected);
  });

  it.each([
    ["videasy", "https://player.videasy.net/tv/1399/1/2?overlay=true&color=e50914"],
    ["vidsrc", "https://vidsrc.to/embed/tv/tt0944947/1/2?ds_lang=en"],
    ["vidking", "https://www.vidking.net/embed/tv/1399/1/2?autoPlay=true&color=e50914"],
    ["vidsrccc", "https://vidsrc.cc/v2/embed/tv/tt0944947/1/2?autoPlay=true&color=e50914"],
    ["vidlink", "https://vidlink.pro/tv/1399/1/2?autoplay=true&primaryColor=e50914"],
    ["autoembed", "https://autoembed.co/tv/imdb/tt0944947-1-2"],
    ["vsembed", "https://vidsrc-embed.ru/embed/tv/tt0944947/1-2?ds_lang=en"],
    ["111movies", "https://111movies.com/tv/tt0944947/1/2"],
    ["vixsrc", "https://vixsrc.to/tv/tt0944947/1/2?autoplay=true&primaryColor=e50914&lang=en"],
  ])("builds the verified %s episode contract", (sourceId, expected) => {
    expect(getSourceUrl(sourceId, "tv", { tmdbId: 1399, imdbId: "tt0944947" }, 1, 2, {}, "#e50914", "en")).toBe(expected);
  });

  it("supports provider-specific external subtitle parameters without exposing them by default", () => {
    const url = getSourceUrl("vidlink", "movie", { tmdbId: 533535 }, null, null, {
      sub_file: "https://example.test/en.vtt",
      sub_label: "English",
    });
    expect(url).toContain("sub_file=https%3A%2F%2Fexample.test%2Fen.vtt");
    expect(url).toContain("sub_label=English");
    expect(getSourceUrl("vidlink", "movie", { tmdbId: 533535 })).not.toContain("fallback_url");
  });

  it("skips sources in runtime cooldown and prefers a proven healthy provider", () => {
    const now = 10_000;
    updateCinemaSourceHealth([
      { sourceId: "vidsrc", mediaType: "movie", state: "failed", cooldownUntil: now + 5_000, updatedAt: now },
      { sourceId: "vidking", mediaType: "movie", state: "ready", startupMs: 900, updatedAt: now },
    ]);
    expect(getNextHealthyNonAsyncSource("videasy", { mediaType: "movie", now })).toBe("vidking");
    updateCinemaSourceHealth([]);
  });

  it("does not return the active or already-attempted source", () => {
    updateCinemaSourceHealth([]);
    expect(getNextHealthyNonAsyncSource("videasy", {
      mediaType: "tv",
      attempted: ["vidsrc"],
    })).toBe("vidking");
  });

  it("keeps unvalidated experimental sources out of automatic failover", () => {
    updateCinemaSourceHealth([]);
    expect(getNextHealthyNonAsyncSource("videasy", {
      mediaType: "movie",
      attempted: ["vidsrc", "vidking", "vidsrccc", "vidlink"],
    })).toBeNull();
    expect(getNextHealthyNonAsyncSource("videasy", {
      mediaType: "movie",
      attempted: ["vidsrc", "vidking", "vidsrccc", "vidlink"],
      includeExperimental: true,
    })).toBe("autoembed");
  });

  it("uses only a provider's declared resume parameter", () => {
    expect(getSourceResumeParams("vidking", 92.8)).toEqual({ progress: 92 });
    expect(getSourceResumeParams("vidlink", 92.8)).toEqual({ startAt: 92 });
    expect(getSourceResumeParams("videasy", 92.8)).toEqual({});
  });
});
