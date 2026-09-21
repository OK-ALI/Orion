import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  hasPlayableTrailerVideo,
  normalizeTrailerCandidates,
} from "../../../src/renderer/features/trailers/trailerCandidateService";
import {
  classifyYouTubeError,
  createTrailerDirectUrl,
  createTrailerEmbedUrl,
  createTrailerExternalUrl,
} from "../../../src/renderer/features/trailers/trailerProviders";

const here = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(here, "../../..");
const read = (relative) => fs.readFileSync(path.join(desktopRoot, relative), "utf8");

describe("Orion Desktop trailer parity", () => {
  it("normalizes YouTube and Vimeo candidates and prefers official trailer truth", () => {
    const candidates = normalizeTrailerCandidates([
      { key: "reaction", site: "YouTube", type: "Trailer", name: "Official Trailer Reaction", official: false, iso_639_1: "en" },
      { key: "main", site: "YouTube", type: "Trailer", name: "Official Trailer", official: true, iso_639_1: "ko" },
      { key: "teaser", site: "Vimeo", type: "Teaser", name: "Teaser", official: true, iso_639_1: "en" },
      { key: "ignored", site: "Dailymotion", type: "Trailer", name: "Unsupported" },
      { key: "main", site: "YouTube", type: "Trailer", name: "Duplicate" },
    ], [], "en", "ko");

    expect(candidates.map((candidate) => candidate.id)).toEqual([
      "youtube:main",
      "vimeo:teaser",
      "youtube:reaction",
    ]);
    expect(candidates[0]).toMatchObject({ official: true, language: "ko", site: "YouTube" });
    expect(hasPlayableTrailerVideo([{ site: "Vimeo", key: "42" }])).toBe(true);
  });

  it("keeps season trailer context and scores it as a relevant fallback", () => {
    const [season] = normalizeTrailerCandidates([], [
      { key: "season", site: "YouTube", type: "Trailer", name: "Season Trailer", official: true, seasonNum: 2 },
    ], "en", "en");
    expect(season).toMatchObject({ scope: "season", season: 2, id: "youtube:season" });
  });

  it("uses Orion wrappers with bounded direct provider fallback and error classification", () => {
    const youtube = { id: "youtube:abc123", site: "YouTube", providerKey: "abc123" };
    const vimeo = { id: "vimeo:987", site: "Vimeo", providerKey: "987" };
    expect(createTrailerEmbedUrl(youtube)).toContain("orion-trailer://player/embed?provider=youtube");
    expect(createTrailerDirectUrl(youtube)).toContain("https://www.youtube.com/embed/abc123");
    expect(createTrailerExternalUrl(youtube)).toBe("https://www.youtube.com/watch?v=abc123");
    expect(createTrailerEmbedUrl(vimeo)).toContain("provider=vimeo");
    expect(createTrailerDirectUrl(vimeo)).toContain("https://player.vimeo.com/video/987");
    expect(classifyYouTubeError(153)).toMatchObject({ category: "client-identity", retryable: true });
    expect(classifyYouTubeError(150)).toMatchObject({ category: "embed-disabled", retryable: false });
  });

  it("ports Mobile original-language and TV season trailer recovery", () => {
    const discovery = read("src/renderer/features/trailers/hooks/useDesktopTrailerDiscovery.js");
    expect(discovery).toMatch(/language: originalLanguage/);
    expect(discovery).toMatch(/\/tv\/\$\{mediaId\}\/season\/\$\{season\}\/videos/);
    expect(discovery).toMatch(/\[Number\(selectedSeason\) \|\| 1, latestSeason\]/);
    expect(discovery).toMatch(/normalizeTrailerCandidates/);
  });

  it("replaces single-key Desktop discovery with the shared Orion candidate architecture", () => {
    const movie = read("src/renderer/features/movies/hooks/useMovieController.js");
    const tv = read("src/renderer/features/tv/hooks/useTVController.js");
    const modal = read("src/renderer/components/TrailerModal.jsx");
    for (const source of [movie, tv]) {
      expect(source).toMatch(/useDesktopTrailerDiscovery/);
      expect(source).toMatch(/trailerCandidates/);
      expect(source).not.toMatch(/trailerKey/);
      expect(source).not.toMatch(/videos\.find\(\(v\) => v\.type === "Trailer"/);
    }
    expect(modal).toMatch(/useTrailerSession/);
    expect(modal).toMatch(/candidates\.map/);
    expect(modal).toMatch(/orion-trailer-event/);
    expect(modal).not.toMatch(/executeJavaScript\(TRAILER_PROBE_SCRIPT\)/);
    expect(modal).toMatch(/Open \{candidate\?\.site/);
    expect(modal).not.toMatch(/All Invidious instances failed|FALLBACK_INSTANCES/);
  });

  it("keeps the modal theme-aware and the provider partition dependency-aware", () => {
    const css = read("src/renderer/styles/components/trailer-modal.css");
    const modal = read("src/renderer/components/TrailerModal.jsx");
    const bootstrap = read("src/main/bootstrap.js");
    const sessionManager = read("src/main/player/sessionManager.js");
    const playbackSettings = read("src/renderer/features/settings/groups/PlaybackSettingsGroup.jsx");
    expect(css).toMatch(/var\(--accent\)/);
    expect(css).toMatch(/var\(--bg-elevated\)/);
    expect(css).toMatch(/var\(--media-scrim\)/);
    expect(css).toMatch(/\.trailer-modal\.is-fullscreen/);
    expect(css).toMatch(/height: 100vh/);
    expect(modal).toMatch(/owner\?\.partition && owner\.partition !== "persist:trailer"/);
    expect(modal).toMatch(/data-trailer-fullscreen/);
    expect(bootstrap).toMatch(/wc\.session === session\.fromPartition\("persist:trailer"\)/);
    expect(bootstrap).toMatch(/partition: attachedPartition/);
    expect(bootstrap).not.toMatch(/session\.getPartition/);
    expect(sessionManager).toMatch(/trailerBlockedHosts/);
    expect(sessionManager).toMatch(/requestHeaders\.Referer = "https:\/\/com\.okali\.orion\/"/);
    expect(playbackSettings).toMatch(/Orion Trailer/);
    expect(playbackSettings).not.toMatch(/Invidious Instance/);
  });
});
