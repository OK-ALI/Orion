// ── Orion — Custom Window Titlebar ────────────────────────────────────────────
import { useState, useEffect } from "react";
import {
  MinimizeIcon,
  MaximizeIcon,
  RestoreIcon,
  CloseIcon,
} from "../common/Icons";
import useNetworkStatus from "../../shared/hooks/useNetworkStatus";

export default function WindowTitlebar() {
  const [maximized, setMaximized] = useState(false);
  const [battery, setBattery] = useState(null);
  const network = useNetworkStatus();

  useEffect(() => {
    if (!window.electron) return;
    window.electron.isMaximized().then(setMaximized);
    const handler = window.electron.onMaximizedChange((v) => setMaximized(v));
    return () => window.electron.offMaximizedChange(handler);
  }, []);

  useEffect(() => {
    if (!window.electron?.getBatteryStatus) return undefined;
    let mounted = true;
    window.electron.getBatteryStatus().then((value) => mounted && setBattery(value)).catch(() => {});
    const handler = window.electron.onBatteryStatus?.((value) => mounted && setBattery(value));
    return () => {
      mounted = false;
      if (handler) window.electron.offBatteryStatus?.(handler);
    };
  }, []);

  return (
    <header className="titlebar titlebar-drag">
      <div className="titlebar-left titlebar-no-drag">
        <div className="titlebar-logo">
  <span>Orion</span>
</div>
      </div>

      <div className="titlebar-controls titlebar-no-drag">
        <div
          className={`titlebar-network is-${network.status}${network.tier !== "unknown" ? ` is-${network.tier}` : ""}`}
          title={network.status === "online"
            ? `Online · ${network.latencyMs} ms round trip to Orion's metadata service`
            : network.status === "checking" ? "Checking Orion connectivity" : "Orion is offline"}
          aria-label={network.status === "online" ? `Online, ${network.latencyMs} milliseconds latency` : network.status === "checking" ? "Checking network status" : "Offline"}
        >
          <span className="titlebar-network-dot" aria-hidden="true" />
          <span>{network.status === "online" ? "Online" : network.status === "checking" ? "Checking" : "Offline"}</span>
          {network.status === "online" && <span className="titlebar-network-latency">{network.latencyMs} ms</span>}
        </div>
        {battery?.available && battery?.visible !== false && (
          <div
            className={`titlebar-battery${battery.charging ? " is-charging" : ""}${Number(battery.level) <= 0.1 ? " is-critical" : ""}`}
            title={battery.charging ? "Battery charging" : "Running on battery power"}
            aria-label={`${Math.round(Number(battery.level || 0) * 100)} percent battery${battery.charging ? ", charging" : ""}`}
          >
            <span className="titlebar-battery-shell"><span style={{ width: `${Math.max(4, Math.round(Number(battery.level || 0) * 100))}%` }} /></span>
            <span>{Math.round(Number(battery.level || 0) * 100)}%</span>
            {battery.charging && <span aria-hidden="true">⚡</span>}
          </div>
        )}
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
