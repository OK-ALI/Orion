import { describe, expect, it } from "vitest";
import { buildPortableMyListPreviewV1 } from "@orion/shared/types";
import { combinePortableMyListPreviewsV1 } from "../../../src/renderer/services/myListConflictResolution";

describe("P8.3 Desktop My List first-enrollment conflict resolution", () => {
  it("combines both active My Lists without duplicate canonical titles and keeps Desktop order first", () => {
    const desktop = buildPortableMyListPreviewV1({
      movie_1: { id: 1, media_type: "movie", title: "Shared", poster_path: null, backdrop_path: null, year: "2026" },
      tv_2: { id: 2, media_type: "tv", name: "Desktop only", poster_path: "/desktop.jpg" },
    }, ["movie_1", "tv_2"]);

    const cloud = buildPortableMyListPreviewV1({
      movie_1: { id: 1, media_type: "movie", title: "Shared", poster_path: "/shared.jpg", backdrop_path: "/shared-bg.jpg", year: "2026" },
      movie_3: { id: 3, media_type: "movie", title: "Cloud only", poster_path: "/cloud.jpg" },
    }, ["movie_1", "movie_3"]);

    const result = combinePortableMyListPreviewsV1(desktop, cloud);

    expect(result.preview.orderedKeys).toEqual(["movie_1", "tv_2", "movie_3"]);
    expect(Object.keys(result.preview.records)).toHaveLength(3);
    expect(result.preview.records.movie_1.order).toBe(0);
    expect(result.preview.records.movie_1.posterPath).toBe("/shared.jpg");
    expect(result.preview.records.movie_1.backdropPath).toBe("/shared-bg.jpg");
    expect(result.summary).toEqual({
      desktopCount: 2,
      cloudCount: 2,
      sharedCount: 1,
      desktopOnlyCount: 1,
      cloudOnlyCount: 1,
      combinedCount: 3,
    });
  });

  it("fails closed when either preview contains rejected local data", () => {
    const clean = { records: {}, orderedKeys: [], rejectedKeys: [] };
    expect(() => combinePortableMyListPreviewsV1(
      { ...clean, rejectedKeys: ["movie_bad"] },
      clean,
    )).toThrow(/rejected My List previews/);
  });
});
