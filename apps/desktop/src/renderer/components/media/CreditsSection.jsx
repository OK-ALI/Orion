import { useState } from "react";
import PersonCard from "./PersonCard";

export default function CreditsSection({ cast = [], keyCrew = [], loading = false, onPersonSelect }) {
  const [showAll, setShowAll] = useState(false);
  if (loading) return <section className="credits-section" aria-label="Loading cast and crew"><div className="credits-section__heading"><h2>Cast &amp; crew</h2></div><div className="credits-rail credits-rail--loading">{Array.from({ length: 6 }, (_, index) => <span key={index} />)}</div></section>;
  if (!cast.length && !keyCrew.length) return null;
  const visibleCast = showAll ? cast : cast.slice(0, 12);
  return (
    <section className="credits-section" aria-labelledby="credits-heading">
      <div className="credits-section__heading">
        <h2 id="credits-heading">Cast &amp; crew</h2>
        {cast.length > 12 && (
          <button type="button" className="btn btn-ghost btn--sm" onClick={() => setShowAll((value) => !value)}>
            {showAll ? "Show less" : `View all ${cast.length}`}
          </button>
        )}
      </div>
      {visibleCast.length > 0 && (
        <div className="credits-rail" aria-label="Cast">
          {visibleCast.map((person, index) => (
            <PersonCard
              key={`${person.id}_${person.character || index}`}
              person={person}
              subtitle={person.character ? `as ${person.character}` : "Cast"}
              compact
              onSelect={onPersonSelect}
            />
          ))}
        </div>
      )}
      {keyCrew.length > 0 && (
        <div className="key-crew" aria-label="Key crew">
          {keyCrew.map((person) => (
            <button type="button" key={`${person.id}_${person.job}`} onClick={() => onPersonSelect?.(person)}>
              <span>{person.job}</span><strong>{person.name}</strong>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
