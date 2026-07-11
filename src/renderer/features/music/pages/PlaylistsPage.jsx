import { useEffect, useMemo, useState } from "react";
import MusicTrackList from "../components/MusicTrackList";
import { useMusic } from "../context/MusicProvider";

export default function PlaylistsPage({ selected: routeSelection }) {
  const music = useMusic();
  const [playlists, setPlaylists] = useState([]);
  const [folders, setFolders] = useState([]);
  const [selectedId, setSelectedId] = useState(routeSelection?.playlistId || null);
  const [folderFilter, setFolderFilter] = useState("all");
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState(null);
  const [reordering, setReordering] = useState(false);
  const load = async () => {
    const [nextPlaylists, nextFolders] = await Promise.all([
      window.electron?.musicListPlaylists?.() || [], window.electron?.musicListPlaylistFolders?.() || [],
    ]);
    setPlaylists(nextPlaylists || []); setFolders(nextFolders || []);
  };
  useEffect(() => { load(); }, []);
  const selected = playlists.find((playlist) => playlist.id === selectedId) || null;
  const visible = useMemo(() => playlists.filter((playlist) => folderFilter === "all"
    || (folderFilter === "root" ? !playlist.folderId : playlist.folderId === folderFilter)), [folderFilter, playlists]);

  const savePlaylist = async (value) => {
    const saved = await window.electron?.musicSavePlaylist?.(value);
    await load(); setSelectedId(saved?.id || value.id || null); setDialog(null);
  };
  const importFile = async () => {
    const result = await window.electron?.musicImportPlaylistFile?.();
    if (result?.cancelled) return;
    if (!result?.ok) { setNotice(result?.error || "Playlist import failed."); return; }
    setNotice(`Imported ${result.playlist.items.length} tracks.`); await load(); setSelectedId(result.playlist.id);
  };
  const exportFile = async (format) => {
    if (!selected) return;
    const result = await window.electron?.musicExportPlaylistFile?.(selected.id, format);
    if (!result?.cancelled) setNotice(result?.ok ? `${selected.name} exported.` : result?.error || "Playlist export failed.");
  };
  const duplicate = () => savePlaylist({ name: `${selected.name} copy`, description: selected.description,
    folderId: selected.folderId, artwork: selected.artwork, items: selected.items });
  const moveTrack = async (from, to) => {
    if (!selected || from === to || to < 0 || to >= selected.items.length) return;
    const items = selected.items.slice(); const [track] = items.splice(from, 1); items.splice(to, 0, track);
    await savePlaylist({ ...selected, items }); setReordering(true);
  };
  const removeTrack = async (index) => savePlaylist({ ...selected, items: selected.items.filter((_, itemIndex) => itemIndex !== index) });

  return <div className="music-page music-playlists-page">
    <header className="music-page-header compact"><span className="music-eyebrow">Playlist constellations</span><h1>Playlists</h1><p>Create, arrange and carry your listening collections across Orion backups.</p></header>
    <div className="music-toolbar"><button className="primary" onClick={() => setDialog({ type: "playlist", value: { name: "", description: "", folderId: folderFilter === "all" ? null : folderFilter, items: [] } })}>New playlist</button>
      <button onClick={() => setDialog({ type: "folder", value: { name: "", parentId: null } })}>New folder</button><button onClick={importFile}>Import JSON / M3U</button></div>
    {notice && <div className="music-plugin-notice" role="status">{notice}</div>}
    <div className="music-playlist-layout">
      <aside><button className={folderFilter === "all" ? "active" : ""} onClick={() => setFolderFilter("all")}><strong>All playlists</strong><small>{playlists.length}</small></button>
        <button className={folderFilter === "root" ? "active" : ""} onClick={() => setFolderFilter("root")}><strong>Unfiled</strong></button>
        {folders.map((folder) => <button key={folder.id} className={folderFilter === folder.id ? "active" : ""} onClick={() => setFolderFilter(folder.id)}><strong>{folder.name}</strong><small>{playlists.filter((playlist) => playlist.folderId === folder.id).length}</small></button>)}
        <span className="music-playlist-divider" />
        {visible.map((playlist) => <button key={playlist.id} className={selectedId === playlist.id ? "active" : ""} onClick={() => setSelectedId(playlist.id)}><strong>{playlist.name}</strong><small>{playlist.items.length} tracks</small></button>)}
      </aside>
      <section>{selected ? <><div className="music-section-heading"><div><span>Playlist</span><h2>{selected.name}</h2><p className="music-muted">{selected.description}</p></div>
        <div className="music-actions"><button className="primary" disabled={!selected.items.length} onClick={() => music.playTrack(selected.items[0], selected.items)}>Play</button>
          <button disabled={!selected.items.length} onClick={() => { const shuffled = selected.items.slice().sort(() => Math.random() - .5); music.playTrack(shuffled[0], shuffled); }}>Shuffle</button>
          <button onClick={() => setDialog({ type: "playlist", value: selected })}>Edit</button><button onClick={() => setReordering((value) => !value)}>Reorder</button><button onClick={duplicate}>Duplicate</button>
          <button onClick={() => exportFile("json")}>Export JSON</button><button onClick={() => exportFile("m3u")}>Export M3U</button>
          <button onClick={async () => { if (window.confirm(`Delete ${selected.name}?`)) { await window.electron.musicDeletePlaylist(selected.id); setSelectedId(null); load(); } }}>Delete</button></div></div>
        {reordering ? <PlaylistOrderEditor items={selected.items} move={moveTrack} remove={removeTrack} /> : <MusicTrackList tracks={selected.items} empty="This playlist is empty. Add tracks from any track menu." />}
      </> : <div className="music-empty">Choose a playlist or create a new one.</div>}</section>
    </div>
    {dialog?.type === "playlist" && <PlaylistDialog initial={dialog.value} folders={folders} close={() => setDialog(null)} save={savePlaylist} />}
    {dialog?.type === "folder" && <FolderDialog initial={dialog.value} folders={folders} close={() => setDialog(null)} save={async (folder) => { await window.electron?.musicSavePlaylistFolder?.(folder); await load(); setDialog(null); }} />}
  </div>;
}

function PlaylistOrderEditor({ items, move, remove }) {
  const [drag, setDrag] = useState(-1);
  return <ol className="music-playlist-order">{items.map((track, index) => <li key={`${track.provider}:${track.id}:${index}`} draggable onDragStart={() => setDrag(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => move(drag, index)}>
    <span>⋮⋮</span><div><strong>{track.title}</strong><small>{track.artistName}</small></div><button onClick={() => remove(index)}>Remove</button>
  </li>)}</ol>;
}

function PlaylistDialog({ initial, folders, close, save }) {
  const [value, setValue] = useState(initial);
  return <div className="music-dialog-backdrop"><section className="music-dialog" role="dialog" aria-modal="true" aria-label="Playlist details"><header><div><span className="music-eyebrow">Playlist</span><h2>{initial.id ? "Edit playlist" : "New playlist"}</h2></div><button onClick={close}>×</button></header>
    <label>Name<input autoFocus value={value.name} onChange={(event) => setValue({ ...value, name: event.target.value })} /></label>
    <label>Description<textarea value={value.description || ""} onChange={(event) => setValue({ ...value, description: event.target.value })} /></label>
    <label>Folder<select value={value.folderId || ""} onChange={(event) => setValue({ ...value, folderId: event.target.value || null })}><option value="">Unfiled</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label>
    <footer><button onClick={close}>Cancel</button><button className="primary" disabled={!value.name.trim()} onClick={() => save({ ...value, name: value.name.trim() })}>Save</button></footer>
  </section></div>;
}

function FolderDialog({ initial, folders, close, save }) {
  const [value, setValue] = useState(initial);
  return <div className="music-dialog-backdrop"><section className="music-dialog" role="dialog" aria-modal="true" aria-label="Playlist folder"><header><div><span className="music-eyebrow">Organization</span><h2>New folder</h2></div><button onClick={close}>×</button></header>
    <label>Name<input autoFocus value={value.name} onChange={(event) => setValue({ ...value, name: event.target.value })} /></label>
    <label>Parent folder<select value={value.parentId || ""} onChange={(event) => setValue({ ...value, parentId: event.target.value || null })}><option value="">Top level</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label>
    <footer><button onClick={close}>Cancel</button><button className="primary" disabled={!value.name.trim()} onClick={() => save({ ...value, name: value.name.trim() })}>Create</button></footer>
  </section></div>;
}
