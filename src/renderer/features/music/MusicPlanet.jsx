import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import '../../styles/features/music/planet-v2.css';
import { useMusic } from './context/MusicProvider';
import MusicRoutes from './MusicRoutes';
import { computeThemeTokens } from './visual/musicThemeTokens';

import IntroSection from './planet-sections/IntroSection';
import LibrarySection from './planet-sections/LibrarySection';
import PlaylistsSection from './planet-sections/PlaylistsSection';
import AlbumsSection from './planet-sections/AlbumsSection';
import ArtistsSection from './planet-sections/ArtistsSection';
import NowPlayingSection from './planet-sections/NowPlayingSection';
import FavoritesSection from './planet-sections/FavoritesSection';
import SourcesSection from './planet-sections/SourcesSection';
import PluginsSection from './planet-sections/PluginsSection';
import CustomCursor from './components/CustomCursor';

const MusicPlanetSceneEngine = lazy(() => import('./visual/MusicPlanetSceneEngine'));

gsap.registerPlugin(ScrollTrigger);

const getTargetState = (page, panel) => {
  if (panel === "queue") return "queue-satellites";
  if (panel === "lyrics") return "lyrics-rings";
  switch (page) {
    case "music-artist": return "artists";
    case "music-album": return "albums";
    case "music-search": return "library";
    case "music-playlist": return "playlists";
    default: return null;
  }
};

export default function MusicPlanet({ page, selected, onNavigate }) {
  const [scrollSceneState, setScrollSceneState] = useState('idle-space');
  const scrollAreaRef = useRef(null);
  const { visualPreferences, panel, ...music } = useMusic();
  
  const homePages = ['music-home', 'music-planet', 'music-library', 'music-playlists', 'music-favorites', 'music-sources', 'music-plugins'];
  const isHome = homePages.includes(page);
  const effectiveSceneState = getTargetState(page, panel) || scrollSceneState;
  
  // Data state
  const [data, setData] = useState({ tracks: [], history: [], favorites: [], playlists: [], providers: [], dashboard: { sections: [], errors: [] } });
  const [isFetchingData, setIsFetchingData] = useState(false);

  // Fetch data
  useEffect(() => {
    if (!isHome) return;
    setIsFetchingData(true);
    Promise.all([
      window.electron?.musicListTracks?.({ limit: 18 }) || [], window.electron?.musicListHistory?.(12) || [],
      window.electron?.musicListFavorites?.() || [], window.electron?.musicListPlaylists?.() || [],
      window.electron?.musicListProviders?.() || [],
      window.electron?.musicGetDashboard?.() || { sections: [], errors: [] }
    ]).then(([tracks, history, favorites, playlists, providers, dashboard]) => {
      setData({ tracks, history, favorites, playlists, providers, dashboard });
    }).catch(() => {}).finally(() => setIsFetchingData(false));
  }, [isHome]);

  // Scroll triggers for background states
  useEffect(() => {
    if (!scrollAreaRef.current || !isHome) return;

    const sections = gsap.utils.toArray('.music-planet-section');
    const triggers = [];

    sections.forEach((section) => {
      const stateId = section.getAttribute('data-scene-state');
      if (stateId) {
        const trigger = ScrollTrigger.create({
          trigger: section,
          scroller: scrollAreaRef.current,
          start: "top center",
          end: "bottom center",
          onEnter: () => setScrollSceneState(stateId),
          onEnterBack: () => setScrollSceneState(stateId),
        });
        triggers.push(trigger);
      }
    });

    return () => {
      triggers.forEach(t => t.kill());
    };
  }, [isHome, isFetchingData]); // Re-run when fetching completes so scroll triggers calculate correct heights

  // Auto-scroll to #now-playing when music changes
  const previousTrackId = useRef(music.current?.id);
  useEffect(() => {
    if (!isHome) return;
    if (music.current && music.current.id !== previousTrackId.current) {
      previousTrackId.current = music.current.id;
      const el = document.getElementById("now-playing");
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [music.current?.id, isHome]);

  // Auto-scroll for Sidebar Navigation
  useEffect(() => {
    if (!isHome || page === 'music-home' || page === 'music-planet') return;
    const targetId = page.replace('music-', '');
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [page, isHome, isFetchingData]);

  const handleSearch = (query) => {
    onNavigate("music-search", { query });
  };

  const loadingStatus = isFetchingData || music.playbackStatus === 'loading' || music.playbackStatus === 'buffering';
  const themeStyles = computeThemeTokens(music.artwork?.palette, effectiveSceneState);

  return (
    <div className="music-planet-container" style={themeStyles}>
      <CustomCursor />
      <Suspense fallback={null}>
        <MusicPlanetSceneEngine sceneState="idle-space" visualPreferences={visualPreferences} loadingStatus={false} />
      </Suspense>

      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(10, 10, 10, 0.4)",
        zIndex: 9999,
        padding: 24,
        textAlign: "center",
        backdropFilter: "blur(4px)"
      }}>
        <div style={{
          background: "rgba(18, 18, 18, 0.8)",
          backdropFilter: "blur(20px)",
          border: "1.5px solid rgba(0, 168, 255, 0.15)",
          boxShadow: "0 20px 50px rgba(0,0,0,0.5), 0 0 40px rgba(0, 168, 255, 0.1)",
          padding: "48px 40px",
          borderRadius: 24,
          maxWidth: 460,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20
        }}>
          {/* Pulsing Space Globe Icon */}
          <div style={{
            width: 70,
            height: 70,
            borderRadius: "50%",
            background: "rgba(0, 168, 255, 0.1)",
            border: "1.5px solid rgba(0, 168, 255, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#00a8ff",
            boxShadow: "0 0 20px rgba(0,168,255,0.2)",
            marginBottom: 8
          }}>
            <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              <path d="M2 12h20"/>
            </svg>
          </div>

          <h2 style={{ fontSize: 26, fontWeight: 900, color: "#fff", letterSpacing: "-0.5px", margin: 0 }}>
            Music Planet
          </h2>
          
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "1px",
            color: "#00a8ff",
            background: "rgba(0, 168, 255, 0.08)",
            padding: "4px 12px",
            borderRadius: 999
          }}>
            Coming Soon
          </div>

          <p style={{ fontSize: 13, color: "var(--text3)", lineHeight: 1.6, margin: "10px 0 20px 0" }}>
            We are currently cultivating the atmosphere. Music Planet is under active construction to bring you a premium, zero-lag dynamic streaming and audio curation experience. Stay tuned!
          </p>

          <button
            className="btn btn-primary"
            onClick={() => onNavigate("home")}
            style={{
              width: "100%",
              padding: "12px 24px",
              borderRadius: 8,
              background: "var(--accent)",
              border: "none",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 4px 15px rgba(0, 168, 255, 0.25)"
            }}
          >
            Return to Cinema
          </button>
        </div>
      </div>
    </div>
  );
}
