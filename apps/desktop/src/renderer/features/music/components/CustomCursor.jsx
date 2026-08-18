import { useEffect, useRef } from "react";

const CONTEXTS = new Set(["default", "action", "precision", "text", "adjust", "drag", "blocked"]);

function explicitContext(target) {
  const owner = target?.closest?.("[data-music-cursor]");
  const value = owner?.dataset?.musicCursor;
  return CONTEXTS.has(value) ? value : "";
}

function isTextInput(input) {
  if (!input || input.tagName === "TEXTAREA") return Boolean(input);
  if (input.tagName !== "INPUT") return false;
  return !["button", "checkbox", "color", "file", "hidden", "image", "radio", "range", "reset", "submit"]
    .includes(String(input.type || "text").toLowerCase());
}

function isPrecisionButton(button) {
  if (!button) return false;
  const label = String(button.getAttribute("aria-label") || "").toLowerCase();
  if (["close", "clear", "remove", "dismiss"].some((word) => label.includes(word))) return true;
  return button.matches([
    ".music-search-clear",
    ".music-track-more",
    ".music-header-icon-btn",
    ".queue-item-remove",
    ".music-scan-dismiss",
    ".player-btn",
  ].join(","));
}

export function resolveMusicCursorContext(target) {
  if (!target?.closest) return "default";

  if (target.closest("button:disabled, input:disabled, textarea:disabled, select:disabled")) {
    return "blocked";
  }

  const explicit = explicitContext(target);
  if (explicit) return explicit;

  if (target.closest('[draggable="true"], .music-player-drag-handle, .music-playlist-order > li > span')) {
    return "drag";
  }

  if (target.closest('input[type="range"]')) return "adjust";

  const field = target.closest("input, textarea");
  if (isTextInput(field)) return "text";

  const button = target.closest("button");
  if (button) return isPrecisionButton(button) ? "precision" : "action";

  if (target.closest('a[href], select, summary, [role="button"], [role="option"]')) return "action";

  return "default";
}

export default function CustomCursor({ reducedMotion = false }) {
  const cursorRef = useRef(null);

  useEffect(() => {
    const cursor = cursorRef.current;
    const finePointer = window.matchMedia?.("(pointer: fine)");
    const systemReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!cursor || reducedMotion || !finePointer?.matches || systemReducedMotion?.matches) return undefined;

    const root = document.documentElement;
    const requestFrame = window.requestAnimationFrame?.bind(window)
      || ((callback) => window.setTimeout(() => callback(Date.now()), 16));
    const cancelFrame = window.cancelAnimationFrame?.bind(window) || window.clearTimeout.bind(window);

    root.classList.add("music-custom-cursor-active");

    let frame = 0;
    let position = { x: 0, y: 0 };

    const paintPosition = () => {
      cursor.style.transform = `translate3d(${position.x}px, ${position.y}px, 0) translate(-50%, -50%) scale(var(--music-cursor-scale, 1))`;
      frame = 0;
    };

    const onMouseMove = (event) => {
      position = { x: event.clientX, y: event.clientY };
      cursor.dataset.context = resolveMusicCursorContext(event.target);
      cursor.classList.add("is-ready");
      if (!frame) frame = requestFrame(paintPosition);
    };

    const onMouseDown = () => cursor.classList.add("is-pressed");
    const onMouseUp = () => cursor.classList.remove("is-pressed");
    const hide = () => {
      cursor.classList.remove("is-ready", "is-pressed");
      cursor.dataset.context = "default";
    };
    const onMouseOut = (event) => {
      if (!event.relatedTarget) hide();
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("mouseout", onMouseOut);
    window.addEventListener("blur", hide);

    return () => {
      root.classList.remove("music-custom-cursor-active");
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("mouseout", onMouseOut);
      window.removeEventListener("blur", hide);
      if (frame) cancelFrame(frame);
    };
  }, [reducedMotion]);

  return <div ref={cursorRef} className="music-planet-cursor" data-context="default" aria-hidden="true" />;
}
