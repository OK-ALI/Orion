// ── Orion — Custom Window Titlebar ────────────────────────────────────────────
import { useState, useEffect } from "react";
import {
  MinimizeIcon,
  MaximizeIcon,
  RestoreIcon,
  CloseIcon,
} from "../common/Icons";

export default function WindowTitlebar({ 
  network = { status: "checking", latencyMs: null, tier: "unknown" },
  googleProfile = null,
  onNavigate = null
}) {
  const [maximized, setMaximized] = useState(false);
  const [battery, setBattery] = useState(null);

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
          title={network.status === "online" || network.status === "degraded"
            ? `Online · ${network.latencyMs} ms round trip to Orion's metadata service`
            : network.status === "checking" ? "Checking Orion connectivity" : "Orion is offline"}
          aria-label={network.status === "online" || network.status === "degraded" ? `${network.status === "degraded" ? "Service degraded" : "Online"}, ${network.latencyMs} milliseconds latency` : network.status === "checking" ? "Checking network status" : "Offline"}
        >
          <span className="titlebar-network-dot" aria-hidden="true" />
          <span>{network.status === "online" ? "Online" : network.status === "degraded" ? "Degraded" : network.status === "checking" ? "Checking" : "Offline"}</span>
          {(network.status === "online" || network.status === "degraded") && <span className="titlebar-network-latency">{network.latencyMs} ms</span>}
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
        {googleProfile && (() => {
          const [showProfileCard, setShowProfileCard] = useState(false);
          return (
            <div style={{ position: "relative", display: "inline-block", height: 22 }}>
              <button
                className="titlebar-btn titlebar-no-drag"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                  borderRadius: "50%",
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  marginRight: 6,
                  transition: "opacity 0.2s",
                }}
                onClick={() => setShowProfileCard(!showProfileCard)}
                onMouseEnter={(e) => e.currentTarget.style.opacity = 0.8}
                onMouseLeave={(e) => e.currentTarget.style.opacity = 1}
              >
                {googleProfile.picture ? (
                  <img
                    src={googleProfile.picture}
                    alt={googleProfile.name}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      border: "1px solid var(--accent)",
                    }}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "var(--surface3)",
                      color: "var(--text)",
                      fontSize: 10,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1px solid var(--accent)",
                    }}
                  >
                    {googleProfile.name ? googleProfile.name[0].toUpperCase() : "G"}
                  </div>
                )}
              </button>

              {showProfileCard && (
                <div 
                  className="titlebar-no-drag"
                  style={{
                    position: "absolute",
                    top: "28px",
                    right: 6,
                    width: 230,
                    background: "rgba(22, 22, 22, 0.95)",
                    backdropFilter: "blur(20px)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    padding: "16px 14px",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                    zIndex: 9999999,
                    textAlign: "center",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 12,
                    cursor: "default"
                  }}
                  onMouseLeave={() => setShowProfileCard(false)}
                >
                  {/* Picture */}
                  {googleProfile.picture ? (
                    <img
                      src={googleProfile.picture}
                      alt=""
                      style={{
                        width: 50,
                        height: 50,
                        borderRadius: "50%",
                        border: "2px solid var(--accent)",
                        boxShadow: "0 0 10px rgba(0, 168, 255, 0.2)"
                      }}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div
                      style={{
                        width: 50,
                        height: 50,
                        borderRadius: "50%",
                        background: "var(--surface3)",
                        color: "var(--text)",
                        fontSize: 18,
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "2px solid var(--accent)",
                      }}
                    >
                      {googleProfile.name ? googleProfile.name[0].toUpperCase() : "G"}
                    </div>
                  )}

                  {/* Details */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 190 }}>
                      {googleProfile.name}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 190 }}>
                      {googleProfile.email}
                    </div>
                  </div>

                  {/* Badge */}
                  <div style={{
                    fontSize: 8,
                    fontWeight: 700,
                    color: "#00a8ff",
                    background: "rgba(0, 168, 255, 0.08)",
                    border: "1px solid rgba(0, 168, 255, 0.15)",
                    padding: "3px 8px",
                    borderRadius: 999,
                    textTransform: "uppercase",
                    letterSpacing: 0.6
                  }}>
                    Cloud Sync Active
                  </div>

                  <div style={{ height: "1px", background: "var(--border)", width: "100%", margin: "2px 0" }} />

                  {/* Settings Button */}
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowProfileCard(false);
                      onNavigate?.("settings");
                    }}
                    style={{
                      width: "100%",
                      fontSize: 11,
                      padding: "6px 12px",
                      borderRadius: 6,
                      background: "var(--surface3)",
                      color: "var(--text)",
                      border: "1px solid var(--border)",
                      cursor: "pointer",
                      fontWeight: 600
                    }}
                  >
                    Google Sync Settings
                  </button>
                </div>
              )}
            </div>
          );
        })()}
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
