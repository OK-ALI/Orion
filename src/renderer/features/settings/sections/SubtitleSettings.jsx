import { useEffect, useState } from "react";
import { storage, STORAGE_KEYS, secureStorage } from "../../../services/settingsStore";
import { clearTmdbCache } from "../../../services/tmdb";
import { ACCENT_PRESETS, applyAccentColor, THEME_PRESETS, applyTheme, DEFAULT_CUSTOM_VARS } from "../../../shared/utils/appearance";
import { SUBTITLE_LANGUAGES } from "../../../shared/utils/subtitles";
import { SettingsSelect, Toggle } from "../components/SettingsControls";

export function SubtitleSettingsSection() {
  const [enabled, setEnabled] = useState(
    () =>
      storage.get(STORAGE_KEYS.SUBTITLE_ENABLED) !== 0 &&
      storage.get(STORAGE_KEYS.SUBTITLE_ENABLED) !== "0",
  );
  const [lang, setLang] = useState(
    () => storage.get(STORAGE_KEYS.SUBTITLE_LANG) || "en",
  );
  const [subdlApiKey, setSubdlApiKey] = useState("");
  const [showSubdlKey, setShowSubdlKey] = useState(false);
  const [wyzieApiKey, setWyzieApiKey] = useState("");
  const [showWyzieKey, setShowWyzieKey] = useState(false);
  const [wyzieCopied, setWyzieCopied] = useState(false);
  const [wyzieClearConfirm, setWyzieClearConfirm] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load keys from secure storage
  useEffect(() => {
    secureStorage.get(STORAGE_KEYS.SUBDL_API_KEY).then((val) => {
      if (val) setSubdlApiKey(val);
    });
    secureStorage.get(STORAGE_KEYS.WYZIE_API_KEY).then((val) => {
      if (val) setWyzieApiKey(val);
    });
  }, []);

  const hasSubdlKey = subdlApiKey.trim().length > 0;
  const hasWyzieKey = wyzieApiKey.trim().length > 0;

  const handleWyzieCopy = () => {
    navigator.clipboard.writeText(wyzieApiKey.trim()).then(() => {
      setWyzieCopied(true);
      setTimeout(() => setWyzieCopied(false), 1500);
    });
  };

  const handleSave = () => {
    storage.set(STORAGE_KEYS.SUBTITLE_ENABLED, enabled ? 1 : 0);
    storage.set(STORAGE_KEYS.SUBTITLE_LANG, lang);
    secureStorage.set(STORAGE_KEYS.SUBDL_API_KEY, subdlApiKey.trim());
    secureStorage.set(STORAGE_KEYS.WYZIE_API_KEY, wyzieApiKey.trim());
    // refresh playerSettings prop (subtitle lang)
    window.dispatchEvent(new CustomEvent("orion:player-settings-changed"));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ marginBottom: 40 }}>
      <div className="settings-section-title">Subtitle Downloads</div>

      {/* Source info */}
      <div
        style={{
          fontSize: 13,
          color: "var(--text3)",
          marginBottom: 20,
          lineHeight: 1.7,
        }}
      >
        <span style={{ color: "var(--text)", fontWeight: 600 }}>
          Wyzie Subs
        </span>{" "}
        is used by default and requires a free API key (no account needed).
        Optionally add a{" "}
        <span
          style={{
            color: "var(--red)",
            cursor: "pointer",
            textDecoration: "underline",
          }}
          onClick={() =>
            window.electron?.openExternal("https://subdl.com/settings")
          }
        >
          SubDL API key
        </span>{" "}
        (free), to use SubDL as the primary source instead.
        {hasSubdlKey && (
          <span
            style={{
              display: "inline-block",
              marginLeft: 8,
              fontSize: 11,
              fontWeight: 700,
              padding: "1px 7px",
              borderRadius: 3,
              background: "rgba(99,149,255,0.15)",
              color: "#6395ff",
              border: "1px solid rgba(99,149,255,0.3)",
            }}
          >
            SubDL ACTIVE
          </span>
        )}
      </div>

      {/* Enable toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <Toggle value={enabled} onChange={setEnabled} />
        <span
          style={{
            fontSize: 14,
            color: enabled ? "var(--text)" : "var(--text3)",
          }}
        >
          {enabled
            ? "Auto-download subtitles when downloading videos"
            : "Subtitle download disabled"}
        </span>
      </div>

      {enabled && (
        <>
          {/* Default language */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{ fontSize: 12, color: "var(--text3)", marginBottom: 6 }}
            >
              Default language
            </div>
            <SettingsSelect
              value={lang}
              onChange={(v) => setLang(v)}
              options={SUBTITLE_LANGUAGES.map((l) => ({
                value: l.code,
                label: l.label,
              }))}
            />
          </div>

          {/* Wyzie API key */}
          <div style={{ marginBottom: 20 }}>
            <div
              style={{ fontSize: 12, color: "var(--text3)", marginBottom: 6 }}
            >
              Wyzie API key{" "}
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "1px 5px",
                  borderRadius: 3,
                  background: hasWyzieKey
                    ? "rgba(99,202,183,0.12)"
                    : "rgba(255,180,80,0.12)",
                  color: hasWyzieKey ? "#63cab7" : "#ffb450",
                  border: `1px solid ${hasWyzieKey ? "rgba(99,202,183,0.25)" : "rgba(255,180,80,0.25)"}`,
                }}
              >
                {hasWyzieKey ? "SET" : "REQUIRED"}
              </span>
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--text3)",
                marginBottom: 8,
                lineHeight: 1.5,
              }}
            >
              Required for Wyzie Subs. Get a free key by following the tutorial.{" "}
              <button
                className="btn btn-ghost"
                style={{
                  display: "inline",
                  padding: 0,
                  fontSize: 12,
                  color: "var(--accent)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
                onClick={() =>
                  window.electron?.openExternal(
                    "https://store.wyzie.io/redeem",
                  )
                }
              >
                Get a Wyzie key ↗
              </button>
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <input
                className="apikey-input"
                style={{ flex: 1, maxWidth: 340, marginBottom: 0 }}
                type={showWyzieKey ? "text" : "password"}
                placeholder="wyzie-..."
                value={wyzieApiKey}
                onChange={(e) => setWyzieApiKey(e.target.value)}
              />
              <button
                className="btn btn-ghost"
                style={{ padding: "6px 12px", fontSize: 12 }}
                onClick={() => setShowWyzieKey((v) => !v)}
              >
                {showWyzieKey ? "Hide" : "Show"}
              </button>
              {hasWyzieKey && (
                <button
                  className="btn btn-ghost"
                  style={{ padding: "6px 12px", fontSize: 12 }}
                  onClick={handleWyzieCopy}
                  title="Copy key"
                >
                  {wyzieCopied ? "Copied!" : "Copy"}
                </button>
              )}
              {hasWyzieKey && (
                <button
                  className="btn btn-ghost"
                  style={{ padding: "6px 12px", fontSize: 12 }}
                  onClick={() =>
                    window.electron?.openExternal(
                      `https://store.wyzie.io/dashboard?key=${wyzieApiKey.trim()}`,
                    )
                  }
                  title="Open your wyzie dashboard"
                >
                  Dashboard ↗
                </button>
              )}
            </div>
          </div>

          {/* SubDL API key */}
          <div style={{ marginBottom: 8 }}>
            <div
              style={{ fontSize: 12, color: "var(--text3)", marginBottom: 6 }}
            >
              SubDL API key{" "}
              <span
                style={{
                  color: "var(--text3)",
                  cursor: "pointer",
                  fontSize: 11,
                }}
                onClick={() =>
                  window.electron?.openExternal("https://subdl.com/settings")
                }
              >
                (free, register at subdl.com ↗)
              </span>
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "1px 5px",
                  borderRadius: 3,
                  background: "rgba(99,202,183,0.12)",
                  color: "#63cab7",
                  border: "1px solid rgba(99,202,183,0.25)",
                }}
              >
                OPTIONAL
              </span>
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--text3)",
                marginBottom: 8,
                lineHeight: 1.5,
              }}
            >
              Leave empty to use{" "}
              <strong style={{ color: "var(--text)" }}>Wyzie Subs</strong>{" "}
              (default, requires Wyzie API key above). Add a SubDL key to switch
              to SubDL as the primary source.
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                className="apikey-input"
                style={{ flex: 1, maxWidth: 400, marginBottom: 0 }}
                type={showSubdlKey ? "text" : "password"}
                placeholder="SubDL API key, leave empty to use Wyzie"
                value={subdlApiKey}
                onChange={(e) => setSubdlApiKey(e.target.value)}
              />
              <button
                className="btn btn-ghost"
                style={{ padding: "6px 12px", fontSize: 12 }}
                onClick={() => setShowSubdlKey((v) => !v)}
              >
                {showSubdlKey ? "Hide" : "Show"}
              </button>
              {subdlApiKey.trim() && (
                <button
                  className="btn btn-ghost"
                  style={{
                    padding: "6px 12px",
                    fontSize: 12,
                    color: "var(--text3)",
                  }}
                  onClick={() => setSubdlApiKey("")}
                  title="Clear key (revert to Wyzie)"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </>
      )}

      <div
        style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}
      >
        <button className="btn btn-primary" onClick={handleSave}>
          Save
        </button>
        {saved && (
          <span style={{ fontSize: 13, color: "#4caf50" }}>✓ Saved</span>
        )}
      </div>
    </div>
  );
}

export function NotificationsSection() {
  const [notifyDownload, setNotifyDownload] = useState(
    () => storage.get(STORAGE_KEYS.NOTIFY_DOWNLOAD_COMPLETE) !== false,
  );
  const [notifyEpisode, setNotifyEpisode] = useState(() => {
    const stored = storage.get(STORAGE_KEYS.NOTIFY_NEW_EPISODE);
    return stored === null || stored === undefined ? true : !!stored;
  });
  const [showBattery, setShowBattery] = useState(
    () => storage.get(STORAGE_KEYS.SHOW_BATTERY_STATUS) !== false,
  );
  const [batteryAlerts, setBatteryAlerts] = useState(
    () => storage.get(STORAGE_KEYS.BATTERY_ALERTS) !== false,
  );
  const [batteryOptimization, setBatteryOptimization] = useState(
    () => storage.get(STORAGE_KEYS.BATTERY_OPTIMIZATION) !== false,
  );
  const [saved, setSaved] = useState(false);

  const saveSettings = () => {
    storage.set(STORAGE_KEYS.NOTIFY_DOWNLOAD_COMPLETE, notifyDownload);
    storage.set(STORAGE_KEYS.NOTIFY_NEW_EPISODE, notifyEpisode);
    storage.set(STORAGE_KEYS.SHOW_BATTERY_STATUS, showBattery);
    storage.set(STORAGE_KEYS.BATTERY_ALERTS, batteryAlerts);
    storage.set(STORAGE_KEYS.BATTERY_OPTIMIZATION, batteryOptimization);
    window.dispatchEvent(new CustomEvent("orion:battery-settings-changed"));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const applyBatterySetting = (key, setter, value) => {
    setter(value);
    storage.set(key, value);
    window.dispatchEvent(new CustomEvent("orion:battery-settings-changed"));
  };

  const ToggleRow = ({ label, description, value, onChange }) => (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        padding: "16px 0",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <Toggle value={value} onChange={onChange} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>
          {label}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--text3)",
            marginTop: 3,
            lineHeight: 1.5,
          }}
        >
          {description}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ marginBottom: 40 }}>
      <div className="settings-section-title">Desktop Notifications</div>
      <div
        style={{
          fontSize: 13,
          color: "var(--text3)",
          marginBottom: 16,
          lineHeight: 1.6,
        }}
      >
        Control which events trigger a desktop notification.
      </div>

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "0 16px",
          marginBottom: 20,
        }}
      >
        <ToggleRow
          label="Notify when a download completes"
          description="Shows a desktop notification when an item finishes downloading."
          value={notifyDownload}
          onChange={setNotifyDownload}
        />
        <ToggleRow
          label="Notify about new episodes on startup"
          description="On startup, checks every TV series you have saved for newly released episodes and notifies you if any aired since the last check."
          value={notifyEpisode}
          onChange={setNotifyEpisode}
        />
        <ToggleRow
          label="Show battery status"
          description="Displays charging state and percentage in Orion's title bar and tray. Hidden automatically on desktops without a battery."
          value={showBattery}
          onChange={(value) => applyBatterySetting(STORAGE_KEYS.SHOW_BATTERY_STATUS, setShowBattery, value)}
        />
        <ToggleRow
          label="Low-battery alerts"
          description="Notifies once at 20% and again at 10% during each discharge cycle."
          value={batteryAlerts}
          onChange={(value) => applyBatterySetting(STORAGE_KEYS.BATTERY_ALERTS, setBatteryAlerts, value)}
        />
        <ToggleRow
          label="Automatic battery optimization"
          description="Reduces visual and download pressure at 20%, and resumably pauses downloads at 10%. Playback continues."
          value={batteryOptimization}
          onChange={(value) => applyBatterySetting(STORAGE_KEYS.BATTERY_OPTIMIZATION, setBatteryOptimization, value)}
        />
      </div>

      <div style={{ color: "#63cab7", fontSize: 12, marginBottom: 16 }}>
        Battery changes apply immediately.
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button className="btn btn-primary" onClick={saveSettings}>
          Save
        </button>
        {saved && (
          <span style={{ fontSize: 13, color: "#48c774" }}>✓ Saved</span>
        )}
      </div>
    </div>
  );
}
