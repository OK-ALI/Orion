import { FREQUENCY_OPTIONS } from "../settingsConstants";
import { useEffect, useRef, useState } from "react";
import UpdateModal from "../../../components/UpdateModal";
import { storage, STORAGE_KEYS, isElectron } from "../../../services/settingsStore";
import { checkForUpdates } from "../../../shared/utils/updates";
import { HOME_ROWS, loadHomeLayout, loadHomeViewMode, saveHomeViewMode } from "../../../shared/utils/homeLayout";
import { collectBackupData, restoreBackupData } from "../../../services/backup";
import { SettingsSelect, Toggle } from "../components/SettingsControls";

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

  const handleExport = () => {
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: collectBackupData(),
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
    reader.onload = (ev) => {
      try {
        const backup = JSON.parse(ev.target.result);
        if (!backup?.data)
          throw new Error("Invalid backup file, missing data field.");
        restoreBackupData(backup.data);
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
