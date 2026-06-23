// ── Orion — Custom Window Titlebar ────────────────────────────────────────────
import { useState, useEffect } from "react";
import {
  MinimizeIcon,
  MaximizeIcon,
  RestoreIcon,
  CloseIcon,
} from "../common/Icons";

export default function WindowTitlebar() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!window.electron) return;
    window.electron.isMaximized().then(setMaximized);
    const handler = window.electron.onMaximizedChange((v) => setMaximized(v));
    return () => window.electron.offMaximizedChange(handler);
  }, []);

  return (
    <header className="titlebar titlebar-drag">
      <div className="titlebar-left titlebar-no-drag">
        <div className="titlebar-logo">
  <span>Orion</span>
</div>
      </div>

      <div className="titlebar-controls titlebar-no-drag">
        <button
          className="titlebar-btn"
          onClick={() => window.electron?.minimize()}
          aria-label="Minimize"
        >
          <MinimizeIcon />
        </button>
        <button
          className="titlebar-btn"
          onClick={() => window.electron?.toggleMaximize()}
          aria-label={maximized ? "Restore" : "Maximize"}
        >
          {maximized ? <RestoreIcon /> : <MaximizeIcon />}
        </button>
        <button
          className="titlebar-btn titlebar-btn-close"
          onClick={() => window.electron?.close()}
          aria-label="Close"
        >
          <CloseIcon />
        </button>
      </div>
    </header>
  );
}
