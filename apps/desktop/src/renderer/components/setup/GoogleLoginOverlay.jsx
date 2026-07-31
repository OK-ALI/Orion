import { useState, useEffect } from "react";

export default function GoogleLoginOverlay({ onLoginSuccess, onSkip }) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [configSource, setConfigSource] = useState("missing");
  const [hasSecret, setHasSecret] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [error, setError] = useState(null);

  const fetchConfig = () => {
    if (!window.electron?.getClientConfig) return;
    window.electron.getClientConfig().then((cfg) => {
      if (cfg) {
        setClientId(cfg.clientId || "");
        setHasSecret(cfg.hasClientSecret);
        setConfigSource(cfg.source || "missing");
      }
    });
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    if (!window.electron?.setClientConfig) return;
    setSaveStatus("Saving...");
    setError(null);
    const res = await window.electron.setClientConfig({
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
    });
    if (res?.ok) {
      setSaveStatus("✓ Credentials Saved");
      setClientSecret("");
      fetchConfig();
      setTimeout(() => setSaveStatus(null), 2500);
    } else {
      setSaveStatus(null);
      setError(res?.error || "Failed to save configuration.");
    }
  };

  const handleLogin = async () => {
    if (!window.electron?.login) return;
    setIsLoggingIn(true);
    setError(null);
    try {
      const res = await window.electron.login();
      if (res?.ok && res.profile) {
        onLoginSuccess(res.profile);
      } else {
        setError(res?.error || "Authentication failed.");
      }
    } catch (err) {
      setError(err.message || "An unexpected error occurred during login.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleCancel = async () => {
    if (!window.electron?.cancelLogin) return;
    try {
      await window.electron.cancelLogin();
    } catch {}
    setIsLoggingIn(false);
  };

  const isConfigured = configSource !== "missing";

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "radial-gradient(circle at center, var(--bg-elevated) 0%, var(--bg-base) 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        overflow: "hidden",
      }}
    >
      {/* Background ambient glowing orbs */}
      <div
        style={{
          position: "absolute",
          top: "-10%",
          left: "-10%",
          width: "60vw",
          height: "60vw",
          background: "radial-gradient(circle, var(--accent-soft) 0%, transparent 70%)",
          filter: "blur(90px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-10%",
          right: "-10%",
          width: "60vw",
          height: "60vw",
          background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 8%, transparent) 0%, transparent 70%)",
          filter: "blur(90px)",
          pointerEvents: "none",
        }}
      />

      {/* Main glass card container */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 460,
          background: "var(--glass-bg)",
          backdropFilter: "blur(var(--glass-blur))",
          WebkitBackdropFilter: "blur(var(--glass-blur))",
          border: "1px solid var(--glass-border)",
          borderRadius: 24,
          padding: "48px 40px",
          boxShadow: "0 24px 60px var(--shadow-color), inset 0 1px 1px var(--glass-border)",
          textAlign: "center",
          zIndex: 10,
        }}
      >
        {/* Logo Section */}
        <div className="setup-logo" style={{ justifyContent: "center", marginBottom: 32 }}>
          <img src="./brand-mark.png" alt="" className="setup-logo-image" style={{ width: 44, height: 44 }} />
          <div style={{ textAlign: "left" }}>
            <span className="setup-logo-text" style={{ fontSize: 24, letterSpacing: 0.5 }}>Orion X</span>
            <span className="setup-subtitle" style={{ fontSize: 11 }}>A universe made to be felt.</span>
          </div>
        </div>

        {/* Heading */}
        <h2
          style={{
            fontFamily: "var(--font-display), sans-serif",
            fontSize: 24,
            fontWeight: 700,
            color: "var(--text)",
            margin: "0 0 12px 0",
          }}
        >
          Sign in to Orion
        </h2>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.6,
            color: "var(--text3)",
            margin: "0 0 32px 0",
          }}
        >
          Sign in to automatically sync your watchlist, settings, and playlists across your devices.
        </p>

        {/* Auth Actions */}
        {isConfigured ? (
          <div style={{ marginBottom: 16 }}>
            <button
              className="btn btn-primary"
              disabled={isLoggingIn}
              onClick={handleLogin}
              style={{
                width: "100%",
                padding: "12px 24px",
                fontSize: 14,
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                borderRadius: 12,
                background: "var(--accent)",
                color: "#ffffff",
                boxShadow: "0 4px 16px var(--accent-glow)",
              }}
            >
              {isLoggingIn ? (
                "Connecting to Google..."
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21.35,11.1H12v2.7h5.3c-0.2,1.3-1,2.4-2.2,3.2v2.7h3.6c2.1-1.9,3.3-4.7,3.3-8C22,11.9,21.8,11.4,21.35,11.1z" fill="#4285F4"/>
                    <path d="M12,20.7c2.4,0,4.5-0.8,6-2.2l-3.6-2.7c-1,0.7-2.3,1.1-3.6,1.1c-2.8,0-5.1-1.9-6-4.4H1.1v2.8C2.6,18.3,7,20.7,12,20.7z" fill="#34A853"/>
                    <path d="M6,12.5c-0.2-0.7-0.3-1.4-0.3-2.1s0.1-1.4,0.3-2.1V5.5H1.1C0.4,6.9,0,8.4,0,10s0.4,3.1,1.1,4.5L6,12.5z" fill="#FBBC05"/>
                    <path d="M12,5.3c1.3,0,2.5,0.5,3.4,1.3l2.6-2.6C16.5,2.7,14.4,2,12,2C7,2,2.6,4.4,1.1,7.2L6,10C6.9,7.5,9.2,5.3,12,5.3z" fill="#EA4335"/>
                  </svg>
                  Sign in with Google
                </>
              )}
            </button>
            <div style={{ marginTop: 12, fontSize: 11, color: "var(--text3)" }}>
              Configured via {configSource === "env" ? "environment" : "saved keys"}.
            </div>
          </div>
        ) : (
          <div
            style={{
              background: "var(--danger-soft)",
              border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)",
              borderRadius: 12,
              padding: "16px 20px",
              color: "var(--text3)",
              fontSize: 13,
              lineHeight: 1.5,
              marginBottom: 16,
              textAlign: "left",
            }}
          >
            <strong>OAuth Configuration Required:</strong> To sign in, please expand the panel below and enter your Google OAuth credentials first.
          </div>
        )}

        {/* Cancel/Skip Options */}
        <div style={{ marginBottom: 24 }}>
          {isLoggingIn ? (
            <button
              className="btn btn-ghost"
              onClick={handleCancel}
              style={{
                width: "100%",
                padding: "10px 24px",
                fontSize: 13,
                color: "var(--danger)",
                borderRadius: 12,
              }}
            >
              Cancel Connection
            </button>
          ) : (
            <button
              className="btn btn-ghost"
              onClick={onSkip}
              style={{
                width: "100%",
                padding: "10px 24px",
                fontSize: 13,
                color: "var(--text3)",
                borderRadius: 12,
              }}
            >
              Skip / Use Offline
            </button>
          )}
        </div>

        {/* Configuration toggle / drawer */}
        {configSource !== "env" && (
          <div style={{ textAlign: "left", marginTop: 8 }}>
            <button
              className="btn btn-ghost"
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: 12,
                color: "var(--text2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "var(--bg-hover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
              }}
              onClick={() => setShowConfig(!showConfig)}
            >
              <span>⚙️ Developer OAuth Credentials</span>
              <span>{showConfig ? "▲" : "▼"}</span>
            </button>

            {showConfig && (
              <form
                onSubmit={handleSaveConfig}
                style={{
                  background: "var(--bg-input)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: "18px 20px",
                  marginTop: 12,
                  animation: "fadeIn 0.25s ease-out",
                }}
              >
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, color: "var(--text3)", display: "block", marginBottom: 5, fontWeight: 600 }}>
                    CLIENT ID
                  </label>
                  <input
                    type="text"
                    className="apikey-input"
                    placeholder="xxxx.apps.googleusercontent.com"
                    style={{ width: "100%", fontSize: 12, padding: "8px 12px", marginBottom: 0 }}
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 11, color: "var(--text3)", display: "block", marginBottom: 5, fontWeight: 600 }}>
                    CLIENT SECRET
                  </label>
                  <input
                    type="password"
                    className="apikey-input"
                    placeholder={hasSecret ? "••••••••••••••••••••••••" : "Paste your Google Client Secret"}
                    style={{ width: "100%", fontSize: 12, padding: "8px 12px", marginBottom: 0 }}
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button type="submit" className="btn btn-primary" style={{ padding: "8px 16px", fontSize: 12 }}>
                    Save Config
                  </button>
                  {saveStatus && (
                    <span style={{ fontSize: 11, color: "#48c774", fontWeight: 500 }}>{saveStatus}</span>
                  )}
                </div>
              </form>
            )}
          </div>
        )}

        {/* Error panel */}
        {error && (
          <div
            style={{
              fontSize: 12,
              color: "var(--danger)",
              marginTop: 20,
              background: "var(--danger-soft)",
              border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)",
              borderRadius: 10,
              padding: "12px 16px",
              textAlign: "left",
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
