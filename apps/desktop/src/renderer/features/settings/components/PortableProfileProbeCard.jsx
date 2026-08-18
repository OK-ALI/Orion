import { useState } from "react";
import { probePortableProfile } from "../../../services/portableProfileProbe";

const FAILURE_STATES = new Set(["error", "invalid", "identity-mismatch", "identity-unavailable", "unavailable"]);

export default function PortableProfileProbeCard({ googleProfile }) {
  const [result, setResult] = useState({ state: "idle", message: "Not checked yet." });

  const runProbe = async () => {
    setResult({ state: "checking", message: "Checking the cross-device profile without changing cloud data..." });
    setResult(await probePortableProfile(googleProfile));
  };

  const failed = FAILURE_STATES.has(result.state);
  const matched = result.state === "matched";

  return (
    <div
      style={{
        background: "var(--surface2)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "16px 20px",
        marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
            Cross-device profile check
          </div>
          <div style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.5 }}>
            Read-only Phase 8 check for the PortableProfileV3 file used by Orion Mobile. Your existing Desktop Google backup remains separate and untouched.
          </div>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={result.state === "checking"}
          onClick={runProbe}
          style={{ flexShrink: 0, fontSize: 12, padding: "7px 12px" }}
        >
          {result.state === "checking" ? "Checking..." : "Check profile"}
        </button>
      </div>

      <div
        role="status"
        aria-live="polite"
        style={{
          marginTop: 12,
          fontSize: 12,
          lineHeight: 1.5,
          color: failed ? "var(--red)" : matched ? "var(--accent)" : "var(--text3)",
        }}
      >
        {result.message}
      </div>

      {matched && (
        <div style={{ marginTop: 6, fontSize: 11, color: "var(--text3)" }}>
          Profile revision {result.profileRevision} · {result.namespaceNames.length} portable namespace{result.namespaceNames.length === 1 ? "" : "s"} visible · Drive revision token available: {result.revisionTag ? "yes" : "no"}
        </div>
      )}

      <div style={{ marginTop: 8, fontSize: 11, color: "var(--text3)" }}>
        This check never creates, writes, migrates, or deletes Google Drive data.
      </div>
    </div>
  );
}
