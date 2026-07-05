import { useEffect, useMemo, useState } from "react";

const SELECTABLE = ["metadata", "streaming", "discovery", "lyrics"];

export default function SourcesPage() {
  const [providers, setProviders] = useState([]);
  const [configuring, setConfiguring] = useState(null);
  const [connection, setConnection] = useState({ url: "", username: "", password: "" });
  const [notice, setNotice] = useState("");
  const load = () => Promise.resolve(window.electron?.musicListProviders?.() || []).then(setProviders).catch(() => {});
  useEffect(() => { load(); }, []);
  const groups = useMemo(() => Object.groupBy ? Object.groupBy(providers, (item) => item.kind)
    : providers.reduce((out, item) => ({ ...out, [item.kind]: [...(out[item.kind] || []), item] }), {}), [providers]);
  const healthy = providers.filter((provider) => ["healthy", "unknown"].includes(provider.health?.status || "unknown")).length;
  return <div className="music-page music-sources-page"><header className="music-page-header compact music-sources-heading"><div><span className="music-eyebrow">Signal routing</span><h1>Music Sources</h1><p>Choose which installed provider supplies metadata, playback, discovery and lyrics.</p></div><div className="music-source-summary"><strong>{healthy}/{providers.length}</strong><span>sources available</span></div></header>
    {notice && <div className="music-plugin-notice" role="status">{notice}</div>}
    <div className="music-source-grid">{Object.entries(groups).map(([kind, items]) => <section key={kind}><header><div><span>{SELECTABLE.includes(kind) ? "Selectable" : "Contributing"}</span><h2>{kind}</h2></div><b>{items.length}</b></header>
      {items.map((provider) => <div key={provider.id} className={`music-source-option${provider.active ? " active" : ""}`}><div><strong>{provider.name}<span className={`music-health music-health-${provider.health?.status || "unknown"}`}>{String(provider.health?.status || "unknown").replaceAll("_", " ")}</span></strong><small>{provider.capabilities.join(" · ")}</small>{provider.requiresConfiguration && !provider.configured && <em>Configuration required</em>}{provider.health?.lastError && <small title={provider.health.lastError}>{provider.health.lastError}</small>}</div>
        <div>{provider.requiresConfiguration && !provider.configured && <button onClick={() => { setConfiguring(provider); setNotice(""); }}>Connect</button>}{SELECTABLE.includes(kind) && <input aria-label={`Use ${provider.name} for ${kind}`} type="radio" name={`provider-${kind}`} checked={provider.active} disabled={provider.requiresConfiguration && !provider.configured} onChange={async () => { const result = await window.electron.musicSetActiveProvider(kind, provider.id); setNotice(result?.ok === false ? result.error : `${provider.name} now supplies ${kind}.`); load(); }} />}</div></div>)}</section>)}</div>
    {configuring && <ConnectionDialog provider={configuring} connection={connection} setConnection={setConnection} close={() => setConfiguring(null)} complete={async (value) => { const result = await window.electron.musicConfigureProvider(configuring.id, value); if (result?.ok) { setConfiguring(null); setConnection({ url: "", username: "", password: "" }); setNotice(`${configuring.name} connected.`); load(); } return result; }} />}
  </div>;
}

function ConnectionDialog({ provider, connection, setConnection, close, complete }) {
  const [error, setError] = useState("");
  return <div className="music-source-dialog" role="dialog" aria-modal="true" aria-label={`Connect ${provider.name}`}><form onSubmit={async (event) => { event.preventDefault(); setError(""); const result = await complete(connection); if (!result?.ok) setError(result?.error || "Connection could not be saved."); }}>
    <h2>Connect {provider.name}</h2><p>Credentials are encrypted by the operating system and remain in Orion's main process.</p>
    <label>Server URL<input type="url" required placeholder="https://music.example.com" value={connection.url} onChange={(event) => setConnection({ ...connection, url: event.target.value })} /></label>
    <label>Username<input required value={connection.username} onChange={(event) => setConnection({ ...connection, username: event.target.value })} /></label>
    <label>Password<input type="password" required value={connection.password} onChange={(event) => setConnection({ ...connection, password: event.target.value })} /></label>
    {error && <em>{error}</em>}<footer><button type="button" onClick={close}>Cancel</button><button className="primary" type="submit">Save connection</button></footer>
  </form></div>;
}
