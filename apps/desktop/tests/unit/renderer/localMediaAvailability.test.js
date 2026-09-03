import { describe, expect, it } from "vitest";
import { findLocalDownloadForItem } from "../../../src/renderer/shared/utils/localMediaAvailability";

const movie = { id: 42, media_type: "movie", title: "Local Story" };
const episode = { id: 42, media_type: "tv", season: 2, episode: 3, title: "Local Series" };
const download = {
  id: "local-movie", mediaType: "movie", tmdbId: 42,
  status: "completed", filePath: "C:\\Orion\\Local Story.mp4",
};

describe("Home local download candidates", () => {
  it("matches a completed local movie by identity, including string IDs", () => {
    expect(findLocalDownloadForItem({ ...movie, id: "42" }, [download])).toBe(download);
  });

  it("matches only the exact episode and supports the existing mediaId fallback", () => {
    const localEpisode = { ...download, id: "local-episode", mediaType: "tv", tmdbId: undefined,
      mediaId: "42", season: "2", episode: "3" };
    expect(findLocalDownloadForItem(episode, [localEpisode])).toBe(localEpisode);
    expect(findLocalDownloadForItem({ ...episode, episode: 4 }, [localEpisode])).toBeNull();
    expect(findLocalDownloadForItem({ ...episode, season: 1 }, [localEpisode])).toBeNull();
    expect(findLocalDownloadForItem({ ...episode, episode: undefined }, [localEpisode])).toBeNull();
    expect(findLocalDownloadForItem(movie, [localEpisode])).toBeNull();
  });

  it.each([
    { filePath: null, driveFileId: "cloud-copy" },
    { filePath: undefined },
    { filePath: "" },
    { filePath: "  " },
    { status: "missing" },
    { status: "failed" },
    { status: "processing" },
    { id: null },
  ])("does not promote cloud-only or unavailable record evidence: %j", (overrides) => {
    expect(findLocalDownloadForItem(movie, [{ ...download, ...overrides }])).toBeNull();
  });

  it("allows a local copy that also has a cloud backup", () => {
    const backedUp = { ...download, driveFileId: "backup" };
    expect(findLocalDownloadForItem(movie, [backedUp])).toBe(backedUp);
  });

  it("never falls back to title matching or another media identity", () => {
    expect(findLocalDownloadForItem({ ...movie, id: 43 }, [{ ...download, name: movie.title }])).toBeNull();
    expect(findLocalDownloadForItem({ title: movie.title }, [download])).toBeNull();
    expect(findLocalDownloadForItem(null, [download])).toBeNull();
  });

  it("uses the current pruned records without probing, persisting or inventing file evidence", () => {
    const frozenDownload = Object.freeze({ ...download });
    const records = Object.freeze([frozenDownload]);
    expect(findLocalDownloadForItem(Object.freeze(movie), records)).toBe(frozenDownload);
    // useDownloads removes known missing files; the selector must not retain a stale match.
    expect(findLocalDownloadForItem(movie, [])).toBeNull();
    expect(findLocalDownloadForItem(movie, undefined)).toBeNull();
  });

  it("skips a cloud-only match when a local candidate also exists", () => {
    expect(findLocalDownloadForItem(movie, [{ ...download, filePath: null, driveFileId: "cloud" }, download])).toBe(download);
  });
});
