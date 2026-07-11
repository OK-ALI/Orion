import { describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS, formatBytes, storage } from "../../../src/renderer/services/settingsStore";
import {
  BACKUP_KEYS,
  collectBackupData,
  collectCompleteBackupData,
  restoreCompleteBackupData,
} from "../../../src/renderer/services/backup";

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
