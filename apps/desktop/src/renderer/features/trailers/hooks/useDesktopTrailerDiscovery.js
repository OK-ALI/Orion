import { useEffect, useMemo, useRef, useState } from "react";
import { tmdbFetch } from "../../../services/tmdb";
import {
  hasPlayableTrailerVideo,
  mergeTrailerVideos,
  normalizeTrailerCandidates,
} from "../trailerCandidateService";

function localeLanguage() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale.split("-")[0]?.toLowerCase() || "en";
  } catch {
    return "en";
  }
}

export function useDesktopTrailerDiscovery({
  mediaId,
  mediaType,
  apiKey,
  details,
  selectedSeason = 1,
  visible = false,
}) {
  const generationRef = useRef(0);
  const [result, setResult] = useState({ key: "", candidates: [], loading: true });
  const originalLanguage = String(details?.original_language || "en").trim().toLowerCase() || "en";
  const latestSeason = Math.max(1, Number(details?.number_of_seasons) || 1);
  const preferredLanguage = useMemo(localeLanguage, []);
  const requestKey = `${mediaType}:${mediaId}:${selectedSeason}:${visible ? "open" : "closed"}:${originalLanguage}:${latestSeason}`;

  useEffect(() => {
    if (!mediaId || !apiKey || !["movie", "tv"].includes(mediaType)) {
      setResult({ key: requestKey, candidates: [], loading: false });
      return undefined;
    }

    const generation = ++generationRef.current;
    let cancelled = false;
    const isCurrent = () => !cancelled && generation === generationRef.current;
    setResult((current) => ({
      key: requestKey,
      candidates: current.key.startsWith(`${mediaType}:${mediaId}:`) ? current.candidates : [],
      loading: true,
    }));

    (async () => {
      let titleVideos = [];
      let seasonVideos = [];

      try {
        const primary = await tmdbFetch(`/${mediaType}/${mediaId}/videos`, apiKey);
        if (!isCurrent()) return;
        titleVideos = Array.isArray(primary?.results) ? primary.results : [];

        if (!hasPlayableTrailerVideo(titleVideos) && originalLanguage) {
          try {
            const fallback = await tmdbFetch(
              `/${mediaType}/${mediaId}/videos`,
              apiKey,
              { language: originalLanguage },
            );
            if (!isCurrent()) return;
            titleVideos = mergeTrailerVideos(
              titleVideos,
              Array.isArray(fallback?.results) ? fallback.results : [],
            );
          } catch {}
        }

        if (mediaType === "tv" && (visible || !hasPlayableTrailerVideo(titleVideos))) {
          const seasons = [...new Set(
            visible ? [Number(selectedSeason) || 1] : [Number(selectedSeason) || 1, latestSeason],
          )].filter((season) => season > 0).slice(0, 2);

          const settled = await Promise.allSettled(seasons.map(async (season) => {
            const response = await tmdbFetch(
              `/tv/${mediaId}/season/${season}/videos`,
              apiKey,
              originalLanguage ? { language: originalLanguage } : {},
            );
            return (response?.results || []).map((video) => ({ ...video, seasonNum: season }));
          }));
          if (!isCurrent()) return;
          seasonVideos = settled.flatMap((entry) => entry.status === "fulfilled" ? entry.value : []);
        }
      } catch {}

      if (!isCurrent()) return;
      setResult({
        key: requestKey,
        candidates: normalizeTrailerCandidates(
          titleVideos,
          seasonVideos,
          preferredLanguage,
          originalLanguage,
        ),
        loading: false,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [apiKey, latestSeason, mediaId, mediaType, originalLanguage, preferredLanguage, requestKey, selectedSeason, visible]);

  const sameMedia = result.key.startsWith(`${mediaType}:${mediaId}:`);
  if (!sameMedia) return { key: requestKey, candidates: [], loading: true };
  return result.key === requestKey ? result : { ...result, key: requestKey, loading: true };
}
