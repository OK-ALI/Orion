import { imgUrl } from "../../services/tmdb";
import { getSearchResultIdentity } from "../../services/search";

export function SearchMediaContext({ result, duplicateTitle = false }) {
  const identity = getSearchResultIdentity(result, duplicateTitle);
  return (
    <div className="search-media-context">
      <span>{identity.facts.join(" · ") || (result.media_type === "tv" ? "TV series" : "Movie")}</span>
      {identity.duplicateTitle && <strong>Same-title match</strong>}
      {identity.supportingText && <small>{identity.supportingLabel}: {identity.supportingText}</small>}
    </div>
  );
}

export default function SearchResultRow({ result, active, duplicateTitle, onActivate, onHover }) {
  const identity = getSearchResultIdentity(result, duplicateTitle);
  const isPerson = result.media_type === "person";
  const imagePath = result.poster_path || result.profile_path;
  const typeLabel = isPerson ? "Person" : result.media_type === "tv" ? "Series" : "Movie";
  return (
    <button
      type="button"
      id={`quick-search-${result.media_type}-${result.id}`}
      className={`search-result${active ? " active" : ""}${isPerson ? " search-result--person" : ""}`}
      onMouseEnter={onHover}
      onClick={onActivate}
    >
      <span className="search-result-image">
        {imagePath ? <img src={imgUrl(imagePath, "w92")} alt="" /> : <span>{identity.title.slice(0, 1).toUpperCase()}</span>}
      </span>
      <span className="search-result-info">
        <span className="search-result-title-line">
          <strong className="search-result-title">{identity.title}</strong>
          {identity.duplicateTitle && <span className="search-result-match-note">Same-title match</span>}
        </span>
        <span className="search-result-facts">
          {identity.facts.map((fact) => <span key={fact}>{fact}</span>)}
        </span>
        {identity.supportingText && <span className="search-result-supporting"><b>{identity.supportingLabel}</b>{identity.supportingText}</span>}
      </span>
      <span className={`search-result-type ${isPerson ? "type-person" : result.media_type === "tv" ? "type-tv" : "type-movie"}`}>{typeLabel}</span>
    </button>
  );
}
