import { useCallback, useEffect, useState } from "react";
import { storage, STORAGE_KEYS, formatBytes } from "../../../services/settingsStore";

export function SectionGroupHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 32, marginTop: 4 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          marginBottom: subtitle ? 6 : 0,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 16,
            letterSpacing: 2,
            color: "var(--red)",
            textTransform: "uppercase",
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </div>
        <div
          style={{ flex: 1, height: 1, background: "rgba(229,9,20,0.18)" }}
        />
      </div>
      {subtitle && (
        <div style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.5 }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

export function Divider() {
  return (
    <div style={{ height: 1, background: "var(--border)", marginBottom: 40 }} />
  );
}

export function tmdbTokenDetail(source) {
  if (source === "user") return "User configured";
  if (source === "bundled") return "Bundled";
  return "Required for metadata, posters, and search";
}

export function SystemCheckSection({ apiKey, apiKeySource = "missing", downloadPath }) {
  const [status, setStatus] = useState(null);
  const [performanceStatus, setPerformanceStatus] = useState(null);
  const [batteryStatus, setBatteryStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    if (!window.electron?.getBackendStatus) {
      setStatus({
        ok: false,
        error: "Backend diagnostics are only available in the desktop app.",
      });
      return;
    }
    setLoading(true);
    try {
      const [result, performanceResult, batteryResult] = await Promise.all([
        window.electron.getBackendStatus({
          tmdbTokenSet: !!apiKey,
          tmdbTokenSource: apiKeySource,
          downloadPath,
        }),
        window.electron.getPerformanceSnapshot?.().catch(() => null),
        window.electron.getBatteryStatus?.().catch(() => null),
      ]);
      setStatus(result);
      setPerformanceStatus(performanceResult);
      setBatteryStatus(batteryResult);
    } catch (e) {
      setStatus({ ok: false, error: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [apiKey, apiKeySource, downloadPath]);

  const checks = status?.ok
    ? [
        {
          label: "TMDB token",
          ok: status.configuration.tmdbTokenSet,
          detail: tmdbTokenDetail(status.configuration.tmdbTokenSource),
        },
        {
          label: "Player sessions",
          ok: true,
          detail: `${status.media.playerWebContents} active player view${status.media.playerWebContents === 1 ? "" : "s"}`,
        },
        {
          label: "yt-dlp",
          ok: status.tools.ytDlp.ok,
          detail: status.tools.ytDlp.ok
            ? status.tools.ytDlp.version
            : "Not installed — use Downloader Tools below",
        },
        {
          label: "FFmpeg",
          ok: status.tools.ffmpeg.ok,
          detail: status.tools.ffmpeg.ok
            ? status.tools.ffmpeg.version
            : "Not installed — use Downloader Tools below",
        },
        {
          label: "Download folder",
          ok: status.configuration.downloadPath.ok,
          detail: status.configuration.downloadPath.ok
            ? status.configuration.downloadPath.path
            : "Choose an available, writable folder",
        },
        {
          label: "Download queue",
          ok: status.downloads.errors === 0,
          detail: `${status.downloads.active} active, ${status.downloads.completed} completed, ${status.downloads.errors} failed`,
        },
        {
          label: "Adaptive performance",
          ok: true,
          detail: performanceStatus
            ? `${performanceStatus.tier} · CPU ${performanceStatus.cpuPercent}% · ${performanceStatus.freeMemoryMb} MB free`
            : "Collecting a local performance sample",
        },
        {
          label: "Battery awareness",
          ok: true,
          detail: batteryStatus?.available
            ? `${Math.round(Number(batteryStatus.level || 0) * 100)}% · ${batteryStatus.charging ? "charging" : "on battery"}`
            : "No battery detected",
        },
      ]
    : [];

  return (
    <div style={{ marginBottom: 40 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <div>
          <div className="settings-section-title">System Check</div>
          <div style={{ fontSize: 13, color: "var(--text3)", lineHeight: 1.6 }}>
            Checks Orion's local backend readiness for playback, downloads, and metadata.
          </div>
        </div>
        <button className="btn btn-ghost" onClick={refresh} disabled={loading}>
          {loading ? "Checking..." : "Refresh"}
        </button>
        <button className="btn btn-ghost" onClick={() => {
          const report = {
            checkedAt: status?.checkedAt,
            runtime: status?.runtime ? {
              platform: status.runtime.platform,
              arch: status.runtime.arch,
              electron: status.runtime.electron,
              memoryMb: status.runtime.memoryMb,
              cpuCount: status.runtime.cpuCount,
            } : null,
            performance: performanceStatus,
            battery: batteryStatus,
            downloads: status?.downloads,
            media: status?.media,
          };
          navigator.clipboard?.writeText(JSON.stringify(report, null, 2));
        }} disabled={!status?.ok}>
          Copy diagnostics
        </button>
      </div>

      {status?.error && (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 8,
            border: "1px solid rgba(255,71,87,0.35)",
            background: "rgba(255,71,87,0.08)",
            color: "#ff6b7a",
            fontSize: 13,
          }}
        >
          {status.error}
        </div>
      )}

      {status?.ok && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 10,
            }}
          >
            {checks.map((check) => (
              <div
                key={check.label}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "13px 14px",
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 6,
                    color: "var(--text)",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: "50%",
                      background: check.ok ? "#48c774" : "#ffb845",
                      boxShadow: check.ok
                        ? "0 0 8px rgba(72,199,116,0.55)"
                        : "0 0 8px rgba(255,184,69,0.45)",
                      flexShrink: 0,
                    }}
                  />
                  {check.label}
                </div>
                <div
                  style={{
                    color: "var(--text3)",
                    fontSize: 12,
                    lineHeight: 1.5,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={check.detail}
                >
                  {check.detail}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 12,
              color: "var(--text3)",
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            Orion {status.app.version} on {status.runtime.platform}/
            {status.runtime.arch}. Cache: {formatBytes(status.media.cacheBytes)}.
            Last checked {new Date(status.checkedAt).toLocaleTimeString()}.
          </div>
        </>
      )}
    </div>
  );
}

export function DownloaderToolsSection() {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [installError, setInstallError] = useState("");
  const [quality, setQuality] = useState(
    () => storage.get(STORAGE_KEYS.DOWNLOAD_QUALITY) || "best",
  );
  const [concurrency, setConcurrency] = useState(
    () => storage.get(STORAGE_KEYS.DOWNLOAD_CONCURRENCY) || 2,
  );
  const [fragmentConcurrency, setFragmentConcurrency] = useState(
    () => storage.get(STORAGE_KEYS.DOWNLOAD_FRAGMENT_CONCURRENCY) || 6,
  );

  const refresh = useCallback(async () => {
    if (!window.electron?.getDownloaderStatus) return;
    setStatus(await window.electron.getDownloaderStatus());
  }, []);

  useEffect(() => {
    refresh();
    if (!window.electron?.onDownloaderToolsProgress) return undefined;
    const handler = window.electron.onDownloaderToolsProgress(setProgress);
    return () => window.electron.offDownloaderToolsProgress(handler);
  }, [refresh]);

  const install = async () => {
    setBusy(true);
    setInstallError("");
    setProgress({ step: "Preparing", progress: 0 });
    try {
      if (!window.electron?.installDownloaderTools) {
        throw new Error("Orion's desktop bridge is unavailable. Restart Orion and try again.");
      }
      const result = await window.electron.installDownloaderTools();
      if (!result?.ok) {
        setInstallError(result?.error || "Downloader tools could not be installed.");
      } else if (result.status) {
        setStatus(result.status);
      }
    } catch (error) {
      setInstallError(error?.message || "Downloader tools could not be installed.");
    } finally {
      setBusy(false);
      await refresh();
    }
  };

  const saveQuality = (value) => {
    setQuality(value);
    storage.set(STORAGE_KEYS.DOWNLOAD_QUALITY, value);
  };

  return (
    <div style={{ marginBottom: 40 }}>
      <div className="settings-section-title">Managed Downloader</div>
      <div style={{ fontSize: 13, color: "var(--text3)", marginBottom: 16, lineHeight: 1.6 }}>
        Orion manages yt-dlp and ffmpeg privately. No helper folder or Python installation is required.
      </div>
      <div className="settings-card" style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <strong style={{ color: status?.exists ? "#63cab7" : "#ffb450" }}>{status?.exists ? "Ready" : status ? "Tools required" : "Checking…"}</strong>
            <div style={{ color: "var(--text3)", fontSize: 12, marginTop: 5 }}>
              {status?.exists ? `yt-dlp ${status.ytDlp?.version || "available"} · ffmpeg available` : "Install or repair Orion's downloader tools."}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => window.electron?.openDownloaderToolsFolder?.()}>Open tools folder</button>
            <button className="btn btn-primary" disabled={busy} onClick={install}>{busy ? "Installing…" : status?.exists ? "Repair tools" : "Install tools"}</button>
          </div>
        </div>
        {progress && busy && (
          <div style={{ marginTop: 14 }} role="status">
            <div style={{ color: "var(--text3)", fontSize: 12, marginBottom: 6 }}>
              {progress.step || "Installing downloader tools…"}
            </div>
            <progress style={{ width: "100%" }} max="100" value={progress.progress || 0} />
          </div>
        )}
        {installError && (
          <div className="download-error" role="alert" style={{ marginTop: 14 }}>
            {installError}
          </div>
        )}
      </div>
      <div style={{ marginTop: 18, maxWidth: 320 }}>
        <label className="settings-label">Default download quality</label>
        <select className="settings-select" value={quality} onChange={(event) => saveQuality(event.target.value)}>
          <option value="best">Best available</option>
          <option value="1080">Up to 1080p</option>
          <option value="720">Up to 720p</option>
          <option value="480">Up to 480p</option>
        </select>
      </div>
      <div style={{ marginTop: 18, maxWidth: 320 }}>
        <label className="settings-label">Simultaneous downloads</label>
        <select className="settings-select" value={concurrency} onChange={(event) => {
          const value = Number(event.target.value);
          setConcurrency(value);
          storage.set(STORAGE_KEYS.DOWNLOAD_CONCURRENCY, value);
        }}>
          <option value="1">1 download</option>
          <option value="2">2 downloads (recommended)</option>
          <option value="3">3 downloads</option>
        </select>
      </div>
      <div style={{ marginTop: 18, maxWidth: 320 }}>
        <label className="settings-label">HLS download speed</label>
        <select className="settings-select" value={fragmentConcurrency} onChange={(event) => {
          const value = Number(event.target.value);
          setFragmentConcurrency(value);
          storage.set(STORAGE_KEYS.DOWNLOAD_FRAGMENT_CONCURRENCY, value);
        }}>
          <option value="2">Conservative · 2 fragments</option>
          <option value="6">Balanced · 6 fragments (recommended)</option>
          <option value="10">Aggressive · 10 fragments</option>
        </select>
        <div style={{ color: "var(--text3)", fontSize: 11, marginTop: 7, lineHeight: 1.5 }}>
          Aggressive can be faster, but some providers may throttle or reject too many parallel requests.
        </div>
      </div>
    </div>
  );
}
