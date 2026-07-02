import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PersonCard from "../../../components/media/PersonCard";
import { storage, STORAGE_KEYS } from "../../../services/settingsStore";
import ConstellationEditorial from "./ConstellationEditorial";
import ConstellationFilters from "./ConstellationFilters";
import { DEFAULT_CONSTELLATION_PREFERENCES, getConstellationCinema } from "./manifest";
import { fetchCinemaConstellationPool, fetchPersonalConstellation, filterConstellationPeople, getCachedConstellationPool, mergeConstellationPeople, mergeConstellationPools, setCachedConstellationPool } from "./service";

function initialPreferences() {
  const saved = storage.get(STORAGE_KEYS.CONSTELLATION_PREFERENCES);
  return { ...DEFAULT_CONSTELLATION_PREFERENCES, ...(saved && typeof saved === "object" ? saved : {}) };
}

export default function ConstellationPage({ apiKey, history = [], saved = [], offline = false, onNavigate }) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [query, setQuery] = useState("");
  const [pool, setPool] = useState(null);
  const [personalPeople, setPersonalPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [personalLoading, setPersonalLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [progressivePeople, setProgressivePeople] = useState([]);
  const [error, setError] = useState("");
  const [usingCache, setUsingCache] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const requestRef = useRef(0);

  const updatePreference = useCallback((key, value) => {
    setPreferences((current) => {
      const next = { ...current, [key]: value };
      storage.set(STORAGE_KEYS.CONSTELLATION_PREFERENCES, next);
      return next;
    });
  }, []);

  useEffect(() => {
    const requestId = ++requestRef.current;
    const cached = getCachedConstellationPool(preferences.cinema);
    setPool(cached);
    setUsingCache(Boolean(cached && offline));
    setError("");
    setProgress(null);
    setProgressivePeople([]);
    if (cached) {
      setLoading(false);
      return undefined;
    }
    if (offline || !apiKey) {
      setLoading(false);
      if (!cached) setError("Constellation is unavailable offline until this cinema has been mapped once.");
      return undefined;
    }
    setLoading(!cached);
    fetchCinemaConstellationPool({
      cinemaId: preferences.cinema,
      page: 1,
      apiKey,
      onProgress: (next) => {
        if (requestRef.current !== requestId) return;
        setProgress(next);
        if (!cached && next.people?.length) setPool({ cinemaId: preferences.cinema, people: next.people, seedPage: 1, totalPages: 1, partialFailures: 0 });
      },
    }).then((nextPool) => {
      if (requestRef.current !== requestId) return;
      setPool(nextPool);
      setCachedConstellationPool(nextPool);
    }).catch((reason) => {
      if (requestRef.current !== requestId) return;
      if (!cached) setError(reason?.message || "This constellation could not be mapped.");
      else setError("Showing the saved constellation because fresh results could not be loaded.");
    }).finally(() => {
      if (requestRef.current === requestId) { setLoading(false); setProgress(null); }
    });
    return () => { if (requestRef.current === requestId) requestRef.current += 1; };
  }, [apiKey, offline, preferences.cinema, retryKey]);

  useEffect(() => {
    if (preferences.cinema !== "global" || offline || !apiKey) { setPersonalPeople([]); return undefined; }
    let active = true;
    setPersonalLoading(true);
    fetchPersonalConstellation({ history, saved, apiKey })
      .then((people) => { if (active) setPersonalPeople(people.slice(0, 12)); })
      .catch(() => { if (active) setPersonalPeople([]); })
      .finally(() => { if (active) setPersonalLoading(false); });
    return () => { active = false; };
  }, [apiKey, history, offline, preferences.cinema, saved]);

  const catalogPeople = useMemo(() => mergeConstellationPeople(pool?.people || [], progressivePeople), [pool, progressivePeople]);
  const displayed = useMemo(() => filterConstellationPeople(catalogPeople, { craft: preferences.craft, media: preferences.media, sort: preferences.sort, query }), [catalogPeople, preferences, query]);
  const defaultView = preferences.cinema === "global" && preferences.craft === "all" && preferences.media === "all" && !query.trim();
  const canLoadMore = Boolean(pool && pool.seedPage < pool.totalPages);
  const openPerson = useCallback((person) => onNavigate("person", person), [onNavigate]);

  const loadMore = async () => {
    if (!canLoadMore || loading || offline) return;
    const requestId = ++requestRef.current;
    setLoading(true); setError(""); setProgressivePeople([]);
    try {
      const next = await fetchCinemaConstellationPool({ cinemaId: preferences.cinema, page: pool.seedPage + 1, apiKey, onProgress: (value) => {
        if (requestRef.current !== requestId) return;
        setProgress(value);
        if (value.people?.length) setProgressivePeople(value.people);
      } });
      if (requestRef.current !== requestId) return;
      const merged = mergeConstellationPools(pool, next);
      setPool(merged); setCachedConstellationPool(merged);
    } catch (reason) {
      if (requestRef.current === requestId) setError(reason?.message || "More people could not be mapped.");
    } finally {
      if (requestRef.current === requestId) { setLoading(false); setProgress(null); setProgressivePeople([]); }
    }
  };

  return (
    <div className="constellation-page fade-in">
      <header className="constellation-header"><span className="eyebrow">People of cinema</span><h1>Constellation</h1><p>Discover the performers and creators behind every story</p></header>
      <ConstellationFilters preferences={preferences} query={query} onPreference={updatePreference} onQuery={setQuery} />
      {usingCache && <div className="constellation-notice">{offline ? "Offline — showing a saved constellation." : "Showing saved people while Orion refreshes this constellation."}</div>}
      {error && <div className="constellation-warning"><span>{error}</span><button type="button" className="btn btn-ghost" onClick={() => setRetryKey((value) => value + 1)} disabled={offline}>Retry</button></div>}
      {pool?.partialFailures > 0 && <div className="constellation-warning">Some credits could not be mapped. The successful people are still shown.</div>}
      {progress && <div className="constellation-progress"><span className="spinner" /><span>{progress.phase === "discovering" ? "Finding regional titles" : "Mapping title credits"}… {progress.completed}/{progress.total}</span></div>}
      {defaultView && <ConstellationEditorial people={pool?.people || []} personalPeople={personalPeople} personalLoading={personalLoading} onSelect={openPerson} />}
      <section className="constellation-section constellation-catalog">
        <div className="constellation-section-heading"><div><span className="eyebrow">{getConstellationCinema(preferences.cinema).label}</span><h2>{query ? "Filtered people" : "People catalog"}</h2></div><span>{displayed.length} mapped</span></div>
        {loading && !pool && <div className="constellation-grid constellation-grid--loading">{Array.from({ length: 12 }, (_, index) => <span key={index} />)}</div>}
        {!loading && !displayed.length && <div className="constellation-empty"><h3>No people match these filters</h3><p>{pool ? "Try another craft, media influence, or search phrase." : "This constellation has no saved results yet."}</p></div>}
        {displayed.length > 0 && <div className="constellation-grid">{displayed.map((person) => <PersonCard key={person.id} person={person} subtitle={`${person.known_for_department || "Person"}${person.contributionCount ? ` · ${person.contributionCount} ${person.contributionCount === 1 ? "title" : "titles"}` : ""}`} onSelect={openPerson} />)}</div>}
        {canLoadMore && <div className="constellation-load-more"><button type="button" className="btn btn-secondary" onClick={loadMore} disabled={loading || offline}>{loading ? "Mapping…" : "Load more"}</button></div>}
        {!canLoadMore && pool && !loading && <p className="constellation-exhausted">You have reached the end of the mapped pool.</p>}
      </section>
    </div>
  );
}
