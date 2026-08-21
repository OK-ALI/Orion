export default function WorkspaceRestoreConfirm({ open, onCancel, onConfirm }) {
  if (!open) return null;

  return (
    <div className="close-confirm-overlay" style={{ zIndex: 999999 }}>
      <div className="close-confirm-modal" style={{ background: "rgba(20, 20, 20, 0.85)", backdropFilter: "blur(20px)", border: "1px solid var(--border)" }}>
        <div className="close-confirm-icon-wrap">
          <div className="close-confirm-icon-ring" style={{ background: "rgba(0, 168, 255, 0.12)", border: "1.5px solid rgba(0, 168, 255, 0.5)" }}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#00a8ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
          </div>
        </div>
        <div className="close-confirm-title" style={{ color: "var(--text)" }}>Restore Workspace?</div>
        <div className="close-confirm-body" style={{ color: "var(--text3)", maxWidth: 320, textAlign: "center", lineHeight: 1.5, fontSize: 13, marginBottom: 20 }}>
          This restores the separate Desktop workspace backup from Google Drive, overwriting the local watchlist, history, playlists, and settings in that backup scope.
          <br /><br />
          <strong>Orion will reload to apply the restored sync workspace.</strong>
        </div>
        <div className="close-confirm-actions" style={{ display: "flex", gap: 10, width: "100%" }}>
          <button
            className="btn btn-secondary"
            onClick={onCancel}
            style={{ flex: 1, padding: "10px 16px", borderRadius: 8, background: "var(--surface3)", border: "1px solid var(--border)", color: "var(--text)" }}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={onConfirm}
            style={{ flex: 1, padding: "10px 16px", borderRadius: 8, background: "var(--accent)", color: "#fff", border: "none" }}
          >
            Restore Now
          </button>
        </div>
      </div>
    </div>
  );
}
