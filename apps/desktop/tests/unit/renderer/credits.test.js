import { describe, expect, it } from "vitest";
import {
  extractKeyCrew,
  normalizeCombinedCredits,
  normalizePersonSummary,
  selectKnownFor,
} from "../../../src/renderer/shared/utils/credits";
import {
  appendUniqueSearchResults,
  filterSearchResults,
  findDuplicateSearchTitles,
  getSearchCinemaId,
  getSearchResultIdentity,
  getSearchTitleKey,
  normalizeSearchResults,
} from "../../../src/renderer/services/search";

describe("people and credit normalization", () => {
  it("retains people beside movie and TV search results", () => {
    const results = normalizeSearchResults([
      { id: 1, media_type: "person", name: "A Person", known_for: [] },
      { id: 2, media_type: "movie", title: "A Movie" },
      { id: 3, media_type: "collection", name: "Ignored" },
    ]);
    expect(results.map((item) => item.media_type)).toEqual(["person", "movie"]);
    expect(results[0]).toEqual(expect.objectContaining({ name: "A Person", profile_path: null }));
  });

  it("merges duplicate filmography entries and preserves roles and jobs", () => {
    const credits = normalizeCombinedCredits({
      cast: [
        { id: 7, media_type: "movie", title: "Shared", character: "Lead", popularity: 3 },
        { id: 7, media_type: "movie", title: "Shared", character: "Narrator", popularity: 4 },
      ],
      crew: [{ id: 7, media_type: "movie", title: "Shared", job: "Producer" }],
    });
    expect(credits).toHaveLength(1);
    expect(credits[0].roles).toEqual(["Lead", "Narrator"]);
    expect(credits[0].jobs).toEqual(["Producer"]);
  });

  it("orders known-for titles and extracts only key crew", () => {
    const credits = [
      { id: 1, popularity: 2, vote_count: 10 },
      { id: 2, popularity: 20, vote_count: 100 },
    ];
    expect(selectKnownFor(credits, 1)[0].id).toBe(2);
    expect(extractKeyCrew([
      { id: 1, name: "Director", job: "Director" },
      { id: 2, name: "Editor", job: "Editor" },
    ], [{ id: 3, name: "Creator" }]).map((person) => person.job)).toEqual(["Director", "Creator"]);
  });

  it("deduplicates appended search pages by media identity", () => {
    const first = [normalizePersonSummary({ id: 1, name: "Person" })];
    const next = [normalizePersonSummary({ id: 1, name: "Person" }), { id: 1, media_type: "movie" }];
    expect(appendUniqueSearchResults(first, next)).toHaveLength(2);
  });

  it("provides language, region, original-title and duplicate context", () => {
    const hindi = { id: 1, media_type: "movie", title: "Don", original_title: "डॉन", original_language: "hi", release_date: "2006-10-20", vote_average: 7.1 };
    const english = { id: 2, media_type: "movie", title: "Don", original_language: "en", release_date: "1978-04-01" };
    const duplicates = findDuplicateSearchTitles([hindi, english]);
    expect(duplicates.has(getSearchTitleKey(hindi))).toBe(true);
    expect(getSearchResultIdentity(hindi, true)).toEqual(expect.objectContaining({
      title: "Don",
      originalTitle: "डॉन",
      duplicateTitle: true,
      facts: expect.arrayContaining(["2006", "Hindi", "★ 7.1"]),
      supportingLabel: "Original title",
    }));
  });

  it("classifies and filters cinema regions without mixing same-title results", () => {
    const results = [
      { id: 1, media_type: "movie", title: "Don", original_language: "hi" },
      { id: 2, media_type: "movie", title: "Don", original_language: "en" },
      { id: 3, media_type: "movie", title: "Don", original_language: "te", origin_country: ["IN"] },
      { id: 4, media_type: "tv", name: "Don", original_language: "ko" },
      { id: 5, media_type: "person", name: "Don Person" },
    ];
    expect(results.map(getSearchCinemaId)).toEqual(["bollywood", "hollywood", "south-indian", "korean", "people"]);
    expect(filterSearchResults(results, "movie", "bollywood").map((item) => item.id)).toEqual([1]);
    expect(filterSearchResults(results, "all", "hollywood").map((item) => item.id)).toEqual([2]);
    expect(filterSearchResults(results, "all", "global")).toHaveLength(5);
  });
});
