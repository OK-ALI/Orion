import { useEffect, useMemo, useState } from "react";

const FILTERS = ["all", "metadata", "streaming", "lyrics", "dashboard", "playlists", "discovery"];

export default function PluginsPage({ onNavigate }) {
  const [plugins, setPlugins] = useState([]);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState("");
  const load = () => Promise.resolve(window.electron?.musicListPlugins?.() || []).then(setPlugins).catch(() => {});
  useEffect(() => { load(); }, []);
  const visible = useMemo(() => plugins.filter((plugin) => (filter === "all" || plugin.categories.includes(filter))
    && `${plugin.name} ${plugin.description} ${plugin.categories.join(" ")}`.toLowerCase().includes(query.toLowerCase())), [filter, plugins, query]);
  const installed = plugins.filter((plugin) => plugin.installed).length;
  const enabled = plugins.filter((plugin) => plugin.enabled).length;
  const perform = async (action, success) => {
    const result = await action();
    setNotice(result?.ok ? success : result?.error || "Plugin operation failed.");
    await load();
    return result;
  };
  return <div className="music-page music-plugins-page"><header className="music-page-header compact music-plugins-heading"><div><span className="music-eyebrow">Capability observatory</span><h1>Music Plugins</h1><p>Add curated catalogs, playback sources, lyrics and discovery capabilities to Music Planet.</p></div><div className="music-plugin-totals"><span><strong>{installed}</strong> Installed</span><span><strong>{enabled}</strong> Active</span><button onClick={() => onNavigate("music-sources")}>Provider routing</button></div></header>
    <div className="music-plugin-toolbar"><label><span>Search plugins</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search capabilities" /></label><div className="music-filter-pills">{FILTERS.map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item === "all" ? "All" : item}</button>)}</div></div>
    {notice && <div className="music-plugin-notice" role="status">{notice}</div>}
    <div className="music-plugin-grid">{visible.map((plugin) => <PluginCard key={plugin.id} plugin={plugin} inspect={() => setSelected(plugin)} perform={perform} />)}</div>
    {!visible.length && <div className="music-empty">No plugins match this view.</div>}
    <div className="music-security-note"><strong>Curated, compiled adapters only.</strong><span>Orion does not execute downloaded JavaScript. Third-party packages remain blocked until signed manifests, utility-process isolation and enforced permissions are complete.</span></div>
    {selected && <PluginDialog plugin={plugins.find((item) => item.id === selected.id) || selected} close={() => setSelected(null)} perform={perform} />}
  </div>;
}

function PluginCard({ plugin, inspect, perform }) {
  return <article className={`${plugin.enabled ? "is-enabled" : ""} status-${plugin.status || "available"}`}>
    <button className="music-plugin-card-main" onClick={inspect}><header><span className="music-plugin-glyph">{plugin.name.slice(0, 1)}</span><div><h2>{plugin.name}</h2><small>v{plugin.version} · {plugin.bundled ? "Orion curated" : plugin.status || "Registry"}</small></div>{plugin.enabled && <b>Active</b>}</header><p>{plugin.description}</p><div className="music-plugin-categories">{plugin.categories.map((category) => <span key={category}>{category}</span>)}</div></button>
    <footer>{!plugin.installed && <button className="primary" disabled={!plugin.available} onClick={inspect}>{plugin.available ? "Review & install" : plugin.status === "experimental" ? "Experimental" : "Coming later"}</button>}
      {plugin.installed && !plugin.locked && <button onClick={() => perform(() => window.electron.musicSetPluginEnabled(plugin.id, !plugin.enabled), `${plugin.name} ${plugin.enabled ? "disabled" : "enabled"}.`)}>{plugin.enabled ? "Disable" : "Enable"}</button>}
      {plugin.locked && <span className="music-plugin-core">Core component</span>}<button onClick={inspect}>Details</button></footer>
  </article>;
}

function PluginDialog({ plugin, close, perform }) {
  const [phase, setPhase] = useState("review");
  const [error, setError] = useState("");
  const install = async () => {
    setPhase("installing"); setError("");
    const result = await perform(() => window.electron.musicInstallPlugin(plugin.id), `${plugin.name} installed and enabled.`);
    if (result?.ok) setPhase("ready"); else { setError(result?.error || "Installation failed."); setPhase("review"); }
  };
  return <div className="music-plugin-dialog" role="dialog" aria-modal="true" aria-label={`${plugin.name} plugin details`}><section><header><span className="music-plugin-glyph large">{plugin.name.slice(0, 1)}</span><div><span className="music-eyebrow">{plugin.bundled ? "Orion curated plugin" : "Music plugin"}</span><h2>{plugin.name}</h2><p>Version {plugin.version}</p></div><button onClick={close} aria-label="Close plugin details">×</button></header>
    <div className="music-plugin-install-state" data-phase={phase}><i />{phase === "review" && <><strong>Review capabilities</strong><span>This compiled adapter will register only the capabilities and permissions shown below.</span></>}{phase === "installing" && <><strong>Registering plugin</strong><span>Validating its manifest and attaching providers to Orion's capability host…</span></>}{phase === "ready" && <><strong>Ready in Music Planet</strong><span>{plugin.name} is installed, enabled and available to provider routing.</span></>}</div>
    <p>{plugin.description}</p><div className="music-plugin-dialog-grid"><div><span>Capabilities</span><div className="music-plugin-categories">{plugin.categories.map((item) => <b key={item}>{item}</b>)}</div></div><div><span>Declared permissions</span><ul>{plugin.permissions.map((permission) => <li key={permission}>{permission}</li>)}</ul></div></div>
    {error && <em>{error}</em>}<footer>{phase === "ready" ? <><button onClick={close}>Done</button></> : <><button onClick={close} disabled={phase === "installing"}>Cancel</button>{!plugin.installed && <button className="primary" onClick={install} disabled={!plugin.available || phase === "installing"}>{phase === "installing" ? "Installing…" : "Install and enable"}</button>}</>}
      {plugin.installed && !plugin.locked && <button className="danger" onClick={async () => { const result = await perform(() => window.electron.musicRemovePlugin(plugin.id), `${plugin.name} removed.`); if (result?.ok) close(); }}>Remove plugin</button>}</footer>
  </section></div>;
}
