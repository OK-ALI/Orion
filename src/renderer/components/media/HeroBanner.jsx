import { useState, useEffect, useCallback, useRef } from "react";
import { imgUrl } from "../../services/tmdb";
import { PlayIcon, StarIcon } from "../common/Icons";

export default function HeroBanner({ items, onSelect, onSave, isSaved }) {
  const [active, setActive] = useState(0);
  const cycleRef = useRef(null);

  const count = items?.length || 0;

  const startCycle = useCallback(() => {
    clearInterval(cycleRef.current);
    if (count <= 1) return;
    cycleRef.current = setInterval(() => {
      setActive((prev) => (prev + 1) % count);
    }, 8000);
  }, [count]);

  useEffect(() => {
    startCycle();
    return () => clearInterval(cycleRef.current);
  }, [startCycle]);

  const handleDot = (idx) => {
    setActive(idx);
    startCycle(); // reset timer
  };

  if (!items || count === 0) return null;

  const activeItem = items[active];
  const title = activeItem.title || activeItem.name;
  const year = (activeItem.release_date || activeItem.first_air_date || "").slice(0, 4);
  const poster = imgUrl(activeItem.backdrop_path, "original");

  return (
    <div className="hero-banner">
      <div className="hero-banner-slides">
        {items.map((item, idx) => (
          <div
            key={item.id}
            className={`hero-banner-slide${active === idx ? " active" : ""}`}
            style={{
              backgroundImage: `url(${imgUrl(item.backdrop_path, "original")})`,
            }}
          />
        ))}
      </div>
      <div className="hero-banner-gradient" />
      <div className="hero-banner-content">
        <div className="hero-banner-tag">
          Spotlight · {activeItem.media_type === "tv" ? "TV Series" : "Movie"}
        </div>
        <h1 className="hero-banner-title">{title}</h1>
        <div className="hero-banner-meta">
          {activeItem.vote_average > 0 && (
            <span className="hero-banner-rating">
              <StarIcon size={14} /> {activeItem.vote_average.toFixed(1)}
            </span>
          )}
          {year && <span>{year}</span>}
        </div>
        <p className="hero-banner-overview">{activeItem.overview}</p>
        <div className="hero-banner-actions">
          <button
            className="btn btn-primary"
            onClick={() => onSelect(activeItem)}
          >
            <PlayIcon size={16} /> Play
          </button>
          {onSave && (
            <button
              className="btn btn-secondary"
              onClick={() => onSave(activeItem)}
            >
              {isSaved?.(activeItem) ? "✓ In My List" : "＋ My List"}
            </button>
          )}
        </div>
      </div>

      <div className="hero-banner-dots">
        {Array.from({ length: count }).map((_, idx) => (
          <button
            key={idx}
            className={`hero-banner-dot${active === idx ? " active" : ""}`}
            onClick={() => handleDot(idx)}
            aria-label={`Spotlight slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
