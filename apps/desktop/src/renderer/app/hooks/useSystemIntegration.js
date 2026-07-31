import { useEffect, useRef, useState } from "react";
import { storage, STORAGE_KEYS } from "../../services/settingsStore";

function batteryPreferences() {
  return {
    showStatus: storage.get(STORAGE_KEYS.SHOW_BATTERY_STATUS) !== false,
    alerts: storage.get(STORAGE_KEYS.BATTERY_ALERTS) !== false,
    automaticOptimization: storage.get(STORAGE_KEYS.BATTERY_OPTIMIZATION) !== false,
  };
}

function mediaPreferences() {
  return {
    enabled: storage.get(STORAGE_KEYS.MEDIA_CONTROLS_ENABLED) !== false,
    metadata: storage.get(STORAGE_KEYS.MEDIA_METADATA_ENABLED) !== false,
    background: storage.get(STORAGE_KEYS.MEDIA_BACKGROUND_CONTROLS) !== false,
  };
}

export function useSystemIntegration({ playbackSession, onMediaCommand, setToast }) {
  const commandRef = useRef(onMediaCommand);
  const batteryToastVisibleRef = useRef(false);
  const [mediaPrefs, setMediaPrefs] = useState(mediaPreferences);
  const [documentVisible, setDocumentVisible] = useState(() => document.visibilityState !== "hidden");
  commandRef.current = onMediaCommand;

  useEffect(() => {
    const settingsChanged = () => setMediaPrefs(mediaPreferences());
    const visibilityChanged = () => setDocumentVisible(document.visibilityState !== "hidden");
    window.addEventListener("orion:media-settings-changed", settingsChanged);
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => {
      window.removeEventListener("orion:media-settings-changed", settingsChanged);
      document.removeEventListener("visibilitychange", visibilityChanged);
    };
  }, []);

  useEffect(() => {
    if (!window.electron) return undefined;
    let disposed = false;
    let battery = null;
    const publishBattery = () => {
      if (!battery || disposed) return;
      window.electron.updateBatteryStatus?.({
        available: true,
        charging: battery.charging,
        level: battery.level,
        chargingTime: battery.chargingTime,
        dischargingTime: battery.dischargingTime,
      });
    };
    const syncPreferences = () => window.electron.updateBatteryPreferences?.(batteryPreferences());
    syncPreferences();
    window.addEventListener("orion:battery-settings-changed", syncPreferences);
    if (navigator.getBattery) {
      navigator.getBattery().then((manager) => {
        if (disposed) return;
        battery = manager;
        for (const name of ["chargingchange", "levelchange", "chargingtimechange", "dischargingtimechange"]) {
          manager.addEventListener(name, publishBattery);
        }
        publishBattery();
      }).catch(() => window.electron.updateBatteryStatus?.({ available: false }));
    } else {
      window.electron.updateBatteryStatus?.({ available: false });
    }
    const alertHandler = window.electron.onBatteryAlert?.((alert) => {
      const percent = Math.round(Number(alert?.level || 0) * 100);
      batteryToastVisibleRef.current = true;
      setToast?.(alert?.severity === "critical"
        ? (alert?.optimized
          ? `Battery ${percent}% · downloads paused until AC power returns`
          : `Battery ${percent}% · connect power soon`)
        : `Battery ${percent}% · Orion reduced background activity`);
    });
    const alertClearedHandler = window.electron.onBatteryAlertCleared?.(() => {
      if (!batteryToastVisibleRef.current) return;
      batteryToastVisibleRef.current = false;
      setToast?.(null);
    });
    const resumeHandler = window.electron.onBatteryResumeDownloads?.(({ ids = [] } = {}) => {
      for (const id of ids) window.electron.resumeDownload?.({ id }).catch(() => {});
      if (ids.length) setToast?.(`Power connected · resumed ${ids.length} battery-paused download${ids.length === 1 ? "" : "s"}`);
    });
    const performanceResumeHandler = window.electron.onPerformanceResumeDownloads?.(({ ids = [] } = {}) => {
      for (const id of ids) window.electron.resumeDownload?.({ id }).catch(() => {});
    });
    return () => {
      disposed = true;
      window.removeEventListener("orion:battery-settings-changed", syncPreferences);
      if (battery) {
        for (const name of ["chargingchange", "levelchange", "chargingtimechange", "dischargingtimechange"]) {
          battery.removeEventListener(name, publishBattery);
        }
      }
      if (alertHandler) window.electron.offBatteryAlert?.(alertHandler);
      if (alertClearedHandler) window.electron.offBatteryAlertCleared?.(alertClearedHandler);
      if (resumeHandler) window.electron.offBatteryResumeDownloads?.(resumeHandler);
      if (performanceResumeHandler) window.electron.offPerformanceResumeDownloads?.(performanceResumeHandler);
    };
  }, [setToast]);

  useEffect(() => {
    if (!window.electron) return undefined;
    let expected = performance.now() + 1000;
    let lagMs = 0;
    const lagTimer = window.setInterval(() => {
      const now = performance.now();
      lagMs = Math.max(0, now - expected);
      expected = now + 1000;
    }, 1000);
    const apply = (snapshot) => {
      if (!snapshot) return;
      document.documentElement.dataset.performanceTier = snapshot.tier || "balanced";
      document.documentElement.dataset.performanceOnBattery = snapshot.onBattery ? "true" : "false";
      window.dispatchEvent(new CustomEvent("orion:performance-tier-changed", { detail: snapshot }));
    };
    window.electron.getPerformanceSnapshot?.().then(apply).catch(() => {});
    const snapshotHandler = window.electron.onPerformanceSnapshot?.(apply);
    const healthTimer = window.setInterval(async () => {
      let state = null;
      if (playbackSession?.webContentsId) {
        state = await window.electron.queryVideoProgress?.(playbackSession.webContentsId).catch(() => null);
      }
      window.electron.reportPlaybackHealth?.({
        eventLoopLagMs: lagMs,
        bufferingEvents: state && !state.paused && Number(state.readyState) < 3 ? 1 : 0,
        droppedFrames: Number(state?.droppedFrames) || 0,
      });
    }, 5000);
    return () => {
      window.clearInterval(lagTimer);
      window.clearInterval(healthTimer);
      if (snapshotHandler) window.electron.offPerformanceSnapshot?.(snapshotHandler);
    };
  }, [playbackSession?.webContentsId]);

  useEffect(() => {
    const mediaSessionAvailable = Boolean(navigator.mediaSession && window.MediaMetadata);
    const active = Boolean(playbackSession && mediaPrefs.enabled && (mediaPrefs.background || documentVisible));
    window.electron?.updateSystemMediaSession?.({
      active,
      mediaSessionAvailable,
      title: playbackSession?.title,
      mediaType: playbackSession?.mediaType,
    });
    if (!active || !mediaSessionAvailable) return undefined;

    const artworkPath = playbackSession.posterPath || playbackSession.item?.poster_path;
    navigator.mediaSession.metadata = mediaPrefs.metadata ? new window.MediaMetadata({
      title: playbackSession.title || "Now Playing",
      artist: playbackSession.context || (playbackSession.mediaType === "tv" ? "Orion · Series" : "Orion · Movie"),
      album: "Orion",
      artwork: artworkPath ? [{ src: `https://image.tmdb.org/t/p/w342${artworkPath}`, sizes: "342x513", type: "image/jpeg" }] : [],
    }) : null;
    const actions = {
      play: "play",
      pause: "pause",
      stop: "stop",
      nexttrack: "next",
      previoustrack: "previous",
    };
    for (const [action, command] of Object.entries(actions)) {
      try { navigator.mediaSession.setActionHandler(action, () => commandRef.current?.(command)); } catch {}
    }
    navigator.mediaSession.playbackState = playbackSession.playbackState?.paused ? "paused" : "playing";

    const positionTimer = window.setInterval(async () => {
      if (!playbackSession.webContentsId) return;
      const state = await window.electron.queryVideoProgress?.(playbackSession.webContentsId).catch(() => null);
      if (!state) return;
      navigator.mediaSession.playbackState = state.paused ? "paused" : "playing";
      if (state.duration > 0 && Number.isFinite(state.duration)) {
        try {
          navigator.mediaSession.setPositionState({
            duration: state.duration,
            position: Math.min(state.duration, Math.max(0, state.currentTime)),
            playbackRate: 1,
          });
        } catch {}
      }
    }, 5000);
    const fallbackHandler = window.electron.onSystemMediaCommand?.((command) => commandRef.current?.(command));
    return () => {
      window.clearInterval(positionTimer);
      if (fallbackHandler) window.electron.offSystemMediaCommand?.(fallbackHandler);
      for (const action of Object.keys(actions)) {
        try { navigator.mediaSession.setActionHandler(action, null); } catch {}
      }
      navigator.mediaSession.playbackState = "none";
    };
  }, [playbackSession, mediaPrefs, documentVisible]);
}
