import { useEffect, useId, useMemo, useState } from "react";

export default function DetailOverview({ text = "", collapseAfter = 180 }) {
  const normalized = useMemo(() => String(text || "").trim(), [text]);
  const [expanded, setExpanded] = useState(false);
  const overviewId = useId();
  const canToggle = normalized.length > collapseAfter;

  useEffect(() => {
    setExpanded(false);
  }, [normalized]);

  if (!normalized) return null;

  return (
    <div className={`detail-overview-wrap${expanded ? " is-expanded" : ""}`}>
      <p
        id={overviewId}
        className={`detail-overview${canToggle && !expanded ? " is-collapsed" : ""}`}
      >
        {normalized}
      </p>
      {canToggle && (
        <button
          type="button"
          className="detail-overview-toggle"
          aria-expanded={expanded}
          aria-controls={overviewId}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
