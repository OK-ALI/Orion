import { useCallback, useEffect, useState } from "react";
import { CloseIcon } from "../common/Icons";

const formatCountdown = (seconds) => (
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
);

function SmartConnectSignal({ connected, paired }) {
  const state = connected ? "connected" : paired ? "reconnecting" : "waiting";

  return (
    <span className={`smart-connect-signal is-${state}`} aria-hidden="true">
      <span className="smart-connect-signal-pulse" />
      <svg className="smart-connect-signal-glyph" viewBox="0 0 48 48" focusable="false">
        <path className="smart-connect-signal-arc arc-outer" d="M8.6 20.2a22 22 0 0 1 30.8 0" />
        <path className="smart-connect-signal-arc arc-middle" d="M14.8 26.3a13.2 13.2 0 0 1 18.4 0" />
        <path className="smart-connect-signal-arc arc-inner" d="M20.3 31.9a5.3 5.3 0 0 1 7.4 0" />
        <circle className="smart-connect-signal-dot" cx="24" cy="37" r="2.8" />
      </svg>
    </span>
  );
}

export default function SmartConnectModal({ onClose }) {
  const [pin, setPin] = useState("------");
  const [pinExpiresAt, setPinExpiresAt] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [paired, setPaired] = useState(false);
  const [connected, setConnected] = useState(false);
  const [devices, setDevices] = useState([]);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [editingDeviceId, setEditingDeviceId] = useState("");
  const [deviceName, setDeviceName] = useState("");

  const applyInfo = useCallback((info) => {
    if (!info) return;
    const nextDevices = Array.isArray(info.devices) ? info.devices : [];
    setDevices(nextDevices);
    setPaired(Boolean(info.paired));
    setConnected(Boolean(info.connected || nextDevices.some((device) => device.connected)));
    if (info.pin) setPin(info.pin);
    if (info.pinExpiresAt) setPinExpiresAt(Number(info.pinExpiresAt));
    if (info.qrDataUrl) setQrDataUrl(info.qrDataUrl);
  }, []);

  const refreshInfo = useCallback(async () => {
    const info = await window.electron?.getSmartConnectInfo?.();
    applyInfo(info);
  }, [applyInfo]);

  useEffect(() => {
    refreshInfo();
    const unsubscribe = window.electron?.onSmartConnectStatus?.(applyInfo);
    return () => unsubscribe?.();
  }, [applyInfo, refreshInfo]);

  useEffect(() => {
    let refreshing = false;
    const tick = async () => {
      const remaining = Math.max(0, Math.ceil((pinExpiresAt - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      if (!connected && pinExpiresAt && remaining === 0 && !refreshing) {
        refreshing = true;
        await window.electron?.setSmartConnectPin?.(null);
        await refreshInfo();
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [connected, pinExpiresAt, refreshInfo]);

  const regenerateCode = async () => {
    await window.electron?.setSmartConnectPin?.(null);
    await refreshInfo();
  };

  const disconnectAll = async () => {
    await window.electron?.disconnectSmartConnect?.();
    await refreshInfo();
  };

  const revokeDevice = async (deviceId) => {
    await window.electron?.revokeSmartConnectDevice?.(deviceId);
    await refreshInfo();
  };

  const beginRename = (device) => {
    setEditingDeviceId(device.deviceId);
    setDeviceName(device.deviceName || "Orion Mobile");
  };

  const saveRename = async () => {
    const nextName = deviceName.trim();
    if (!editingDeviceId || !nextName) return;
    await window.electron?.renameSmartConnectDevice?.(editingDeviceId, nextName);
    setEditingDeviceId("");
    setDeviceName("");
    await refreshInfo();
  };

  const liveDevice = devices.find((device) => device.connected);
  const status = connected
    ? `Connected: ${liveDevice?.deviceName || "Orion Mobile"} (Live Remote)`
    : paired
      ? "Pairing saved; waiting for Orion Mobile to reconnect"
      : "Waiting for Orion Mobile remote";

  return (
    <div
      className="download-modal-backdrop"
      onClick={onClose}
      role="presentation"
      style={{ background: "var(--overlay-backdrop)", zIndex: 9999 }}
    >
      <div
        className="download-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Orion Smart Connect"
        onClick={(event) => event.stopPropagation()}
        style={{
          maxWidth: 500,
          maxHeight: "min(820px, calc(100vh - 48px))",
          overflowY: "auto",
          background: "var(--bg-elevated)",
          border: connected ? "1px solid var(--success)" : "1px solid var(--border-accent)",
          borderRadius: 22,
          padding: 24,
          textAlign: "center",
          boxShadow: connected ? "0 0 30px var(--success-soft)" : "var(--shadow-glow)",
        }}
      >
        <button className="download-dialog-close" onClick={onClose} aria-label="Close Smart Connect">
          <CloseIcon size={15} />
        </button>

        <div style={{ marginBottom: 18 }}>
          <SmartConnectSignal connected={connected} paired={paired} />
          <h2 style={{ fontSize: 22, fontWeight: 900, color: "var(--text-primary)", margin: "0 0 6px" }}>
            Orion Smart Connect
          </h2>
          <p style={{ fontSize: 13, color: "var(--text3)", margin: 0 }}>
            {connected ? "Live remote connected" : paired ? "Paired device offline" : "Pair Orion Mobile as a smart remote"}
          </p>
        </div>

        {!connected && (
          <div
            style={{
              background: "var(--surface-translucent)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: 20,
              marginBottom: 18,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text3)", letterSpacing: 1, marginBottom: 10 }}>
              SCAN SECURE QR
            </div>
            <div
              style={{
                width: 140,
                height: 140,
                background: "var(--on-media)",
                margin: "0 auto 18px",
                padding: 8,
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "var(--shadow-glow)",
              }}
            >
              {qrDataUrl
                ? <img src={qrDataUrl} alt="Smart Connect QR Code" style={{ width: 124, height: 124 }} />
                : <span style={{ color: "var(--bg-base)", fontSize: 12, fontWeight: 700 }}>Preparing secure QR…</span>}
            </div>

            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text3)", letterSpacing: 1, marginBottom: 8 }}>
              OR ENTER 6-DIGIT CODE
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 10 }}>
              {pin.split("").map((digit, index) => (
                <div
                  key={`${digit}-${index}`}
                  style={{
                    width: 44,
                    height: 52,
                    borderRadius: 10,
                    background: "var(--accent-soft)",
                    border: "1px solid var(--border-accent)",
                    color: "var(--text-primary)",
                    fontSize: 24,
                    fontWeight: 900,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {digit}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, display: "flex", justifyContent: "center", alignItems: "center", gap: 10 }}>
              <span style={{ color: "var(--text3)", fontSize: 11 }}>
                {secondsRemaining > 0 ? `Expires in ${formatCountdown(secondsRemaining)}` : "Refreshing secure code…"}
              </span>
              <button className="btn btn-secondary" onClick={regenerateCode} style={{ minHeight: 32, padding: "4px 10px" }}>
                New code
              </button>
            </div>
            {paired && (
              <p style={{ color: "var(--warning)", fontSize: 11, lineHeight: 1.5, margin: "12px 0 0" }}>
                This device is remembered but not currently online. Open Orion Connect on Mobile to reconnect,
                or use the refreshed code to pair again.
              </p>
            )}
          </div>
        )}

        {devices.length > 0 && (
          <div
            style={{
              display: "grid",
              gap: 8,
              padding: 14,
              marginBottom: 18,
              borderRadius: 14,
              background: connected ? "var(--success-soft)" : "var(--surface-translucent)",
              border: `1px solid ${connected ? "var(--success)" : "var(--border)"}`,
            }}
          >
            {devices.map((device) => (
              <div
                key={device.deviceId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "var(--surface2)",
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
                  <strong style={{ display: "block", color: "var(--text1)" }}>
                    <span style={{ color: device.connected ? "var(--success)" : "var(--warning)" }}>● </span>
                    {device.deviceName || "Orion Mobile"}
                  </strong>
                  <span style={{ color: "var(--text3)", fontSize: 11 }}>
                    {device.connected ? "Live now" : "Offline"} · Last active{" "}
                    {device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : "recently"}
                  </span>
                  {editingDeviceId === device.deviceId && (
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <input
                        autoFocus
                        value={deviceName}
                        maxLength={80}
                        aria-label="Paired device name"
                        onChange={(event) => setDeviceName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") saveRename();
                          if (event.key === "Escape") setEditingDeviceId("");
                        }}
                        style={{
                          minWidth: 0,
                          flex: 1,
                          color: "var(--text1)",
                          background: "var(--surface2)",
                          border: "1px solid var(--border-accent)",
                          borderRadius: 8,
                          padding: "7px 9px",
                        }}
                      />
                      <button className="btn btn-primary" onClick={saveRename}>Save</button>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {editingDeviceId !== device.deviceId && (
                    <button className="btn btn-secondary" onClick={() => beginRename(device)}>Rename</button>
                  )}
                  <button className="btn btn-secondary" onClick={() => revokeDevice(device.deviceId)}>Revoke</button>
                </div>
              </div>
            ))}
            <button
              className="btn btn-secondary"
              onClick={disconnectAll}
              style={{ justifySelf: "center", borderColor: "var(--danger)", color: "var(--danger)", marginTop: 4 }}
            >
              Forget all remotes
            </button>
          </div>
        )}

        <div
          style={{
            fontSize: 12,
            color: connected ? "var(--success)" : paired ? "var(--warning)" : "var(--text3)",
            fontWeight: 700,
            marginBottom: 16,
          }}
        >
          {status}
        </div>

        <button className="btn btn-primary" onClick={onClose} style={{ width: "100%", fontSize: 13, fontWeight: 800 }}>
          Done
        </button>
      </div>
    </div>
  );
}
