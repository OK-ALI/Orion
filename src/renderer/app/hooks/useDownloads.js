import { useCallback, useEffect, useMemo, useState } from "react";
import { storage, STORAGE_KEYS } from "../../services/settingsStore";

const ACTIVE_STATUSES = new Set(["queued", "preflighting", "downloading", "processing"]);

export function useDownloads() {
  const [downloads, setDownloads] = useState([]);
  const [highlightDownload, setHighlightDownload] = useState(null);

  useEffect(() => {
    if (!window.electron) return undefined;
    let mounted = true;
    window.electron.getDownloads().then(async (list) => {
      if (!mounted || !Array.isArray(list)) return;
      const pruned = [...list];
      const remove = new Set();
      await Promise.all(pruned.map(async (download) => {
        if (download.status !== "completed" || !download.filePath) return;
        const exists = await window.electron.fileExists(download.filePath);
        if (!exists) {
          window.electron.deleteDownload({ id: download.id, filePath: null });
          remove.add(download.id);
          return;
        }
        if (download.subtitlePaths?.length && window.electron.pruneSubtitlePaths) {
          const result = await window.electron.pruneSubtitlePaths(download.id);
          if (result?.ok) download.subtitlePaths = result.subtitlePaths;
        }
      }));
      if (mounted) setDownloads(pruned.filter((download) => !remove.has(download.id)));
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!window.electron) return undefined;
    const handler = window.electron.onDownloadProgress((update) => {
      if (update.status === "completed") {
        if (storage.get(STORAGE_KEYS.NOTIFY_DOWNLOAD_COMPLETE) !== false && window.electron.showNotification) {
          window.electron.showNotification({ title: "Download complete", body: update.name || "Your download has finished.", silent: false });
        }
        
        // Auto-backup to Google Drive if configured
        const autoBackup = localStorage.getItem("orion_google_auto_backup_media") === "true";
        const isLoggedIn = localStorage.getItem("orion_google_sync_enabled") !== "false";
        if (autoBackup && isLoggedIn && update.filePath && window.electron.uploadMediaFile && window.electron.updateDownloadRecord) {
          setDownloads((previous) => previous.map((download) => download.id === update.id ? { ...download, uploading: true } : download));
          
          const dlItem = downloads.find((d) => d.id === update.id);
          const metadata = dlItem ? {
            mediaType: dlItem.mediaType,
            name: dlItem.name,
            season: dlItem.season
          } : {
            mediaType: update.mediaType || "movie",
            name: update.name || "Unknown Title",
            season: update.season
          };

          window.electron.uploadMediaFile(update.filePath, update.name, metadata).then((res) => {
            if (res?.ok && res.fileId) {
              window.electron.updateDownloadRecord(update.id, { driveFileId: res.fileId });
              setDownloads((previous) => previous.map((download) => download.id === update.id ? { ...download, driveFileId: res.fileId, uploading: false } : download));
            } else {
              setDownloads((previous) => previous.map((download) => download.id === update.id ? { ...download, uploading: false } : download));
            }
          }).catch(() => {
            setDownloads((previous) => previous.map((download) => download.id === update.id ? { ...download, uploading: false } : download));
          });
        }
      }
      setDownloads((previous) => {
        const index = previous.findIndex((download) => download.id === update.id);
        if (index === -1) return update.name ? [update, ...previous] : previous;
        const next = [...previous];
        next[index] = { ...next[index], ...update };
        return next;
      });
    });
    return () => window.electron.offDownloadProgress(handler);
  }, []);

  const handleDownloadStarted = useCallback((entry) => {
    setDownloads((previous) => {
      const index = previous.findIndex((download) => download.id === entry.id);
      if (index === -1) return [entry, ...previous];
      const next = [...previous];
      next[index] = { ...next[index], ...entry };
      return next;
    });
  }, []);

  const handleDeleteDownload = useCallback((id) => {
    setDownloads((previous) => previous.filter((download) => download.id !== id));
  }, []);

  const activeDownloadCount = useMemo(() => downloads.filter((download) => ACTIVE_STATUSES.has(download.status)).length, [downloads]);

  return { activeDownloadCount, downloads, handleDeleteDownload, handleDownloadStarted, highlightDownload, setDownloads, setHighlightDownload };
}
