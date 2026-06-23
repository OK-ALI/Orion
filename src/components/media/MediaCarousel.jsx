import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { imgUrl, isAnimeContent } from "../../utils/api";
import { StarIcon, ChevronLeftIcon, ChevronRightIcon } from "../common/Icons";

const VISIBLE = 5;
const HALF = Math.floor(VISIBLE / 2);

function visibilityRatio(el, scrollRoot) {
  const r = el.getBoundingClientRect();
  const rootTop = scrollRoot ? scrollRoot.getBoundingClientRect().top : 0;
  const rootHeight = scrollRoot
    ? scrollRoot.getBoundingClientRect().height
    : window.innerHeight;
  const visTop = Math.max(r.top, rootTop);
  const visBottom = Math.min(r.bottom, rootTop + rootHeight);
  const px = Math.max(0, visBottom - visTop);
  return r.height > 0 ? px / r.height : 0;
}

const RatingBadge = memo(function RatingBadge({ cert, restricted }) {
  if (!cert) return null;
  return (
    <span
      className={`media-carousel-rating-badge${restricted ? " restricted" : ""}`}
      title={restricted ? "Age-restricted" : `Rated ${cert}`}
    >
      {cert}
    </span>
  );
});

const CarouselSlot = memo(function CarouselSlot({
  item,
  offset,
  onSelect,
  onFocus,
  animating,
  ageRating,
  restricted,
  isAnime,
}) {
  if (!item) return null;
  const isCenter = offset === 0;
  const abs = Math.abs(offset);
  const title = item.title || item.name;
  const year = (item.release_date || item.first_air_date || "").slice(0, 4);
  const poster = imgUrl(item.poster_path, "w342");

  const scale = isCenter ? 1 : abs === 1 ? 0.76 : 0.55;
  const opacity = isCenter ? 1 : abs === 1 ? 0.65 : 0.35;
  const tx = offset * 210;

  const rawDate = item.release_date || item.first_air_date;
  const isUnreleased = useMemo(() => {
    if (!rawDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(rawDate) > today;
  }, [rawDate]);

  const releaseLabel = useMemo(
    () =>
      rawDate
        ? new Date(rawDate).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : null,
    [rawDate],
  );

  return (
    <div
      className={`media-carousel-item${isCenter ? " active" : ""}${animating ? " animating" : ""}`}
      style={{
        transform: `translateX(${tx}px) scale(${scale})`,
        opacity,
        zIndex: isCenter ? 10 : abs === 1 ? 6 : 2,
        cursor: "pointer",
        pointerEvents: "auto",
      }}
      onClick={isCenter ? onSelect : onFocus}
    >
      <div className="media-carousel-poster-wrap">
        {poster ? (
          <img
            src={poster}
            alt={title}
            className="media-carousel-poster"
            draggable={false}
            loading={abs > 1 ? "lazy" : "eager"}
          />
        ) : (
          <div className="media-carousel-poster placeholder">
            <span>{title}</span>
          </div>
        )}

        {isUnreleased && (
          <div className="media-carousel-unreleased-overlay">
            <span className="media-carousel-unreleased-label">🔒 Coming Soon</span>
            {releaseLabel && (
              <span className="media-carousel-unreleased-date">{releaseLabel}</span>
            )}
          </div>
        )}

        {item.vote_average > 0 && (
          <div className="media-carousel-score">
            <StarIcon size={10} />
            {item.vote_average.toFixed(1)}
          </div>
        )}
        <div className="media-carousel-badge-wrap">
          <RatingBadge cert={ageRating} restricted={restricted} />
        </div>
        {isAnime && (
          <div className="media-carousel-anime-badge">ANIME</div>
        )}
      </div>

      <div className="media-carousel-info">
        <div className="media-carousel-info-title">{title}</div>
        <div className="media-carousel-info-meta">
          {year && <span>{year}</span>}
          {item.media_type && (
            <span className="media-carousel-info-type">
              {item.media_type === "tv" ? "Series" : "Movie"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

export default function MediaCarousel({
  items,
  onSelect,
  title,
  titleHighlight,
  ratingsMap = {},
}) {
  const count = items.length;
  const activeRef = useRef(0);
  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState(1);
  const [animating, setAnimating] = useState(false);

  const intervalRef = useRef(null);
  const isFocusedRef = useRef(false);
  const wheelThrottle = useRef(false);
  const touchStartX = useRef(null);
  const containerRef = useRef(null);
  const animTimeout = useRef(null);
  const sectionRef = useRef(null);

  const go = useCallback(
    (idx) => {
      const next = ((idx % count) + count) % count;
      const curr = activeRef.current;
      if (next === curr) return;
      const fwd = (next - curr + count) % count;
      setDirection(fwd <= count / 2 ? 1 : -1);
      setAnimating(true);
      clearTimeout(animTimeout.current);
      animTimeout.current = setTimeout(() => setAnimating(false), 420);
      activeRef.current = next;
      setActive(next);
    },
    [count],
  );

  const goNext = useCallback(() => go(activeRef.current + 1), [go]);
  const goPrev = useCallback(() => go(activeRef.current - 1), [go]);

  const isHoveredRef = useRef(false);

  const handleMouseEnter = useCallback(() => {
    isHoveredRef.current = true;
    clearInterval(intervalRef.current);
  }, []);

  const startCycle = useCallback(() => {
    clearInterval(intervalRef.current);
    if (isHoveredRef.current) return;
    intervalRef.current = setInterval(() => go(activeRef.current + 1), 4500);
  }, [go]);

  const handleMouseLeave = useCallback(() => {
    isHoveredRef.current = false;
    startCycle();
  }, [startCycle]);

  const resetInterval = useCallback(() => startCycle(), [startCycle]);

  useEffect(() => {
    if (count <= 1) return;
    startCycle();
    const sectionEl = sectionRef.current;
    if (!sectionEl) return;
    const scrollRoot = document.querySelector(".app-content");

    const updateFocus = () => {
      const should = visibilityRatio(sectionEl, scrollRoot) > 0.1;
      if (should && !isFocusedRef.current) {
        isFocusedRef.current = true;
        startCycle();
      } else if (!should && isFocusedRef.current) {
        isFocusedRef.current = false;
        clearInterval(intervalRef.current);
      }
    };

    const scrollEl = scrollRoot || window;
    scrollEl.addEventListener("scroll", updateFocus, { passive: true });
    window.addEventListener("resize", updateFocus, { passive: true });

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          isFocusedRef.current = false;
          clearInterval(intervalRef.current);
        } else {
          updateFocus();
        }
      },
      { root: scrollRoot, threshold: 0 },
    );
    observer.observe(sectionEl);

    const id = requestAnimationFrame(updateFocus);

    return () => {
      scrollEl.removeEventListener("scroll", updateFocus);
      window.removeEventListener("resize", updateFocus);
      observer.disconnect();
      cancelAnimationFrame(id);
      clearInterval(intervalRef.current);
    };
  }, [count, startCycle]);

  const handleWheel = useCallback(
    (e) => {
      const isHorizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      if (!isHorizontal) return;

      e.preventDefault();
      if (wheelThrottle.current) return;
      wheelThrottle.current = true;
      setTimeout(() => {
        wheelThrottle.current = false;
      }, 600);
      if (e.deltaX > 0) {
        goNext();
      } else {
        goPrev();
      }
      resetInterval();
    },
    [goNext, goPrev, resetInterval],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const onTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);
  const onTouchEnd = useCallback(
    (e) => {
      if (touchStartX.current === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      touchStartX.current = null;
      if (Math.abs(dx) < 40) return;
      dx < 0 ? goNext() : goPrev();
      resetInterval();
    },
    [goNext, goPrev, resetInterval],
  );

  const handlePrev = useCallback(() => {
    goPrev();
    resetInterval();
  }, [goPrev, resetInterval]);
  const handleNext = useCallback(() => {
    goNext();
    resetInterval();
  }, [goNext, resetInterval]);
  const handleDot = useCallback(
    (i) => {
      go(i);
      resetInterval();
    },
    [go, resetInterval],
  );

  const slots = useMemo(
    () =>
      Array.from({ length: VISIBLE }, (_, i) => {
        const offset = i - HALF;
        const idx = (((active + offset) % count) + count) % count;
        return { offset, idx };
      }),
    [active, count],
  );

  const slotHandlers = useMemo(() => {
    const handlers = {};
    for (let i = 0; i < VISIBLE; i++) {
      const offset = i - HALF;
      const idx = (((active + offset) % count) + count) % count;
      if (offset === 0) {
        handlers[offset] = {
          onSelect: () => onSelect(items[idx]),
          onFocus: null,
        };
      } else {
        const captured = idx;
        handlers[offset] = {
          onSelect: null,
          onFocus: () => {
            go(captured);
            resetInterval();
          },
        };
      }
    }
    return handlers;
  }, [active, count, items, onSelect, go, resetInterval]);

  const activeItem = items[active];
  const activeType = activeItem?.media_type === "tv" ? "tv" : "movie";
  const activeRatingKey = activeItem ? `${activeType}_${activeItem.id}` : null;
  const activeRating = activeRatingKey ? ratingsMap[activeRatingKey] || {} : {};

  const dotCount = Math.min(count, 15);

  if (!items || count === 0) return null;

  return (
    <div className="media-carousel-section" ref={sectionRef}>
      <div className="section-title">
        {titleHighlight ? (
          <>
            {title}&nbsp;
            <span style={{ color: "var(--accent)" }}>{titleHighlight}</span>
          </>
        ) : (
          title
        )}
      </div>

      <div
        className="media-carousel-wrapper"
        ref={containerRef}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <button
          className="media-carousel-btn left"
          onClick={handlePrev}
          aria-label="Previous"
        >
          <ChevronLeftIcon size={22} />
        </button>

        <div
          className={`media-carousel-track${animating ? ` dir-${direction > 0 ? "fwd" : "bwd"}` : ""}`}
        >
          {slots.map(({ offset, idx }) => {
            const item = items[idx];
            const type = item.media_type === "tv" ? "tv" : "movie";
            const ratingKey = `${type}_${item.id}`;
            const ratingData = ratingsMap[ratingKey] || {};
            const h = slotHandlers[offset];
            return (
              <CarouselSlot
                key={"slot_" + item.id + "_" + idx}
                item={item}
                offset={offset}
                onSelect={h.onSelect}
                onFocus={h.onFocus}
                animating={animating}
                ageRating={ratingData.cert}
                restricted={ratingData.restricted || false}
                isAnime={isAnimeContent(item)}
              />
            );
          })}
        </div>

        <button
          className="media-carousel-btn right"
          onClick={handleNext}
          aria-label="Next"
        >
          <ChevronRightIcon size={22} />
        </button>
      </div>

      <div className="media-carousel-dots">
        {Array.from({ length: dotCount }, (_, i) => (
          <button
            key={`dot-${i}`}
            className={`media-carousel-dot${active === i ? " active" : ""}`}
            onClick={() => handleDot(i)}
            aria-label={`Go to ${i + 1}`}
          />
        ))}
        {count > 15 && (
          <span className="media-carousel-dots-more">+{count - 15}</span>
        )}
      </div>
    </div>
  );
}
