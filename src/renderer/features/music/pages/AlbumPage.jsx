import { useEffect, useState } from "react";
import MusicArtwork from "../components/MusicArtwork";
import MusicTrackList from "../components/MusicTrackList";

export default function AlbumPage({ selected }) {
  const [details, setDetails] = useState({ status: "loading", value: null, error: "" });
  const [fallbackTracks, setFallbackTracks] = useState([]);
  useEffect(() => {
    let cancelled = false; setDetails({ status: "loading", value: null, error: "" });
    Promise.all([window.electron?.musicGetDetails?.("album", selected), selected?.title ? window.electron?.musicSearch?.(`${selected.artistName || ""} ${selected.title}`) : null]).then(([result, search]) => {
      if (cancelled) return;
      setDetails(result?.ok ? { status: "ready", value: result.value, error: "" } : { status: "partial", value: null, error: result?.error || "Full tracklist is unavailable." });
      setFallbackTracks((search?.results || []).flatMap((group) => group.value?.tracks || []).filter((track) => !track.albumTitle || track.albumTitle.toLowerCase() === selected.title.toLowerCase()));
    }).catch((error) => { if (!cancelled) setDetails({ status: "error", value: null, error: error.message }); });
    return () => { cancelled = true; };
  }, [selected?.artistName, selected?.id, selected?.source?.provider, selected?.title]);
  const album = details.value?.album || selected; const tracks = details.value?.tracks?.length ? details.value.tracks : fallbackTracks;
  return <div className="music-page"><header className="music-entity-hero"><MusicArtwork className="music-album-art large" track={album} label={`Artwork for ${album?.title || "album"}`} /><div><span>{album?.primaryType || "Album"}</span><h1>{album?.title || "Unknown album"}</h1><p>{album?.artistName || "Unknown artist"} {[album?.releaseDate, album?.year].find(Boolean) ? `· ${album.releaseDate || album.year}` : ""}</p>{album?.genres?.length > 0 && <div className="music-plugin-categories">{album.genres.slice(0, 6).map((genre) => <span key={genre}>{genre}</span>)}</div>}</div></header>
    {details.error && <div className="music-provider-warning">{details.error} Search matches are shown where available.</div>}
    <section className="music-section"><div className="music-section-heading"><div><span>{tracks.length || 0} tracks</span><h2>Tracklist</h2></div></div><MusicTrackList tracks={tracks} empty={details.status === "loading" ? "Mapping this release…" : "This source has not returned an album tracklist yet."} /></section></div>;
}
