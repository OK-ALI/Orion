import { useEffect, useRef, useState } from "react";
import VoiceBoostIcon from "../../../components/media/VoiceBoostIcon";

function _makePartialCircle(pct) {
  const r = 5;
  const cx = 7;
  const cy = 7;
  const angle = (pct / 100) * 2 * Math.PI - Math.PI / 2;
  const x = cx + r * Math.cos(angle);
  const y = cy + r * Math.sin(angle);
  const large = pct > 50 ? 1 : 0;
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      style={{
        display: "inline-block",
        verticalAlign: "middle",
        marginRight: 4,
        flexShrink: 0,
      }}
    >
      {/* Background ring */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.25"
      />
      {/* Filled arc */}
      <path
        d={`M ${cx} ${cy - r} A ${r} ${r} 0 ${large} 1 ${x.toFixed(3)} ${y.toFixed(3)} L ${cx} ${cy} Z`}
        fill="currentColor"
        opacity="0.9"
      />
    </svg>
  );
}

const _CIRCLE_MAP = {
  25: _makePartialCircle(25),
  50: _makePartialCircle(50),
  75: _makePartialCircle(75),
};

function PartialCircleIcon({ pct }) {
  return _CIRCLE_MAP[pct] ?? null;
}

function ContextMenu({
  x,
  y,
  isWatched,
  hasProgress,
  watchedLabel,
  unwatchedLabel,
  onMarkWatched,
  onMarkUnwatched,
  onMarkNotStarted,
  onClose,
}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const close = () => onCloseRef.current();
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
    };
  }, []);
  return (
    <div
      className="context-menu"
      style={{ top: y, left: x }}
      onClick={(e) => e.stopPropagation()}
    >
      {isWatched ? (
        <button
          className="context-menu-item"
          onClick={(e) => {
            e.stopPropagation();
            onMarkUnwatched();
            onCloseRef.current();
          }}
        >
          ↩ {unwatchedLabel}
        </button>
      ) : (
        <button
          className="context-menu-item"
          onClick={(e) => {
            e.stopPropagation();
            onMarkWatched();
            onCloseRef.current();
          }}
        >
          ✓ {watchedLabel}
        </button>
      )}
      {onMarkNotStarted && !isWatched && hasProgress && (
        <button
          className="context-menu-item"
          onClick={(e) => {
            e.stopPropagation();
            onMarkNotStarted();
            onCloseRef.current();
          }}
        >
          ⊘ Mark as Not Started
        </button>
      )}
    </div>
  );
}

function EpisodeDesc({ overview }) {
  const [expanded, setExpanded] = useState(false);
  if (!overview) return <div className="episode-desc" />;

  return (
    <div className="episode-desc-wrap">
      <div
        className="episode-desc"
        style={
          expanded
            ? { WebkitLineClamp: "unset", display: "block" }
            : undefined
        }
      >
        {overview}
      </div>
      <button
        className="episode-desc-toggle"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(!expanded);
        }}
        style={{
          background: "none",
          border: "none",
          color: "var(--accent)",
          cursor: "pointer",
          padding: 0,
          marginTop: "4px",
          fontSize: "11.5px",
          fontWeight: 600,
          display: "inline-block",
        }}
      >
        {expanded ? "Read less" : "Read more"}
      </button>
    </div>
  );
}

export { ContextMenu, EpisodeDesc, PartialCircleIcon, VoiceBoostIcon };
