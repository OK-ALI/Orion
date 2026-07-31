import { useEffect, useMemo, useState } from "react";
import { tmdbFetch } from "../../services/tmdb";
import { extractKeyCrew, normalizePersonSummary } from "../utils/credits";

export function useTitleCredits({ mediaType, mediaId, apiKey, creators = [] }) {
  const [credits, setCredits] = useState({ cast: [], crew: [] });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setCredits({ cast: [], crew: [] });
    setLoading(true);
    tmdbFetch(`/${mediaType}/${mediaId}/credits`, apiKey)
      .then((data) => { if (active) setCredits({ cast: data.cast || [], crew: data.crew || [] }); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [apiKey, mediaId, mediaType]);

  const cast = useMemo(() => credits.cast
    .filter((person) => person.id != null)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    .map((person) => ({ ...normalizePersonSummary(person), character: person.character || "" })), [credits.cast]);
  const keyCrew = useMemo(() => extractKeyCrew(credits.crew, creators), [credits.crew, creators]);
  return { cast, keyCrew, loading };
}
