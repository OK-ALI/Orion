import { useCallback } from "react";

export default function QuickSearchFilterRail({ label, ariaLabel, children, className = "" }) {
  const handleWheel = useCallback((event) => {
    const rail = event.currentTarget;
    if (rail.scrollWidth <= rail.clientWidth) return;
    const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    if (!delta) return;
    const before = rail.scrollLeft;
    const max = Math.max(0, rail.scrollWidth - rail.clientWidth);
    const next = Math.max(0, Math.min(max, before + delta));
    if (next === before) return;
    event.preventDefault();
    event.stopPropagation();
    rail.scrollLeft = next;
  }, []);

  return (
    <div className="quick-search-filter-row">
      <span>{label}</span>
      <div
        className={`quick-search-filters${className ? ` ${className}` : ""}`}
        role="tablist"
        aria-label={ariaLabel}
        onWheel={handleWheel}
      >
        {children}
      </div>
    </div>
  );
}
