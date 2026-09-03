import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { notifyMusicCollectionsChanged } from "../utils/collections";
import { showToast } from "../../../components/layout/Toast";

function sameTrack(left, right) {
  if (!left || !right) return false;
  return left.id === right.id && (left.provider || left.source?.provider || "unknown") === (right.provider || right.source?.provider || "unknown");
}

export default function AddToPlaylistDialog({ track, close }) {
  const [playlists, setPlaylists] = useState([]);
  const [status, setStatus] = useState("loading");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [actionStatus, setActionStatus] = useState("idle");
  const [error, setError] = useState("");
  const createInputRef = useRef(null);
  const savingRef = useRef(false);
  const portalTarget = useMemo(() => document.querySelector(".music-planet-container") || document.body, []);
  const saving = actionStatus === "saving";

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    window.electron?.musicListPlaylists?.()
      .then((items) => {
        if (cancelled) return;
        setPlaylists(items || []);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!creating) return undefined;
    const frame = window.requestAnimationFrame(() => createInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [creating]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !saving) close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close, saving]);

  const add = async (playlist) => {
    if (savingRef.current) return;
    setError("");
    if ((playlist.items || []).some((item) => sameTrack(item, track))) {
      showToast(`${track.title || "Track"} is already in ${playlist.name}.`);
      close();
      return;
    }
    savingRef.current = true;
    setActionStatus("saving");
    try {
      const result = await window.electron?.musicSavePlaylist?.({ ...playlist, items: [...(playlist.items || []), track] });
      if (!result?.id || result.ok === false) throw new Error("This track could not be added. Please try again.");
      notifyMusicCollectionsChanged({ kind: "playlist", id: playlist.id });
      showToast(`${track.title || "Track"} added to ${playlist.name}.`, "success");
      close();
    } catch {
      savingRef.current = false;
      setActionStatus("idle");
      setError("This track could not be added to the playlist. Please try again.");
    }
  };

  const create = async () => {
    const name = newName.trim();
    if (!name || savingRef.current) return;
    setError("");
    savingRef.current = true;
    setActionStatus("saving");
    try {
      const result = await window.electron?.musicSavePlaylist?.({ name, description: "", items: [track] });
      if (!result?.id || result.ok === false) throw new Error("The playlist could not be created. Please try again.");
      notifyMusicCollectionsChanged({ kind: "playlist", id: result.id });
      showToast(`${name} created and ${track.title || "track"} added.`, "success");
      close();
    } catch {
      savingRef.current = false;
      setActionStatus("idle");
      setError("The playlist could not be created. Please try again.");
    }
  };

  const dialog = (
    <div className="music-dialog-backdrop music-add-to-playlist-backdrop" role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && !saving && close()}>
      <section className="music-dialog music-add-to-playlist-dialog" role="dialog" aria-modal="true"
        aria-labelledby="music-add-to-playlist-title" aria-describedby="music-add-to-playlist-track">
        <header>
          <div><span className="music-eyebrow">Keep this track</span><h2 id="music-add-to-playlist-title">Add to playlist</h2></div>
          <button onClick={close} disabled={saving} aria-label="Close">×</button>
        </header>

        <div className="music-playlist-dialog-track" id="music-add-to-playlist-track">
          <span>Adding</span>
          <strong>{track?.title || track?.name || "Selected track"}</strong>
          <small>{track?.artistName || "Unknown artist"}</small>
        </div>

        {status === "loading" && <div className="music-loading-status"><span className="music-button-loader"><i /></span>Loading playlists…</div>}
        {status === "error" && <div className="music-playlist-dialog-state"><strong>Playlists could not be loaded.</strong><small>Close this panel and try again.</small></div>}

        {status === "ready" && playlists.length > 0 && !creating && <>
          <div className="music-dialog-list music-playlist-choice-list">
            {playlists.map((playlist) => <button key={playlist.id} disabled={saving} onClick={() => add(playlist)}>
              <span><strong>{playlist.name}</strong><small>{playlist.items?.length || 0} tracks</small></span><b aria-hidden="true">＋</b>
            </button>)}
          </div>
          <footer className="music-playlist-dialog-actions">
            <button onClick={close} disabled={saving}>Cancel</button>
            <button className="primary" onClick={() => setCreating(true)} disabled={saving}>Create new playlist</button>
          </footer>
        </>}

        {status === "ready" && playlists.length === 0 && !creating && <div className="music-playlist-dialog-state is-empty">
          <strong>No playlists yet</strong>
          <small>Create your first playlist and Orion will add this track immediately.</small>
          <button className="primary" onClick={() => setCreating(true)}>Create playlist</button>
        </div>}

        {status === "ready" && creating && <div className="music-playlist-create-panel">
          <label><span>Playlist name</span><input ref={createInputRef} value={newName}
            onChange={(event) => setNewName(event.target.value)} placeholder="My playlist"
            onKeyDown={(event) => event.key === "Enter" && create()} disabled={saving} /></label>
          <div className="music-playlist-create-actions">
            <button onClick={() => { setCreating(false); setNewName(""); setError(""); }} disabled={saving}>Back</button>
            <button className="primary" disabled={!newName.trim() || saving} onClick={create}>
              {saving ? "Creating…" : "Create & Add"}
            </button>
          </div>
        </div>}

        {error && <p className="music-playlist-dialog-error" role="alert">{error}</p>}
      </section>
    </div>
  );

  return createPortal(dialog, portalTarget);
}
