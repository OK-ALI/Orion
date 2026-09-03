import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

// Collection actions use an in-app modal; Electron cannot rely on window.confirm.
export default function MusicCollectionDialog({ label, busy = false, close, children }) {
  const panel = useRef(null);
  const trigger = useRef(document.activeElement);
  useEffect(() => {
    const target = panel.current?.querySelector("[data-initial-focus]")
      || panel.current?.querySelector("input") || panel.current?.querySelector("button");
    target?.focus();
    return () => {
      const target = trigger.current?.isConnected ? trigger.current : document.querySelector(".music-playlist-page-toolbar button");
      target?.focus();
    };
  }, []);
  const onKeyDown = (event) => {
    event.stopPropagation();
    if (event.key === "Escape") { event.preventDefault(); if (!busy) close(); }
    if (event.key !== "Tab") return;
    const controls = [...panel.current.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]')];
    const first = controls[0]; const last = controls.at(-1);
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  return createPortal(<div className="music-dialog-backdrop" onKeyDown={onKeyDown}>
    <section ref={panel} className="music-dialog" role="dialog" aria-modal="true" aria-label={label} aria-busy={busy}>
      {children}
    </section>
  </div>, document.querySelector(".music-planet-container") || document.body);
}
