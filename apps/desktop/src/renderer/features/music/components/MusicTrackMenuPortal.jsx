import { createPortal } from "react-dom";
import { useLayoutEffect, useRef, useState } from "react";

const EDGE = 10;
const GAP = 8;

export default function MusicTrackMenuPortal({ anchor, close, children }) {
  const menuRef = useRef(null);
  const [position, setPosition] = useState(null);

  useLayoutEffect(() => {
    if (!anchor) return undefined;
    let frame = 0;

    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = anchor.getBoundingClientRect();
        const menu = menuRef.current;
        const width = menu?.offsetWidth || 190;
        const height = menu?.offsetHeight || 220;
        const below = rect.bottom + GAP;
        const top = below + height <= window.innerHeight - EDGE
          ? below
          : Math.max(EDGE, rect.top - height - GAP);
        const left = Math.max(
          EDGE,
          Math.min(window.innerWidth - width - EDGE, rect.right - width),
        );
        setPosition({ top: Math.round(top), left: Math.round(left) });
      });
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") close?.();
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [anchor, close]);

  if (!anchor) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="music-track-menu music-track-menu-portal"
      role="menu"
      style={position ? { top: position.top, left: position.left } : undefined}
      data-positioned={position ? "true" : "false"}
    >
      {children}
    </div>,
    document.body,
  );
}
