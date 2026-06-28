import { useEffect, useMemo, useState } from "react";
import { CloseIcon, DownloadIcon, SettingsIcon, SubtitlesIcon } from "./common/Icons";
import { storage, STORAGE_KEYS, secureStorage } from "../services/settingsStore";
import { LANG_LABEL } from "../shared/utils/subtitles";

const QUALITY_OPTIONS = [
  ["best", "Best available"],
  ["1080", "Up to 1080p"],
  ["720", "Up to 720p"],
  ["480", "Up to 480p"],
];

function subtitleKey(subtitle, index) {
  return subtitle.file_id || subtitle.direct_url || subtitle.url || `subtitle-${index}`;
}

function subtitleLanguage(subtitle) {
  const raw = String(subtitle.language || subtitle.lang || "").trim();
  const normalized = raw.toLowerCase().replace("_", "-");
  const base = normalized.split("-")[0];
  return {
    code: raw ? normalized.toUpperCase() : "SUB",
    label: LANG_LABEL[normalized] || LANG_LABEL[base] || raw || "Subtitle",
  };
}

function subtitleSource(subtitle) {
  if (subtitle.via_subdl) return "SubDL";
  if (subtitle.via_wyzie || String(subtitle.file_id || "").startsWith("wyzie_")) return "Wyzie";
  return "Stream";
}

export default function DownloadModal({
  onClose,
  captureSessionId,
  m3u8Url,
  m3u8Context,
  subtitles = [],
  mediaName,
  onOpenSettings,
  onDownloadStarted,
  mediaId,
  mediaType,
  season,
  episode,
  posterPath,
  tmdbId,
}) {
  const [candidates, setCandidates] = useState([]);
  const [candidateId, setCandidateId] = useState(m3u8Context?.candidateId || m3u8Context?.id || "");
  const [quality, setQuality] = useState(() => storage.get(STORAGE_KEYS.DOWNLOAD_QUALITY) || "best");
  const [downloadPath, setDownloadPath] = useState(() => storage.get(STORAGE_KEYS.DOWNLOAD_PATH) || "");
  const [toolStatus, setToolStatus] = useState(null);
  const [installing, setInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState(null);
  const [advanced, setAdvanced] = useState(false);
  const [availableSubtitles, setAvailableSubtitles] = useState(subtitles);
  const [selectedSubs, setSelectedSubs] = useState(() => new Set(subtitles.map((_, index) => index)));
  const [subtitleStatus, setSubtitleStatus] = useState("");
  const [subtitleState, setSubtitleState] = useState(subtitles.length ? "ready" : "idle");
  const [preferredSubtitleKey, setPreferredSubtitleKey] = useState("");
  const [subtitleProviders, setSubtitleProviders] = useState({ subdl: false, wyzie: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [detectingSeconds, setDetectingSeconds] = useState(0);

  const selectedCandidate = useMemo(
    () => candidates.find((item) => item.id === candidateId) || candidates[0] || null,
    [candidates, candidateId],
  );

  const refresh = async () => {
    if (!window.electron) return;
    const [streams, status] = await Promise.all([
      window.electron.listStreamCandidates?.({ sessionId: captureSessionId }) || [],
      window.electron.getDownloaderStatus(),
    ]);
    const next = Array.isArray(streams) ? streams : [];
    setCandidates(next);
    setCandidateId((current) => current || m3u8Context?.candidateId || m3u8Context?.id || next[0]?.id || "");
    setToolStatus(status);
  };

  useEffect(() => {
    refresh();
  }, [captureSessionId, m3u8Context?.candidateId, m3u8Context?.id]);

  useEffect(() => {
    const startedAt = Date.now();
    const refreshCandidates = async () => {
      const streams = await window.electron?.listStreamCandidates?.({
        sessionId: captureSessionId,
      });
      const next = Array.isArray(streams) ? streams : [];
      setCandidates(next);
      setCandidateId((current) => current || next[0]?.id || "");
      setDetectingSeconds(Math.floor((Date.now() - startedAt) / 1000));
    };
    const timer = window.setInterval(refreshCandidates, 1000);
    const handler = window.electron?.onM3u8Found?.((candidate) => {
      if (captureSessionId && candidate?.sessionId !== captureSessionId) return;
      refreshCandidates();
    });
    return () => {
      window.clearInterval(timer);
      if (handler) window.electron?.offM3u8Found?.(handler);
    };
  }, [captureSessionId]);

  useEffect(() => {
    if (!window.electron?.onDownloaderToolsProgress) return undefined;
    const handler = window.electron.onDownloaderToolsProgress((update) => {
      setInstallProgress(update);
      if (update?.error) setError(update.error);
    });
    return () => window.electron.offDownloaderToolsProgress(handler);
  }, []);

  useEffect(() => {
    let mounted = true;
    const enabled =
      storage.get(STORAGE_KEYS.SUBTITLE_ENABLED) !== 0 &&
      storage.get(STORAGE_KEYS.SUBTITLE_ENABLED) !== "0";
    if (!enabled || !tmdbId || !window.electron?.searchSubtitles) {
      if (!enabled) {
        setSubtitleState("disabled");
        setSubtitleStatus("Automatic subtitle search is disabled in Settings.");
      } else if (subtitles.length) {
        setSubtitleState("ready");
        setSubtitleStatus(`${subtitles.length} subtitle track${subtitles.length === 1 ? "" : "s"} detected in the stream.`);
      }
      return () => { mounted = false; };
    }
    const preferredLanguage = storage.get(STORAGE_KEYS.SUBTITLE_LANG) || "en";
    setSubtitleState("searching");
    setSubtitleStatus(`Searching for ${preferredLanguage.toUpperCase()} subtitles…`);
    Promise.all([
      secureStorage.get(STORAGE_KEYS.SUBDL_API_KEY),
      secureStorage.get(STORAGE_KEYS.WYZIE_API_KEY),
    ]).then(async ([subdlApiKey, wyzieApiKey]) => {
      if (!mounted) return;
      const providers = {
        subdl: Boolean(String(subdlApiKey || "").trim()),
        wyzie: Boolean(String(wyzieApiKey || "").trim()),
      };
      setSubtitleProviders(providers);
      if (!providers.subdl && !providers.wyzie) {
        setSubtitleState("setup");
        setSubtitleStatus("Connect SubDL or Wyzie to search for downloadable subtitles.");
        return;
      }
      const result = await window.electron.searchSubtitles({
        tmdbId,
        mediaType,
        season,
        episode,
        languages: preferredLanguage,
        subdlApiKey: subdlApiKey || "",
        wyzieApiKey: wyzieApiKey || "",
      });
      if (!mounted) return;
      if (!result?.ok || !result.results?.length) {
        setSubtitleState("error");
        setSubtitleStatus(result?.error || "No automatic subtitles found.");
        return;
      }
      const combined = [...subtitles];
      for (const subtitle of result.results.slice(0, 6)) {
        const key = subtitle.file_id || subtitle.direct_url || subtitle.url;
        if (!combined.some((item) => (item.file_id || item.direct_url || item.url) === key)) {
          combined.push(subtitle);
        }
      }
      setAvailableSubtitles(combined);
      const preferredKey = subtitleKey(result.results[0], 0);
      setPreferredSubtitleKey(preferredKey);
      setSelectedSubs((current) => {
        const next = new Set(current);
        const preferredIndex = combined.findIndex(
          (item, index) => subtitleKey(item, index) === preferredKey,
        );
        if (preferredIndex >= 0) next.add(preferredIndex);
        return next;
      });
      setSubtitleState("ready");
      setSubtitleStatus(`${result.results.length} subtitle option${result.results.length === 1 ? "" : "s"} found. The preferred match is selected.`);
    }).catch((searchError) => {
      if (mounted) {
        setSubtitleState("error");
        setSubtitleStatus(searchError.message || "Subtitle search failed.");
      }
    });
    return () => { mounted = false; };
  }, [tmdbId, mediaType, season, episode, subtitles]);

  const installTools = async () => {
    setInstalling(true);
    setError("");
    setInstallProgress({ step: "Preparing", progress: 0 });
    try {
      if (!window.electron?.installDownloaderTools) {
        throw new Error("Orion's desktop bridge is unavailable. Restart Orion and try again.");
      }
      const result = await window.electron.installDownloaderTools();
      if (!result?.ok) {
        setError(result?.error || "Downloader tools could not be installed.");
      } else if (result.status) {
        setToolStatus(result.status);
      }
    } catch (installError) {
      setError(installError?.message || "Downloader tools could not be installed.");
    } finally {
      setInstalling(false);
      await refresh();
    }
  };

  const chooseFolder = async () => {
    const folder = await window.electron?.pickFolder?.();
    if (!folder) return;
    storage.set(STORAGE_KEYS.DOWNLOAD_PATH, folder);
    setDownloadPath(folder);
  };

  const start = async () => {
    if (!downloadPath) {
      setError("Choose a download folder first.");
      return;
    }
    if (!toolStatus?.exists) {
      await installTools();
      return;
    }
    if (!selectedCandidate && !m3u8Url) {
      setError("No video stream has been captured yet. Start playback, wait a moment, then retry.");
      return;
    }
    setBusy(true);
    setError("");
    let preflight = null;
    if (selectedCandidate?.kind === "hls") {
      preflight = await window.electron.preflightStream(selectedCandidate.id);
      if (!preflight?.ok) {
        setBusy(false);
        setError(preflight?.error || "The selected stream is not downloadable.");
        return;
      }
    } else if (selectedCandidate) {
      preflight = { ok: true, strategy: "direct" };
    }
    storage.set(STORAGE_KEYS.DOWNLOAD_QUALITY, quality);
    const result = await window.electron.runDownload({
      candidateId: selectedCandidate?.id,
      m3u8Url: selectedCandidate ? undefined : m3u8Url,
      m3u8Context: selectedCandidate ? undefined : m3u8Context,
      name: mediaName,
      downloadPath,
      mediaId,
      mediaType,
      season,
      episode,
      posterPath,
      tmdbId,
      qualityPreset: quality,
      concurrency: storage.get(STORAGE_KEYS.DOWNLOAD_CONCURRENCY) || 2,
      fragmentConcurrency: storage.get(STORAGE_KEYS.DOWNLOAD_FRAGMENT_CONCURRENCY) || 6,
      downloadStrategy: preflight?.strategy || "auto",
      subtitles: availableSubtitles.filter((_, index) => selectedSubs.has(index)),
      downloaderEngine: "auto",
    });
    setBusy(false);
    if (!result?.ok) {
      setError(result?.error || "The download could not be started.");
      return;
    }
    onDownloadStarted?.(result.download || {
      id: result.id,
      name: mediaName,
      mediaId,
      tmdbId,
      mediaType,
      season,
      episode,
      posterPath,
      status: "downloading",
      progress: 0,
      qualityPreset: quality,
    });
    onClose();
  };

  return (
    <div className="download-modal-backdrop" onClick={onClose} role="presentation">
      <div className="download-dialog" role="dialog" aria-modal="true" aria-labelledby="download-title" onClick={(event) => event.stopPropagation()}>
        <button className="download-dialog-close" onClick={onClose} aria-label="Close downloader"><CloseIcon size={15} /></button>
        <div className="download-dialog-heading">
          <span className="download-dialog-icon"><DownloadIcon size={24} /></span>
          <div><h2 id="download-title">Download</h2><p>{mediaName}</p></div>
        </div>

        <div className={`download-readiness ${selectedCandidate ? "ready" : "waiting"}`}>
          <strong>{selectedCandidate ? `${selectedCandidate.kind.toUpperCase()} source ready` : detectingSeconds >= 10 ? "Still detecting playback" : "Detecting a downloadable stream"}</strong>
          <span>{selectedCandidate
            ? `${selectedCandidate.host} · ${selectedCandidate.rankReason}`
            : detectingSeconds >= 30
              ? "No downloadable response was found. This source may be browser-only, DRM protected, or still loading."
              : `Keep the video playing while Orion watches its media requests${detectingSeconds ? ` · ${detectingSeconds}s` : ""}.`}</span>
          {!selectedCandidate && (
            <button type="button" className="download-detect-refresh" onClick={refresh}>
              Refresh detection
            </button>
          )}
        </div>

        {candidates.length > 1 && (
          <div className="download-field">
            <button className="download-advanced-toggle" onClick={() => setAdvanced((value) => !value)}>
              {advanced ? "Hide" : "Choose"} captured source ({candidates.length})
            </button>
            {advanced && (
              <select value={selectedCandidate?.id || ""} onChange={(event) => setCandidateId(event.target.value)}>
                {candidates.map((candidate, index) => (
                  <option key={candidate.id} value={candidate.id}>#{index + 1} {candidate.host} — {candidate.rankReason}</option>
                ))}
              </select>
            )}
          </div>
        )}

        <div className="download-form-grid">
          <label className="download-field"><span>Quality</span><select value={quality} onChange={(event) => setQuality(event.target.value)}>{QUALITY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <div className="download-field"><span>Destination</span><button className="download-path-button" onClick={chooseFolder} title={downloadPath}>{downloadPath || "Choose folder…"}</button></div>
        </div>

        {(availableSubtitles.length > 0 || subtitleStatus) && (
          <section className="download-subtitles" aria-labelledby="download-subtitles-title">
            <div className="download-subtitles-header">
              <span className="download-subtitles-icon"><SubtitlesIcon size={17} /></span>
              <div>
                <div className="download-subtitles-title-row">
                  <strong id="download-subtitles-title">Subtitles</strong>
                  {selectedSubs.size > 0 && <span className="download-subtitles-count">{selectedSubs.size} selected</span>}
                  {subtitleProviders.subdl && <span className="download-subtitles-provider subdl">SubDL</span>}
                  {subtitleProviders.wyzie && <span className="download-subtitles-provider wyzie">Wyzie</span>}
                </div>
                <span>Saved beside the video as playable sidecar files.</span>
              </div>
              {availableSubtitles.length > 0 && (
                <div className="download-subtitles-actions" aria-label="Subtitle selection controls">
                  <button type="button" onClick={() => setSelectedSubs(new Set(availableSubtitles.map((_, index) => index)))} disabled={selectedSubs.size === availableSubtitles.length}>All</button>
                  <button type="button" onClick={() => setSelectedSubs(new Set())} disabled={selectedSubs.size === 0}>None</button>
                </div>
              )}
            </div>

            {subtitleStatus && (
              <div className={`download-subtitles-status ${subtitleState}`} role="status">
                {subtitleState === "searching" && <span className="download-subtitles-spinner" aria-hidden="true" />}
                <span>{subtitleStatus}</span>
              </div>
            )}

            {subtitleState === "setup" && (
              <div className="download-subtitles-setup">
                <strong>One-time subtitle setup</strong>
                <p>Subtitle providers use your own API key. Choose either service, copy its key, then save it in Orion’s Subtitle settings.</p>
                <ol>
                  <li><span>SubDL</span> Create a free account and copy the API key from Settings.</li>
                  <li><span>Wyzie</span> Redeem or create a key, then copy the <code>wyzie-…</code> value.</li>
                </ol>
                <div>
                  <button type="button" onClick={() => window.electron?.openExternal("https://subdl.com/settings")}>Get SubDL key ↗</button>
                  <button type="button" onClick={() => window.electron?.openExternal("https://store.wyzie.io/redeem")}>Get Wyzie key ↗</button>
                  <button type="button" className="primary" onClick={() => onOpenSettings?.("subtitles")}>Configure in Settings</button>
                </div>
              </div>
            )}

            {subtitleState !== "setup" && availableSubtitles.length > 0 ? (
              <div className="download-subtitles-list">
                {availableSubtitles.map((subtitle, index) => {
                  const language = subtitleLanguage(subtitle);
                  const source = subtitleSource(subtitle);
                  const selected = selectedSubs.has(index);
                  const recommended = subtitleKey(subtitle, index) === preferredSubtitleKey;
                  const release = subtitle.release || subtitle.file_name || subtitle.name || `${language.label} subtitle`;
                  return (
                    <label className={`download-subtitle-option ${selected ? "selected" : ""}`} key={`${subtitleKey(subtitle, index)}-${index}`}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => setSelectedSubs((current) => {
                          const next = new Set(current);
                          next.has(index) ? next.delete(index) : next.add(index);
                          return next;
                        })}
                      />
                      <span className="download-subtitle-check" aria-hidden="true">{selected ? "✓" : ""}</span>
                      <span className="download-subtitle-language">
                        <strong>{language.code}</strong>
                        <small>{language.label}</small>
                      </span>
                      <span className="download-subtitle-details">
                        <span className="download-subtitle-release" title={release}>{release}</span>
                        <span className="download-subtitle-meta">
                          <b className={`source-${source.toLowerCase()}`}>{source}</b>
                          {recommended && <em>Best match</em>}
                          {subtitle.hearing_impaired && <span title="Includes hearing-impaired cues">CC</span>}
                          {subtitle.ai_translated && <span title="AI translated">AI</span>}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : subtitleState !== "searching" && subtitleState !== "setup" ? (
              <div className="download-subtitles-empty">No selectable subtitle tracks are currently available.</div>
            ) : null}

            <button type="button" className="download-subtitles-settings" onClick={() => onOpenSettings?.("subtitles")}>
              <SettingsIcon size={13} /> Subtitle preferences
            </button>
          </section>
        )}

        {!toolStatus?.exists && (
          <div className="download-tools-warning"><strong>Downloader tools required</strong><span>{installProgress?.step || "Orion will install its managed yt-dlp and ffmpeg tools."}</span>{installProgress && <progress max="100" value={installProgress.progress || 0} />}</div>
        )}
        {error && <div className="download-error" role="alert">{error}</div>}

        <div className="download-dialog-actions">
          <button className="btn btn-ghost" onClick={() => onOpenSettings?.("downloads")}>Settings</button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={toolStatus?.exists ? start : installTools} disabled={busy || installing}>
            {installing ? "Installing…" : busy ? "Checking stream…" : toolStatus?.exists ? "Start download" : "Install downloader"}
          </button>
        </div>
      </div>
    </div>
  );
}
