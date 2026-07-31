import PersonCard from "../../../components/media/PersonCard";
import { imgUrl } from "../../../services/tmdb";

function PersonRail({ title, eyebrow, people, onSelect }) {
  if (!people.length) return null;
  return <section className="constellation-section"><div className="constellation-section-heading"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div></div><div className="constellation-rail">{people.map((person) => <PersonCard key={person.id} person={person} compact subtitle={person.known_for_department || "Person"} onSelect={onSelect} />)}</div></section>;
}

export default function ConstellationEditorial({ people, personalPeople, personalLoading, onSelect }) {
  const featured = people[0];
  if (!featured) return null;
  const knownFor = (featured.known_for || []).map((item) => item.title || item.name).filter(Boolean).slice(0, 3).join(" · ");
  return (
    <div className="constellation-editorial">
      <button type="button" className="constellation-feature" onClick={() => onSelect(featured)}>
        <span className="constellation-feature-portrait">{featured.profile_path ? <img src={imgUrl(featured.profile_path, "h632")} alt="" /> : <b>{featured.name?.[0] || "?"}</b>}</span>
        <span className="constellation-feature-copy"><span className="eyebrow">Featured person</span><strong>{featured.name}</strong><small>{featured.known_for_department || "Performer and creator"}</small>{knownFor && <em>Known for {knownFor}</em>}<span className="btn btn-primary">View profile</span></span>
      </button>
      <PersonRail title="Trending this week" people={people.slice(1, 13)} onSelect={onSelect} />
      {personalLoading ? <section className="constellation-section"><div className="constellation-section-heading"><div><span className="eyebrow">Personal to this device</span><h2>From Your Stories</h2></div></div><div className="constellation-rail constellation-rail--loading">{Array.from({ length: 6 }, (_, index) => <span key={index} />)}</div></section> : <PersonRail title="From Your Stories" eyebrow="Personal to this device" people={personalPeople} onSelect={onSelect} />}
    </div>
  );
}
