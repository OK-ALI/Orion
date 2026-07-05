import { useEffect, useState } from "react";
import MusicArtwork from "../components/MusicArtwork";
import MusicTrackList from "../components/MusicTrackList";

export default function ArtistPage({ selected, onNavigate }) {
  const [details, setDetails] = useState({ status: "loading", value: null, error: "" });
  const [tracks, setTracks] = useState([]);
  useEffect(() => {
    let cancelled = false; setDetails({ status: "loading", value: null, error: "" });
    Promise.all([window.electron?.musicGetDetails?.("artist", selected), selected?.name ? window.electron?.musicSearch?.(selected.name) : null]).then(([result, search]) => {
      if (cancelled) return;
      setDetails(result?.ok ? { status: "ready", value: result.value, error: "" } : { status: "partial", value: null, error: result?.error || "Extended biography is unavailable." });
      setTracks((search?.results || []).flatMap((group) => group.value?.tracks || []).filter((track) => track.artistName?.toLowerCase().includes(selected.name.toLowerCase())));
    }).catch((error) => { if (!cancelled) setDetails({ status: "error", value: null, error: error.message }); });
    return () => { cancelled = true; };
  }, [selected?.id, selected?.name, selected?.source?.provider]);
  const artist = details.value?.artist || selected;
  return <div className="music-page music-artist-world"><header className="music-entity-hero"><MusicArtwork className="music-round-art large" track={{ ...artist, artworkUrl: artist?.profileImageUrl }} label={`Portrait for ${artist?.name || "artist"}`} /><div><span>Artist world</span><h1>{artist?.name || "Unknown artist"}</h1><p>{artist?.disambiguation || [artist?.country, artist?.lifeSpan?.begin].filter(Boolean).join(" · ") || "Albums, recordings and appearances across your active sources."}</p>{artist?.genres?.length > 0 && <div className="music-plugin-categories">{artist.genres.slice(0, 6).map((genre) => <span key={genre}>{genre}</span>)}</div>}</div></header>
    {details.value?.biography && <section className="music-artist-bio"><span className="music-eyebrow">Biography</span><p>{details.value.biography}</p></section>}
    {details.error && <div className="music-provider-warning">{details.error} Matching tracks are still shown.</div>}
    {details.value?.albums?.length > 0 && <section className="music-section"><h2>Discography</h2><div className="music-editorial-rail">{details.value.albums.slice(0, 18).map((album) => <button key={album.id} onClick={() => onNavigate("music-album", album)}><MusicArtwork track={album} label={`Artwork for ${album.title}`} /><strong>{album.title}</strong><small>{album.releaseDate || album.primaryType}</small></button>)}</div></section>}
    <section className="music-section"><h2>Top matching tracks</h2><MusicTrackList tracks={tracks.slice(0, 30)} empty={details.status === "loading" ? "Mapping this artist's catalog…" : "No playable tracks are available from the active sources."} /></section></div>;
}
