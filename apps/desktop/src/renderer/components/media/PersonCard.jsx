import { imgUrl } from "../../services/tmdb";

function knownForText(person) {
  return (person.known_for || [])
    .map((item) => item.title || item.name)
    .filter(Boolean)
    .slice(0, 3)
    .join(" · ");
}

export default function PersonCard({ person, onSelect, compact = false, subtitle = "" }) {
  const knownFor = !subtitle ? knownForText(person) : "";
  const supportingText = subtitle || person.known_for_department || "Person";
  return (
    <button
      type="button"
      className={`person-card${compact ? " person-card--compact" : ""}`}
      onClick={() => onSelect?.(person)}
      aria-label={`Open ${person.name || "person"}`}
    >
      <span className="person-card__portrait">
        {person.profile_path ? (
          <img src={imgUrl(person.profile_path, compact ? "w185" : "h632")} alt="" loading="lazy" />
        ) : (
          <span className="person-card__placeholder" aria-hidden="true">
            {(person.name || "?").slice(0, 1).toUpperCase()}
          </span>
        )}
      </span>
      <span className="person-card__copy">
        <strong>{person.name || "Unknown person"}</strong>
        <small>{supportingText}</small>
        {knownFor && <small className="person-card__known-for">Known for {knownFor}</small>}
      </span>
    </button>
  );
}
