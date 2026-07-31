import { SearchIcon } from "../../../components/common/Icons";
import { CONSTELLATION_CINEMAS, CONSTELLATION_CRAFTS, CONSTELLATION_MEDIA, CONSTELLATION_SORTS } from "./manifest";

function FilterTabs({ label, items, value, onChange }) {
  return <div className="constellation-filter-group"><span className="constellation-filter-label">{label}</span><div className="constellation-tabs" role="tablist" aria-label={label}>{items.map((item) => <button key={item.id} type="button" role="tab" aria-selected={value === item.id} className={value === item.id ? "active" : ""} onClick={() => onChange(item.id)}>{item.label}</button>)}</div></div>;
}

export default function ConstellationFilters({ preferences, query, onPreference, onQuery }) {
  return (
    <section className="constellation-filters" aria-label="Constellation filters">
      <FilterTabs label="Cinema" items={CONSTELLATION_CINEMAS} value={preferences.cinema} onChange={(value) => onPreference("cinema", value)} />
      <div className="constellation-filter-row">
        <FilterTabs label="Craft" items={CONSTELLATION_CRAFTS} value={preferences.craft} onChange={(value) => onPreference("craft", value)} />
        <FilterTabs label="Media influence" items={CONSTELLATION_MEDIA} value={preferences.media} onChange={(value) => onPreference("media", value)} />
        <label className="constellation-sort">Sort<select value={preferences.sort} onChange={(event) => onPreference("sort", event.target.value)}>{CONSTELLATION_SORTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      </div>
      <label className="constellation-search"><SearchIcon size={18} /><span className="sr-only">Search people</span><input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search this constellation and all people…" /></label>
      <p className="constellation-search-note">Mapped matches respect these filters. Orion also searches TMDB globally so missing people appear immediately.</p>
    </section>
  );
}
