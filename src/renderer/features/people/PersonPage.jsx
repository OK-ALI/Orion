import { useEffect, useMemo, useRef, useState } from "react";
import MediaCard from "../../components/media/MediaCard";
import { imgUrl, tmdbFetch } from "../../services/tmdb";
import { normalizeCombinedCredits, selectKnownFor } from "../../shared/utils/credits";

function yearOf(item) {
  return String(item.release_date || "").slice(0, 4);
}

export default function PersonPage({ item, apiKey, onNavigate, onBack }) {
  const [details, setDetails] = useState(null);
  const [credits, setCredits] = useState([]);
  const [filter, setFilter] = useState("all");
  const [expandedBio, setExpandedBio] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fatalError, setFatalError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  useEffect(() => {
    if (!error) return undefined;
    const retry = () => setRetryKey((value) => value + 1);
    window.addEventListener("orion:network-restored", retry, { once: true });
    return () => window.removeEventListener("orion:network-restored", retry);
  }, [error]);
  const requestRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestRef.current;
    setLoading(true); setError(""); setFatalError(false); setDetails(null); setCredits([]); setFilter("all");
    Promise.allSettled([
      tmdbFetch(`/person/${item.id}`, apiKey),
      tmdbFetch(`/person/${item.id}/combined_credits`, apiKey),
    ]).then(([personResult, creditsResult]) => {
      if (requestRef.current !== requestId) return;
      const hasDetails = personResult.status === "fulfilled";
      const hasCredits = creditsResult.status === "fulfilled";
      if (hasDetails) setDetails(personResult.value);
      if (hasCredits) setCredits(normalizeCombinedCredits(creditsResult.value));
      if (!hasDetails && !hasCredits) {
        setFatalError(true);
        setError("This person could not be loaded. Check your connection and try again.");
      } else if (!hasDetails) {
        setError("Profile details are temporarily unavailable. Filmography is still shown below.");
      } else if (!hasCredits) {
        setError("Filmography is temporarily unavailable. Profile details are still available.");
      }
      setLoading(false);
    });
    return () => { requestRef.current += 1; };
  }, [item.id, apiKey, retryKey]);

  const person = details || item;
  const knownFor = useMemo(() => selectKnownFor(credits, 12), [credits]);
  const filmography = useMemo(() => credits
    .filter((credit) => filter === "all" || credit.media_type === filter)
    .sort((a, b) => (b.release_date || "").localeCompare(a.release_date || "")), [credits, filter]);
  const biography = person.biography || "No biography is currently available.";

  if (loading) return <div className="person-page person-page--loading"><span className="spinner" /><p>Loading person details…</p></div>;
  if (fatalError) return <div className="person-page person-page--error"><button type="button" className="btn btn-ghost person-page__back" onClick={onBack}>← Back</button><div className="person-error-state"><h1>Person unavailable</h1><p>{error}</p><button type="button" className="btn btn-primary" onClick={() => setRetryKey((value) => value + 1)}>Retry</button></div></div>;
  return (
    <div className="person-page fade-in">
      <button type="button" className="btn btn-ghost person-page__back" onClick={onBack}>← Back</button>
      <header className="person-hero">
        <div className="person-hero__portrait">
          {person.profile_path ? <img src={imgUrl(person.profile_path, "h632")} alt={person.name || ""} /> : <span>{(person.name || "?")[0]}</span>}
        </div>
        <div className="person-hero__copy">
          <span className="eyebrow">{person.known_for_department || "Person"}</span>
          <h1>{person.name || "Unknown person"}</h1>
          <div className="person-facts">
            {person.birthday && <span>Born {person.birthday}</span>}
            {person.deathday && <span>Died {person.deathday}</span>}
            {person.place_of_birth && <span>{person.place_of_birth}</span>}
          </div>
          <p className={expandedBio ? "is-expanded" : ""}>{biography}</p>
          {biography.length > 420 && <button type="button" className="person-bio-toggle" onClick={() => setExpandedBio((value) => !value)}>{expandedBio ? "Show less" : "Read full biography"}</button>}
          {error && <div className="person-partial-warning">{error}</div>}
        </div>
      </header>

      {knownFor.length > 0 && <section className="person-section"><h2>Known for</h2><div className="scroll-row">{knownFor.map((credit) => <div className="person-credit" key={`${credit.media_type}_${credit.id}`}><MediaCard item={credit} onClick={() => onNavigate(credit.media_type, credit)} /><small>{[...(credit.roles || []), ...(credit.jobs || [])].slice(0, 2).join(" · ")}</small></div>)}</div></section>}

      <section className="person-section">
        <div className="person-section__heading"><h2>Filmography</h2><div className="person-filter-tabs" role="tablist" aria-label="Filmography type">{[["all", "All"], ["movie", "Movies"], ["tv", "TV"]].map(([value, label]) => <button type="button" role="tab" aria-selected={filter === value} className={filter === value ? "active" : ""} key={value} onClick={() => setFilter(value)}>{label}</button>)}</div></div>
        {filmography.length > 0 ? <div className="person-filmography">{filmography.map((credit) => <button type="button" className="filmography-row" key={`${credit.media_type}_${credit.id}`} onClick={() => onNavigate(credit.media_type, credit)}><span className="filmography-year">{yearOf(credit) || "—"}</span><span><strong>{credit.title}</strong><small>{[...(credit.roles || []), ...(credit.jobs || [])].join(" · ") || (credit.media_type === "tv" ? "TV series" : "Movie")}</small></span><em>{credit.media_type === "tv" ? "TV" : "Movie"}</em></button>)}</div> : <div className="person-empty">No {filter === "all" ? "filmography" : filter} credits are available.</div>}
      </section>
    </div>
  );
}
