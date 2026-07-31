import { useCallback, useEffect, useState } from "react";
import { storage, STORAGE_KEYS } from "../../../services/settingsStore";
import { Toggle } from "../components/SettingsControls";
import { Divider, SectionGroupHeader } from "../sections/SystemSettings";

function LiveToggle({ label, description, value, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "15px 0", borderBottom: "1px solid var(--border)" }}>
      <Toggle value={value} onChange={onChange} />
      <div>
        <div style={{ color: "var(--text)", fontSize: 14, fontWeight: 600 }}>{label}</div>
        <div style={{ color: "var(--text3)", fontSize: 12, lineHeight: 1.55, marginTop: 3 }}>{description}</div>
      </div>
    </div>
  );
}

export default function SystemIntegrationSettingsGroup({ model }) {
  const { secSystemIntegration } = model;
  const [enabled, setEnabled] = useState(() => storage.get(STORAGE_KEYS.MEDIA_CONTROLS_ENABLED) !== false);
  const [metadata, setMetadata] = useState(() => storage.get(STORAGE_KEYS.MEDIA_METADATA_ENABLED) !== false);
  const [background, setBackground] = useState(() => storage.get(STORAGE_KEYS.MEDIA_BACKGROUND_CONTROLS) !== false);
  const [status, setStatus] = useState(null);
  const [outputs, setOutputs] = useState([]);

  const refresh = useCallback(async () => {
    const [mediaStatus, devices] = await Promise.all([
      window.electron?.getSystemMediaStatus?.().catch(() => null),
      navigator.mediaDevices?.enumerateDevices?.().catch(() => []),
    ]);
    setStatus(mediaStatus);
    setOutputs((devices || []).filter((device) => device.kind === "audiooutput"));
  }, []);

  useEffect(() => {
    refresh();
    navigator.mediaDevices?.addEventListener?.("devicechange", refresh);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", refresh);
  }, [refresh]);

  const apply = (key, setter, value) => {
    setter(value);
    storage.set(key, value);
    window.dispatchEvent(new CustomEvent("orion:media-settings-changed"));
    window.setTimeout(refresh, 50);
  };

  return (
    <div ref={secSystemIntegration} style={{ scrollMarginTop: 80 }}>
      <SectionGroupHeader title="System integration" subtitle="Windows media controls, Bluetooth output, and background playback ownership" />

      <div className="settings-card" style={{ padding: "0 16px", marginBottom: 20 }}>
        <LiveToggle
          label="Windows media controls"
          description="Allows headset, speaker, keyboard, and Windows media-flyout controls while Orion is playing."
          value={enabled}
          onChange={(value) => apply(STORAGE_KEYS.MEDIA_CONTROLS_ENABLED, setEnabled, value)}
        />
        <LiveToggle
          label="Publish title and artwork"
          description="Shows the current movie or episode, artwork, progress, and playback state in Windows."
          value={metadata}
          onChange={(value) => apply(STORAGE_KEYS.MEDIA_METADATA_ENABLED, setMetadata, value)}
        />
        <LiveToggle
          label="Controls while Orion is in the background"
          description="Keeps media buttons active while Orion is unfocused, minimized, or in the tray."
          value={background}
          onChange={(value) => apply(STORAGE_KEYS.MEDIA_BACKGROUND_CONTROLS, setBackground, value)}
        />
      </div>
      <div style={{ color: "var(--success)", fontSize: 12, marginBottom: 28 }}>Changes apply immediately.</div>

      <Divider />
      <div className="settings-section-title">Windows audio output</div>
      <div style={{ color: "var(--text3)", fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
        Windows owns output selection and volume. Orion can display audio outputs exposed by Windows, but Bluetooth connection and the active default device remain controlled by Windows.
      </div>
      <div className="settings-card" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div style={{ color: "var(--text)", fontWeight: 700, fontSize: 14 }}>
              {status?.active ? `Media session active · ${status.title || "Now playing"}` : "Media session ready"}
            </div>
            <div style={{ color: "var(--text3)", fontSize: 12, marginTop: 5 }}>
              {status?.fallbackKeys ? `${status.fallbackKeys} fallback media keys registered` : "Chromium Media Session is preferred"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" onClick={refresh}>Refresh</button>
            <button className="btn btn-secondary" onClick={() => window.electron?.openWindowsSoundSettings?.()}>Open Windows sound settings</button>
          </div>
        </div>
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 7 }}>
          {(outputs.length ? outputs : [{ deviceId: "default", label: "Windows default audio output" }]).map((device, index) => (
            <div key={`${device.deviceId}-${index}`} style={{ color: "var(--text2)", fontSize: 12, padding: "8px 10px", borderRadius: 7, background: "var(--surface2)" }}>
              {device.label || `Audio output ${index + 1}`}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
