import { useCallback, useEffect, useRef, useState } from "react";

const EXIT_MS = 320;
const snapshotRect = (rect) => rect ? ({
  left: rect.left,
  right: rect.right,
  top: rect.top,
  bottom: rect.bottom,
  width: rect.width,
  height: rect.height,
}) : null;

export function useSearchOverlayController({ isOpen, setOpen }) {
  const [searchAnchorRect, setSearchAnchorRect] = useState(null);
  const [searchWorld, setSearchWorld] = useState("cinema");
  const clearTimerRef = useRef(0);

  useEffect(() => () => window.clearTimeout(clearTimerRef.current), []);

  const cancelDeferredClear = useCallback(() => {
    window.clearTimeout(clearTimerRef.current);
    clearTimerRef.current = 0;
  }, []);

  const openGlobalSearch = useCallback((world = "cinema") => {
    cancelDeferredClear();
    setSearchAnchorRect(null);
    setSearchWorld(world === "music" ? "music" : "cinema");
    setOpen(true);
  }, [cancelDeferredClear, setOpen]);

  const closeSearch = useCallback(() => {
    setOpen(false);
    cancelDeferredClear();
    clearTimerRef.current = window.setTimeout(() => {
      setSearchAnchorRect(null);
      clearTimerRef.current = 0;
    }, EXIT_MS);
  }, [cancelDeferredClear, setOpen]);

  const openQuickSearch = useCallback((rect, world = "cinema") => {
    if (isOpen && searchAnchorRect) {
      closeSearch();
      return;
    }
    cancelDeferredClear();
    setSearchWorld(world === "music" ? "music" : "cinema");
    setSearchAnchorRect(snapshotRect(rect));
    setOpen(true);
  }, [cancelDeferredClear, closeSearch, isOpen, searchAnchorRect, setOpen]);

  return { searchAnchorRect, searchWorld, openGlobalSearch, openQuickSearch, closeSearch };
}
