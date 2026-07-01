const path = require("path");
const { app, Menu, nativeImage, Tray } = require("electron");

const ACTIVE_DOWNLOAD_STATUSES = new Set([
  "queued",
  "preflighting",
  "downloading",
  "processing",
]);

function createTrayController({ rootDir, downloads, getMainWindow }) {
  let tray = null;
  let miniPlayerActive = false;
  let miniPlayerTitle = "";
  let shownTrayBalloon = false;
  let monitorTimer = null;
  let lastSignature = "";
  let batteryStatus = null;

  const getActiveDownloads = () =>
    downloads
      .getDownloads()
      .filter((entry) => ACTIVE_DOWNLOAD_STATUSES.has(entry.status));

  const downloadPercent = (entry) => {
    const value = Number(entry.progress);
    return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  };

  const showMainWindow = (page = null) => {
    const mainWindow = getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send("tray-restore-window");
    if (page) mainWindow.webContents.send("tray-open-page", page);
  };

  const showBalloonOnce = (
    title = "Orion is still running",
    content = "Open the tray icon to restore Orion.",
  ) => {
    if (shownTrayBalloon || !tray || process.platform !== "win32") return;
    try {
      tray.displayBalloon({ title, content, iconType: "info" });
      shownTrayBalloon = true;
    } catch {}
  };

  function updateMenu() {
    if (!tray) return;

    const activeDownloads = getActiveDownloads();
    const activeCount = activeDownloads.length;
    const totalProgress = activeCount
      ? Math.round(
          activeDownloads.reduce((sum, entry) => sum + downloadPercent(entry), 0) /
            activeCount,
        )
      : 0;
    const downloadSubmenu = activeDownloads.slice(0, 6).map((entry) => ({
      label: `${String(entry.name || "Download").slice(0, 42)} — ${Math.round(downloadPercent(entry))}%`,
      submenu: [
        {
          label: entry.speed
            ? `${entry.speed}${entry.eta ? ` · ETA ${entry.eta}` : ""}`
            : entry.lastMessage || entry.status,
          enabled: false,
        },
        {
          label: "Pause",
          click: () => {
            downloads.pauseDownload(entry.id, "Paused from the system tray");
            updateDownloadSurfaces(true);
          },
        },
      ],
    }));

    const contextMenu = Menu.buildFromTemplate([
      { label: "Open Orion", click: () => showMainWindow() },
      { label: "Open Downloads", click: () => showMainWindow("downloads") },
      { type: "separator" },
      ...(batteryStatus?.available
        ? [{
            label: batteryStatus.level == null
              ? (batteryStatus.charging ? "Battery: Charging" : "Battery power")
              : `Battery: ${Math.round(batteryStatus.level * 100)}%${batteryStatus.charging ? " · Charging" : ""}`,
            enabled: false,
          }, { type: "separator" }]
        : []),
      {
        label: activeCount
          ? `Downloads: ${activeCount} active · ${totalProgress}% overall`
          : "Downloads: No active jobs",
        enabled: false,
      },
      ...(activeCount
        ? [
            { label: "Active downloads", submenu: downloadSubmenu },
            {
              label: "Pause all downloads",
              click: () => {
                downloads.pauseAllDownloads();
                updateDownloadSurfaces(true);
              },
            },
          ]
        : []),
      { type: "separator" },
      {
        label: miniPlayerActive
          ? `Now Playing: ${miniPlayerTitle}`
          : "Orion: No Stream Active",
        enabled: false,
      },
      {
        label: "Stop Playback",
        enabled: miniPlayerActive,
        click: () => {
          const mainWindow = getMainWindow();
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("stop-mini-player");
          }
          miniPlayerActive = false;
          updateMenu();
        },
      },
      { type: "separator" },
      {
        label: activeCount ? "Pause Downloads & Quit Orion" : "Quit Orion",
        click: () => {
          if (activeCount) downloads.pauseAllDownloads("Paused when Orion quit");
          app.isQuiting = true;
          app.quit();
        },
      },
    ]);

    const tooltip = activeCount
      ? `Orion · ${activeCount} active download${activeCount === 1 ? "" : "s"} · ${totalProgress}%\n${activeDownloads
          .slice(0, 2)
          .map(
            (entry) =>
              `${String(entry.name || "Download").slice(0, 36)} — ${Math.round(downloadPercent(entry))}%`,
          )
          .join("\n")}`
      : miniPlayerActive
        ? `Orion · Playing ${miniPlayerTitle || "stream"}`
        : "Orion Media Player";
    tray.setToolTip(tooltip.slice(0, 120));
    tray.setContextMenu(contextMenu);
  }

  function updateDownloadSurfaces(force = false) {
    const active = getActiveDownloads();
    const signature = active
      .map(
        (entry) =>
          `${entry.id}:${entry.status}:${Math.round(downloadPercent(entry))}:${entry.speed || ""}`,
      )
      .join("|");
    if (!force && signature === lastSignature) return;
    lastSignature = signature;
    updateMenu();

    const mainWindow = getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (active.length === 0) {
      mainWindow.setProgressBar(-1);
      return;
    }
    const average =
      active.reduce((total, entry) => total + downloadPercent(entry), 0) /
      active.length;
    const indeterminate =
      average <= 0 && active.some((entry) => entry.status !== "queued");
    mainWindow.setProgressBar(indeterminate ? 2 : average / 100, {
      mode: indeterminate ? "indeterminate" : "normal",
    });
  }

  const create = () => {
    if (tray) return;
    const iconPath = app.isPackaged
      ? path.join(process.resourcesPath, "icon.png")
      : path.join(rootDir, "public", "icon.png");
    const trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) {
      console.error("Tray icon failed to load:", iconPath);
      return;
    }
    try {
      tray = new Tray(trayIcon);
    } catch (error) {
      console.error("Failed to create tray:", error);
      return;
    }
    tray.on("double-click", () => showMainWindow());
    updateMenu();
  };

  const startDownloadMonitor = () => {
    if (monitorTimer) return;
    updateDownloadSurfaces(true);
    monitorTimer = setInterval(() => updateDownloadSurfaces(), 1000);
  };

  const setMiniPlayerStatus = ({ active, title = "" }) => {
    miniPlayerActive = Boolean(active);
    miniPlayerTitle = title;
    updateMenu();
  };

  const setBatteryStatus = (value) => {
    batteryStatus = value;
    updateMenu();
  };

  const destroy = () => {
    if (monitorTimer) clearInterval(monitorTimer);
    monitorTimer = null;
    if (tray) tray.destroy();
    tray = null;
  };

  return {
    create,
    destroy,
    isMiniPlayerActive: () => miniPlayerActive,
    setMiniPlayerStatus,
    setBatteryStatus,
    showBalloonOnce,
    showMainWindow,
    startDownloadMonitor,
    updateDownloadSurfaces,
    updateMenu,
  };
}

module.exports = { createTrayController };
