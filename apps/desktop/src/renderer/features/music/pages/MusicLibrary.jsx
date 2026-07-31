import { useEffect, useMemo, useState } from "react";
import MusicTrackList from "../components/MusicTrackList";
import PlanetGrid from "../components/PlanetGrid";
import StarGrid from "../components/StarGrid";

const ACTIVE_SCAN_PHASES = new Set(["discovering", "reading", "reconciling"]);
const SCAN_LABELS = { discovering: "Finding audio files", reading: "Reading music metadata",
  reconciling: "Reconciling library", complete: "Library scan complete", cancelled: "Library scan paused" };
const VIEWS = [["overview", "Overview"], ["songs", "Songs"], ["albums", "Albums"], ["artists", "Artists"],
  ["playlists", "Playlists"], ["recent", "Recently played"], ["local", "Local files"]];

export default function MusicLibrary({ onNavigate }) {
  const [tracks, setTracks] = useState([]);
  const [folders, setFolders] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [history, setHistory] = useState([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("title");
  const [view, setView] = useState("overview");
  const [scanning, setScanning] = useState(null);
  const refresh = () => Promise.all([
    window.electron?.musicListTracks?.({ query, limit: 1000 }).then(setTracks),
    window.electron?.musicListFolders?.().then(setFolders),
    window.electron?.musicListPlaylists?.().then(setPlaylists),
    window.electron?.musicListHistory?.(200).then(setHistory),
  ]).catch(() => {});
  useEffect(() => { refresh(); }, [query]);
  useEffect(() => window.electron?.onMusicScanProgress?.(setScanning), []);
  const scanActive = ACTIVE_SCAN_PHASES.has(scanning?.phase);
  const sortedTracks = useMemo(() => tracks.slice().sort((left, right) => {
    if (sort === "artist") return String(left.artistName).localeCompare(String(right.artistName));
    if (sort === "album") return String(left.albumTitle).localeCompare(String(right.albumTitle));
    if (sort === "newest") return Number(right.addedAt || 0) - Number(left.addedAt || 0);
    return String(left.title).localeCompare(String(right.title));
  }), [sort, tracks]);
  const artists = useMemo(() => [...new Map(tracks.filter((track) => track.artistName).map((track) => [track.artistName, {
    id: track.id, name: track.artistName, artworkUrl: track.artworkUrl,
    source: { provider: "orion-local-metadata", id: track.artistName },
  }])).values()], [tracks]);
  const albums = useMemo(() => [...new Map(tracks.filter((track) => track.albumTitle).map((track) => [`${track.artistName}\0${track.albumTitle}`, {
    id: track.id, title: track.albumTitle, artistName: track.artistName, artworkUrl: track.artworkUrl,
    source: { provider: "orion-local-metadata", id: track.albumTitle },
  }])).values()], [tracks]);
  const recent = useMemo(() => [...new Map(history.map((item) => [`${item.track?.provider || ""}:${item.track?.id}`, item.track])).values()].filter(Boolean), [history]);

  const addFolder = async () => { const result = await window.electron?.musicAddFolder?.(); if (result?.ok) refresh(); };
  return <div className="music-page music-library-page">
    <header className="music-page-header compact music-library-heading"><div><span className="music-eyebrow">Your collection</span><h1>Music Library</h1><p>Your saved and local listening, organized without leaving Music Planet.</p></div>
      <div className="music-library-stats"><span><strong>{tracks.length}</strong> Tracks</span><span><strong>{artists.length}</strong> Artists</span><span><strong>{albums.length}</strong> Albums</span></div></header>
    <nav className="music-library-tabs" aria-label="Music library view">{VIEWS.map(([id, label]) => <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}>{label}</button>)}</nav>
    <div className="music-toolbar music-library-toolbar"><label><span>Search library</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tracks, artists or albums" /></label>
      <label><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="title">Title</option><option value="artist">Artist</option><option value="album">Album</option><option value="newest">Recently added</option></select></label>
      <button onClick={addFolder}>Add folder</button><button disabled={scanActive} onClick={async () => { setScanning({ phase: "discovering", current: 0, total: 0 }); await window.electron?.musicScan?.(); refresh(); }}>Rescan</button>
      {scanActive && <button onClick={() => window.electron?.musicCancelScan?.()}>Cancel scan</button>}</div>
    {scanning && <div className="music-scan-status"><span>{SCAN_LABELS[scanning.phase] || "Updating library"}</span><progress max={scanning.total || 1} value={scanning.current || 0} /><small>{scanning.current || 0} / {scanning.total || 0} · {scanning.imported || 0} updated · {scanning.unchanged || 0} unchanged · {scanning.failed || 0} skipped</small></div>}
    {scanning?.errors?.length > 0 && <details className="music-scan-errors"><summary>{scanning.errors.length} files need attention</summary><ul>{scanning.errors.map((item, index) => <li key={`${item.fileName}-${index}`}><strong>{item.fileName}</strong><span>{item.reason}</span></li>)}</ul></details>}
    {view === "local" && <div className="music-folder-row">{folders.map((folder) => <span key={folder.id}>{folder.name}<button aria-label={`Remove ${folder.name}`} onClick={async () => { await window.electron.musicRemoveFolder(folder.id); refresh(); }}>×</button></span>)}</div>}
    {(view === "songs" || view === "local") && <MusicTrackList tracks={sortedTracks} empty={folders.length ? "No supported audio files were found." : "Add a music folder to build your library."} />}
    {view === "albums" && <PlanetGrid items={albums} onNavigate={onNavigate} empty="Albums from your local library will appear here." />}
    {view === "artists" && <StarGrid items={artists} onNavigate={onNavigate} empty="Artists from your local library will appear here." />}
    {view === "recent" && <MusicTrackList tracks={recent} empty="Recently played tracks will appear here." />}
    {view === "playlists" && <div className="music-open-list">{playlists.map((playlist) => <button key={playlist.id} onClick={() => onNavigate?.("music-playlists", { playlistId: playlist.id })}><strong>{playlist.name}</strong><small>{playlist.items?.length || 0} tracks</small></button>)}</div>}
    {view === "overview" && <><section className="music-section"><div className="music-section-heading"><div><span>Return to</span><h2>Recently played</h2></div></div><MusicTrackList tracks={recent.slice(0, 8)} compact empty="Your listening history will appear here." /></section><section className="music-section"><div className="music-section-heading"><div><span>On this device</span><h2>Recently added</h2></div></div><MusicTrackList tracks={sortedTracks.slice(0, 8)} compact empty="Add a folder to begin." /></section></>}
  </div>;
}
