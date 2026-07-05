import { useEffect, useState } from "react";
import MusicTrackList from "../components/MusicTrackList";

export default function PlaylistsPage() {
  const [playlists, setPlaylists] = useState([]);
  const [selected, setSelected] = useState(null);
  const [remote, setRemote] = useState({ open: false, loading: false, sources: [], errors: [] });
  const [notice, setNotice] = useState("");
  const load = () => window.electron?.musicListPlaylists?.().then(setPlaylists).catch(() => {});
  useEffect(() => { load(); }, []);
  const create = async () => {
    const name = window.prompt("Playlist name");
    if (!name?.trim()) return;
    const value = await window.electron.musicSavePlaylist({ name: name.trim(), items: [] });
    await load(); setSelected(value);
  };
  const importYouTube = async () => {
    const url = window.prompt("Public YouTube playlist URL");
    if (!url?.trim()) return;
    setNotice("Importing playlist…");
    const result = await window.electron.musicImportPlaylist("youtube-playlists", url.trim());
    if (!result?.ok) { setNotice(result?.error || "Playlist import failed."); return; }
    setNotice(`Imported ${result.playlist.items.length} tracks.`); await load(); setSelected(result.playlist);
  };
  const browseServers = async () => {
    setRemote({ open: true, loading: true, sources: [], errors: [] });
    const result = await window.electron?.musicListRemotePlaylists?.();
    setRemote({ open: true, loading: false, sources: result?.sources || [], errors: result?.errors || [] });
  };
  const importRemote = async (providerId, playlist) => {
    setNotice(`Importing ${playlist.name}…`);
    const result = await window.electron.musicImportPlaylist(providerId, playlist.id);
    if (!result?.ok) { setNotice(result?.error || "Server playlist import failed."); return; }
    setNotice(`Imported ${result.playlist.items.length} tracks from ${playlist.name}.`);
    setRemote((value) => ({ ...value, open: false })); await load(); setSelected(result.playlist);
  };
  const importFile = async () => {
    const result = await window.electron?.musicImportPlaylistFile?.();
    if (result?.cancelled) return;
    if (!result?.ok) { setNotice(result?.error || "Playlist import failed."); return; }
    setNotice(`Imported ${result.playlist.items.length} tracks from file.`); await load(); setSelected(result.playlist);
  };
  const exportFile = async (format) => {
    if (!selected) return;
    const result = await window.electron?.musicExportPlaylistFile?.(selected.id, format);
    if (result?.cancelled) return;
    setNotice(result?.ok ? `${selected.name} exported as ${format === "m3u" ? "M3U" : "JSON"}.` : result?.error || "Playlist export failed.");
  };
  return <div className="music-page"><header className="music-page-header compact"><span className="music-eyebrow">Made by you</span><h1>Playlists</h1><p>Persistent, portable listening collections.</p></header>
    <div className="music-toolbar"><button className="primary" onClick={create}>New playlist</button><button onClick={importFile}>Import file</button><button onClick={browseServers}>Import from server</button><button onClick={importYouTube}>Import YouTube</button></div>
    {notice && <div className="music-plugin-notice" role="status">{notice}</div>}
    {remote.open && <section className="music-remote-playlists" aria-label="Server playlists"><div className="music-section-heading"><div><span>Connected catalogs</span><h2>Server playlists</h2></div><button onClick={() => setRemote((value) => ({ ...value, open: false }))}>Close</button></div>
      {remote.loading ? <p>Reading connected music servers…</p> : remote.sources.flatMap((source) => source.playlists.map((playlist) => <button key={`${source.providerId}:${playlist.id}`} onClick={() => importRemote(source.providerId, playlist)}><span><strong>{playlist.name}</strong><small>{source.providerName} · {playlist.trackCount || 0} tracks</small></span><b>Import</b></button>))}
      {!remote.loading && remote.sources.every((source) => !source.playlists.length) && <p>No server playlists are available. Connect Subsonic or Navidrome from Sources.</p>}
      {remote.errors.length > 0 && <small>{remote.errors.join(" · ")}</small>}
    </section>}
    <div className="music-playlist-layout"><aside>{playlists.map((playlist) => <button key={playlist.id} className={selected?.id === playlist.id ? "active" : ""} onClick={() => setSelected(playlist)}><strong>{playlist.name}</strong><small>{playlist.items.length} tracks</small></button>)}</aside>
      <section>{selected ? <><div className="music-section-heading"><div><span>Playlist</span><h2>{selected.name}</h2></div><div className="music-actions"><button onClick={() => exportFile("json")}>Export JSON</button><button onClick={() => exportFile("m3u")}>Export M3U</button><button onClick={async () => { if (window.confirm(`Delete ${selected.name}?`)) { await window.electron.musicDeletePlaylist(selected.id); setSelected(null); load(); } }}>Delete</button></div></div><MusicTrackList tracks={selected.items} empty="This playlist is empty." /></> : <div className="music-empty">Choose a playlist or create a new one.</div>}</section></div>
  </div>;
}
