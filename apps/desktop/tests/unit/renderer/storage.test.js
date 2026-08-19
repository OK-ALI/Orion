import { describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS, formatBytes, storage } from "../../../src/renderer/services/settingsStore";
import {
  BACKUP_KEYS,
  LEGACY_CLOUD_MY_LIST_FENCE_MARKER,
  LEGACY_CLOUD_VIEWING_FENCE_MARKER,
  LEGACY_CLOUD_VIEWING_STATE_KEYS,
  collectBackupData,
  collectCompleteBackupData,
  collectLegacyCloudSyncData,
  restoreCompleteBackupData,
  restoreLegacyCloudSyncData,
} from "../../../src/renderer/services/backup";
import { saveDesktopMyListSyncCheckpointV1 } from "../../../src/renderer/services/myListSyncCheckpoint";

describe("v1.0.7 renderer storage compatibility", () => {
  it("keeps the orion_ prefix and JSON representation", () => {
    storage.set(STORAGE_KEYS.DOWNLOAD_QUALITY, "1080p");
    expect(localStorage.getItem("orion_downloadQuality")).toBe('"1080p"');
    expect(storage.get(STORAGE_KEYS.DOWNLOAD_QUALITY)).toBe("1080p");
  });

  it("clears Orion values without touching unrelated storage", () => {
    storage.set("saved", { 1: true });
    localStorage.setItem("another-app", "keep");
    storage.clearAll();
    expect(storage.get("saved")).toBeNull();
    expect(localStorage.getItem("another-app")).toBe("keep");
  });

  it("preserves byte formatting used by downloads", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1024 ** 3)).toBe("1.00 GB");
  });

  it("adds detailed playback progress without replacing the legacy percentage map", () => {
    storage.set(STORAGE_KEYS.WATCH_PROGRESS, { movie_7: 42 });
    storage.set(STORAGE_KEYS.PROGRESS_DETAILS, { movie_7: { currentTime: 420, duration: 1000, percent: 42, updatedAt: 10 } });
    expect(storage.get(STORAGE_KEYS.WATCH_PROGRESS)).toEqual({ movie_7: 42 });
    expect(storage.get(STORAGE_KEYS.PROGRESS_DETAILS).movie_7.currentTime).toBe(420);
  });

  it("backs up current preferences without exporting secure provider keys", () => {
    storage.set(STORAGE_KEYS.DOWNLOAD_FRAGMENT_CONCURRENCY, 8);
    storage.set(STORAGE_KEYS.CUSTOM_THEME_VARS, { "--bg": "#101010" });
    storage.set(STORAGE_KEYS.CLOSE_TO_TRAY, "tray");
    storage.set(STORAGE_KEYS.INTERACTION_HOVER_PRESET, "vivid");
    storage.set(STORAGE_KEYS.INTERACTION_HOVER_COLOR, "#7c3aed");
    storage.set(STORAGE_KEYS.INTERACTION_GLOW_STRENGTH, 72);
    storage.set(STORAGE_KEYS.MUSIC_DISPLAY_FONT, "space-grotesk");
    storage.set(STORAGE_KEYS.MUSIC_DISPLAY_SCALE, "spacious");
    storage.set(STORAGE_KEYS.MUSIC_GLASS_DENSITY, "deep");
    storage.set(STORAGE_KEYS.MUSIC_PLAYER_DOCK_MODE, "float");
    storage.set(STORAGE_KEYS.SUBDL_API_KEY, "must-not-export");

    const backup = collectBackupData();
    expect(backup.downloadFragmentConcurrency).toBe(8);
    expect(backup.customThemeVars).toEqual({ "--bg": "#101010" });
    expect(backup.closeToTray).toBe("tray");
    expect(backup.interactionHoverPreset).toBe("vivid");
    expect(backup.interactionHoverColor).toBe("#7c3aed");
    expect(backup.interactionGlowStrength).toBe(72);
    expect(backup.musicDisplayFont).toBe("space-grotesk");
    expect(backup.musicDisplayScale).toBe("spacious");
    expect(backup.musicGlassDensity).toBe("deep");
    expect(backup.musicPlayerDockMode).toBe("float");
    expect(backup.subdlApiKey).toBeUndefined();
    expect(BACKUP_KEYS).not.toContain(STORAGE_KEYS.SUBDL_API_KEY);
    expect(BACKUP_KEYS).not.toContain(STORAGE_KEYS.WYZIE_API_KEY);
    expect(BACKUP_KEYS).not.toContain(STORAGE_KEYS.API_KEY);
  });

  it("fences viewing state out of the legacy Google cloud backup without weakening file backups", async () => {
    storage.set(STORAGE_KEYS.SAVED, { movie_1: { id: 1 } });
    storage.set(STORAGE_KEYS.HISTORY, [{ id: 1, media_type: "movie", playbackVerified: true }]);
    storage.set(STORAGE_KEYS.WATCH_PROGRESS, { movie_1: 44 });
    storage.set(STORAGE_KEYS.PROGRESS_DETAILS, { movie_1: { currentTime: 44, duration: 100, playbackVerified: true } });
    storage.set(STORAGE_KEYS.WATCHED, { movie_1: true });

    const fileBackup = collectBackupData();
    expect(fileBackup.history).toHaveLength(1);
    expect(fileBackup.progress.movie_1).toBe(44);
    expect(fileBackup.watched.movie_1).toBe(true);

    const cloudBackup = await collectLegacyCloudSyncData();
    for (const key of LEGACY_CLOUD_VIEWING_STATE_KEYS) expect(cloudBackup[key]).toBeUndefined();
    expect(cloudBackup[LEGACY_CLOUD_VIEWING_FENCE_MARKER]).toBe(true);
    expect(cloudBackup.saved.movie_1.id).toBe(1);

    await restoreLegacyCloudSyncData({
      history: [{ id: 99, media_type: "movie" }],
      progress: { movie_99: 90 },
      progressDetails: { movie_99: { currentTime: 90, duration: 100 } },
      watched: { movie_99: true },
      saved: { movie_2: { id: 2 } },
    });

    expect(storage.get(STORAGE_KEYS.HISTORY)[0].id).toBe(1);
    expect(storage.get(STORAGE_KEYS.WATCH_PROGRESS)).toEqual({ movie_1: 44 });
    expect(storage.get(STORAGE_KEYS.WATCHED)).toEqual({ movie_1: true });
    expect(storage.get(STORAGE_KEYS.SAVED)).toEqual({ movie_2: { id: 2 } });
  });

  it("fences My List out of the legacy Google Drive workspace only after Orion Cloud enrollment", async () => {
    const profileId = "profile-my-list-fence";
    storage.set(STORAGE_KEYS.SAVED, { movie_7: { id: 7, media_type: "movie", title: "Local" } });
    storage.set(STORAGE_KEYS.SAVED_ORDER, ["movie_7"]);

    const beforeEnrollment = await collectLegacyCloudSyncData({ profileId });
    expect(beforeEnrollment.saved.movie_7.id).toBe(7);
    expect(beforeEnrollment.savedOrder).toEqual(["movie_7"]);

    saveDesktopMyListSyncCheckpointV1({
      profileId,
      localSignature: "local",
      cloudNamespaceSignature: "cloud",
      verifiedAt: 1,
    });

    const afterEnrollment = await collectLegacyCloudSyncData({ profileId });
    expect(afterEnrollment.saved).toBeUndefined();
    expect(afterEnrollment.savedOrder).toBeUndefined();
    expect(afterEnrollment[LEGACY_CLOUD_MY_LIST_FENCE_MARKER]).toBe(true);

    await restoreLegacyCloudSyncData({
      saved: { movie_99: { id: 99, media_type: "movie", title: "Legacy cloud" } },
      savedOrder: ["movie_99"],
    }, { profileId });

    expect(storage.get(STORAGE_KEYS.SAVED).movie_7.id).toBe(7);
    expect(storage.get(STORAGE_KEYS.SAVED_ORDER)).toEqual(["movie_7"]);
  });

  it("includes portable SQLite Music state without placing credentials in renderer storage", async () => {
    window.electron = {
      musicExportBackup: vi.fn().mockResolvedValue({ ok: true, state: { version: 1, playlists: [{ name: "Orbit" }],
        queue: { items: [{ id: "signal", title: "Signal" }], index: 0, repeat: "all", shuffle: false } } }),
      musicImportBackup: vi.fn().mockResolvedValue({ ok: true }),
    };
    const restored = vi.fn();
    window.addEventListener("orion:music-backup-restored", restored);
    const backup = await collectCompleteBackupData();
    expect(backup.musicState.playlists[0].name).toBe("Orbit");
    expect(backup.musicState.queue.items[0].id).toBe("signal");
    await restoreCompleteBackupData(backup);
    expect(window.electron.musicImportBackup).toHaveBeenCalledWith(backup.musicState);
    expect(restored).toHaveBeenCalledTimes(1);
    window.removeEventListener("orion:music-backup-restored", restored);
  });
});
