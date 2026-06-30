import { useEffect, useMemo, useRef, useState } from "react";
import { CloseIcon, MiniPlayerIcon, PopOutIcon } from "../../../components/common/Icons";
import { storage, STORAGE_KEYS } from "../../../services/settingsStore";

function progressKey(media) {
  if (media.mediaType === "tv") {
    return `tv_${media.mediaId}_s${media.season}e${media.episode}`;
  }
  return `movie_${media.mediaId}`;
}

export default function LocalPlayer({
  download,
  onClose,
  onHistory,
  onMarkWatched,
  onOpenMiniPlayer,
  onSaveProgress,
  onForget,
}) {
  const videoRef = useRef(null);
  const lastSavedRef = useRef(0);
  const [media, setMedia] = useState(null);
  const [error, setError] = useState("");
  const [ambientColors, setAmbientColors] = useState(["#6d3bd1", "#168aa4"]);
  const key = useMemo(() => media ? progressKey(media) : null, [media]);

  useEffect(() => {
    let mounted = true;
    window.electron?.openLocalMedia?.(download.id).then((result) => {
      if (!mounted) return;
      if (!result?.ok) setError(result?.error || "This download could not be opened.");
      else setMedia(result);
    });
    return () => { mounted = false; };
  }, [download.id]);

  useEffect(() => {
    if (!media || !window.electron?.startAmbientSampling) return undefined;
    const ambientProfile = storage.get(STORAGE_KEYS.AMBIENT_PROFILE) || "balanced";
    if (ambientProfile === "off" || storage.get(STORAGE_KEYS.REDUCE_ANIMATIONS)) return undefined;
    const targetId = `local-${download.id}`;
    let paletteHandler = null;
    let disposed = false;
    window.electron.getRendererWebContentsId?.().then((webContentsId) => {
      if (disposed) return;
      const rect = videoRef.current?.getBoundingClientRect?.();
      const cropRect = rect ? {
        x: Math.max(0, Math.round(rect.x)),
        y: Math.max(0, Math.round(rect.y)),
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
      } : undefined;
      window.electron.startAmbientSampling({ targetId, webContentsId, profile: ambientProfile, cropRect });
      paletteHandler = window.electron.onAmbientPalette?.((payload) => {
        if (payload?.targetId === targetId && payload.colors?.length === 2) setAmbientColors(payload.colors);
      });
    });
    return () => {
      disposed = true;
      window.electron.stopAmbientSampling?.(targetId);
      if (paletteHandler) window.electron.offAmbientPalette?.(paletteHandler);
    };
  }, [download.id, media]);

  const savePosition = (force = false) => {
    const video = videoRef.current;
    if (!video || !key || !Number.isFinite(video.duration) || video.duration <= 0) return;
    if (!force && Date.now() - lastSavedRef.current < 1000) return;
    lastSavedRef.current = Date.now();
    const percent = Math.max(0, Math.min(100, video.currentTime / video.duration * 100));
    storage.set("dlTime_" + key, video.currentTime);
    const details = storage.get(STORAGE_KEYS.PROGRESS_DETAILS) || {};
    details[key] = {
      currentTime: video.currentTime,
      duration: video.duration,
      percent,
      updatedAt: Date.now(),
    };
    storage.set(STORAGE_KEYS.PROGRESS_DETAILS, details);
    onSaveProgress?.(key, percent);
  };

  const historyItem = () => ({
    id: media.mediaId,
    title: download.name,
    poster_path: download.posterPath,
    media_type: media.mediaType,
    season: media.season,
    episode: media.episode,
  });

  const openMini = () => {
    const video = videoRef.current;
    savePosition(true);
    onOpenMiniPlayer?.({
      url: media.url,
      title: media.title,
      mediaType: media.mediaType,
      mediaId: media.mediaId,
      season: media.season,
      episode: media.episode,
      currentTime: video?.currentTime || 0,
      duration: video?.duration || 0,
      muted: video?.muted || false,
      volume: video?.volume ?? 1,
      paused: false,
      playbackState: {
        currentTime: video?.currentTime || 0,
        duration: video?.duration || 0,
        muted: video?.muted || false,
        volume: video?.volume ?? 1,
        paused: false,
      },
      local: true,
      item: historyItem(),
      subtitles: media.subtitles || [],
      download,
    });
    onClose();
  };

  if (error) {
    return (
      <div className="local-player-backdrop" role="dialog" aria-modal="true">
        <div className="local-player-error">
          <h2>Local file unavailable</h2><p>{error}</p>
          <button className="btn btn-primary" onClick={async () => {
            const repaired = await window.electron?.repairLocalMedia?.(download.id);
            if (!repaired?.ok) return;
            const result = await window.electron.openLocalMedia(download.id);
            if (result?.ok) { setMedia(result); setError(""); }
          }}>Repair file</button>
          <button className="btn btn-secondary" onClick={() => window.electron?.showInFolder?.(download.filePath)}>Show folder</button>
          <button className="btn btn-ghost" onClick={() => { onForget?.(download); onClose(); }}>Forget record</button>
          <button className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="local-player-backdrop" role="dialog" aria-modal="true" aria-label={`Playing ${download.name}`}>
      <div className="local-player-shell" style={{ "--local-ambient-a": ambientColors[0], "--local-ambient-b": ambientColors[1] }}>
        <div className="local-player-topbar">
          <div><strong>{download.name}</strong><span>Downloaded · {download.qualityPreset === "best" ? "Best quality" : `${download.qualityPreset || "Best"}p`}</span></div>
          <div className="local-player-actions">
            <button onClick={openMini} title="Continue in mini-player" aria-label="Continue in mini-player"><MiniPlayerIcon /></button>
            <button
              onClick={async () => {
                const video = videoRef.current;
                savePosition(true);
                await window.electron?.openPipWindow?.(media.url, media.title, {
                  currentTime: video?.currentTime || 0,
                  muted: video?.muted || false,
                  volume: video?.volume ?? 1,
                  paused: false,
                  orionContext: {
                    mediaType: media.mediaType,
                    mediaId: media.mediaId,
                    season: media.season,
                    episode: media.episode,
                    title: media.title,
                    url: media.url,
                    local: true,
                    subtitles: media.subtitles || [],
                    item: historyItem(),
                  },
                });
                onClose();
              }}
              title="Open pop-out"
              aria-label="Open pop-out"
            ><PopOutIcon /></button>
            <button onClick={onClose} title="Close player" aria-label="Close player"><CloseIcon /></button>
          </div>
        </div>
        {media ? (
          <video
            ref={videoRef}
            className="local-player-video"
            src={media.url}
            controls
            autoPlay
            onLoadedMetadata={(event) => {
              const saved = Number(storage.get("dlTime_" + progressKey(media)) || 0);
              if (saved > 0 && saved < event.currentTarget.duration - 5) event.currentTarget.currentTime = saved;
              onHistory?.(historyItem());
            }}
            onTimeUpdate={() => savePosition(false)}
            onPause={() => savePosition(true)}
            onEnded={() => {
              savePosition(true);
              onMarkWatched?.(progressKey(media));
            }}
          >
            {media.subtitles.map((subtitle, index) => (
              <track
                key={subtitle.url}
                kind="subtitles"
                src={subtitle.url}
                srcLang={subtitle.lang || "en"}
                label={subtitle.lang || subtitle.release || `Subtitle ${index + 1}`}
                default={index === 0}
              />
            ))}
          </video>
        ) : <div className="local-player-loading"><span className="spinner" /> Preparing local playback…</div>}
      </div>
    </div>
  );
}
