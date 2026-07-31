import { useState, useEffect, useRef } from "react";
import { renderChangelog } from "../features/updates/changelog";

// ── Inline markdown + GitHub formatter ──────────────────────────────
// Handles: ~~strike~~, **bold**, *italic*, _italic_, `code`,
//          ![img](url), [link](url), bare https:// URLs, @mentions


// ── Block-level markdown renderer ────────────────────────────────────────────
// Handles: # headings, --- hr, > blockquote, 1. numbered list,
//          - /* bullets, ![img](url), blank lines, paragraphs


// ── Main component ────────────────────────────────────────────────────────────
export default function UpdateModal({
  updateInfo,
  activeDownloads = 0,
  onClose,
}) {
  const { latest, current, url, changelog, assets } = updateInfo;

  const [phase, setPhase] = useState("idle"); // idle | downloading | installing | done | error
  const [format, setFormat] = useState(null); // "appimage" | "deb" | "exe" | "dmg" | null
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const cancelRef = useRef(false);

  // Detect install format on mount
  useEffect(() => {
    if (!window.electron?.detectUpdateFormat) return;
    let mounted = true;
    window.electron.detectUpdateFormat().then((fmt) => {
      if (mounted) setFormat(fmt);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Listen for download progress from main process
  useEffect(() => {
    if (!window.electron?.onUpdateProgress) return;
    const handler = window.electron.onUpdateProgress((data) => {
      setProgress(data.percent ?? 0);
      setProgressLabel(data.label ?? "");
    });
    return () => window.electron.offUpdateProgress(handler);
  }, []);

  const assetUrl = format && assets?.[format];
  const canInstall =
    format && assetUrl && activeDownloads === 0 && phase === "idle";

  const handleInstall = async () => {
    if (!canInstall) return;
    cancelRef.current = false;
    setPhase("downloading");
    setProgress(0);
    setProgressLabel("Preparing…");

    try {
      const result = await window.electron.downloadAndInstallUpdate({
        url: assetUrl,
        format,
      });
      if (cancelRef.current) return;
      if (!result.ok) throw new Error(result.error || "Update failed");
      setPhase("installing");
      setProgressLabel("Launching installer…");
    } catch (e) {
      if (cancelRef.current) return;
      setPhase("error");
      setErrorMsg(e.message || "Update failed");
    }
  };

  const handleCancel = () => {
    if (phase === "downloading") {
      cancelRef.current = true;
      window.electron?.cancelUpdate?.();
    }
    onClose();
  };

  const formatLabel = {
    appimage: "AppImage",
    deb: ".deb package",
    pacman: ".pacman (Arch)",
    exe: "Windows installer",
    dmg: "macOS installer (Universal)",
  }[format] || "installer";

  const busy = phase === "downloading" || phase === "installing";

  return (
    <div
      onClick={busy ? undefined : handleCancel}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 6000,
        background: "rgba(0,0,0,0.78)",
        backdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        cursor: busy ? "default" : "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          width: "100%",
          maxWidth: 560,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 32px 80px rgba(0,0,0,0.7)",
          overflow: "hidden",
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            padding: "24px 28px 16px",
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 4,
                }}
              >
                <span style={{ fontSize: 20 }}>🎉</span>
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 22,
                    letterSpacing: 1,
                  }}
                >
                  UPDATE AVAILABLE
                </span>
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--text3)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                {current && (
                  <>
                    <span style={{ color: "var(--text3)" }}>v{current}</span>
                    <span style={{ color: "var(--text3)", fontSize: 11 }}>→</span>
                  </>
                )}
                <a
                  href={url}
                  onClick={(e) => {
                    e.preventDefault();
                    window.electron?.openExternal(url);
                  }}
                  style={{
                    color: "var(--red)",
                    fontWeight: 600,
                    textDecoration: "none",
                    cursor: "pointer",
                  }}
                  title="View on GitHub"
                >
                  v{latest} ↗
                </a>
                is ready to install
                {format && (
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--text3)",
                      background: "var(--surface2)",
                      border: "1px solid var(--border)",
                      borderRadius: 4,
                      padding: "1px 7px",
                    }}
                  >
                    {formatLabel}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={handleCancel}
              disabled={busy}
              style={{
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--text3)",
                cursor: busy ? "not-allowed" : "pointer",
                fontSize: 18,
                width: 28,
                height: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                opacity: busy ? 0.35 : 1,
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* ── Changelog ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
          {changelog ? (
            <>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  color: "var(--text3)",
                  textTransform: "uppercase",
                  marginBottom: 12,
                }}
              >
                What's New
              </div>
              <div>{renderChangelog(changelog)}</div>
            </>
          ) : (
            <div
              style={{
                fontSize: 13,
                color: "var(--text3)",
                fontStyle: "italic",
              }}
            >
              No changelog available.
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div
          style={{
            padding: "16px 28px",
            borderTop: "1px solid var(--border)",
            flexShrink: 0,
          }}
        >
          {/* Active downloads warning */}
          {activeDownloads > 0 && phase === "idle" && (
            <div
              style={{
                fontSize: 12,
                color: "var(--red)",
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              ⚠ {activeDownloads} download{activeDownloads > 1 ? "s" : ""}{" "}
              running, finish or cancel them before updating.
            </div>
          )}

          {/* No format detected warning */}
          {!format && phase === "idle" && (
            <div
              style={{ fontSize: 12, color: "var(--text3)", marginBottom: 12 }}
            >
              Could not detect install format. Use the{" "}
              <a
                href={url}
                onClick={(e) => {
                  e.preventDefault();
                  window.electron?.openExternal(url);
                }}
                style={{ color: "var(--red)", cursor: "pointer" }}
              >
                GitHub releases page
              </a>{" "}
              to download manually.
            </div>
          )}

          {/* Progress bar */}
          {(phase === "downloading" || phase === "installing") && (
            <div style={{ marginBottom: 14 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  color: "var(--text3)",
                  marginBottom: 6,
                }}
              >
                <span>
                  {progressLabel ||
                    (phase === "downloading"
                      ? "Downloading update…"
                      : "Installing…")}
                </span>
                {phase === "downloading" && (
                  <span>{Math.round(progress)}%</span>
                )}
              </div>
              <div
                style={{
                  height: 4,
                  background: "var(--surface2)",
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: phase === "installing" ? "100%" : `${progress}%`,
                    background: "var(--red)",
                    borderRadius: 2,
                    transition: "width 0.3s ease",
                    animation:
                      phase === "installing"
                        ? "progress-indeterminate 1.2s ease-in-out infinite"
                        : "none",
                  }}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {phase === "error" && (
            <div
              style={{ fontSize: 13, color: "var(--red)", marginBottom: 12 }}
            >
              ✕ {errorMsg}
              <span style={{ marginLeft: 10 }}>
                <a
                  href={url}
                  onClick={(e) => {
                    e.preventDefault();
                    window.electron?.openExternal(url);
                  }}
                  style={{
                    color: "var(--red)",
                    textDecoration: "underline",
                    cursor: "pointer",
                  }}
                >
                  Download manually ↗
                </a>
              </span>
            </div>
          )}

          {/* Done */}
          {phase === "done" && (
            <div style={{ fontSize: 13, color: "#48c774", marginBottom: 12 }}>
              ✓ Update downloaded, installer is running
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button className="btn btn-ghost" onClick={handleCancel}>
              {phase === "downloading" ? "Cancel" : "Close"}
            </button>
            {phase === "idle" && (
              <>
                <a
                  href={url}
                  onClick={(e) => {
                    e.preventDefault();
                    window.electron?.openExternal(url);
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "9px 18px",
                    background: "var(--surface2)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--text)",
                    textDecoration: "none",
                    cursor: "pointer",
                  }}
                >
                  GitHub ↗
                </a>
                <button
                  className="btn"
                  disabled={!canInstall}
                  onClick={handleInstall}
                  style={{
                    background: canInstall
                      ? "var(--red)"
                      : "rgba(229,9,20,0.3)",
                    color: "#fff",
                    border: "none",
                    fontWeight: 600,
                    opacity: canInstall ? 1 : 0.6,
                    cursor: canInstall ? "pointer" : "not-allowed",
                  }}
                >
                  Install Update
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes progress-indeterminate {
          0%   { transform: translateX(-100%); width: 60%; }
          100% { transform: translateX(200%);  width: 60%; }
        }
      `}</style>
    </div>
  );
}
