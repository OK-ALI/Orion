import MusicArtwork from "./MusicArtwork";
import "../../../styles/features/music/detail-surface.css";

export default function MusicEntityHero({
  eyebrow,
  title,
  subtitle,
  facts = [],
  variant = "album",
  artworkTrack,
  artworkLabel,
  children,
}) {
  const visibleFacts = facts.filter(Boolean);

  return (
    <header className={`music-entity-hero is-${variant}`}>
      <MusicArtwork
        variant={variant}
        className="music-entity-artwork"
        track={artworkTrack}
        label={artworkLabel}
      />
      <div className="music-entity-copy">
        {eyebrow && <span className="music-eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {subtitle && <p className="music-entity-subtitle">{subtitle}</p>}
        {visibleFacts.length > 0 && (
          <div className="music-entity-facts" aria-label="Details">
            {visibleFacts.map((fact) => <span key={fact}>{fact}</span>)}
          </div>
        )}
        {children}
      </div>
    </header>
  );
}
