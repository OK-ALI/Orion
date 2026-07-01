import { describe, expect, it } from "vitest";
import { STORAGE_KEYS, formatBytes, storage } from "../../../src/renderer/services/settingsStore";
import {
  BACKUP_KEYS,
  collectBackupData,
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
    storage.set(STORAGE_KEYS.SUBDL_API_KEY, "must-not-export");

    const backup = collectBackupData();
    expect(backup.downloadFragmentConcurrency).toBe(8);
    expect(backup.customThemeVars).toEqual({ "--bg": "#101010" });
    expect(backup.closeToTray).toBe("tray");
    expect(backup.interactionHoverPreset).toBe("vivid");
    expect(backup.interactionHoverColor).toBe("#7c3aed");
    expect(backup.interactionGlowStrength).toBe(72);
    expect(backup.subdlApiKey).toBeUndefined();
    expect(BACKUP_KEYS).not.toContain(STORAGE_KEYS.SUBDL_API_KEY);
    expect(BACKUP_KEYS).not.toContain(STORAGE_KEYS.WYZIE_API_KEY);
    expect(BACKUP_KEYS).not.toContain(STORAGE_KEYS.API_KEY);
  });
});
