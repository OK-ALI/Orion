import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SearchIcon } from "../common/Icons";
import { storage, STORAGE_KEYS } from "../../services/settingsStore";
import {
  clampOrbPixels,
  DEFAULT_SEARCH_ORB_POSITION,
  normalizedToPixels,
  pixelsToNormalized,
  SEARCH_ORB_SIZE,
  settleOrbPixels,
} from "./searchOrbGeometry";

const DRAG_THRESHOLD = 5;

const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });

export default function SearchOrb({ onOpenFullSearch, onOpenQuickSearch, hidden = false, world = "cinema" }) {
  const [enabled, setEnabled] = useState(() => storage.get(STORAGE_KEYS.SEARCH_ORB_ENABLED) !== false);
  const [normalized, setNormalized] = useState(
    () => storage.get(STORAGE_KEYS.SEARCH_ORB_POSITION) || DEFAULT_SEARCH_ORB_POSITION,
  );
  const [position, setPosition] = useState(() => normalizedToPixels(normalized, viewport()));
  const positionRef = useRef(position);
  const [dragging, setDragging] = useState(false);
  const [launching, setLaunching] = useState(false);
  const dragRef = useRef(null);
  const suppressClickRef = useRef(false);

  useEffect(() => { positionRef.current = position; }, [position]);

  const persist = useCallback((pixels) => {
    const next = pixelsToNormalized(pixels, viewport());
    storage.set(STORAGE_KEYS.SEARCH_ORB_POSITION, next);
    setNormalized(next);
  }, []);

  const restoreFromNormalized = useCallback((nextNormalized = normalized) => {
    setPosition(normalizedToPixels(nextNormalized, viewport()));
  }, [normalized]);

  useEffect(() => {
    const onResize = () => restoreFromNormalized();
    const reset = () => {
      const next = { ...DEFAULT_SEARCH_ORB_POSITION };
      storage.remove(STORAGE_KEYS.SEARCH_ORB_POSITION);
      setNormalized(next);
      setPosition(normalizedToPixels(next, viewport()));
    };
    const onVisibility = () => setEnabled(storage.get(STORAGE_KEYS.SEARCH_ORB_ENABLED) !== false);
    window.addEventListener("resize", onResize);
    window.addEventListener("orion:reset-search-orb", reset);
    window.addEventListener("orion:search-orb-visibility-changed", onVisibility);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orion:reset-search-orb", reset);
      window.removeEventListener("orion:search-orb-visibility-changed", onVisibility);
    };
  }, [restoreFromNormalized]);

  useEffect(() => () => {
    document.documentElement.classList.remove("search-orb-routing");
  }, []);

  const handlePointerDown = (event) => {
    if (event.button !== 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: position.left,
      top: position.top,
      moved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!drag.moved) {
      drag.moved = true;
      setDragging(true);
    }
    suppressClickRef.current = true;
    const next = clampOrbPixels({ left: drag.left + dx, top: drag.top + dy }, viewport());
    positionRef.current = next;
    setPosition(next);
  };

  const finishDrag = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (!drag.moved) return;
    const settled = settleOrbPixels(positionRef.current, viewport());
    positionRef.current = settled;
    setPosition(settled);
    persist(settled);
    setDragging(false);
    window.setTimeout(() => { suppressClickRef.current = false; }, 0);
  };

  const openFull = () => {
    if (suppressClickRef.current || dragging || launching) return;
    setLaunching(true);
    document.documentElement.classList.add("search-orb-routing");
    window.setTimeout(() => {
      onOpenFullSearch?.();
      window.setTimeout(() => {
        document.documentElement.classList.remove("search-orb-routing");
        setLaunching(false);
      }, 150);
    }, 170);
  };

  const openQuick = (event) => {
    event.preventDefault();
    if (dragging) return;
    onOpenQuickSearch?.(event.currentTarget.getBoundingClientRect());
  };

  const style = useMemo(() => ({
    left: `${Math.round(position.left)}px`,
    top: `${Math.round(position.top)}px`,
    width: SEARCH_ORB_SIZE,
    height: SEARCH_ORB_SIZE,
  }), [position]);

  const unavailable = hidden || !enabled;
  const searchLabel = world === "music" ? "Search Music Planet" : "Search Orion";

  return (
    <button
      type="button"
      className={`search-orb${dragging ? " is-dragging" : ""}${launching ? " is-launching" : ""}${unavailable ? " is-hidden" : ""}`}
      style={style}
      onClick={openFull}
      disabled={unavailable}
      onContextMenu={openQuick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      aria-label={searchLabel}
      aria-hidden={unavailable}
      tabIndex={unavailable ? -1 : 0}
      title={`${searchLabel} · Right-click for Quick Search · Drag to move`}
    >
      <span className="search-orb-glow" aria-hidden="true" />
      <SearchIcon size={20} />
    </button>
  );
}
