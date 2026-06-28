import { useEffect, useMemo, useRef, useState } from "react";
import { DownloadIcon, SearchIcon } from "../../components/common/Icons";
import SubtitleDownloaderModal from "../../components/SubtitleDownloaderModal";
import { storage, STORAGE_KEYS } from "../../services/settingsStore";
import LocalPlayer from "./components/LocalPlayer";

const ACTIVE = new Set(["queued", "preflighting", "downloading", "processing", "paused", "interrupted"]);
const STATUS_LABEL = {
  queued: "Queued", preflighting: "Checking source", downloading: "Downloading",
  processing: "Finishing", paused: "Paused", interrupted: "Interrupted",
  completed: "Completed", failed: "Failed", error: "Failed", cancelled: "Cancelled",
};

function statusGroup(status) {
  if (ACTIVE.has(status)) return "active";
  if (status === "completed") return "completed";
  return "failed";
}

function formatDate(timestamp) {
  if (!timestamp) return "";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(timestamp));
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor(seconds % 3600 / 60);
  const s = Math.floor(seconds % 60);
  return h ? `${h}h ${m}m` : m ? `${m}m ${s}s` : `${s}s`;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${Math.round(bytes / 1e3)} KB`;
}

export default function DownloadsPage({
  downloads = [], onDeleteDownload, highlightId, onClearHighlight, searchOpen,
  onSearchClose, onSettings, onUpdateDownload, onHistory, onSaveProgress,
  onMarkWatched, onOpenMiniPlayer,
}) {
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [mediaFilter, setMediaFilter] = useState("all");
  const [sortBy, setSortBy] = useState(() => storage.get(STORAGE_KEYS.DL_SORT_BY) || "newest");
  const [actionError, setActionError] = useState("");
  const [subtitleDownload, setSubtitleDownload] = useState(null);
  const [localPlayback, setLocalPlayback] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());
  const [now, setNow] = useState(Date.now());
  const searchRef = useRef(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => { if (searchOpen) searchRef.current?.focus(); }, [searchOpen]);
  useEffect(() => { storage.set(STORAGE_KEYS.DL_SORT_BY, sortBy); }, [sortBy]);
  useEffect(() => {
    if (!highlightId) return;
    const item = downloads.find((download) => download.id === highlightId);
    if (item) setTab(statusGroup(item.status));
    const timer = setTimeout(() => {
      document.querySelector(`[data-download-id="${highlightId}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      onClearHighlight?.();
    }, 150);
    return () => clearTimeout(timer);
  }, [highlightId, downloads, onClearHighlight]);

  const counts = useMemo(() => downloads.reduce((result, item) => {
    result.all += 1;
    result[statusGroup(item.status)] += 1;
    return result;
  }, { all: 0, active: 0, completed: 0, failed: 0 }), [downloads]);

  const visible = useMemo(() => {
    const result = downloads
      .filter((item) => tab === "all" || statusGroup(item.status) === tab)
      .filter((item) => mediaFilter === "all" || item.mediaType === mediaFilter)
      .filter((item) => !query || `${item.name} ${item.sourceHost || ""}`.toLowerCase().includes(query.toLowerCase()));
    return result.sort((a, b) => {
      if (sortBy === "oldest") return (a.startedAt || 0) - (b.startedAt || 0);
      if (sortBy === "name") return String(a.name || "").localeCompare(String(b.name || ""));
      if (sortBy === "progress") return (b.progress || 0) - (a.progress || 0);
      if (sortBy === "size") return (b.totalBytes || b.downloadedBytes || 0) - (a.totalBytes || a.downloadedBytes || 0);
      return (b.completedAt || b.startedAt || 0) - (a.completedAt || a.startedAt || 0);
    });
  }, [downloads, mediaFilter, query, sortBy, tab]);

  const pause = async (item) => {
    const result = await window.electron.pauseDownload(item.id);
    if (result?.ok) onUpdateDownload?.(item.id, { status: "paused", lastMessage: "Paused", updatedAt: Date.now() });
    else setActionError(result?.error || "Could not pause this download.");
  };
  const resume = async (item) => {
    setActionError("");
    const result = await window.electron.resumeDownload({ id: item.id });
    if (result?.ok) onUpdateDownload?.(item.id, { status: "downloading", lastMessage: "Resuming…", updatedAt: Date.now() });
    else setActionError(result?.error || "Could not resume this download.");
  };
  const remove = async (item) => {
    setActionError("");
    const result = await window.electron.deleteDownload({ id: item.id, filePath: item.filePath || null });
    if (result?.ok) onDeleteDownload?.(item.id);
    else setActionError(result?.error || "Could not remove this download.");
  };
  const pauseAll = async () => {
    for (const item of downloads.filter((entry) => entry.status === "downloading")) await pause(item);
  };
  const resumeAll = async () => {
    for (const item of downloads.filter((entry) => ["paused", "interrupted"].includes(entry.status))) await resume(item);
  };
  const retryFailed = async () => {
    setActionError("");
    for (const item of downloads.filter((entry) => statusGroup(entry.status) === "failed")) await resume(item);
  };
  const clearFailed = async () => {
    if (!window.confirm("Remove all failed download records? Partial files for these tasks will also be cleaned up.")) return;
    for (const item of downloads.filter((entry) => statusGroup(entry.status) === "failed")) await remove(item);
  };

  return (
    <div className="downloads-page fade-in">
      {localPlayback && <LocalPlayer download={localPlayback} onClose={() => setLocalPlayback(null)} onHistory={onHistory} onSaveProgress={onSaveProgress} onMarkWatched={onMarkWatched} onOpenMiniPlayer={onOpenMiniPlayer} onForget={(item) => remove({ ...item, filePath: null })} />}
      {subtitleDownload && <SubtitleDownloaderModal
        dl={subtitleDownload} onClose={() => setSubtitleDownload(null)}
        onOpenSettings={(section) => onSettings?.(section)}
        onSubtitlesSaved={(subtitlePaths) => {
          onUpdateDownload?.(subtitleDownload.id, { subtitlePaths });
          setSubtitleDownload((current) => current ? { ...current, subtitlePaths } : current);
        }}
        onSubtitleDeleted={(subtitlePath) => {
          const subtitlePaths = (subtitleDownload.subtitlePaths || []).filter((item) => item.path !== subtitlePath);
          onUpdateDownload?.(subtitleDownload.id, { subtitlePaths });
          setSubtitleDownload((current) => current ? { ...current, subtitlePaths } : current);
        }}
      />}
      <header className="downloads-header page-header">
        <div><span className="page-eyebrow">Offline media</span><h1>Downloads</h1><p>Manage active transfers and media available on this device.</p></div>
        <div className="downloads-header-actions">
          {counts.active > 0 && <button className="btn btn-secondary" onClick={pauseAll}>Pause all</button>}
          {downloads.some((item) => ["paused", "interrupted"].includes(item.status)) && <button className="btn btn-secondary" onClick={resumeAll}>Resume interrupted</button>}
          {counts.failed > 0 && <button className="btn btn-secondary" onClick={retryFailed}>Retry failed</button>}
          {counts.failed > 0 && <button className="btn btn-ghost" onClick={clearFailed}>Clear failed</button>}
          <button className="btn btn-secondary" onClick={() => onSettings?.("downloads")}>Download settings</button>
        </div>
      </header>

      <div className="downloads-toolbar">
        <div className="downloads-tabs">
          {["all", "active", "completed", "failed"].map((value) => <button key={value} className={tab === value ? "active" : ""} onClick={() => setTab(value)}>{value[0].toUpperCase() + value.slice(1)} <span>{counts[value]}</span></button>)}
        </div>
        <div className="downloads-toolbar-controls">
          <select value={mediaFilter} onChange={(event) => setMediaFilter(event.target.value)} aria-label="Filter media type"><option value="all">All media</option><option value="movie">Movies</option><option value="tv">Series</option></select>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Sort downloads"><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="name">Name</option><option value="progress">Progress</option><option value="size">Size</option></select>
          <label className="downloads-search"><SearchIcon size={17} /><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} onBlur={onSearchClose} placeholder="Search downloads" /></label>
        </div>
      </div>
      {actionError && <div className="download-error" role="alert">{actionError}</div>}

      {visible.length === 0 ? (
        <div className="downloads-empty"><span><DownloadIcon size={32} /></span><h2>{query ? "No matching downloads" : tab === "all" ? "No downloads yet" : `No ${tab} downloads`}</h2><p>{tab === "active" ? "Start playback, then use Download on a movie or episode." : tab === "completed" ? "Finished downloads will be ready for Orion playback here." : tab === "failed" ? "Failed tasks and recovery actions will appear here." : "Play a title and choose Download to build your offline library."}</p>{query && <button className="btn btn-secondary" onClick={() => setQuery("")}>Clear search</button>}</div>
      ) : (
        <div className="download-list">
          {visible.map((item) => {
            const paused = ["paused", "interrupted"].includes(item.status);
            const failed = statusGroup(item.status) === "failed";
            const completed = item.status === "completed";
            const isExpanded = expanded.has(item.id);
            const elapsed = Math.max(0, ((item.completedAt || now) - (item.startedAt || now)) / 1000);
            const bytes = item.downloadedBytes ? `${formatBytes(item.downloadedBytes)}${item.totalBytes ? ` / ${formatBytes(item.totalBytes)}` : ""}` : item.size;
            return (
              <article key={item.id} data-download-id={item.id} className={`download-card${highlightId === item.id ? " highlighted" : ""}${isExpanded ? " expanded" : ""}`}>
                {item.posterPath ? <img src={`https://image.tmdb.org/t/p/w185${item.posterPath}`} alt="" /> : <div className="download-card-poster"><DownloadIcon size={24} /></div>}
                <div className="download-card-body">
                  <div className="download-card-title"><div><h3>{item.name}</h3><p>{item.mediaType === "tv" && item.season ? `Season ${item.season}${item.episode ? ` · Episode ${item.episode}` : ""}` : "Movie"} · {item.qualityPreset === "best" || !item.qualityPreset ? "Best quality" : `${item.qualityPreset}p`}</p></div><span className={`download-status ${statusGroup(item.status)}`}>{STATUS_LABEL[item.status] || item.status}</span></div>
                  {!completed && <div className="download-progress"><div><span style={{ width: `${Math.max(0, Math.min(100, item.progress || 0))}%` }} /></div><strong>{Math.round(item.progress || 0)}%</strong></div>}
                  <div className="download-card-meta"><span>{item.lastMessage || (completed ? "Ready to watch" : "Waiting…")}</span>{item.speed && <span>{item.speed}</span>}{bytes && <span>{bytes}</span>}{item.etaSeconds != null && !completed && <span>ETA {formatDuration(item.etaSeconds)}</span>}<span>{formatDuration(elapsed)} elapsed</span></div>
                  {isExpanded && <div className="download-card-details">
                    <div><span>Fragments</span><strong>{item.completedFragments || 0} / {item.totalFragments || "—"}</strong></div>
                    <div><span>Retries</span><strong>{item.retryCount || 0}</strong></div>
                    <div><span>Strategy</span><strong>{String(item.strategy || item.downloaderEngine || "Automatic").replaceAll("-", " ")}</strong></div>
                    <div><span>Source</span><strong>{item.sourceHost || "Protected source"}</strong></div>
                    <div><span>Started</span><strong>{formatDate(item.startedAt)}</strong></div>
                    <div><span>Finished</span><strong>{formatDate(item.completedAt) || "—"}</strong></div>
                    <div className="wide"><span>Destination</span><strong title={item.filePath || item.downloadPath}>{item.filePath || item.downloadPath || "—"}</strong></div>
                  </div>}
                  <div className="download-card-actions">
                    {item.status === "downloading" && <button className="btn btn-secondary" onClick={() => pause(item)}>Pause</button>}
                    {(paused || failed) && <button className="btn btn-primary" onClick={() => resume(item)}>{failed ? "Retry" : "Resume"}</button>}
                    {completed && item.filePath && <><button className="btn btn-primary" onClick={() => setLocalPlayback(item)}>Play in Orion</button><button className="btn btn-secondary" onClick={() => window.electron.openPathAtTime(item.filePath, 0, item.subtitlePaths || [])}>Open externally</button><button className="btn btn-secondary" onClick={() => window.electron.showInFolder(item.filePath)}>Show in folder</button><button className="btn btn-secondary" onClick={() => setSubtitleDownload(item)}>Subtitles</button></>}
                    {failed && item.logPath && <button className="btn btn-secondary" onClick={() => window.electron.openDownloadLog(item.logPath)}>Diagnostics</button>}
                    <button className="btn btn-ghost" onClick={() => setExpanded((current) => { const next = new Set(current); next.has(item.id) ? next.delete(item.id) : next.add(item.id); return next; })}>{isExpanded ? "Less info" : "More info"}</button>
                    <button className="btn btn-ghost danger" onClick={() => remove(item)}>{completed ? "Delete file" : item.status === "downloading" ? "Cancel" : "Remove"}</button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
