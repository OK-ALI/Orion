const { globalShortcut, ipcMain, shell, powerSaveBlocker } = require("electron");

const FALLBACK_SHORTCUTS = Object.freeze({
  MediaPlayPause: "toggle",
  MediaStop: "stop",
  MediaNextTrack: "next",
  MediaPreviousTrack: "previous",
});

function createMediaControls({ getMainWindow, getPopoutController }) {
  let state = { active: false, mediaSessionAvailable: true };
  let powerBlockerId = null;
  const registered = new Set();

  const syncPowerSaveBlocker = (active) => {
    try {
      if (!powerSaveBlocker) return;
      if (active) {
        if (powerBlockerId === null || !powerSaveBlocker.isStarted(powerBlockerId)) {
          powerBlockerId = powerSaveBlocker.start("prevent-display-sleep");
        }
      } else {
        if (powerBlockerId !== null && powerSaveBlocker.isStarted(powerBlockerId)) {
          powerSaveBlocker.stop(powerBlockerId);
          powerBlockerId = null;
        }
      }
    } catch {}
  };

  const send = (command) => {
    const popout = getPopoutController?.();
    if (popout?.isOpen?.() && ["toggle", "play", "pause", "stop", "restart"].includes(command)) {
      popout.controlPlayback?.(command);
      if (command === "stop") popout.close?.();
      return;
    }
    const win = getMainWindow?.();
    if (win && !win.isDestroyed() && state.active) {
      win.webContents.send("media-control:command", command);
    }
  };

  const unregisterFallbacks = () => {
    for (const accelerator of registered) globalShortcut.unregister(accelerator);
    registered.clear();
  };

  const syncFallbacks = () => {
    unregisterFallbacks();
    if (!state.active || state.mediaSessionAvailable) return;
    for (const [accelerator, command] of Object.entries(FALLBACK_SHORTCUTS)) {
      try {
        if (globalShortcut.register(accelerator, () => send(command))) registered.add(accelerator);
      } catch {}
    }
  };

  function register() {
    ipcMain.handle("media-control:get-status", () => ({
      ...state,
      fallbackKeys: registered.size,
      platform: process.platform,
    }));
    ipcMain.handle("media-control:open-sound-settings", async () => {
      if (process.platform !== "win32") return { ok: false, error: "Windows sound settings are unavailable on this platform." };
      try {
        await shell.openExternal("ms-settings:sound");
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error.message };
      }
    });
    ipcMain.handle("media-control:update-session", (_event, value = {}) => {
      state = {
        active: Boolean(value.active),
        mediaSessionAvailable: value.mediaSessionAvailable !== false,
        title: String(value.title || "").slice(0, 180),
        mediaType: ["tv", "music"].includes(value.mediaType) ? value.mediaType : "movie",
        artist: String(value.artist || "").slice(0, 180),
        album: String(value.album || "").slice(0, 180),
      };
      syncFallbacks();
      syncPowerSaveBlocker(state.active);
      return { ok: true, fallbackKeys: registered.size };
    });
  }

  function destroy() {
    unregisterFallbacks();
    syncPowerSaveBlocker(false);
  }

  return {
    register,
    destroy,
    send,
    getState: () => ({ ...state }),
    setPlaybackPowerState: (active) => syncPowerSaveBlocker(Boolean(active)),
  };
}

module.exports = { FALLBACK_SHORTCUTS, createMediaControls };
