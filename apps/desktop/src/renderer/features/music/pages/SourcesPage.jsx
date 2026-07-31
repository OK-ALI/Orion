import { useEffect, useMemo, useState } from "react";
import { buildSignalSources } from "../services/signalSources";

export default function SourcesPage({ onNavigate }) {
  const [providers, setProviders] = useState([]);
  const [notice, setNotice] = useState("");
  const load = () => Promise.resolve(window.electron?.musicListProviders?.() || [])
    .then(setProviders).catch(() => setNotice("Signal source health could not be read."));
  useEffect(() => { load(); }, []);

  const sources = useMemo(() => buildSignalSources(providers), [providers]);
  const ready = sources.filter((source) => source.setupState === "ready").length;

  return (
    <div className="music-page music-sources-page music-signal-page">
      <header className="music-page-header compact music-sources-heading">
        <div>
          <span className="music-eyebrow">Signal Sources</span>
          <h1>Music sources</h1>
          <p>Only Echo-aligned sources appear here: YouTube Music, YouTube Audio, LRCLib, Spotify import and Local Library.</p>
        </div>
        <div className="music-source-summary"><strong>{ready}/{sources.length}</strong><span>signals ready</span></div>
      </header>

      {notice && <div className="music-plugin-notice" role="status">{notice}</div>}
      <div className="music-signal-grid">
        {sources.map((source) => <SignalSourceCard key={source.id} source={source} onNavigate={onNavigate} />)}
      </div>
      <div className="music-security-note">
        <strong>No raw streams leave the main process.</strong>
        <span>Playback resolves through protected Orion grants. Spotify is metadata/import only and never appears as a playable source.</span>
      </div>
    </div>
  );
}

function SignalSourceCard({ source, onNavigate }) {
  const health = source.health?.status || source.setupState;
  const disabled = source.setupState !== "ready";
  return (
    <article className={`music-signal-card role-${source.role} status-${health}`}>
      <header>
        <span className="music-signal-orb" aria-hidden="true"><i /></span>
        <div>
          <small>{source.roleLabel}</small>
          <h2>{source.label}</h2>
        </div>
        <b>{source.setupState}</b>
      </header>
      <p>{source.description}</p>
      <div className="music-signal-meta">
        <span>{source.providerCount ? `${source.providerCount} provider${source.providerCount === 1 ? "" : "s"}` : "No active adapter"}</span>
        <span>{String(health).replaceAll("_", " ")}</span>
      </div>
      {source.lastError && <em title={source.lastError}>{source.lastError}</em>}
      <footer>
        {source.id === "local-library" && <button onClick={() => onNavigate?.("music-library")}>Open Library</button>}
        {source.id === "spotify-import" && <button disabled>Import adapter pending</button>}
        {source.id !== "local-library" && source.id !== "spotify-import" && <button disabled={disabled}>{disabled ? "Pending" : "Ready"}</button>}
      </footer>
    </article>
  );
}
