import MusicOrbitalStage from "../components/MusicOrbitalStage";

export default function PlaylistsSection({ playlists = [], onNavigate }) {
  const items = playlists.filter((item) => item?.id && item?.name).slice(0, 6);
  return <MusicOrbitalStage id="playlists" sceneState="playlists" anchor="right" eyebrow="Yours"
    title="Playlists" description="Constellations assembled around the way you listen."
    action={<button onClick={() => onNavigate?.("music-playlists")}>Manage playlists</button>}
    state={items.length ? "ready" : "empty"} stateTitle="No constellations yet"
    stateMessage="Create a playlist and Orion will gather its tracks here."
    stateActions={<button onClick={() => onNavigate?.("music-playlists")}>Create Playlist</button>}>
    <div className="music-stage-playlist-rail">
      {items.map((playlist) => <button key={playlist.id} onClick={() => onNavigate?.("music-playlists", { playlistId: playlist.id })}
        className="music-stage-playlist"><span className="music-stage-playlist-art" aria-hidden="true"><i /><i /><i /></span>
        <strong>{playlist.name}</strong><small>{playlist.items?.length || 0} tracks</small></button>)}
    </div>
  </MusicOrbitalStage>;
}
