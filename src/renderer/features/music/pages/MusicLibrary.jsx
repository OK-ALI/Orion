import { useEffect, useState } from "react";
import MusicTrackList from "../components/MusicTrackList";

const ACTIVE_SCAN_PHASES = new Set(["discovering", "reading", "reconciling"]);
const SCAN_LABELS = {
  discovering: "Finding audio files", reading: "Reading music metadata",
  reconciling: "Reconciling library", complete: "Library scan complete", cancelled: "Library scan paused",
};

export default function MusicLibrary() {
  const [tracks, setTracks] = useState([]);
  const [folders, setFolders] = useState([]);
  const [query, setQuery] = useState("");
  const [scanning, setScanning] = useState(null);
  const refresh = () => Promise.all([
    window.electron?.musicListTracks?.({ query, limit: 1000 }).then(setTracks),
    window.electron?.musicListFolders?.().then(setFolders),
  ]).catch(() => {});
  useEffect(() => { refresh(); }, [query]);
  useEffect(() => window.electron?.onMusicScanProgress?.(setScanning), []);
  const scanActive = ACTIVE_SCAN_PHASES.has(scanning?.phase);
  const addFolder = async () => {
    const result = await window.electron?.musicAddFolder?.();
    if (result?.ok) refresh();
  };
  const artists = new Set(tracks.map((track) => track.artistName).filter(Boolean)).size;
  const albums = new Set(tracks.map((track) => track.albumTitle).filter(Boolean)).size;
  return <div className="music-page music-library-page">
    <header className="music-page-header compact music-library-heading"><div><span className="music-eyebrow">Your collection</span><h1>Music Library</h1>
      <p>Indexed locally. File locations never leave this device.</p></div><div className="music-library-stats"><span><strong>{tracks.length}</strong> Tracks</span><span><strong>{artists}</strong> Artists</span><span><strong>{albums}</strong> Albums</span></div></header>
    <div className="music-toolbar music-library-toolbar"><label><span>Filter library</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tracks, artists or albums" /></label>
      <button onClick={addFolder}>Add folder</button>
      <button disabled={scanActive} onClick={async () => { setScanning({ phase: "discovering", current: 0, total: 0 }); await window.electron?.musicScan?.(); refresh(); }}>Rescan</button>
      {scanActive && <button onClick={() => window.electron?.musicCancelScan?.()}>Cancel scan</button>}
    </div>
    {scanning && <div className="music-scan-status"><span>{SCAN_LABELS[scanning.phase] || "Updating library"}</span><progress max={scanning.total || 1} value={scanning.current || 0} />
      <small>{scanning.current || 0} / {scanning.total || 0} · {scanning.imported || 0} updated · {scanning.unchanged || 0} unchanged · {scanning.failed || 0} skipped{scanning.missing ? ` · ${scanning.missing} missing` : ""}</small></div>}
    {scanning?.errors?.length > 0 && <details className="music-scan-errors"><summary>{scanning.errors.length} files need attention</summary><ul>{scanning.errors.map((item, index) => <li key={`${item.fileName}-${index}`}><strong>{item.fileName}</strong><span>{item.reason}</span></li>)}</ul></details>}
    <div className="music-folder-row">{folders.map((folder) => <span key={folder.id}>{folder.name}<button aria-label={`Remove ${folder.name}`} onClick={async () => { await window.electron.musicRemoveFolder(folder.id); refresh(); }}>×</button></span>)}</div>
    <MusicTrackList tracks={tracks} empty={folders.length ? "No supported audio files were found." : "Add a music folder to build your library."} />
  </div>;
}
