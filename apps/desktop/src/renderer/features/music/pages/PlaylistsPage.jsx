import { useEffect, useMemo, useState } from "react";
import MusicTrackList from "../components/MusicTrackList";
import PlaylistArtwork from "../components/PlaylistArtwork";
import { useMusic } from "../context/MusicProvider";
import { notifyMusicCollectionsChanged } from "../utils/collections";
import {
  PLAYLIST_ARTWORK_PRESETS,
  customPlaylistArtworkFromFile,
  playlistArtworkPreset,
} from "../utils/playlistArtwork";

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
      window.electron?.musicListPlaylists?.() || [],
      window.electron?.musicListPlaylistFolders?.() || [],
    ]);
    setPlaylists(nextPlaylists || []);
    setFolders(nextFolders || []);
  };

  useEffect(() => { load(); }, []);

  const selected = playlists.find((playlist) => playlist.id === selectedId) || null;
  const visible = useMemo(() => playlists.filter((playlist) => folderFilter === "all"
    || (folderFilter === "root" ? !playlist.folderId : playlist.folderId === folderFilter)), [folderFilter, playlists]);

  useEffect(() => {
    if (!selectedId && visible.length) setSelectedId(visible[0].id);
    else if (selectedId && !playlists.some((playlist) => playlist.id === selectedId)) setSelectedId(visible[0]?.id || null);
  }, [playlists, selectedId, visible]);

  const announceChange = (detail = {}) => notifyMusicCollectionsChanged({ kind: "playlist", ...detail });

  const savePlaylist = async (value) => {
    const saved = await window.electron?.musicSavePlaylist?.(value);
    await load();
    setSelectedId(saved?.id || value.id || null);
    setDialog(null);
    announceChange({ id: saved?.id || value.id });
  };

  const importFile = async () => {
    const result = await window.electron?.musicImportPlaylistFile?.();
    if (result?.cancelled) return;
    if (!result?.ok) { setNotice(result?.error || "Playlist import failed."); return; }
    setNotice(`Imported ${result.playlist.items.length} tracks.`);
    await load();
    setSelectedId(result.playlist.id);
    announceChange({ id: result.playlist.id });
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
    const items = selected.items.slice();
    const [track] = items.splice(from, 1);
    items.splice(to, 0, track);
    await savePlaylist({ ...selected, items });
    setReordering(true);
  };

  const removeTrack = async (index) => savePlaylist({ ...selected, items: selected.items.filter((_, itemIndex) => itemIndex !== index) });

  const deleteSelected = async () => {
    if (!selected || !window.confirm(`Delete ${selected.name}?`)) return;
    await window.electron.musicDeletePlaylist(selected.id);
    setSelectedId(null);
    await load();
    announceChange({ id: selected.id, removed: true });
  };

  return <div className="music-page music-playlists-page">
    <header className="music-page-header compact"><span className="music-eyebrow">Playlist constellations</span><h1>Playlists</h1><p>Create, arrange and carry your listening collections across Orion backups.</p></header>
    <div className="music-toolbar music-playlist-page-toolbar"><button className="primary" onClick={() => setDialog({ type: "playlist", value: { name: "", description: "", folderId: folderFilter === "all" ? null : folderFilter, items: [] } })}>New playlist</button>
      <button onClick={() => setDialog({ type: "folder", value: { name: "", parentId: null } })}>New folder</button><button onClick={importFile}>Import JSON / M3U</button></div>
    {notice && <div className="music-plugin-notice" role="status">{notice}</div>}

    <div className="music-playlist-layout">
      <aside aria-label="Playlist navigation">
        <span className="music-playlist-rail-label">Browse</span>
        <button className={`music-playlist-filter${folderFilter === "all" ? " active" : ""}`} onClick={() => setFolderFilter("all")}><strong>All playlists</strong><small>{playlists.length}</small></button>
        <button className={`music-playlist-filter${folderFilter === "root" ? " active" : ""}`} onClick={() => setFolderFilter("root")}><strong>Unfiled</strong></button>
        {folders.map((folder) => <button key={folder.id} className={`music-playlist-filter${folderFilter === folder.id ? " active" : ""}`} onClick={() => setFolderFilter(folder.id)}><strong>{folder.name}</strong><small>{playlists.filter((playlist) => playlist.folderId === folder.id).length}</small></button>)}
        <span className="music-playlist-divider" />
        <span className="music-playlist-rail-label">Playlists</span>
        {visible.map((playlist) => <button key={playlist.id} className={`music-playlist-entry${selectedId === playlist.id ? " active" : ""}`} onClick={() => { setSelectedId(playlist.id); setReordering(false); }}><strong>{playlist.name}</strong><small>{playlist.items.length} tracks</small></button>)}
      </aside>

      <section className="music-playlist-workspace">
        {selected ? <>
          <header className="music-playlist-detail-header">
            <div className="music-playlist-detail-identity"><PlaylistArtwork playlist={selected} />
              <div className="music-playlist-detail-copy"><span className="music-eyebrow">Playlist</span><h2>{selected.name}</h2>
                {selected.description && <p className="music-muted">{selected.description}</p>}<small>{selected.items.length} {selected.items.length === 1 ? "track" : "tracks"}</small></div>
            </div>
            <div className="music-playlist-detail-actions">
              <button className="primary" disabled={!selected.items.length} onClick={() => music.playTrack(selected.items[0], selected.items)}>Play</button>
              <button disabled={!selected.items.length} onClick={() => { const shuffled = selected.items.slice().sort(() => Math.random() - .5); music.playTrack(shuffled[0], shuffled); }}>Shuffle</button>
              <button onClick={() => setDialog({ type: "playlist", value: selected })}>Edit</button>
              <button onClick={() => setReordering((value) => !value)}>{reordering ? "Done" : "Reorder"}</button>
              <details className="music-playlist-more">
                <summary>More</summary>
                <div className="music-playlist-more-menu">
                  <button onClick={duplicate}>Duplicate</button>
                  <button onClick={() => exportFile("json")}>Export JSON</button>
                  <button onClick={() => exportFile("m3u")}>Export M3U</button>
                  <button className="danger" onClick={deleteSelected}>Delete</button>
                </div>
              </details>
            </div>
          </header>
          {reordering ? <PlaylistOrderEditor items={selected.items} move={moveTrack} remove={removeTrack} />
            : selected.items.length ? <MusicTrackList tracks={selected.items} />
              : <div className="music-playlist-empty-state"><span>Empty playlist</span><strong>Ready for its first track</strong><p>Add tracks from any track menu. They will appear here immediately.</p></div>}
        </> : <div className="music-playlist-empty-state is-selection"><span>Playlist workspace</span><strong>No playlist selected</strong><p>Create a playlist or choose one from the collection rail.</p></div>}
      </section>
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
  const [artError, setArtError] = useState("");
  const selectedPreset = value.artwork?.kind === "preset" ? value.artwork.preset : "";

  const chooseCustomArtwork = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      setArtError("");
      const artwork = await customPlaylistArtworkFromFile(file);
      setValue((current) => ({ ...current, artwork }));
    } catch (error) {
      setArtError(error?.message || "Artwork could not be processed.");
    }
  };

  return <div className="music-dialog-backdrop"><section className="music-dialog" role="dialog" aria-modal="true" aria-label="Playlist details"><header><div><span className="music-eyebrow">Playlist</span><h2>{initial.id ? "Edit playlist" : "New playlist"}</h2></div><button onClick={close} aria-label="Close playlist details">×</button></header>
    <label>Name<input autoFocus value={value.name} onChange={(event) => setValue({ ...value, name: event.target.value })} /></label>
    <label>Description<textarea value={value.description || ""} onChange={(event) => setValue({ ...value, description: event.target.value })} /></label>
    <label>Folder<select value={value.folderId || ""} onChange={(event) => setValue({ ...value, folderId: event.target.value || null })}><option value="">Unfiled</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label>
    <div className="music-playlist-artwork-editor">
      <PlaylistArtwork playlist={value} label={`Artwork preview for ${value.name || "playlist"}`} />
      <div className="music-playlist-artwork-controls"><span>Artwork</span>
        <div className="music-playlist-artwork-presets">
          <button type="button" className={!value.artwork ? "active" : ""} onClick={() => setValue({ ...value, artwork: null })}>Smart mosaic</button>
          {PLAYLIST_ARTWORK_PRESETS.map((preset) => <button type="button" key={preset.id}
            className={selectedPreset === preset.id ? "active" : ""}
            onClick={() => setValue({ ...value, artwork: { kind: "preset", preset: preset.id } })}>{preset.label}</button>)}
        </div>
        <label className="music-playlist-custom-upload">Choose custom image<input type="file" accept="image/*" onChange={chooseCustomArtwork} /></label>
        {artError && <p className="music-playlist-artwork-error" role="alert">{artError}</p>}
      </div>
    </div>
    <footer><button onClick={close}>Cancel</button><button className="primary" disabled={!value.name.trim()} onClick={() => save({ ...value, name: value.name.trim() })}>Save</button></footer>
  </section></div>;
}

function FolderDialog({ initial, folders, close, save }) {
  const [value, setValue] = useState(initial);
  return <div className="music-dialog-backdrop"><section className="music-dialog" role="dialog" aria-modal="true" aria-label="Playlist folder"><header><div><span className="music-eyebrow">Organization</span><h2>New folder</h2></div><button onClick={close} aria-label="Close playlist folder">×</button></header>
    <label>Name<input autoFocus value={value.name} onChange={(event) => setValue({ ...value, name: event.target.value })} /></label>
    <label>Parent folder<select value={value.parentId || ""} onChange={(event) => setValue({ ...value, parentId: event.target.value || null })}><option value="">Top level</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label>
    <footer><button onClick={close}>Cancel</button><button className="primary" disabled={!value.name.trim()} onClick={() => save({ ...value, name: value.name.trim() })}>Create</button></footer>
  </section></div>;
}
