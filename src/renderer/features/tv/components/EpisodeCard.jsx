import { memo } from "react";
import { imgUrl } from "../../../services/tmdb";
import { DownloadIcon, PlayIcon, WatchedIcon } from "../../../components/common/Icons";
import { formatDate } from "../../../shared/utils/date";
import { EpisodeDesc } from "./EpisodeUi";

const today = (() => {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value;
})();

function EpisodeCard({ ep, itemId, selectedSeason, epPct, epWatched, playing, selectedEpNumber, downloadsByEpisodeKey, restricted, onPlay, onDownload, onContextMenu, onGoToDownloads }) {
  const progressKey = `tv_${itemId}_s${selectedSeason}e${ep.episode_number}`;
  const isPlaying = playing && selectedEpNumber === ep.episode_number;
  const isUnreleased = Boolean(ep.air_date) && new Date(ep.air_date) > today;
  const download = downloadsByEpisodeKey.get(`s${selectedSeason}e${ep.episode_number}`) ?? null;
  return (
    <div
      className={`episode-card ${isPlaying ? "playing" : ""} ${epWatched ? "ep-watched" : ""} ${restricted ? "episode-card--restricted" : ""} ${isUnreleased ? "episode-card--unreleased" : ""}`}
      onClick={() => (restricted || isUnreleased ? null : onPlay(ep))}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!restricted && !isUnreleased) onContextMenu({ x: event.clientX, y: event.clientY, pk: progressKey });
      }}
      style={isUnreleased ? { cursor: "default" } : undefined}
    >
      <div className="episode-thumb">
        {ep.still_path ? (
          <img src={imgUrl(ep.still_path, "w300")} alt={ep.name} loading="lazy" />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)" }}><PlayIcon /></div>
        )}
        {restricted ? (
          <div className="episode-restricted-overlay">🔒<span>Inappropriate for your age</span></div>
        ) : isUnreleased ? (
          <div className="episode-restricted-overlay">🔒<span>Unreleased</span></div>
        ) : isPlaying ? (
          <div className="episode-playing-badge"><span className="episode-playing-dot" />Playing</div>
        ) : (
          <div className="episode-thumb-play"><PlayIcon /></div>
        )}
      </div>
      <div className="episode-info">
        <div className="episode-num" style={{ display: "flex", alignItems: "center", gap: 5 }}>
          E{ep.episode_number}
          {epWatched && <WatchedIcon size={14} />}
          {download && (
            <span
              className="ep-downloaded-badge"
              title={download.status === "downloading" ? "Downloading… - click to view in Downloads" : "Downloaded - click to view in Downloads"}
              style={{
                borderColor: download.status === "downloading" ? "rgba(229,9,20,0.5)" : "rgba(72,199,116,0.5)",
                color: download.status === "downloading" ? "var(--red)" : "#4caf50",
                background: download.status === "downloading" ? "rgba(229,9,20,0.12)" : "rgba(72,199,116,0.18)",
              }}
              onClick={(event) => { event.stopPropagation(); onGoToDownloads?.(download.id); }}
            >↓</span>
          )}
        </div>
        <div className="episode-name">{ep.name}</div>
        {ep.air_date && <div className="episode-air-date" style={{ fontSize: 11, color: "var(--text3)", marginTop: 2, marginBottom: 4 }}>{formatDate(ep.air_date)}</div>}
        <EpisodeDesc overview={ep.overview} />
        {!restricted && !isUnreleased && (
          <button
            className="episode-download-btn"
            onClick={(event) => { event.stopPropagation(); download ? onGoToDownloads?.(download.id) : onDownload?.(ep); }}
            title={download ? (download.status === "downloading" ? "View active download" : "View downloaded episode") : "Download this episode"}
          >
            <DownloadIcon size={13} />
            {download ? (download.status === "downloading" ? "Downloading" : "Downloaded") : "Download"}
          </button>
        )}
        {!epWatched && epPct > 0 && <div className="episode-progress-bar"><div className="episode-progress-fill" style={{ width: `${Math.min(epPct, 100)}%` }} /></div>}
      </div>
    </div>
  );
}

export default memo(EpisodeCard);
