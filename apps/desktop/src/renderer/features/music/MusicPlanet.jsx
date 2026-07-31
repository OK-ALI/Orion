import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MusicHeader from "./components/MusicHeader";
import CustomCursor from "./components/CustomCursor";
import MusicRoutes from "./MusicRoutes";
import MusicPlanetSceneEngine from "./visual/MusicPlanetSceneEngine";
import IntroSection from "./planet-sections/IntroSection";
import NowPlayingSection from "./planet-sections/NowPlayingSection";
import LibrarySection from "./planet-sections/LibrarySection";
import AlbumsSection from "./planet-sections/AlbumsSection";
import ArtistsSection from "./planet-sections/ArtistsSection";
import PlaylistsSection from "./planet-sections/PlaylistsSection";
import FavoritesSection from "./planet-sections/FavoritesSection";
import SourcesSection from "./planet-sections/SourcesSection";
import { useMusic } from "./context/MusicProvider";
import "../../styles/features/music/layout.css";
import "../../styles/features/music/planet.css";
import "../../styles/features/music/planet-v2.css";
import "../../styles/features/music/planet-bridge.css";
import "../../styles/features/music/planet-polish.css";
import "../../styles/features/music/orbital-stage.css";

const DETAIL_PAGES = new Set([
  "music-search", "music-library", "music-playlists", "music-favorites",
  "music-sources", "music-settings", "music-artist", "music-album", "music-now-playing",
]);

const MUSIC_HOME_SCROLL_KEY = "orion:music-home-scroll";

function readMusicHomeScroll() {
  try {
    const raw = window.sessionStorage?.getItem(MUSIC_HOME_SCROLL_KEY);
    if (!raw) return { top: 0, chapter: "home", chapterOffset: 0 };
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return {
      top: Math.max(0, Number(parsed.top) || 0),
      chapter: typeof parsed.chapter === "string" ? parsed.chapter : "home",
      chapterOffset: Number(parsed.chapterOffset) || 0,
    };
    const legacy = Number(parsed);
    if (Number.isFinite(legacy)) return { top: Math.max(0, legacy), chapter: "home", chapterOffset: 0 };
  } catch {}
  return { top: 0, chapter: "home", chapterOffset: 0 };
}

function persistMusicHomeScroll(value) {
  try { window.sessionStorage?.setItem(MUSIC_HOME_SCROLL_KEY, JSON.stringify(value)); }
  catch {}
}

function rememberMusicHomeScroll(container) {
  if (!container) return null;
  const root = container.getBoundingClientRect();
  const marker = root.top + Math.min(160, root.height * 0.25);
  const sections = [...container.querySelectorAll("[data-scene-state]")];
  const chapter = sections.filter((section) => {
    const rect = section.getBoundingClientRect();
    return rect.top <= marker && rect.bottom > marker;
  }).at(-1) || sections[0];
  const chapterTop = chapter ? container.scrollTop + chapter.getBoundingClientRect().top - root.top : 0;
  const value = {
    top: Math.max(0, Math.round(container.scrollTop)),
    chapter: chapter?.id || "home",
    chapterOffset: Math.round(container.scrollTop - chapterTop),
  };
  persistMusicHomeScroll(value);
  return value;
}

function useMusicDashboard() {
  const [dashboard, setDashboard] = useState({ status: "idle", value: null, error: "" });
  const [requestId, setRequestId] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setDashboard({ status: "loading", value: null, error: "" });
    window.electron?.musicGetDashboard?.()
      .then((result) => {
        if (cancelled) return;
        if (result?.ok) setDashboard({ status: result.partial ? "partial" : "ready", value: result.dashboard,
          error: result.partial ? "Some discovery signals could not be reached." : "" });
        else setDashboard({ status: "error", value: null, error: result?.error || "Music discovery is unavailable." });
      })
      .catch((error) => {
        if (!cancelled) setDashboard({ status: "error", value: null, error: error?.message || "Music discovery is unavailable." });
      });
    return () => { cancelled = true; };
  }, [requestId]);

  return { ...dashboard, retry: () => setRequestId((value) => value + 1) };
}

function useLocalMusicPreview() {
  const [tracks, setTracks] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    window.electron?.musicListTracks?.({ limit: 24 }).then((value) => setTracks(value || [])).catch(() => {});
    window.electron?.musicListPlaylists?.().then((value) => setPlaylists(value || [])).catch(() => {});
    window.electron?.musicListHistory?.(24).then((value) => setHistory(value || [])).catch(() => {});
  }, []);

  return { tracks, playlists, history };
}

function useSceneFromScroll(containerRef, defaultScene) {
  const [sceneState, setSceneState] = useState(defaultScene);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const sections = [...container.querySelectorAll("[data-scene-state]")];
    if (!sections.length) return undefined;
    const updateSceneFromPosition = () => {
      const root = container.getBoundingClientRect();
      const marker = root.top + Math.min(160, root.height * 0.25);
      const visible = sections.filter((section) => {
        const rect = section.getBoundingClientRect();
        return rect.top <= marker && rect.bottom > marker;
      }).at(-1) || [...sections].sort((left, right) => {
        const leftDistance = Math.abs(left.getBoundingClientRect().top - marker);
        const rightDistance = Math.abs(right.getBoundingClientRect().top - marker);
        return leftDistance - rightDistance;
      })[0];
      const next = visible?.dataset?.sceneState;
      if (next) {
        setSceneState(next);
        window.dispatchEvent(new CustomEvent("orion:music-chapter-change", {
          detail: { chapter: visible.id || "home" },
        }));
      }
    };
    const observer = new IntersectionObserver(updateSceneFromPosition, { root: container, threshold: [0, 0.25, 0.5, 0.75] });
    sections.forEach((section) => observer.observe(section));
    container.addEventListener("scroll", updateSceneFromPosition, { passive: true });
    updateSceneFromPosition();
    return () => {
      observer.disconnect();
      container.removeEventListener("scroll", updateSceneFromPosition);
    };
  }, [containerRef, defaultScene]);

  return [sceneState, setSceneState];
}

export default function MusicPlanet({ page, selected, onNavigate }) {
  const music = useMusic();
  const scrollRef = useRef(null);
  const pendingHomeScrollRef = useRef(true);
  const requestedChapterRef = useRef(null);
  const savedHomeScrollRef = useRef(null);
  if (savedHomeScrollRef.current === null) savedHomeScrollRef.current = readMusicHomeScroll();
  const activeHomeChapterRef = useRef(savedHomeScrollRef.current.chapter || "home");
  const dashboard = useMusicDashboard();
  const { tracks, playlists, history } = useLocalMusicPreview();
  const [sceneState, setSceneState] = useSceneFromScroll(scrollRef, "idle-space");
  const showDetail = DETAIL_PAGES.has(page);
  const musicAppearance = {
    "data-music-display-font": music.visualPreferences.displayFont,
    "data-music-display-scale": music.visualPreferences.displayScale,
    "data-music-glass-density": music.visualPreferences.glassDensity,
  };

  const favoriteTracks = useMemo(() => {
    const favorites = music.favorites?.tracks || [];
    return favorites.map((item) => item.track || item)
      .filter((item) => item?.id && item?.title && (item.artistName || item.albumTitle || item.provider))
      .slice(0, 12);
  }, [music.favorites?.tracks]);

  const scrollToChapter = useCallback((chapter, { instant = false } = {}) => {
    const container = scrollRef.current;
    const target = document.getElementById(chapter || "home");
    if (!container || !target || !container.contains(target)) return;
    pendingHomeScrollRef.current = false;
    requestedChapterRef.current = chapter || "home";
    activeHomeChapterRef.current = chapter || "home";
    const root = container.getBoundingClientRect();
    const targetTop = container.scrollTop + target.getBoundingClientRect().top - root.top;
    const requested = { top: Math.max(0, Math.round(targetTop)), chapter: chapter || "home", chapterOffset: 0 };
    savedHomeScrollRef.current = requested;
    persistMusicHomeScroll(requested);
    window.dispatchEvent(new CustomEvent("orion:music-chapter-change", {
      detail: { chapter: chapter || "home" },
    }));
    const reduced = music.visualPreferences.reduceMotion;
    target.scrollIntoView({ behavior: instant || reduced ? "auto" : "smooth", block: "start" });
  }, [music.visualPreferences.reduceMotion]);

  useEffect(() => {
    if (showDetail) return undefined;
    const container = scrollRef.current;
    if (!container) return undefined;
    let frame = 0;
    const remember = () => {
      if (pendingHomeScrollRef.current) return;
      if (requestedChapterRef.current) {
        const requested = document.getElementById(requestedChapterRef.current);
        const root = container.getBoundingClientRect();
        if (requested && Math.abs(requested.getBoundingClientRect().top - root.top) >= 120) return;
        requestedChapterRef.current = null;
      }
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        savedHomeScrollRef.current = rememberMusicHomeScroll(container) || savedHomeScrollRef.current;
      });
    };
    container.addEventListener("scroll", remember, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      if (!pendingHomeScrollRef.current) {
        persistMusicHomeScroll(savedHomeScrollRef.current);
      }
      container.removeEventListener("scroll", remember);
    };
  }, [showDetail]);

  useEffect(() => {
    if (showDetail) pendingHomeScrollRef.current = true;
  }, [showDetail]);

  useEffect(() => {
    if (showDetail || selected?.musicChapter || !pendingHomeScrollRef.current) return undefined;
    const saved = savedHomeScrollRef.current || readMusicHomeScroll();
    if (saved.top <= 0 && saved.chapter === "home") {
      pendingHomeScrollRef.current = false;
      return undefined;
    }
    let cancelled = false;
    const restore = () => {
      const container = scrollRef.current;
      if (cancelled || !container) return;
      const chapterCandidate = saved.chapter && saved.chapter !== "home" ? document.getElementById(saved.chapter) : null;
      const chapter = chapterCandidate && container.contains(chapterCandidate) ? chapterCandidate : null;
      const root = container.getBoundingClientRect();
      const chapterTop = chapter ? container.scrollTop + chapter.getBoundingClientRect().top - root.top : saved.top;
      const targetScroll = chapter ? chapterTop + saved.chapterOffset : saved.top;
      const maximum = Math.max(0, container.scrollHeight - container.clientHeight);
      container.scrollTop = Math.min(targetScroll, maximum);
      const dashboardSettled = !["idle", "loading"].includes(dashboard.status);
      if (dashboardSettled) pendingHomeScrollRef.current = false;
    };
    const frame = window.requestAnimationFrame(restore);
    const timers = [60, 180, 420].map((delay) => window.setTimeout(restore, delay));
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [dashboard.status, playlists.length, selected?.musicChapter, showDetail, tracks.length]);

  useEffect(() => {
    const onScrollChapter = (event) => scrollToChapter(event.detail?.chapter);
    window.addEventListener("orion:music-scroll-chapter", onScrollChapter);
    return () => window.removeEventListener("orion:music-scroll-chapter", onScrollChapter);
  }, [scrollToChapter]);

  useEffect(() => {
    const rememberActiveChapter = (event) => {
      if (!showDetail && event.detail?.chapter) activeHomeChapterRef.current = event.detail.chapter;
    };
    window.addEventListener("orion:music-chapter-change", rememberActiveChapter);
    return () => window.removeEventListener("orion:music-chapter-change", rememberActiveChapter);
  }, [showDetail]);

  useEffect(() => {
    if (showDetail || !selected?.musicChapter) return undefined;
    pendingHomeScrollRef.current = false;
    const restore = () => scrollToChapter(selected.musicChapter, { instant: true });
    const frame = window.requestAnimationFrame(restore);
    const timers = [80, 240, 600].map((delay) => window.setTimeout(restore, delay));
    return () => {
      window.cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [dashboard.status, scrollToChapter, selected?.musicChapter, showDetail]);

  useEffect(() => {
    if (!showDetail) return;
    const sceneByPage = {
      "music-now-playing": "now-playing",
      "music-library": "library",
      "music-playlists": "playlists",
      "music-favorites": "playlists",
      "music-album": "albums",
      "music-artist": "artists",
      "music-sources": "queue-satellites",
      "music-settings": "lyrics-rings",
    };
    setSceneState(sceneByPage[page] || "idle-space");
  }, [page, setSceneState, showDetail]);

  const handleSearch = (query) => onNavigate("music-search", { query });

  return (
    <div className="music-planet-container" {...musicAppearance}>
      <CustomCursor reducedMotion={music.visualPreferences.reduceMotion} />
      <MusicPlanetSceneEngine
        sceneState={sceneState}
        visualPreferences={music.visualPreferences}
      />
      <MusicHeader onNavigate={(targetPage, targetData) => onNavigate(
        targetPage,
        targetPage === "music-settings"
          ? { ...(targetData || {}), returnChapter: activeHomeChapterRef.current || "home" }
          : targetData,
      )} showSearch={showDetail && page !== "music-search"} />

      {showDetail ? (
        <main className="music-planet-detail-overlay">
          <button className="detail-back-button" onClick={() => {
            onNavigate("music-home", {
              musicChapter: selected?.returnChapter || activeHomeChapterRef.current || "home",
            });
          }} aria-label="Back to Music Planet">
            ← Music Planet
          </button>
          <MusicRoutes page={page} selected={selected} onNavigate={onNavigate} />
        </main>
      ) : (
        <main ref={scrollRef} className="music-planet-scroll-area">
          <IntroSection onSearch={handleSearch} />
          <NowPlayingSection music={music} onNavigate={onNavigate} />
          <LibrarySection tracks={tracks} history={history} onNavigate={onNavigate} />
          <AlbumsSection dashboard={dashboard} onNavigate={onNavigate} />
          <ArtistsSection dashboard={dashboard} onNavigate={onNavigate} />
          <PlaylistsSection playlists={playlists} onNavigate={onNavigate} />
          <FavoritesSection tracks={favoriteTracks} onNavigate={onNavigate} />
          <SourcesSection onNavigate={onNavigate} />
        </main>
      )}

    </div>
  );
}
