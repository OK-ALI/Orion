import React from "react";
import { CloseIcon, DownloadIcon } from "./common/Icons";

export default function DownloadModal({ onClose, mediaName }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        background: "rgba(0, 0, 0, 0.8)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: "fadeIn 0.2s ease-out",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "linear-gradient(135deg, rgba(20, 20, 28, 0.85) 0%, rgba(10, 10, 15, 0.95) 100%)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 20,
          width: 500,
          maxWidth: "90vw",
          padding: "40px 32px",
          textAlign: "center",
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.7), inset 0 1px 1px rgba(255, 255, 255, 0.1)",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
          animation: "scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "50%",
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "var(--text2)",
            transition: "all 0.2s",
            outline: "none",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(229, 9, 20, 0.15)";
            e.currentTarget.style.borderColor = "var(--red)";
            e.currentTarget.style.color = "#fff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
            e.currentTarget.style.color = "var(--text2)";
          }}
        >
          <CloseIcon size={14} />
        </button>

        {/* Pulse download glow */}
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "linear-gradient(135deg, var(--red) 0%, #ff5252 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            boxShadow: "0 0 30px rgba(229, 9, 20, 0.4)",
            marginBottom: 8,
          }}
        >
          <DownloadIcon size={32} />
        </div>

        {/* Title */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: 2,
              color: "#fff",
              textTransform: "uppercase",
            }}
          >
            Orion Downloader
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--red)",
              letterSpacing: 1,
              textTransform: "uppercase",
              background: "rgba(229, 9, 20, 0.12)",
              border: "1px solid rgba(229, 9, 20, 0.25)",
              padding: "2px 10px",
              borderRadius: 20,
              alignSelf: "center",
            }}
          >
            Coming Soon
          </span>
        </div>

        {/* Body Description */}
        <p
          style={{
            fontSize: 14,
            color: "var(--text2)",
            lineHeight: 1.6,
            margin: 0,
            maxWidth: 380,
          }}
        >
          We are currently designing a zero-configuration, premium HLS downloading engine.
          No external command-line tools or directory configurations required.
          Install and download in one click. Coming in a future release.
        </p>

        {mediaName && (
          <div
            style={{
              fontSize: 12,
              color: "var(--text3)",
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.05)",
              borderRadius: 8,
              padding: "8px 16px",
              marginTop: 4,
              maxWidth: "100%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            Queued for: <span style={{ color: "var(--text2)" }}>{mediaName}</span>
          </div>
        )}

        {/* Action Button */}
        <button
          className="btn btn-primary"
          onClick={onClose}
          style={{
            marginTop: 12,
            padding: "10px 32px",
            fontSize: 14,
            fontWeight: 600,
            boxShadow: "0 4px 15px rgba(229, 9, 20, 0.35)",
            width: "100%",
            justifyContent: "center",
          }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}
