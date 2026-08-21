import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const rendererRoot = path.resolve(here, "../../../src/renderer");
const read = (relative) => fs.readFileSync(path.join(rendererRoot, relative), "utf8");

const movie = read("features/movies/components/MovieDetails.jsx");
const tv = read("features/tv/components/TVDetails.jsx");
const tvController = read("features/tv/hooks/useTVController.js");

describe("Desktop title detail product consistency", () => {
  it("uses Orion My List language on movie and TV detail actions", () => {
    for (const source of [movie, tv]) {
      expect(source).toMatch(/In My List/);
      expect(source).toMatch(/Add to My List/);
      expect(source).not.toMatch(/\{isSaved \? "Saved" : "Save"\}/);
    }
  });

  it("adds a primary TV Watch Now action through the existing episode playback owner", () => {
    expect(tv).toMatch(/const watchNowEpisode = selectedEp \|\| currentSeasonEpisodes\?\.\[0\] \|\| null/);
    expect(tv).toMatch(/className="btn btn-primary"/);
    expect(tv).toMatch(/<PlayIcon \/> Watch Now/);
    expect(tv).toMatch(/playEpisode\(watchNowEpisode\)/);
    expect(tv).toMatch(/disabled=\{!watchNowEpisode\}/);
    expect(tv).toMatch(/🔒 Restricted/);
    expect(tvController).toMatch(/currentSeasonEpisodes/);
    expect(tvController).toMatch(/playEpisode/);
    expect(tvController).toMatch(/const viewModel = \{[\s\S]*currentSeasonEpisodes[\s\S]*playEpisode/);
  });
});
