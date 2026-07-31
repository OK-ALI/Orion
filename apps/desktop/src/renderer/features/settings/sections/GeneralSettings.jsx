import { FREQUENCY_OPTIONS } from "../settingsConstants";
import { useEffect, useRef, useState, useCallback } from "react";
import UpdateModal from "../../../components/UpdateModal";
import { storage, STORAGE_KEYS, isElectron } from "../../../services/settingsStore";
import { checkForUpdates } from "../../../shared/utils/updates";
import { HOME_ROWS, loadHomeLayout, loadHomeViewMode, saveHomeViewMode } from "../../../shared/utils/homeLayout";
import { collectCompleteBackupData, restoreCompleteBackupData } from "../../../services/backup";
import { SettingsSelect, Toggle } from "../components/SettingsControls";

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${Math.round(bytes / 1e3)} KB`;
}

export function VersionSection() {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null); // { latest, current, url, hasUpdate } | { error }
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [autoCheck, setAutoCheck] = useState(() => {
    const stored = storage.get(STORAGE_KEYS.AUTO_CHECK_UPDATES);
    return stored === null || stored === undefined ? true : !!stored;
  });
  const [autoSaved, setAutoSaved] = useState(false);
  const [currentVersion, setCurrentVersion] = useState("0.0.0");

  useEffect(() => {
    if (window.electron?.getAppVersion) {
      window.electron.getAppVersion().then((v) => {
        setCurrentVersion(v);
      });
    }
  }, []);

  const runCheck = async () => {
    setChecking(true);
    setResult(null);
    try {
      const r = await checkForUpdates();
      setResult(r);
    } catch (e) {
      setResult({ error: e.message || "Could not reach GitHub." });
    } finally {
      setChecking(false);
    }
  };

  const toggleAuto = (val) => {
    setAutoCheck(val);
    storage.set(STORAGE_KEYS.AUTO_CHECK_UPDATES, val ? 1 : 0);
    setAutoSaved(true);
    setTimeout(() => setAutoSaved(false), 1800);
  };

  return (
    <div style={{ marginBottom: 40 }}>
      <div className="settings-section-title">App Version</div>

      {/* Version row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, color: "var(--text3)" }}>
            Current version
          </span>
          <code
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--text)",
              background: "var(--surface2)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "4px 12px",
            }}
          >
            v{currentVersion}
          </code>
        </div>

        <button
          className="btn btn-ghost"
          disabled={checking}
          onClick={runCheck}
          style={{ opacity: checking ? 0.6 : 1 }}
        >
          {checking ? "Checking…" : "Check for Updates"}
        </button>

        {result && !result.error && result.hasUpdate && (
          <button
            onClick={() => setShowUpdateModal(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(229,9,20,0.12)",
              border: "1px solid rgba(229,9,20,0.4)",
              color: "var(--red)",
              borderRadius: 8,
              padding: "6px 14px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(229,9,20,0.22)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "rgba(229,9,20,0.12)")
            }
          >
            🎉 v{result.latest} available. Install Update
          </button>
        )}

        {result && !result.error && !result.hasUpdate && (
          <span style={{ fontSize: 13, color: "#48c774", fontWeight: 500 }}>
            ✓ You're up to date
          </span>
        )}

        {result?.error && (
          <span style={{ fontSize: 13, color: "var(--red)" }}>
            ✕ {result.error}
          </span>
        )}
      </div>

      {showUpdateModal && result?.hasUpdate && (
        <UpdateModal
          updateInfo={result}
          onClose={() => setShowUpdateModal(false)}
        />
      )}

      {/* Auto-check toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <Toggle
          value={autoCheck}
          onChange={toggleAuto}
          title={autoCheck ? "Disable auto-check" : "Enable auto-check"}
        />
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>
            Check for updates on startup
          </div>
          <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
            Shows a notification banner if a new version is available. Turned on
            by default.
          </div>
        </div>
        {autoSaved && (
          <span style={{ fontSize: 12, color: "#48c774" }}>✓ Saved</span>
        )}
      </div>
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
      const localData = await collectCompleteBackupData();
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
        await restoreCompleteBackupData(res.data);
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
      <div className="settings-section-title">Google Authentication</div>
      <div
        style={{
          fontSize: 13,
          color: "var(--text3)",
          marginBottom: 16,
          lineHeight: 1.6,
        }}
      >
        Connect your Google Account to backup and sync your settings, watch progress, and details to the cloud, or to access integrations like Google Drive streaming. Requires custom OAuth Credentials from Google Cloud Console.
      </div>

      {profile ? (
        // Logged-in view
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              background: "var(--surface2)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "16px 20px",
              marginBottom: 16,
            }}
          >
            {profile.picture ? (
              <img
                src={profile.picture}
                alt={profile.name || "Profile"}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  border: "2px solid var(--accent)",
                }}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: "var(--surface3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 18,
                  color: "var(--text)",
                  border: "2px solid var(--accent)",
                }}
              >
                {profile.name ? profile.name[0].toUpperCase() : "G"}
              </div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
                {profile.name}
              </div>
              <div style={{ fontSize: 13, color: "var(--text3)", marginTop: 2 }}>
                {profile.email}
              </div>
            </div>
            <button className="btn btn-ghost" onClick={handleLogout}>
              Sign Out
            </button>
          </div>

          {/* Sync Controls Section */}
          <div
            style={{
              background: "var(--surface2)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "20px 24px",
              marginTop: 12,
            }}
          >
            {/* Storage Meter */}
            {storageQuota && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text3)", marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, color: "var(--text)" }}>Google Drive Storage</span>
                  <span>{formatBytes(Number(storageQuota.usage))} of {formatBytes(Number(storageQuota.limit))} ({((Number(storageQuota.usage) / Number(storageQuota.limit)) * 100).toFixed(1)}% used)</span>
                </div>
                <div style={{ width: "100%", height: 8, background: "var(--surface3)", borderRadius: 4, overflow: "hidden" }}>
                  <div 
                    style={{ 
                      width: `${Math.min(100, (Number(storageQuota.usage) / Number(storageQuota.limit)) * 100)}%`, 
                      height: "100%", 
                      background: (Number(storageQuota.usage) / Number(storageQuota.limit)) > 0.85 ? "var(--red)" : "var(--accent)", 
                      borderRadius: 4 
                    }} 
                  />
                </div>
              </div>
            )}

            {storageQuota && <div style={{ height: "1px", background: "var(--border)", margin: "16px 0" }} />}

            {/* Toggle 1: Auto-Sync */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <div style={{ paddingRight: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
                  Enable Cloud Auto-Sync
                </div>
                <div style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.4 }}>
                  Automatically sync your watchlist, play history, custom playlists, and settings with Google Drive.
                </div>
              </div>
              <input
                type="checkbox"
                checked={syncEnabled}
                onChange={(e) => {
                  const val = e.target.checked;
                  setSyncEnabled(val);
                  localStorage.setItem("orion_google_sync_enabled", val ? "true" : "false");
                }}
                style={{
                  width: 18,
                  height: 18,
                  cursor: "pointer",
                  accentColor: "var(--accent)",
                }}
              />
            </div>

            {/* Toggle 2: Auto-Backup Media Downloads */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <div style={{ paddingRight: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
                  Auto-Backup Downloads to Cloud
                </div>
                <div style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.4 }}>
                  Automatically upload completed video downloads to your Orion Media Locker folder on Google Drive.
                </div>
              </div>
              <input
                type="checkbox"
                checked={autoBackupMedia}
                onChange={(e) => {
                  const val = e.target.checked;
                  setAutoBackupMedia(val);
                  localStorage.setItem("orion_google_auto_backup_media", val ? "true" : "false");
                }}
                style={{
                  width: 18,
                  height: 18,
                  cursor: "pointer",
                  accentColor: "var(--accent)",
                }}
              />
            </div>

            <div style={{ height: "1px", background: "var(--border)", margin: "16px 0" }} />

            {/* Cloud Manual Buttons */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
              <button
                className="btn btn-primary"
                disabled={syncStatus === "syncing"}
                onClick={handleBackupToCloud}
                style={{ fontSize: 13, padding: "8px 16px" }}
              >
                {syncStatus === "syncing" ? "Syncing..." : "Backup to Cloud"}
              </button>
              <button
                className="btn btn-secondary"
                disabled={syncStatus === "syncing"}
                onClick={handleRestoreFromCloud}
                style={{
                  fontSize: 13,
                  padding: "8px 16px",
                  background: "var(--surface3)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  borderRadius: 8,
                  cursor: "pointer",
                  transition: "background 0.15s"
                }}
                onMouseEnter={(e) => {
                  if (syncStatus !== "syncing") e.currentTarget.style.background = "var(--surface2)";
                }}
                onMouseLeave={(e) => {
                  if (syncStatus !== "syncing") e.currentTarget.style.background = "var(--surface3)";
                }}
              >
                Restore from Cloud
              </button>
            </div>
            <div>
              <span
                style={{
                  fontSize: 12,
                  color: syncStatus === "error" ? "var(--red)" : "var(--text3)",
                  lineHeight: 1.4,
                }}
              >
                {syncStatus === "syncing" && "Connecting to Google Drive..."}
                {syncStatus === "success" && "✓ Backup successful."}
                {syncStatus === "success_reload" && "✓ Restore successful. Reloading..."}
                {syncStatus === "error" && `✕ Failed: ${syncError || "Please check configuration"}`}
                {syncStatus === "idle" && (
                  lastSyncTime
                    ? `Last synced: ${new Date(lastSyncTime).toLocaleString()}`
                    : "Ready to sync with Google Drive"
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
                  OAuth Configured ({configSource === "env" ? "Environment" : "User UI"})
                </span>
                {configSource === "user" && (
                  <button className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: 11 }} onClick={handleClearConfig}>
                    Clear Config
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
                    Sign in with Google
                  </>
                )}
              </button>
            </div>
          ) : (
            <div style={{ color: "var(--text3)", fontSize: 13, background: "rgba(229,9,20,0.06)", border: "1px solid rgba(229,9,20,0.15)", borderRadius: 8, padding: "12px 16px", marginBottom: 20 }}>
              Google OAuth client keys are not set. Configure them below or define them in your <code>.env</code> file.
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
                OAuth Client Credentials
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
                  Save Credentials
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

      {showRestoreConfirm && (
        <div className="close-confirm-overlay" style={{ zIndex: 999999 }}>
          <div className="close-confirm-modal" style={{ background: "rgba(20, 20, 20, 0.85)", backdropFilter: "blur(20px)", border: "1px solid var(--border)" }}>
            <div className="close-confirm-icon-wrap">
              <div className="close-confirm-icon-ring" style={{ background: "rgba(0, 168, 255, 0.12)", border: "1.5px solid rgba(0, 168, 255, 0.5)" }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#00a8ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                </svg>
              </div>
            </div>
            <div className="close-confirm-title" style={{ color: "var(--text)" }}>Restore Workspace?</div>
            <div className="close-confirm-body" style={{ color: "var(--text3)", maxWidth: 320, textAlign: "center", lineHeight: 1.5, fontSize: 13, marginBottom: 20 }}>
              This will download your watchlist, history, playlists, and settings from Google Drive, overwriting all local workspace databases.
              <br /><br />
              <strong>Orion will reload to apply the restored sync workspace.</strong>
            </div>
            <div className="close-confirm-actions" style={{ display: "flex", gap: 10, width: "100%" }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowRestoreConfirm(false)}
                style={{ flex: 1, padding: "10px 16px", borderRadius: 8, background: "var(--surface3)", border: "1px solid var(--border)", color: "var(--text)" }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={() => {
                  setShowRestoreConfirm(false);
                  executeRestoreFromCloud();
                }}
                style={{ flex: 1, padding: "10px 16px", borderRadius: 8, background: "var(--accent)", color: "#fff", border: "none" }}
              >
                Restore Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

