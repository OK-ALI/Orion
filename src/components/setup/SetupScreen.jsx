// ── Orion — Setup Screen ──────────────────────────────────────────────────────
// Shown on first launch to collect the user's TMDB API key.

import { useState, useCallback } from "react";
import { OrionLogo, KeyIcon } from "../common/Icons";

export default function SetupScreen({ onComplete, onSave, onSkip }) {
  const [apiKey, setApiKey] = useState("");
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      const key = apiKey.trim();
      if (!key) {
        setError("Please enter your TMDB API Read Access Token.");
        return;
      }
      if (key.length < 30) {
        setError(
          'This looks too short. Make sure you\'re using the "API Read Access Token" (the long one), not the shorter API key.'
        );
        return;
      }

      setValidating(true);
      setError(null);

      try {
        // Validate the key by fetching a known endpoint
        const res = await fetch(
          "https://api.themoviedb.org/3/trending/movie/week?language=en-US",
          {
            headers: { Authorization: `Bearer ${key}` },
          }
        );

        if (res.status === 401) {
          setError(
            "Invalid API key. Please check your TMDB API Read Access Token."
          );
          return;
        }

        if (!res.ok) {
          setError(`TMDB returned HTTP ${res.status}. Please try again.`);
          return;
        }

        const data = await res.json();
        if (!data.results || data.results.length === 0) {
          setError("Unexpected response from TMDB. Please try again.");
          return;
        }

        // Valid! Save and proceed
        (onComplete || onSave)?.(key);
      } catch (err) {
        setError(
          err.message.includes("fetch")
            ? "Network error. Check your internet connection."
            : err.message
        );
      } finally {
        setValidating(false);
      }
    },
    [apiKey, onComplete, onSave]
  );

  return (
    <div className="setup-screen">
      <form className="setup-card" onSubmit={handleSubmit}>
        <div className="setup-logo">
          <OrionLogo size={36} className="setup-logo-icon" />
          <div>
            <span className="setup-logo-text">Orion</span>
            <span className="setup-subtitle">A Multiverse of Stories</span>
          </div>
        </div>

        <h2 className="setup-heading">Welcome to Orion</h2>
        <p className="setup-desc">
          To get started, enter your <strong>TMDB API Read Access Token</strong>. 
          This is used to fetch movie/TV metadata, posters, and search results. 
          It's completely free — no credit card needed.
        </p>

        <div className="setup-input-wrap">
          <input
            className="setup-input"
            type="password"
            placeholder="eyJhbGciOiJIUz..."
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setError(null);
            }}
            autoFocus
            spellCheck={false}
            autoComplete="off"
          />
          <button
            className="btn btn-primary"
            type="submit"
            disabled={validating || !apiKey.trim()}
            style={{ padding: "8px 20px" }}
          >
            {validating ? (
              <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
            ) : (
              <>
                <KeyIcon size={14} /> Validate
              </>
            )}
          </button>
        </div>

        {error && <div className="setup-error">⚠ {error}</div>}

        <p className="setup-link">
          Don't have a key?{" "}
          <a
            onClick={() =>
              window.electron
                ? require("electron")?.shell?.openExternal(
                    "https://www.themoviedb.org/settings/api"
                  )
                : window.open("https://www.themoviedb.org/settings/api", "_blank")
            }
          >
            Get one free at themoviedb.org →
          </a>
          {onSkip && (
            <>
              {" · "}
              <a onClick={onSkip}>Skip for now</a>
            </>
          )}
        </p>
      </form>
    </div>
  );
}
