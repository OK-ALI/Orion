import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DESKTOP_VIEWING_STATE_PORTABILITY,
  buildDesktopPortableViewingStatePreview,
} from "../../../src/renderer/features/library/viewingStatePortableAdapter";

describe("P8.4 Desktop viewing-state portability", () => {
  it("canonicalizes legacy watched keys without promoting whole-series summaries", () => {
    const preview = buildDesktopPortableViewingStatePreview({
      watched: { movie_7: true, tv_9_s1e2: true, tv_10: true },
      history: [
        { id: 7, media_type: "movie", title: "Seven" },
        { id: 9, media_type: "tv", name: "Series", season: 1, episode: 2, episodeName: "Two" },
      ],
    });

    expect(Object.keys(preview.watched)).toEqual(["movie_7", "tv_9_s1_e2"]);
    expect(preview.rejected.watched).toContainEqual({ key: "tv_10", reason: "non-portable-watched-identity" });
  });

  it("refuses to elevate current Desktop opened-only history or unmarked legacy progress", () => {
    const preview = buildDesktopPortableViewingStatePreview({
      history: [{ id: 7, media_type: "movie", title: "Seven", lastWatchedAt: 1000 }],
      progress: { movie_7: 40 },
      progressDetails: { movie_7: { currentTime: 40, duration: 100, percent: 40, updatedAt: 1000 } },
    });

    expect(preview.history).toEqual({});
    expect(preview.progress).toEqual({});
    expect(preview.rejected.history[0].reason).toBe("legacy-unverified-history");
    expect(preview.rejected.progress[0].reason).toBe("legacy-unverified-progress");
  });

  it("exposes only verified history/progress while keeping Continue Watching derived", () => {
    const preview = buildDesktopPortableViewingStatePreview({
      history: [{
        id: 7, media_type: "movie", title: "Seven", poster_path: "/seven.jpg",
        playbackVerified: true, playbackVerifiedAt: 900, lastPlayedAt: 1000,
      }],
      progress: { movie_7: 40 },
      progressDetails: {
        movie_7: {
          currentTime: 40, duration: 100, percent: 40, updatedAt: 1000,
          startedAt: 900, playbackVerified: true, playbackVerifiedAt: 900,
        },
      },
    });

    expect(preview.history.movie_7).toEqual(expect.objectContaining({ verified: true, lastPlayedAt: 1000 }));
    expect(preview.progress.movie_7).toEqual(expect.objectContaining({
      verified: true, currentTime: 40, duration: 100, startedAt: 900, lastPlayedAt: 1000,
    }));
    expect(DESKTOP_VIEWING_STATE_PORTABILITY.continueWatching).toBe("derived-from-progress");
    expect(DESKTOP_VIEWING_STATE_PORTABILITY.legacyCloudBackup).toBe("viewing-state-fenced");
    expect(DESKTOP_VIEWING_STATE_PORTABILITY.history).toBe("portable-read-only-verified");
    expect(DESKTOP_VIEWING_STATE_PORTABILITY.progress).toBe("portable-read-only-verified");
  });
  it("fences the existing raw Google backup instead of treating it as PortableProfileV3", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const rendererRoot = path.resolve(here, "../../../src/renderer");
    const backup = fs.readFileSync(path.join(rendererRoot, "services/backup.js"), "utf8");
    const app = fs.readFileSync(path.join(rendererRoot, "app/App.jsx"), "utf8");
    const mainIpc = fs.readFileSync(path.resolve(rendererRoot, "../main/ipc/googleAuthIpc.js"), "utf8");
    const adapter = fs.readFileSync(path.join(rendererRoot, "features/library/viewingStatePortableAdapter.js"), "utf8");

    expect(backup).toMatch(/LEGACY_CLOUD_VIEWING_STATE_KEYS/);
    expect(backup).toMatch(/"history"[\s\S]*"progress"[\s\S]*"progressDetails"[\s\S]*"watched"/);
    expect(app).toMatch(/collectLegacyCloudSyncData/);
    expect(app).toMatch(/restoreLegacyCloudSyncData/);
    expect(app).toMatch(/uploadSync/);
    expect(mainIpc).toMatch(/prepareLegacySyncUploadPayload/);
    expect(mainIpc).toMatch(/preserve legacy viewing state before cloud sync/i);
    expect(adapter).not.toMatch(/uploadSync|downloadSync|CloudProfileStore|store\.write/);
  });

});
