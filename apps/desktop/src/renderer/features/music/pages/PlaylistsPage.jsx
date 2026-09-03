import { useEffect, useMemo, useRef, useState } from "react";
import MusicCollectionDialog from "../components/MusicCollectionDialog";
import { showToast } from "../../../components/layout/Toast";
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
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState(routeSelection?.playlistId || null);
  const [folderFilter, setFolderFilter] = useState("all");
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState(null);
  const [reordering, setReordering] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const operation = useRef(false);
  const openDialog = (value) => { setActionError(""); setDialog(value); };

  const load = async () => {
    const [nextPlaylists, nextFolders] = await Promise.all([
      window.electron?.musicListPlaylists?.() || [],
      window.electron?.musicListPlaylistFolders?.() || [],
    ]);
    setPlaylists(nextPlaylists || []);
    setFolders(nextFolders || []);
    setLoaded(true);
  };

  useEffect(() => { load().catch(() => setNotice("Playlists could not be loaded. Please reopen this page.")); }, []);

  const selected = playlists.find((playlist) => playlist.id === selectedId) || null;
  const visible = useMemo(() => playlists.filter((playlist) => folderFilter === "all"
    || (folderFilter === "root" ? !playlist.folderId : playlist.folderId === folderFilter)), [folderFilter, playlists]);

  useEffect(() => {
    if (!loaded) return;
    if (!visible.some((playlist) => playlist.id === selectedId)) setSelectedId(visible[0]?.id || null);
  }, [loaded, selectedId, visible]);

  const announceChange = (detail = {}) => notifyMusicCollectionsChanged({ kind: "playlist", ...detail });

  const runAction = async (action, errorMessage) => {
    if (operation.current) return;
    operation.current = true; setBusy(true); setActionError("");
    try { await action(); }
    catch { setActionError(errorMessage); }
    finally { operation.current = false; setBusy(false); }
  };

  const savePlaylist = (value, message) => runAction(async () => {
    const saved = await window.electron?.musicSavePlaylist?.(value);
    if (!saved?.id || saved.ok === false) throw new Error("Save failed");
    setPlaylists((current) => [saved, ...current.filter((playlist) => playlist.id !== saved.id)]);
    setFolderFilter("all"); setSelectedId(saved.id); setDialog(null);
    announceChange({ id: saved.id });
    showToast(message || `${saved.name} ${value.id ? "saved" : "created"}.`, "success");
  }, "The playlist could not be saved. Please try again.");

  const saveFolder = (folder) => runAction(async () => {
    const result = await window.electron?.musicSavePlaylistFolder?.(folder);
    if (!result?.ok || !result.folder?.id) throw new Error("Save failed");
    setFolders((current) => [...current, result.folder]);
    setDialog(null); announceChange({ kind: "folder", id: result.folder.id });
    showToast(`${result.folder.name} created.`, "success");
  }, "The folder could not be created. Please try again.");

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
    folderId: selected.folderId, artwork: selected.artwork, items: selected.items }, `${selected.name} duplicated.`);

  const moveTrack = async (from, to) => {
    if (!selected || from === to || to < 0 || to >= selected.items.length) return;
    const items = selected.items.slice();
    const [track] = items.splice(from, 1);
    items.splice(to, 0, track);
    await savePlaylist({ ...selected, items });
    setReordering(true);
  };

  const removeTrack = async (index) => savePlaylist({ ...selected, items: selected.items.filter((_, itemIndex) => itemIndex !== index) }, `Track removed from ${selected.name}.`);

  const deleteSelected = () => runAction(async () => {
    const { value, type } = dialog;
    const folder = type === "delete-folder";
    const result = folder ? await window.electron?.musicDeletePlaylistFolder?.(value.id)
      : await window.electron?.musicDeletePlaylist?.(value.id);
    if (!result?.ok) throw new Error("Delete failed");
    if (folder) {
      setFolders((current) => current.filter((item) => item.id !== value.id));
      setPlaylists((current) => current.map((item) => item.folderId === value.id ? { ...item, folderId: null } : item));
      setFolderFilter("root");
    } else {
      setPlaylists((current) => current.filter((item) => item.id !== value.id));
      setSelectedId(null);
    }
    setDialog(null);
    announceChange({ kind: folder ? "folder" : "playlist", id: value.id, removed: true });
    showToast(`${value.name} deleted.`, "success");
  }, "This collection could not be deleted. Please try again.");

  return <div className="music-page music-playlists-page">
    <header className="music-page-header compact"><span className="music-eyebrow">Playlist constellations</span><h1>Playlists</h1><p>Create, arrange and carry your listening collections across Orion backups.</p></header>
    <div className="music-toolbar music-playlist-page-toolbar"><button className="primary" disabled={busy} onClick={() => openDialog({ type: "playlist", value: { name: "", description: "", folderId: folderFilter === "all" ? null : folderFilter, items: [] } })}>New playlist</button>
      <button disabled={busy} onClick={() => openDialog({ type: "folder", value: { name: "", parentId: null } })}>New folder</button><button onClick={importFile}>Import JSON / M3U</button></div>
    {notice && <div className="music-plugin-notice" role="status">{notice}</div>}
    {!dialog && actionError && <p role="alert">{actionError}</p>}

    <div className="music-playlist-layout">
      <aside aria-label="Playlist navigation">
        <span className="music-playlist-rail-label">Browse</span>
        <button className={`music-playlist-filter${folderFilter === "all" ? " active" : ""}`} onClick={() => setFolderFilter("all")}><strong>All playlists</strong><small>{playlists.length}</small></button>
        <button className={`music-playlist-filter${folderFilter === "root" ? " active" : ""}`} onClick={() => setFolderFilter("root")}><strong>Unfiled</strong></button>
        {folders.map((folder) => <button key={folder.id} className={`music-playlist-filter${folderFilter === folder.id ? " active" : ""}`} onClick={() => setFolderFilter(folder.id)}><strong>{folder.name}</strong><small>{playlists.filter((playlist) => playlist.folderId === folder.id).length}</small></button>)}
        {folders.some((folder) => folder.id === folderFilter) && <button disabled={busy} onClick={() => openDialog({ type: "delete-folder", value: folders.find((folder) => folder.id === folderFilter) })}>Delete folder</button>}
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
              <button disabled={busy} onClick={() => openDialog({ type: "playlist", value: selected })}>Edit</button>
              <button disabled={busy} onClick={() => openDialog({ type: "delete-playlist", value: selected })}>Delete playlist</button>
              <button onClick={() => setReordering((value) => !value)}>{reordering ? "Done" : "Reorder"}</button>
              <details className="music-playlist-more">
                <summary>More</summary>
                <div className="music-playlist-more-menu">
                  <button disabled={busy} onClick={duplicate}>Duplicate</button>
                  <button onClick={() => exportFile("json")}>Export JSON</button>
                  <button onClick={() => exportFile("m3u")}>Export M3U</button>
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

    {dialog?.type === "playlist" && <PlaylistDialog initial={dialog.value} folders={folders} close={() => setDialog(null)} save={savePlaylist} busy={busy} error={actionError} />}
    {dialog?.type === "folder" && <FolderDialog initial={dialog.value} folders={folders} close={() => setDialog(null)} save={saveFolder} busy={busy} error={actionError} />}
    {dialog?.type?.startsWith("delete-") && <MusicCollectionDialog label={dialog.type === "delete-folder" ? "Delete folder?" : "Delete playlist?"} busy={busy} close={() => setDialog(null)}>
      <header><h2>{dialog.type === "delete-folder" ? "Delete folder?" : "Delete playlist?"}</h2></header>
      <p>Delete “{dialog.value.name}”?</p>
      <p>{dialog.type === "delete-folder" ? "Its playlists will remain in Unfiled. Child folders will remain at the top level." : "Your music files and current playback will not be deleted or stopped."}</p>
      {actionError && <p role="alert">{actionError}</p>}
      <footer><button data-initial-focus disabled={busy} onClick={() => setDialog(null)}>Cancel</button>
        <button disabled={busy} onClick={deleteSelected}>{busy ? "Deleting…" : dialog.type === "delete-folder" ? "Delete folder" : "Delete playlist"}</button></footer>
    </MusicCollectionDialog>}
  </div>;
}

function PlaylistOrderEditor({ items, move, remove }) {
  const [drag, setDrag] = useState(-1);
  return <ol className="music-playlist-order">{items.map((track, index) => <li key={`${track.provider}:${track.id}:${index}`} draggable onDragStart={() => setDrag(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => move(drag, index)}>
    <span>⋮⋮</span><div><strong>{track.title}</strong><small>{track.artistName}</small></div><button onClick={() => remove(index)}>Remove</button>
  </li>)}</ol>;
}

function PlaylistDialog({ initial, folders, close, save, busy, error }) {
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

  return <MusicCollectionDialog label="Playlist details" busy={busy} close={close}><header><div><span className="music-eyebrow">Playlist</span><h2>{initial.id ? "Edit playlist" : "New playlist"}</h2></div><button disabled={busy} onClick={close} aria-label="Close playlist details">×</button></header>
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
    {error && <p role="alert">{error}</p>}
    <footer><button disabled={busy} onClick={close}>Cancel</button><button className="primary" disabled={busy || !value.name.trim()} onClick={() => save({ ...value, name: value.name.trim() })}>{busy ? "Saving…" : "Save"}</button></footer>
  </MusicCollectionDialog>;
}

function FolderDialog({ initial, folders, close, save, busy, error }) {
  const [value, setValue] = useState(initial);
  return <MusicCollectionDialog label="Playlist folder" busy={busy} close={close}><header><div><span className="music-eyebrow">Organization</span><h2>New folder</h2></div><button disabled={busy} onClick={close} aria-label="Close playlist folder">×</button></header>
    <label>Name<input autoFocus value={value.name} onChange={(event) => setValue({ ...value, name: event.target.value })} /></label>
    <label>Parent folder<select value={value.parentId || ""} onChange={(event) => setValue({ ...value, parentId: event.target.value || null })}><option value="">Top level</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label>
    {error && <p role="alert">{error}</p>}
    <footer><button disabled={busy} onClick={close}>Cancel</button><button className="primary" disabled={busy || !value.name.trim()} onClick={() => save({ ...value, name: value.name.trim() })}>{busy ? "Creating…" : "Create"}</button></footer>
  </MusicCollectionDialog>;
}
