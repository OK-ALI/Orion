import { useEffect, useMemo, useRef, useState } from "react";

export const MUSIC_QUICK_FILTERS = [
  ["all", "All"],
  ["tracks", "Tracks"],
  ["artists", "Artists"],
  ["albums", "Albums"],
  ["playlists", "Playlists"],
];

function mergeResults(groups, key) {
  const map = new Map();
  for (const group of groups || []) {
    for (const item of group?.value?.[key] || []) {
      const identity = `${String(item?.name || item?.title || "").toLowerCase()}\0${String(item?.artistName || "").toLowerCase()}`;
      if (!identity.replace("\0", "")) continue;
      if (!map.has(identity)) map.set(identity, item);
    }
  }
  return [...map.values()];
}

function normalizeItem(kind, item) {
  const title = item?.name || item?.title || "Untitled";
  const secondary = kind === "track"
    ? [item?.artistName, item?.albumTitle].filter(Boolean).join(" · ") || "Track"
    : kind === "artist"
      ? "Artist"
      : kind === "album"
        ? item?.artistName || "Album"
        : item?.author || item?.ownerName || "Playlist";
  return {
    kind,
    item,
    id: `${kind}-${item?.provider || item?.source || "music"}-${item?.id || title}`,
    title,
    secondary,
    artworkUrl: item?.profileImageUrl || item?.artworkUrl || item?.thumbnailUrl || "",
  };
}

function flattenResults(groups, filter) {
  const tracks = mergeResults(groups, "tracks");
  const artists = mergeResults(groups, "artists");
  const albums = mergeResults(groups, "albums");
  const playlists = mergeResults(groups, "playlists");
  const byFilter = {
    tracks: tracks.map((item) => normalizeItem("track", item)),
    artists: artists.map((item) => normalizeItem("artist", item)),
    albums: albums.map((item) => normalizeItem("album", item)),
    playlists: playlists.map((item) => normalizeItem("playlist", item)),
  };
  const all = [
    ...byFilter.artists.slice(0, 2),
    ...byFilter.albums.slice(0, 2),
    ...byFilter.tracks.slice(0, 6),
    ...byFilter.playlists.slice(0, 2),
  ];
  return {
    items: filter === "all" ? all : (byFilter[filter] || []),
    tracks,
    counts: {
      all: tracks.length + artists.length + albums.length + playlists.length,
      tracks: tracks.length,
      artists: artists.length,
      albums: albums.length,
      playlists: playlists.length,
    },
  };
}

export function useMusicQuickSearch(query, filter) {
  const [response, setResponse] = useState({ results: [], errors: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef(0);

  useEffect(() => {
    const term = String(query || "").trim();
    const requestId = ++requestRef.current;
    setError("");
    if (term.length < 2) {
      setResponse({ results: [], errors: [] });
      setLoading(false);
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setLoading(true);
      Promise.resolve(window.electron?.musicSearch?.(term))
        .then((value) => {
          if (requestRef.current !== requestId) return;
          const next = value || { results: [], errors: [] };
          setResponse(next);
          if (!next?.results?.length && next?.errors?.length) setError("Music search is temporarily unavailable.");
        })
        .catch(() => {
          if (requestRef.current === requestId) {
            setResponse({ results: [], errors: [] });
            setError("Music search is temporarily unavailable.");
          }
        })
        .finally(() => { if (requestRef.current === requestId) setLoading(false); });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  return useMemo(() => ({ ...flattenResults(response.results, filter), loading, error }), [error, filter, loading, response.results]);
}
