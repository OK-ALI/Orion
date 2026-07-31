import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ tmdbFetch: vi.fn() }));
vi.mock("../../../src/renderer/services/tmdb", () => ({ tmdbFetch: mocks.tmdbFetch }));

import { buildCinemaDiscoverPaths, CONSTELLATION_CINEMAS } from "../../../src/renderer/features/people/constellation/manifest";
import {
  CONSTELLATION_CACHE_TTL,
  aggregateConstellationCredits,
  fetchCinemaConstellationPool,
  filterConstellationPeople,
  getCachedConstellationPool,
  mapWithConcurrency,
  mergeConstellationPeople,
  selectPersonalizedSeeds,
  setCachedConstellationPool,
} from "../../../src/renderer/features/people/constellation/service";
import { storage, STORAGE_KEYS } from "../../../src/renderer/services/settingsStore";

const movie = { id: 1, media_type: "movie", title: "Film", popularity: 80 };
const tv = { id: 2, media_type: "tv", name: "Series", popularity: 60 };

describe("Constellation data layer", () => {
  beforeEach(() => {
    mocks.tmdbFetch.mockReset();
  });

  it("defines every approved cinema and expands South Indian languages", () => {
    expect(CONSTELLATION_CINEMAS.map((item) => item.id)).toEqual([
      "global", "hollywood", "bollywood", "south-indian", "korean", "japanese", "chinese",
    ]);
    const south = buildCinemaDiscoverPaths("south-indian", "movie", 2);
    expect(south).toHaveLength(4);
    expect(south.join(" ")).toContain("with_original_language=ta");
    expect(south.join(" ")).toContain("with_original_language=kn");
    expect(south.every((path) => path.includes("with_origin_country=IN") && path.includes("page=2"))).toBe(true);
  });

  it("maps cast and key crew into deduplicated multi-craft people", () => {
    const people = aggregateConstellationCredits([
      { media: movie, credits: { cast: [{ id: 10, name: "Alex Star", profile_path: "/a" }], crew: [{ id: 20, name: "Dana Director", job: "Director" }] } },
      { media: tv, credits: { cast: [{ id: 10, name: "Alex Star" }], crew: [{ id: 10, name: "Alex Star", job: "Producer" }, { id: 30, name: "Ignored", job: "Editor" }] } },
    ]);
    expect(people).toHaveLength(2);
    expect(people.find((person) => person.id === 10)).toEqual(expect.objectContaining({
      crafts: ["acting", "production"], mediaTypes: ["movie", "tv"], contributionCount: 2,
    }));
    expect(people.find((person) => person.id === 20)?.known_for_department).toBe("Directing");
  });

  it("maps nested TV aggregate crew jobs including creators", () => {
    const people = aggregateConstellationCredits([{
      media: tv,
      credits: { cast: [], crew: [{ id: 8, name: "Creator Example", jobs: [{ job: "Creator" }, { job: "Executive Producer" }] }] },
    }]);
    expect(people).toHaveLength(1);
    expect(people[0]).toMatchObject({
      id: 8,
      crafts: expect.arrayContaining(["writing", "production"]),
      mediaTypes: ["tv"],
      contributionCount: 1,
    });
  });

  it("filters by craft, media, local text and deterministic sorts", () => {
    const people = [
      { id: 1, name: "Zulu", crafts: ["acting"], mediaTypes: ["movie"], known_for: [{ title: "Hidden Film" }], contributionCount: 1, score: 20 },
      { id: 2, name: "Alpha", crafts: ["directing"], mediaTypes: ["tv"], known_for: [], contributionCount: 4, score: 10 },
    ];
    expect(filterConstellationPeople(people, { craft: "directing", media: "tv" }).map((person) => person.id)).toEqual([2]);
    expect(filterConstellationPeople(people, { query: "hidden" }).map((person) => person.id)).toEqual([1]);
    expect(filterConstellationPeople(people, { sort: "credits" }).map((person) => person.id)).toEqual([2, 1]);
    expect(filterConstellationPeople(people, { sort: "name" }).map((person) => person.id)).toEqual([2, 1]);
  });

  it("deduplicates personalized seeds across history and My List", () => {
    const seeds = selectPersonalizedSeeds(
      [{ id: 1, media_type: "movie" }, { id: 2, media_type: "tv" }],
      [{ id: 1, media_type: "movie" }, { id: 3, media_type: "movie" }],
    );
    expect(seeds.map((item) => `${item.media_type}_${item.id}`)).toEqual(["movie_1", "tv_2", "movie_3"]);
  });

  it("bounds local concurrency", async () => {
    let active = 0;
    let maximum = 0;
    await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
      active += 1; maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1; return value;
    });
    expect(maximum).toBe(2);
  });

  it("builds Bollywood pools from movie credits and TV aggregate credits", async () => {
    const progress = [];
    mocks.tmdbFetch.mockImplementation((path) => {
      if (path.startsWith("/discover/movie")) return Promise.resolve({ results: [movie], total_pages: 3 });
      if (path.startsWith("/discover/tv")) return Promise.resolve({ results: [tv], total_pages: 2 });
      if (path === "/movie/1/credits") return Promise.resolve({ cast: [{ id: 10, name: "Movie Actor" }], crew: [] });
      if (path === "/tv/2/aggregate_credits") return Promise.resolve({ cast: [{ id: 11, name: "TV Actor" }], crew: [] });
      return Promise.reject(new Error("unexpected path"));
    });
    const pool = await fetchCinemaConstellationPool({ cinemaId: "bollywood", apiKey: "token", onProgress: (value) => progress.push(value) });
    expect(pool.people.map((person) => person.id).sort()).toEqual([10, 11]);
    expect(pool.totalPages).toBe(3);
    expect(mocks.tmdbFetch).toHaveBeenCalledWith(expect.stringContaining("with_original_language=hi"), "token");
    expect(mocks.tmdbFetch).toHaveBeenCalledWith("/tv/2/aggregate_credits", "token");
    expect(progress.some((value) => value.phase === "discovering")).toBe(true);
    expect(progress.some((value) => value.phase === "mapping" && value.people.length > 0)).toBe(true);
  });

  it("retains partial credit successes and merges subsequent pages", async () => {
    mocks.tmdbFetch.mockImplementation((path) => {
      if (path.startsWith("/discover/movie")) return Promise.resolve({ results: [movie], total_pages: 2 });
      if (path.startsWith("/discover/tv")) return Promise.resolve({ results: [tv], total_pages: 2 });
      if (path === "/movie/1/credits") return Promise.resolve({ cast: [{ id: 10, name: "Available" }], crew: [] });
      return Promise.reject(new Error("temporary"));
    });
    const pool = await fetchCinemaConstellationPool({ cinemaId: "hollywood", apiKey: "token" });
    expect(pool.people).toHaveLength(1);
    expect(pool.partialFailures).toBe(1);
    expect(mergeConstellationPeople(pool.people, [{ ...pool.people[0], contributionCount: 1, score: 2 }])[0].contributionCount).toBe(2);
  });

  it("versions and expires compact cinema caches", () => {
    const now = Date.now();
    setCachedConstellationPool({ version: 1, cinemaId: "korean", people: [], seedPage: 1, totalPages: 1, generatedAt: now, partialFailures: 0 });
    expect(getCachedConstellationPool("korean", now + 10)?.cinemaId).toBe("korean");
    expect(getCachedConstellationPool("korean", now + CONSTELLATION_CACHE_TTL)).toBeNull();
    const cache = storage.get(STORAGE_KEYS.CONSTELLATION_CACHE);
    expect(cache.version).toBe(1);
  });
});
