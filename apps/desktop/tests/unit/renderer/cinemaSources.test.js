import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ALL_CINEMA_SOURCES,
  AUTOMATIC_PLAYER_SOURCES,
  PLAYER_SOURCES,
  getRegisteredSource,
  getSource,
  getNextHealthyNonAsyncSource,
  getSourceResumeParams,
  getSourceUrl,
  normalizeSelectableSourceId,
  resolveSourceMediaId,
  sourceResumeStrategy,
  sourceSupportsProgress,
  updateCinemaSourceHealth,
} from "../../../src/renderer/features/player/sources/registry";
import { validateSourceDescriptor } from "../../../src/renderer/features/player/sources/contracts";
import { ANIME_DEFAULT_SOURCE, NON_ANIME_DEFAULT_SOURCE } from "../../../src/renderer/services/tmdb";
import {
  installOrionProviderStatusV1,
  resolveOrionProviderStatusV1,
} from "@orion/shared/types";

const here = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(here, "../../..");
const read = (relative) => fs.readFileSync(path.join(desktopRoot, relative), "utf8");

describe("Cinema source registry", () => {
  it("contains unique, valid descriptors", () => {
    expect(new Set(ALL_CINEMA_SOURCES.map((source) => source.id)).size).toBe(ALL_CINEMA_SOURCES.length);
    for (const source of ALL_CINEMA_SOURCES) expect(validateSourceDescriptor(source)).toEqual([]);
  });

  it("keeps compatibility adapters registered while exposing only qualified Desktop sources", () => {
    expect(PLAYER_SOURCES.map((source) => source.id)).toEqual([
      "vixsrc", "vidsrc", "vidlink", "111movies", "vidnest", "vidsrc-ir", "cinesrc",
    ]);
    expect(getRegisteredSource("2embed")?.releaseStatus).toBe("disabled");
    expect(getRegisteredSource("videasy")?.id).toBe("videasy");
    expect(PLAYER_SOURCES.map((source) => source.id)).not.toContain("allmanga");
    expect(AUTOMATIC_PLAYER_SOURCES.map((source) => source.id)).toEqual(["vixsrc"]);
  });

  it("migrates retired, disabled, and anime-only saved sources to VixSrc", () => {
    expect(normalizeSelectableSourceId("vidfast")).toBe("vixsrc");
    expect(normalizeSelectableSourceId("allmanga", { anime: true })).toBe("vixsrc");
    expect(normalizeSelectableSourceId("videasy", { anime: true })).toBe("vixsrc");
    expect(normalizeSelectableSourceId("vidlink")).toBe("vidlink");
    expect(ANIME_DEFAULT_SOURCE).toBe("vixsrc");
    expect(NON_ANIME_DEFAULT_SOURCE).toBe("vixsrc");
  });

  it("does not confuse provider display tags with anime-only eligibility", () => {
    for (const controller of [
      read("src/renderer/features/movies/hooks/useMovieController.js"),
      read("src/renderer/features/tv/hooks/useTVController.js"),
    ]) {
      expect(controller).not.toMatch(/currentSrc\?\.tag|savedSrc\?\.tag/);
      expect(controller).toMatch(/normalizeSelectableSourceId\(playerSource/);
      expect(controller).toMatch(/STORAGE_KEYS\.PLAYER_SOURCE/);
    }
  });

  it("routes provider IDs according to their declared policy", () => {
    const ids = { tmdbId: 533535, imdbId: "tt6263850" };
    expect(resolveSourceMediaId("videasy", "movie", ids)).toBe(533535);
    expect(resolveSourceMediaId("vidsrc", "movie", ids)).toBe("tt6263850");
    expect(resolveSourceMediaId("vidlink", "tv", ids)).toBe(533535);
  });

  it.each([
    ["videasy", "movie", "https://player.videasy.to/movie/533535?overlay=true&color=e50914"],
    ["vidsrc", "movie", "https://vsembed.su/embed/movie/tt6263850?ds_lang=en"],
    ["vidking", "movie", "https://www.vidking.net/embed/movie/533535?autoPlay=true&color=e50914"],
    ["vidlink", "movie", "https://vidlink.pro/movie/533535?autoplay=true&primaryColor=e50914"],
    ["autoembed", "movie", "https://autoembed.co/movie/imdb/tt6263850"],
    ["vsembed", "movie", "https://vsembed.su/embed/movie/tt6263850?ds_lang=en"],
    ["111movies", "movie", "https://111movies.net/movie/tt6263850"],
    ["vixsrc", "movie", "https://vixsrc.to/movie/tt6263850?autoplay=true&primaryColor=e50914&lang=en"],
  ])("builds the verified %s movie contract", (sourceId, type, expected) => {
    expect(getSourceUrl(sourceId, type, { tmdbId: 533535, imdbId: "tt6263850" }, null, null, {}, "#e50914", "en")).toBe(expected);
  });

  it.each([
    ["videasy", "https://player.videasy.to/tv/1399/1/2?overlay=true&color=e50914"],
    ["vidsrc", "https://vsembed.su/embed/tv/tt0944947/1/2?ds_lang=en"],
    ["vidking", "https://www.vidking.net/embed/tv/1399/1/2?autoPlay=true&color=e50914"],
    ["vidlink", "https://vidlink.pro/tv/1399/1/2?autoplay=true&primaryColor=e50914"],
    ["autoembed", "https://autoembed.co/tv/imdb/tt0944947-1-2"],
    ["vsembed", "https://vsembed.su/embed/tv/tt0944947/1/2?ds_lang=en"],
    ["111movies", "https://111movies.net/tv/tt0944947/1/2"],
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
      { sourceId: "vixsrc", mediaType: "movie", state: "ready", startupMs: 900, updatedAt: now },
    ]);
    expect(getNextHealthyNonAsyncSource("videasy", { mediaType: "movie", now, includeExperimental: true })).toBe("vixsrc");
    updateCinemaSourceHealth([]);
  });

  it("does not return the active or already-attempted source", () => {
    updateCinemaSourceHealth([]);
    expect(getNextHealthyNonAsyncSource("videasy", {
      mediaType: "tv",
      attempted: ["vidsrc"],
      includeExperimental: true,
    })).toBe("vixsrc");
    expect(getNextHealthyNonAsyncSource("videasy", {
      mediaType: "tv",
      attempted: ["vixsrc"],
      includeExperimental: true,
    })).toBeNull();
  });

  it("uses only the physically qualified automatic pool", () => {
    updateCinemaSourceHealth([]);
    expect(getNextHealthyNonAsyncSource("videasy", {
      mediaType: "movie",
      attempted: ["vidsrc", "vidking", "vidsrccc", "vidlink"],
    })).toBe("vixsrc");
    expect(getNextHealthyNonAsyncSource("videasy", {
      mediaType: "movie",
      attempted: ["vidsrc", "vidking", "vidsrccc", "vidlink"],
      includeExperimental: true,
    })).toBe("vixsrc");
    expect(getNextHealthyNonAsyncSource("videasy", {
      mediaType: "movie",
      attempted: ["vixsrc"],
      includeExperimental: true,
    })).toBeNull();
  });

  it("uses only a provider's declared resume parameter", () => {
    expect(getSourceResumeParams("vidking", 92.8)).toEqual({ progress: 92 });
    expect(getSourceResumeParams("vidlink", 92.8)).toEqual({});
    expect(getSourceResumeParams("videasy", 92.8)).toEqual({ progress: 92 });
    expect(getSourceResumeParams("vidnest", 92.8, "movie")).toEqual({ startAt: 92 });
    expect(getSourceResumeParams("vidnest", 92.8, "tv")).toEqual({ progress: 92 });
  });

  it.each([
    ["vixsrc", "url-param", { startAt: 92 }, { startAt: 92 }],
    ["vidsrc", "verified-seek", {}, {}],
    ["vidlink", "verified-seek", {}, {}],
    ["111movies", "verified-seek", {}, {}],
    ["vidnest", "url-param", { startAt: 92 }, { progress: 92 }],
    ["vidsrc-ir", "url-param", { startAt: 92 }, { startAt: 92 }],
    ["cinesrc", "url-param", { t: 92 }, { t: 92 }],
  ])("keeps %s eligible for Orion resume handoff", (sourceId, strategy, movieParams, tvParams) => {
    expect(sourceSupportsProgress(sourceId)).toBe(true);
    expect(sourceResumeStrategy(sourceId)).toBe(strategy);
    expect(getSourceResumeParams(sourceId, 92.8, "movie")).toEqual(movieParams);
    expect(getSourceResumeParams(sourceId, 92.8, "tv")).toEqual(tvParams);
  });

  it("accepts only verified, newer provider status and never promotes a bundled policy", () => {
    const encoded = (payload) => Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const demotion = {
      schemaVersion: 1,
      sequence: 100,
      publishedAt: new Date(Date.now() - 1_000).toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      statuses: [
        { sourceId: "vixsrc", action: "demote", availability: "having-trouble", message: "This source is having trouble." },
        { sourceId: "vidlink", action: "restore", availability: "ready", message: "Ready." },
      ],
    };
    const envelope = {
      schemaVersion: 1,
      algorithm: "Ed25519",
      keyId: "test-key",
      payload: encoded(demotion),
      signature: Buffer.alloc(64, 1).toString("base64url"),
    };
    expect(resolveOrionProviderStatusV1(envelope, () => false)).toBeNull();
    const verified = resolveOrionProviderStatusV1(envelope, () => true);
    expect(installOrionProviderStatusV1(verified)).toBe(true);
    expect(installOrionProviderStatusV1(verified)).toBe(false);
    expect(getSource("vixsrc").routingMode).toBe("manual-only");
    expect(getSource("vidlink").routingMode).toBe("manual-only");
    expect(getNextHealthyNonAsyncSource("videasy", { mediaType: "movie" })).toBeNull();

    const restoration = {
      ...demotion,
      sequence: 101,
      statuses: [{ sourceId: "vixsrc", action: "restore", availability: "ready", message: "Ready." }],
    };
    const restoredEnvelope = { ...envelope, payload: encoded(restoration) };
    expect(installOrionProviderStatusV1(resolveOrionProviderStatusV1(restoredEnvelope, () => true))).toBe(true);
    expect(getSource("vixsrc").routingMode).toBe("automatic");
  });
});
