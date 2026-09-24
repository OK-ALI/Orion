import { describe, expect, it } from "vitest";
import fs from "node:fs";

function read(relativePath) {
  return fs.readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const movieDetails = read("../../../src/renderer/features/movies/components/MovieDetails.jsx");
const movieOverlays = read("../../../src/renderer/features/movies/components/MovieOverlays.jsx");
const moviePlayer = read("../../../src/renderer/features/movies/components/MoviePlayer.jsx");
const movieController = read("../../../src/renderer/features/movies/hooks/useMovieController.js");
const movieWebview = read("../../../src/renderer/features/movies/hooks/useMovieWebview.js");
const tvDetails = read("../../../src/renderer/features/tv/components/TVDetails.jsx");
const tvEpisodes = read("../../../src/renderer/features/tv/components/TVEpisodes.jsx");
const tvOverlays = read("../../../src/renderer/features/tv/components/TVOverlays.jsx");
const tvPlayer = read("../../../src/renderer/features/tv/components/TVPlayerCore.jsx");
const tvActions = read("../../../src/renderer/features/tv/hooks/useTVEpisodeActions.js");
const tvController = read("../../../src/renderer/features/tv/hooks/useTVController.js");
const tvWebview = read("../../../src/renderer/features/tv/hooks/useTVWebview.js");
const downloadPreflight = read("../../../src/renderer/features/player/hooks/useDownloadCandidatePreflight.js");

describe("Desktop download entrypoint preparation contract", () => {
  it("routes Movie Details through the real player lifecycle and returns only after preflight succeeds", () => {
    expect(movieDetails).toContain(": openDownload()");
    expect(movieController).toContain("const openDownload = useCallback(() => {");
    expect(movieController).toContain("setDownloadResolutionActive(true);");
    expect(movieController).toContain("setShowDownload(false);");
    expect(movieController).toContain("setCaptureSessionId(null);");
    expect(movieController).toContain("startMovieDownloadResolution();");
    expect(movieController).toContain("useDownloadCandidatePreflight({");
    expect(downloadPreflight).toContain("preflightStream?.(candidate.id)");
    expect(downloadPreflight).toContain("result?.ok && result?.verified === true");
    expect(downloadPreflight).toContain("candidate.sourceId !== target.sourceId");
    expect(movieController).toContain("DOWNLOAD_CAPTURE_TIMEOUT_MS");
    expect(movieController).not.toContain("useDownloadSourceRecovery");
    expect(movieController).toContain("setDownloadResolutionError(");
    expect(downloadPreflight).toContain("setActive(false);");
    expect(movieController).toContain("setPlaying(false);");
    expect(downloadPreflight).toContain("setShowDownload(true);");
    expect(movieOverlays).not.toContain("DownloadSourceProbe");

    const openDownloadBlock = movieController.match(
      /const openDownload = useCallback\(\(\) => \{[\s\S]*?\n  \}, \[[^\]]*\]\);/,
    )?.[0];
    expect(openDownloadBlock).toBeTruthy();
    expect(openDownloadBlock).not.toContain("onHistory(");
    expect(openDownloadBlock).not.toContain("onPlay(");

    const resolutionBlock = movieWebview.match(
      /const startMovieDownloadResolution = useCallback\(\(\) => \{[\s\S]*?\n  \}, \[[^\]]*\]\);/,
    )?.[0];
    expect(resolutionBlock).toBeTruthy();
    expect(resolutionBlock).toContain("setPlaying(true);");
    expect(resolutionBlock).not.toContain("scrollIntoView");
    expect(resolutionBlock).not.toContain("onHistory(");
    expect(resolutionBlock).not.toContain("onPlay(");
    expect(resolutionBlock).not.toContain("saveProgress");
    expect(resolutionBlock).not.toContain('storage.set("dlTime_');
  });

  it("routes selected, card, and season episode downloads through one exact-target player owner", () => {
    expect(tvDetails).toContain(": startEpisodeDownload(selectedEp)");
    expect(tvEpisodes).toContain("onDownload={startEpisodeDownload}");
    expect(tvEpisodes).toContain("onClick={startSeasonDownload}");
    expect(tvActions).toContain("prepareEpisodeDownload(ep, selectedSeason);");
    expect(tvActions).toContain("startEpisodeDownload(firstPending);");

    expect(tvController).toContain("setSelectedEp(ep);");
    expect(tvController).toContain("episodeRecord: ep");
    expect(tvController).toContain("setDownloadResolutionActive(true);");
    expect(tvController).toContain("setShowDownload(false);");
    expect(tvController).toContain("startEpisodeDownloadResolution(ep);");
    expect(tvController).toContain("useDownloadCandidatePreflight({");
    expect(downloadPreflight).toContain("preflightStream?.(candidate.id)");
    expect(tvController).toContain("DOWNLOAD_CAPTURE_TIMEOUT_MS");
    expect(tvController).not.toContain("useDownloadSourceRecovery");
    expect(tvController).toContain("setPlaying(false);");
    expect(downloadPreflight).toContain("setShowDownload(true);");
    expect(tvOverlays).not.toContain("DownloadSourceProbe");

    const resolutionBlock = tvWebview.match(
      /const startEpisodeDownloadResolution = \(ep\) => \{[\s\S]*?\n  \};/,
    )?.[0];
    expect(resolutionBlock).toBeTruthy();
    expect(resolutionBlock).toContain("setSelectedEp(ep);");
    expect(resolutionBlock).toContain("setPlaying(true);");
    expect(resolutionBlock).not.toContain("scrollIntoView");
    expect(resolutionBlock).not.toContain("onHistory(");
    expect(resolutionBlock).not.toContain("onPlay(");
    expect(resolutionBlock).not.toContain("saveProgress");
    expect(resolutionBlock).not.toContain('storage.set("dlTime_');
  });

  it("separates display episode identity from provider episode identity", () => {
    expect(tvController).toContain("const rawSeason = ep._tmdbSeason ?? season;");
    expect(tvController).toContain("const rawEpisode = ep._tmdbAbsolute ?? ep.episode_number;");
    expect(tvController).toContain("applyEpisodeMapping(item.id, rawSeason, rawEpisode, episodeGroupMap)");
    expect(tvController).toContain("season: seasonNumber");
    expect(tvController).toContain("episode: episodeNumber");
    expect(tvController).toContain("providerSeason:");
    expect(tvController).toContain("providerEpisode:");
  });

  it("suppresses viewing persistence while player-assisted source resolution is active", () => {
    expect(movieWebview).toContain(
      "if (downloadResolutionActive || !playing || !sourceSupportsProgress(playerSource)) return;",
    );
    expect(tvWebview).toContain(
      "if (downloadResolutionActive || !playing || !currentProgressKey) return;",
    );

    expect(movieController).not.toContain("DownloadSourceProbe");
    expect(tvController).not.toContain("DownloadSourceProbe");

    const movieResolution = movieWebview.match(
      /const startMovieDownloadResolution = useCallback\(\(\) => \{[\s\S]*?\n  \}, \[[^\]]*\]\);/,
    )?.[0];
    const tvResolution = tvWebview.match(
      /const startEpisodeDownloadResolution = \(ep\) => \{[\s\S]*?\n  \};/,
    )?.[0];

    for (const block of [movieResolution, tvResolution]) {
      expect(block).toBeTruthy();
      expect(block).not.toContain("onHistory(");
      expect(block).not.toContain("onPlay(");
      expect(block).not.toContain("onMarkWatched");
      expect(block).not.toContain("saveProgress");
    }
  });

  it("routes active Movie and TV Player downloads directly to the current-session modal", () => {
    expect(moviePlayer).toContain("openDownloadFromPlayer()");
    expect(tvPlayer).toContain("openDownloadFromPlayer()");
    expect(moviePlayer).not.toContain("openDownload()");
    expect(tvPlayer).not.toContain("startEpisodeDownload(selectedEp)");
    for (const controller of [movieController, tvController]) {
      const action = controller.match(/const openDownloadFromPlayer = useCallback\(\(\) => \{[\s\S]*?\n  \}, \[\]\);/)?.[0];
      expect(action).toBeTruthy();
      expect(action).toContain("setShowDownload(true)");
      expect(action).not.toMatch(/setPlaying|setPlayerSource|setCaptureSessionId|setDownloadTarget|setM3u8/);
      expect(controller).not.toContain("DownloadRecoveryConsent");
    }
    expect(movieOverlays).not.toContain("DownloadRecoveryConsent");
    expect(tvOverlays).not.toContain("DownloadRecoveryConsent");
  });
});
