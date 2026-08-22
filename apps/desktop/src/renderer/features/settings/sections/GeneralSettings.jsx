import { FREQUENCY_OPTIONS } from "../settingsConstants";
import { useEffect, useRef, useState, useCallback } from "react";
import UpdateModal from "../../../components/UpdateModal";
import { storage, STORAGE_KEYS, isElectron } from "../../../services/settingsStore";
import { checkForUpdates } from "../../../shared/utils/updates";
import { HOME_ROWS, loadHomeLayout, loadHomeViewMode, saveHomeViewMode } from "../../../shared/utils/homeLayout";
import { collectCompleteBackupData, collectLegacyCloudSyncData, restoreCompleteBackupData, restoreLegacyCloudSyncData } from "../../../services/backup";
import { SettingsSelect, Toggle } from "../components/SettingsControls";
import MyListSyncCard from "../components/MyListSyncCard";
import WatchedSyncCard from "../components/WatchedSyncCard";
import ViewingActivitySyncCard from "../components/ViewingActivitySyncCard";
import WorkspaceRestoreConfirm from "../components/WorkspaceRestoreConfirm";
function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${Math.round(bytes / 1e3)} KB`;
}

export function VersionSection() {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [channel, setChannel] = useState(() =>
    storage.get(STORAGE_KEYS.UPDATE_CHANNEL) === "preview" ? "preview" : "stable",
  );
  const [autoCheck, setAutoCheck] = useState(() => {
    const stored = storage.get(STORAGE_KEYS.AUTO_CHECK_UPDATES);
    return stored === null || stored === undefined ? true : !!stored;
  });
  const [autoSaved, setAutoSaved] = useState(false);
  const [currentVersion, setCurrentVersion] = useState("0.0.0");

  useEffect(() => {
    if (window.electron?.getAppVersion) {
      window.electron.getAppVersion().then((v) => setCurrentVersion(v));
    }
  }, []);

  const runCheck = useCallback(async (selectedChannel = channel) => {
    setChecking(true);
    setResult(null);
    try {
      const r = await checkForUpdates(selectedChannel);
      setResult(r);
      return r;
    } catch (e) {
      const failed = { error: e.message || "Could not reach GitHub." };
      setResult(failed);
      return failed;
    } finally {
      setChecking(false);
    }
  }, [channel]);

  useEffect(() => {
    runCheck(channel);
  }, [channel, runCheck]);

  const changeChannel = (next) => {
    const normalized = next === "preview" ? "preview" : "stable";
    storage.set(STORAGE_KEYS.UPDATE_CHANNEL, normalized);
    setChannel(normalized);
  };

  const toggleAuto = (val) => {
    setAutoCheck(val);
    storage.set(STORAGE_KEYS.AUTO_CHECK_UPDATES, val ? 1 : 0);
    setAutoSaved(true);
    setTimeout(() => setAutoSaved(false), 1800);
  };

  return (
    <div style={{ marginBottom: 40 }}>
      <div className="settings-section-title">Orion Updates</div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(220px, .55fr)", gap: 18, marginBottom: 18 }}>
        <div style={{ border: "1px solid var(--border)", background: "var(--surface2)", borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>ORION DESKTOP</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <code style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 12px" }}>
              v{currentVersion}
            </code>
            {result && !result.error && (
              <span style={{ fontSize: 13, color: result.hasUpdate ? "var(--red)" : "#48c774", fontWeight: 600 }}>
                {result.hasUpdate ? `v${result.latest} available` : "✓ You're up to date"}
              </span>
            )}
            {result?.error && <span style={{ fontSize: 13, color: "var(--red)" }}>✕ {result.error}</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
            <SettingsSelect
              value={channel}
              onChange={changeChannel}
              options={[
                { value: "stable", label: "Stable — Recommended" },
                { value: "preview", label: "Preview — Early releases" },
              ]}
              style={{ minWidth: 210 }}
            />
            <button className="btn btn-ghost" disabled={checking} onClick={() => runCheck(channel)} style={{ opacity: checking ? 0.6 : 1 }}>
              {checking ? "Checking…" : "Check for Updates"}
            </button>
            {result && !result.error && result.hasUpdate && (
              <button className="btn btn-primary" onClick={() => setShowUpdateModal(true)}>
                View Update
              </button>
            )}
          </div>
          <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 10, lineHeight: 1.5 }}>
            Preview widens eligibility to newer preview builds, but never downgrades below the newest Stable release.
          </div>
        </div>

        <div style={{ border: "1px solid var(--border)", background: "var(--surface2)", borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8 }}>UPDATE CHECKS</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Toggle value={autoCheck} onChange={toggleAuto} title={autoCheck ? "Disable auto-check" : "Enable auto-check"} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>Check on startup</div>
              <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>Uses the selected {channel} channel.</div>
            </div>
            {autoSaved && <span style={{ fontSize: 12, color: "#48c774" }}>✓ Saved</span>}
          </div>
        </div>
      </div>

      {showUpdateModal && result?.hasUpdate && (
        <UpdateModal updateInfo={result} onClose={() => setShowUpdateModal(false)} />
      )}

    </div>
  );
}

export function HomeLayoutSection() {
  const [order, setOrder] = useState(() => {
    const { order: o } = loadHomeLayout();
    return o;
  });
  const [visible, setVisible] = useState(() => {
    const { visible: v } = loadHomeLayout();
    return v;
  });
  const [viewMode, setViewMode] = useState(() => loadHomeViewMode());
  const [saved, setSaved] = useState(false);
  const dragItem = useRef(null);
  const dragOver = useRef(null);

  const handleDragStart = (idx) => {
    dragItem.current = idx;
  };
  const handleDragEnter = (idx) => {
    dragOver.current = idx;
  };
  const handleDragEnd = () => {
    const newOrder = [...order];
    const dragged = newOrder.splice(dragItem.current, 1)[0];
    newOrder.splice(dragOver.current, 0, dragged);
    dragItem.current = null;
    dragOver.current = null;
    setOrder(newOrder);
  };

  const toggleVisible = (id) => {
    setVisible((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSave = () => {
    storage.set(STORAGE_KEYS.HOME_ROW_ORDER, order);
    storage.set(STORAGE_KEYS.HOME_ROW_VISIBLE, visible);
    saveHomeViewMode(viewMode);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const rowLabels = Object.fromEntries(HOME_ROWS.map((r) => [r.id, r.label]));

  return (
    <div style={{ marginBottom: 40 }}>
      <div className="settings-section-title">Home Page Layout</div>
      <div
        style={{
          fontSize: 13,
          color: "var(--text3)",
          marginBottom: 16,
          lineHeight: 1.6,
        }}
      >
        Choose which rows appear on the Home page and drag to reorder them. The
        hero banner is always shown at the top.
      </div>

      {/* ── View mode selector ── */}
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text2)",
            marginBottom: 8,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Row display style
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {[
            {
              value: "carousel",
              label: "Carousel",
              desc: "Scrollable spotlight with featured poster",
            },
            {
              value: "list",
              label: "⊞ Grid",
              desc: "Compact grid of all items",
            },
          ].map(({ value, label, desc }) => (
            <button
              key={value}
              onClick={() => setViewMode(value)}
              style={{
                flex: 1,
                maxWidth: 220,
                padding: "10px 14px",
                borderRadius: 8,
                border: `2px solid ${viewMode === value ? "var(--red)" : "var(--border)"}`,
                background:
                  viewMode === value
                    ? "color-mix(in srgb, var(--red) 12%, var(--surface))"
                    : "var(--surface)",
                color: viewMode === value ? "var(--text)" : "var(--text2)",
                cursor: "pointer",
                textAlign: "left",
                transition: "border-color 0.15s, background 0.15s",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
              <div
                style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}
              >
                {desc}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          maxWidth: 480,
        }}
      >
        {order.map((id, idx) => (
          <div
            key={id}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragEnter={() => handleDragEnter(idx)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => e.preventDefault()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "10px 14px",
              cursor: "grab",
              opacity: visible[id] ? 1 : 0.45,
              transition: "opacity 0.2s",
              userSelect: "none",
            }}
          >
            {/* Drag handle */}
            <span
              style={{
                color: "var(--text3)",
                fontSize: 16,
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              ⠿
            </span>

            {/* Label */}
            <span
              style={{
                flex: 1,
                fontSize: 14,
                fontWeight: 500,
                color: "var(--text)",
              }}
            >
              {rowLabels[id] || id}
            </span>

            {/* Toggle */}
            <Toggle
              value={visible[id]}
              onChange={() => toggleVisible(id)}
              title={visible[id] ? "Hide row" : "Show row"}
            />
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 16,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <button className="btn btn-primary" onClick={handleSave}>
          Save Layout
        </button>
        {saved && (
          <span style={{ fontSize: 13, color: "#48c774" }}>✓ Saved</span>
        )}
      </div>
    </div>
  );
}

export function ScheduledBackupSection() {
  const [enabled, setEnabled] = useState(false);
  const [backupPath, setBackupPath] = useState("");
  const [keepCount, setKeepCount] = useState(5);
  const [frequency, setFrequency] = useState("startup");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isElectron) {
      setLoading(false);
      return;
    }
    window.electron.getScheduledBackupSettings().then((s) => {
      if (s) {
        setEnabled(!!s.enabled);
        setBackupPath(s.path || "");
        setKeepCount(s.keepCount ?? 5);
        setFrequency(s.frequency || "startup");
      }
      setLoading(false);
    });
  }, []);

  const pickFolder = async () => {
    if (!isElectron) return;
    const folder = await window.electron.pickFolder();
    if (folder) setBackupPath(folder);
  };

  const handleSave = async () => {
    if (!isElectron) return;
    const settings = {
      enabled,
      path: backupPath,
      keepCount: Math.max(1, Math.min(99, Number(keepCount) || 5)),
      frequency,
      lastRun: null,
    };
    // preserve lastRun from existing settings
    const existing = await window.electron.getScheduledBackupSettings();
    if (existing?.lastRun) settings.lastRun = existing.lastRun;
    await window.electron.setScheduledBackupSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!isElectron || loading) return null;

  return (
    <div
      style={{
        marginTop: 28,
        padding: "20px 22px",
        background: "var(--surface2)",
        border: "1px solid var(--border)",
        borderRadius: 10,
      }}
    >
      {/* Header row with toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: enabled ? 20 : 0,
        }}
      >
        <Toggle value={enabled} onChange={setEnabled} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
            Scheduled Backups
          </div>
          <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
            Automatically save a backup file on a schedule
          </div>
        </div>
      </div>

      {enabled && (
        <>
          {/* Backup path */}
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text2)",
                marginBottom: 6,
              }}
            >
              Backup Folder
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                className="apikey-input"
                style={{ flex: 1, marginBottom: 0 }}
                placeholder="/home/you/Backups"
                value={backupPath}
                onChange={(e) => setBackupPath(e.target.value)}
              />
              <button
                className="btn btn-ghost"
                style={{ padding: "7px 14px", fontSize: 13 }}
                onClick={pickFolder}
              >
                Browse…
              </button>
            </div>
          </div>

          {/* Frequency + Keep count row */}
          <div
            style={{
              display: "flex",
              gap: 16,
              flexWrap: "wrap",
              marginBottom: 16,
            }}
          >
            <div style={{ flex: 1, minWidth: 160 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text2)",
                  marginBottom: 6,
                }}
              >
                Frequency
              </div>
              <SettingsSelect
                value={frequency}
                onChange={(v) => setFrequency(v)}
                options={FREQUENCY_OPTIONS}
                style={{ width: "100%" }}
              />
            </div>

            <div style={{ flex: 1, minWidth: 120 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text2)",
                  marginBottom: 6,
                }}
              >
                Keep Last N Backups
              </div>
              <input
                type="number"
                min={1}
                max={99}
                className="apikey-input"
                style={{ width: "100%", marginBottom: 0 }}
                value={keepCount}
                onChange={(e) => setKeepCount(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button className="btn btn-primary" onClick={handleSave}>
              Save
            </button>
            {saved && (
              <span style={{ fontSize: 13, color: "#48c774" }}>✓ Saved</span>
            )}
          </div>
        </>
      )}

      {!enabled && (
        <div
          style={{ display: "flex", justifyContent: "flex-end", marginTop: 0 }}
        >
          {/* empty, toggle handles everything */}
        </div>
      )}
    </div>
  );
}

export function BackupRestoreSection({ onRestored }) {
  const [restoreStatus, setRestoreStatus] = useState(null);

  const handleExport = async () => {
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: await collectCompleteBackupData(),
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orion-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const backup = JSON.parse(ev.target.result);
        if (!backup?.data)
          throw new Error("Invalid backup file, missing data field.");
        await restoreCompleteBackupData(backup.data);
        setRestoreStatus("✓ Backup restored: reloading…");
        setTimeout(() => window.location.reload(), 1200);
        onRestored?.();
      } catch (err) {
        setRestoreStatus("✕ " + (err.message || "Could not read backup file."));
        setTimeout(() => setRestoreStatus(null), 4000);
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  return (
    <div style={{ marginBottom: 40 }}>
      <div className="settings-section-title">Backup &amp; Restore</div>
      <div
        style={{
          fontSize: 13,
          color: "var(--text3)",
          marginBottom: 20,
          lineHeight: 1.6,
        }}
      >
        Export your watchlist, watch history, progress, and preferences to a
        JSON file. Secure provider API keys are intentionally not exported.
        Import the file later before reinstalling or switching devices.
      </div>
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <button className="btn btn-primary" onClick={handleExport}>
          ⬆ Export Backup
        </button>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "9px 18px",
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            color: "var(--text)",
            cursor: "pointer",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "var(--surface)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "var(--surface2)")
          }
        >
          ⬇ Import Backup
          <input
            type="file"
            accept=".json,application/json"
            onChange={handleImport}
            style={{ display: "none" }}
          />
        </label>
        {restoreStatus && (
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: restoreStatus.startsWith("✕") ? "var(--red)" : "#48c774",
            }}
          >
            {restoreStatus}
          </span>
        )}
      </div>
      <ScheduledBackupSection />
    </div>
  );
}

export function GoogleAuthSection({ secGoogle }) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [configSource, setConfigSource] = useState("missing");
  const [hasSecret, setHasSecret] = useState(false);
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [error, setError] = useState(null);

  const [syncEnabled, setSyncEnabled] = useState(() => {
    const val = localStorage.getItem("orion_google_sync_enabled");
    return val === null ? true : val === "true";
  });
  const [syncStatus, setSyncStatus] = useState("idle");
  const [syncError, setSyncError] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(() => {
    return localStorage.getItem("orion_google_last_sync_time") || null;
  });
  const [storageQuota, setStorageQuota] = useState(null);
  const [autoBackupMedia, setAutoBackupMedia] = useState(() => {
    return localStorage.getItem("orion_google_auto_backup_media") === "true";
  });
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

  const fetchQuota = useCallback(async () => {
    if (!window.electron?.getStorageQuota) return;
    try {
      const res = await window.electron.getStorageQuota();
      if (res?.ok && res.quota) {
        setStorageQuota(res.quota);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (profile) {
      fetchQuota();
    }
  }, [profile, fetchQuota]);

  const handleBackupToCloud = async () => {
    if (!window.electron?.uploadSync) return;
    setSyncStatus("syncing");
    setSyncError(null);
    try {
      const localData = await collectLegacyCloudSyncData({ profileId: profile?.sub });
      localData.timestamp = new Date().toISOString();
      const res = await window.electron.uploadSync(localData);
      if (res?.ok) {
        setSyncStatus("success");
        const now = new Date().toISOString();
        setLastSyncTime(now);
        localStorage.setItem("orion_google_last_sync_time", now);
        await fetchQuota();
        setTimeout(() => setSyncStatus("idle"), 3000);
      } else {
        setSyncStatus("error");
        setSyncError(res?.error || "Failed to upload sync data.");
      }
    } catch (e) {
      setSyncStatus("error");
      setSyncError(e.message || "An unexpected error occurred.");
    }
  };

  const handleRestoreFromCloud = () => {
    setShowRestoreConfirm(true);
  };

  const executeRestoreFromCloud = async () => {
    if (!window.electron?.downloadSync) return;
    setSyncStatus("syncing");
    setSyncError(null);
    try {
      const res = await window.electron.downloadSync();
      if (res?.ok && res.data) {
        setSyncStatus("success");
        await restoreLegacyCloudSyncData(res.data, { profileId: profile?.sub });
        if (res.data.timestamp) {
          localStorage.setItem("orion_google_last_sync_time", res.data.timestamp);
        }
        setSyncStatus("success_reload");
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else if (res?.ok) {
        setSyncStatus("error");
        setSyncError("No cloud backup found on Google Drive.");
      } else {
        setSyncStatus("error");
        setSyncError(res?.error || "Failed to download backup.");
      }
    } catch (e) {
      setSyncStatus("error");
      setSyncError(e.message || "An unexpected error occurred.");
    }
  };

  const fetchConfig = useCallback(() => {
    if (!window.electron?.getClientConfig) return;
    window.electron.getClientConfig().then((cfg) => {
      if (cfg) {
        setClientId(cfg.clientId || "");
        setHasSecret(cfg.hasClientSecret);
        setConfigSource(cfg.source || "missing");
      }
    });
  }, []);

  const fetchProfile = useCallback(() => {
    if (!window.electron?.getProfile) {
      setLoadingProfile(false);
      return;
    }
    window.electron.getProfile().then((res) => {
      if (res?.ok) {
        setProfile(res.profile);
      }
      setLoadingProfile(false);
    });
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchProfile();
  }, [fetchConfig, fetchProfile]);

  const handleSaveConfig = async () => {
    if (!window.electron?.setClientConfig) return;
    setSaveStatus("Saving...");
    setError(null);
    const res = await window.electron.setClientConfig({
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
    });
    if (res?.ok) {
      setSaveStatus("✓ Saved");
      setClientSecret(""); // clear input after saving
      if (window.electron?.getClientConfig) {
        const cfg = await window.electron.getClientConfig();
        if (cfg) {
          setClientId(cfg.clientId || "");
          setHasSecret(cfg.hasClientSecret);
          setConfigSource(cfg.source || "missing");
        }
      }
      setTimeout(() => setSaveStatus(null), 2500);
    } else {
      setSaveStatus(null);
      setError(res?.error || "Failed to save configuration.");
    }
  };

  const handleClearConfig = async () => {
    if (!window.electron?.setClientConfig) return;
    setError(null);
    const res = await window.electron.setClientConfig({
      clientId: null,
      clientSecret: null,
    });
    if (res?.ok) {
      setClientId("");
      setClientSecret("");
      setSaveStatus("✓ Configuration cleared");
      if (window.electron?.getClientConfig) {
        const cfg = await window.electron.getClientConfig();
        if (cfg) {
          setClientId(cfg.clientId || "");
          setHasSecret(cfg.hasClientSecret);
          setConfigSource(cfg.source || "missing");
        }
      }
      setTimeout(() => setSaveStatus(null), 2500);
    } else {
      setError(res?.error || "Failed to clear configuration.");
    }
  };

  const handleLogin = async () => {
    if (!window.electron?.login) return;
    setIsLoggingIn(true);
    setError(null);
    try {
      const res = await window.electron.login();
      if (res?.ok) {
        setProfile(res.profile);
      } else {
        setError(res?.error || "Authentication failed.");
      }
    } catch (err) {
      setError(err.message || "An unexpected error occurred during login.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    if (!window.electron?.logout) return;
    setError(null);
    const res = await window.electron.logout();
    if (res?.ok) {
      setProfile(null);
      window.location.reload();
    } else {
      setError(res?.error || "Logout failed.");
    }
  };

  if (!isElectron) return null;
  if (loadingProfile) return null;

  const isConfigured = configSource !== "missing";

  return (
    <div ref={secGoogle} style={{ scrollMarginTop: 80, marginBottom: 40 }}>
      <div className="settings-section-title">Account</div>
      <div
        style={{
          fontSize: 13,
          color: "var(--text3)",
          marginBottom: 16,
          lineHeight: 1.6,
        }}
      >
        Your Orion identity and account connection.
      </div>

      {profile ? (
        // Logged-in view
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              background: "var(--surface2)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "14px 18px",
              marginBottom: 12,
            }}
          >
            {profile.picture ? (
              <img
                src={profile.picture}
                alt={profile.name || "Profile"}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  border: "2px solid var(--accent)",
                }}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: "var(--surface3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 17,
                  color: "var(--text)",
                  border: "2px solid var(--accent)",
                }}
              >
                {profile.name ? profile.name[0].toUpperCase() : "G"}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 650, color: "var(--text)" }}>
                {profile.name}
              </div>
              <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
                {profile.email}
              </div>
            </div>
            <span
              style={{
                border: "1px solid var(--border)",
                borderRadius: 999,
                padding: "4px 9px",
                color: "var(--text3)",
                background: "var(--surface3)",
                fontSize: 10,
                fontWeight: 800,
                whiteSpace: "nowrap",
              }}
            >
              Google connected
            </span>
          </div>

          <div
            style={{
              background: "var(--surface2)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "18px 20px 4px",
              marginBottom: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, paddingBottom: 14 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 750, color: "var(--text)" }}>Orion Cloud</div>
                <div style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.5, marginTop: 3 }}>
                  Keep your Orion library in sync across devices.
                </div>
              </div>
              <span
                style={{
                  border: "1px solid var(--accent)",
                  borderRadius: 999,
                  padding: "4px 9px",
                  background: "var(--accent-soft)",
                  color: "var(--accent)",
                  fontSize: 10,
                  fontWeight: 800,
                }}
              >
                Connected
              </span>
            </div>

            <MyListSyncCard key={`my-list-${profile?.sub || "no-google"}`} googleProfile={profile} />
            <WatchedSyncCard key={`watched-${profile?.sub || "no-google"}`} googleProfile={profile} />
            <ViewingActivitySyncCard key={`viewing-${profile?.sub || "no-google"}`} googleProfile={profile} />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
            <button className="btn btn-ghost" onClick={handleLogout} style={{ color: "var(--danger)" }}>
              Disconnect Google
            </button>
          </div>

          <div
            style={{
              background: "var(--surface2)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "18px 20px",
              marginTop: 12,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Desktop backup & media</div>
            <div style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.5, marginBottom: 16 }}>
              Back up this Desktop's workspace and completed downloads to Google Drive. Separate from Orion Cloud.
            </div>

            {storageQuota && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text3)", marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, color: "var(--text)" }}>Google Drive storage</span>
                  <span>{formatBytes(Number(storageQuota.usage))} of {formatBytes(Number(storageQuota.limit))} ({((Number(storageQuota.usage) / Number(storageQuota.limit)) * 100).toFixed(1)}% used)</span>
                </div>
                <div style={{ width: "100%", height: 8, background: "var(--surface3)", borderRadius: 4, overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${Math.min(100, (Number(storageQuota.usage) / Number(storageQuota.limit)) * 100)}%`,
                      height: "100%",
                      background: (Number(storageQuota.usage) / Number(storageQuota.limit)) > 0.85 ? "var(--danger)" : "var(--accent)",
                      borderRadius: 4,
                    }}
                  />
                </div>
              </div>
            )}

            {storageQuota && <div style={{ height: "1px", background: "var(--border)", margin: "16px 0" }} />}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 18,
                marginBottom: 16,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>
                  Desktop workspace backup
                </div>
                <div style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.4 }}>
                  Back up playlists and settings to Google Drive.
                </div>
              </div>
              <Toggle
                value={syncEnabled}
                onChange={(val) => {
                  setSyncEnabled(val);
                  localStorage.setItem("orion_google_sync_enabled", val ? "true" : "false");
                }}
                title={syncEnabled ? "Disable Desktop workspace backup" : "Enable Desktop workspace backup"}
              />
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 18,
                marginBottom: 20,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>
                  Media Locker backup
                </div>
                <div style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.4 }}>
                  Back up completed downloads to Google Drive.
                </div>
              </div>
              <Toggle
                value={autoBackupMedia}
                onChange={(val) => {
                  setAutoBackupMedia(val);
                  localStorage.setItem("orion_google_auto_backup_media", val ? "true" : "false");
                }}
                title={autoBackupMedia ? "Disable Media Locker backup" : "Enable Media Locker backup"}
              />
            </div>

            <div style={{ height: "1px", background: "var(--border)", margin: "16px 0" }} />

            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
              <button
                className="btn btn-primary"
                disabled={syncStatus === "syncing"}
                onClick={handleBackupToCloud}
                style={{ fontSize: 13, padding: "8px 16px" }}
              >
                {syncStatus === "syncing" ? "Backing up..." : "Back up Desktop workspace"}
              </button>
              <button
                className="btn btn-secondary"
                disabled={syncStatus === "syncing"}
                onClick={handleRestoreFromCloud}
                style={{ fontSize: 13, padding: "8px 16px" }}
              >
                Restore Desktop workspace
              </button>
            </div>
            <div>
              <span
                style={{
                  fontSize: 12,
                  color: syncStatus === "error" ? "var(--danger)" : "var(--text3)",
                  lineHeight: 1.4,
                }}
              >
                {syncStatus === "syncing" && "Connecting to Google Drive..."}
                {syncStatus === "success" && "✓ Backup successful."}
                {syncStatus === "success_reload" && "✓ Restore successful. Reloading..."}
                {syncStatus === "error" && `✕ Failed: ${syncError || "Please check configuration"}`}
                {syncStatus === "idle" && (
                  lastSyncTime
                    ? `Last backup: ${new Date(lastSyncTime).toLocaleString()}`
                    : "Google Drive backup is ready"
                )}
              </span>
            </div>
          </div>
        </div>
      ) : (
        // Logged-out view
        <div style={{ marginBottom: 20 }}>
          {isConfigured ? (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <span className="badge badge-secondary" style={{ textTransform: "capitalize" }}>
                  Google connection ready
                </span>
                {configSource === "user" && (
                  <button className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: 11 }} onClick={handleClearConfig}>
                    Reset setup
                  </button>
                )}
              </div>
              <button
                className="btn btn-primary"
                disabled={isLoggingIn}
                onClick={handleLogin}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  opacity: isLoggingIn ? 0.7 : 1,
                }}
              >
                {isLoggingIn ? (
                  "Connecting..."
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 6 }}>
                      <path d="M21.35,11.1H12v2.7h5.3c-0.2,1.3-1,2.4-2.2,3.2v2.7h3.6c2.1-1.9,3.3-4.7,3.3-8C22,11.9,21.8,11.4,21.35,11.1z" fill="#4285F4"/>
                      <path d="M12,20.7c2.4,0,4.5-0.8,6-2.2l-3.6-2.7c-1,0.7-2.3,1.1-3.6,1.1c-2.8,0-5.1-1.9-6-4.4H1.1v2.8C2.6,18.3,7,20.7,12,20.7z" fill="#34A853"/>
                      <path d="M6,12.5c-0.2-0.7-0.3-1.4-0.3-2.1s0.1-1.4,0.3-2.1V5.5H1.1C0.4,6.9,0,8.4,0,10s0.4,3.1,1.1,4.5L6,12.5z" fill="#FBBC05"/>
                      <path d="M12,5.3c1.3,0,2.5,0.5,3.4,1.3l2.6-2.6C16.5,2.7,14.4,2,12,2C7,2,2.6,4.4,1.1,7.2L6,10C6.9,7.5,9.2,5.3,12,5.3z" fill="#EA4335"/>
                    </svg>
                    Continue with Google
                  </>
                )}
              </button>
            </div>
          ) : (
            <div style={{ color: "var(--text3)", fontSize: 13, background: "rgba(229,9,20,0.06)", border: "1px solid rgba(229,9,20,0.15)", borderRadius: 8, padding: "12px 16px", marginBottom: 20 }}>
              Google sign-in needs setup on this Desktop. Enter the Google connection details below.
            </div>
          )}

          {/* Configuration Fields */}
          {configSource !== "env" && (
            <div
              style={{
                background: "var(--surface2)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "20px 22px",
                marginTop: 16,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 12 }}>
                Google connection setup
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 6 }}>
                  Client ID
                </div>
                <input
                  type="text"
                  className="apikey-input"
                  placeholder="your-client-id.apps.googleusercontent.com"
                  style={{ width: "100%", marginBottom: 0 }}
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                />
              </div>
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 6 }}>
                  Client Secret
                </div>
                <input
                  type="password"
                  className="apikey-input"
                  placeholder={hasSecret ? "••••••••••••••••••••••••" : "Paste your Google Client Secret"}
                  style={{ width: "100%", marginBottom: 0 }}
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button className="btn btn-primary" onClick={handleSaveConfig}>
                  Save Google setup
                </button>
                {saveStatus && (
                  <span style={{ fontSize: 13, color: "#48c774" }}>{saveStatus}</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div
          style={{
            fontSize: 13,
            color: "var(--red)",
            marginTop: 10,
            background: "rgba(229,9,20,0.08)",
            border: "1px solid rgba(229,9,20,0.2)",
            borderRadius: 6,
            padding: "10px 14px",
          }}
        >
          {error}
        </div>
      )}

      <WorkspaceRestoreConfirm
        open={showRestoreConfirm}
        onCancel={() => setShowRestoreConfirm(false)}
        onConfirm={() => {
          setShowRestoreConfirm(false);
          executeRestoreFromCloud();
        }}
      />
    </div>
  );
}

