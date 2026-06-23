import React from "react";
import { DownloadIcon } from "../components/common/Icons";

export default function DownloadsPage() {
  return (
    <div
      className="fade-in"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "70vh",
        padding: "40px 20px",
        fontFamily: "var(--font-body)",
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg, rgba(20, 20, 28, 0.45) 0%, rgba(10, 10, 15, 0.65) 100%)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255, 255, 255, 0.05)",
          borderRadius: 24,
          padding: "50px 40px",
          maxWidth: 600,
          width: "100%",
          textAlign: "center",
          boxShadow: "0 30px 80px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
        }}
      >
        {/* Glow Icon container */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: "linear-gradient(135deg, var(--red) 0%, #ff4d4d 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            boxShadow: "0 0 30px rgba(229, 9, 20, 0.35)",
            marginBottom: 8,
          }}
        >
          <DownloadIcon size={36} />
        </div>

        {/* Title */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: 3,
              color: "#fff",
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            Orion Downloader
          </h2>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#63cab7",
              letterSpacing: 1.5,
              textTransform: "uppercase",
              background: "rgba(99, 202, 183, 0.12)",
              border: "1px solid rgba(99, 202, 183, 0.25)",
              padding: "3px 12px",
              borderRadius: 20,
              alignSelf: "center",
            }}
          >
            Coming Soon
          </span>
        </div>

        {/* Body */}
        <p
          style={{
            fontSize: 14,
            color: "var(--text2)",
            lineHeight: 1.7,
            margin: 0,
            maxWidth: 440,
          }}
        >
          We are currently designing a zero-configuration, premium HLS downloading engine.
          No external command-line tools, local binaries, or directory configurations required.
          Simply install the application wherever you want and download in one click.
          Coming in a future release.
        </p>

        {/* Divider */}
        <div
          style={{
            width: "100%",
            height: 1,
            background: "linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.05) 50%, transparent 100%)",
            margin: "8px 0",
          }}
        />

        <div style={{ fontSize: 12, color: "var(--text3)" }}>
          Orion Zero-Setup Architecture Initiative · © 2026
        </div>
      </div>
    </div>
  );
}
