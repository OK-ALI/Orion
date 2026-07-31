import { describe, expect, it } from "vitest";
import {
  getLibraryYear,
  mergeLibraryOrder,
  needsLibraryMetadata,
  sortLibraryItems,
  toLibraryRecord,
} from "../../../src/renderer/shared/utils/library";

describe("library metadata compatibility", () => {
  it("normalizes complete movie and TV records without losing legacy years", () => {
    expect(toLibraryRecord({ id: 1, title: "Legacy", year: "1999" }, "movie")).toEqual(expect.objectContaining({
      title: "Legacy", year: "1999", release_date: "", vote_average: null,
    }));
    expect(toLibraryRecord({ id: 2, name: "Series", first_air_date: "2024-03-02", vote_average: "8.2" }, "tv")).toEqual(expect.objectContaining({
      title: "Series", year: "2024", first_air_date: "2024-03-02", vote_average: 8.2,
    }));
  });

  it("sorts legacy and complete records deterministically", () => {
    const items = [
      { id: 1, title: "Zulu", year: 1999, vote_average: null },
      { id: 2, title: "Alpha", release_date: "2025-01-02", vote_average: 7.2 },
      { id: 3, title: "Beta", first_air_date: "2020-04-03", vote_average: 9.1 },
    ];
    expect(sortLibraryItems(items, "title").map((item) => item.id)).toEqual([2, 3, 1]);
    expect(sortLibraryItems(items, "rating").map((item) => item.id)).toEqual([3, 2, 1]);
    expect(sortLibraryItems(items, "year").map((item) => item.id)).toEqual([2, 3, 1]);
    expect(getLibraryYear(items[0])).toBe("1999");
  });

  it("keeps valid titles omitted by a stale manual order", () => {
    const saved = { movie_1: { id: 1 }, movie_2: { id: 2 }, tv_3: { id: 3 } };
    expect(mergeLibraryOrder(saved, ["movie_2", "movie_2", "missing"])).toEqual(["movie_2", "movie_1", "tv_3"]);
  });

  it("repairs only records that are missing useful TMDB metadata", () => {
    expect(needsLibraryMetadata({ id: 1, poster_path: "/p", backdrop_path: "/b", release_date: "2020-01-01", vote_average: 7 })).toBe(false);
    expect(needsLibraryMetadata({ id: 1, year: "2020" })).toBe(true);
  });
});
