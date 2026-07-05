import { useEffect, useRef } from "react";
import { useMusic } from "../context/MusicProvider";
import MusicPlanetSceneEngine from "../visual/MusicPlanetSceneEngine";

const getTargetState = (page, panel) => {
  if (panel === "queue") return "queue-satellites";
  if (panel === "lyrics") return "lyrics-rings";

  switch (page) {
    case "music-home":
      return "idle-space";
    case "music-library":
      return "library-galaxy";
    case "music-playlists":
      return "playlist-constellation";
    case "music-favorites":
      return "memory-trails";
    case "music-artist":
      return "artist-stars";
    case "music-album":
      return "album-orbits";
    case "music-now-playing":
      return "now-playing-core";
    case "music-search":
      return "enter-music-planet";
    default:
      return "idle-space";
  }
};

export default function MusicBackground({ page }) {
  const { playing, artwork, visualPreferences, visualBus, panel } = useMusic();
  const canvasRef = useRef(null);
  const engineRef = useRef(null);

  // 1. Initialize Scene Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const engine = new MusicPlanetSceneEngine(canvas, {
      lowGpu: visualPreferences.lowGpu,
      reduceMotion: visualPreferences.reduceMotion,
      staticBg: visualPreferences.staticBg,
      disableAudioReactivity: visualPreferences.disableAudioReactiveBg,
      batterySaver: visualPreferences.batterySaver,
      particleDensity: visualPreferences.particleDensity,
      intensity: visualPreferences.intensity
    });

    engineRef.current = engine;
    engine.updatePalette(artwork.palette);
    engine.setState("enter-music-planet");
    engine.start();

    const transitionTimer = setTimeout(() => {
      if (engineRef.current) {
        engineRef.current.setState(getTargetState(page, panel));
      }
    }, 900);

    const resizeObserver = new ResizeObserver(() => {
      if (engineRef.current) engineRef.current.resize();
    });
    resizeObserver.observe(canvas.parentElement || canvas);

    return () => {
      clearTimeout(transitionTimer);
      engine.stop();
      resizeObserver.disconnect();
      engineRef.current = null;
    };
  }, []);

  // 2. React to Artwork and Settings preferences changes
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.updatePalette(artwork.palette);
      engineRef.current.updateOptions({
        lowGpu: visualPreferences.lowGpu,
        reduceMotion: visualPreferences.reduceMotion,
        staticBg: visualPreferences.staticBg,
        disableAudioReactivity: visualPreferences.disableAudioReactiveBg,
        batterySaver: visualPreferences.batterySaver,
        particleDensity: visualPreferences.particleDensity,
        intensity: visualPreferences.intensity
      });
    }
  }, [artwork.palette, visualPreferences]);

  // 3. React to page / panel state changes (Transitions)
  useEffect(() => {
    if (engineRef.current) {
      // In the home page, the active sub-section determines the target state (handled by IntersectionObserver).
      // However, when first entering or closing sidebars, we sync with the page.
      const nextState = getTargetState(page, panel);
      engineRef.current.setState(nextState);
    }
  }, [page, panel]);

  // 4. Subscribe to Real-Time Audio Engine Frames
  useEffect(() => {
    if (!visualBus) return undefined;

    const unsubscribe = visualBus.subscribe((frame) => {
      if (engineRef.current) {
        engineRef.current.updateAudio(frame);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [visualBus]);

  // 5. Scroll IntersectionObserver for MusicHome sub-sections
  useEffect(() => {
    if (page !== "music-home") return undefined;

    const scrollContainer = document.querySelector(".music-planet-scrollable-content");
    if (!scrollContainer) return undefined;

    const handleIntersect = (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const sectionId = entry.target.getAttribute("data-scene-section");
          let targetState = "idle-space";
          
          switch (sectionId) {
            case "intro":
              targetState = "idle-space";
              break;
            case "history":
            case "favorites":
              targetState = "memory-trails";
              break;
            case "playlists":
              targetState = "playlist-constellation";
              break;
            case "library":
            case "sources":
              targetState = "library-galaxy";
              break;
            default:
              targetState = "idle-space";
          }

          if (engineRef.current && panel !== "queue" && panel !== "lyrics") {
            engineRef.current.setState(targetState);
          }
        }
      }
    };

    const observer = new IntersectionObserver(handleIntersect, {
      root: scrollContainer,
      threshold: 0.2
    });

    const sections = scrollContainer.querySelectorAll("[data-scene-section]");
    sections.forEach((sec) => observer.observe(sec));

    const handleScroll = () => {
      const scrollTop = scrollContainer.scrollTop;
      const scrollHeight = scrollContainer.scrollHeight - scrollContainer.clientHeight;
      const progress = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
      if (engineRef.current) {
        engineRef.current.updateScroll(progress);
      }
    };
    scrollContainer.addEventListener("scroll", handleScroll);

    return () => {
      observer.disconnect();
      scrollContainer.removeEventListener("scroll", handleScroll);
    };
  }, [page, panel]);

  const style = {
    "--music-base": artwork?.palette?.base || "transparent",
    "--music-primary": artwork?.palette?.primary || "transparent"
  };

  return (
    <div className={`music-background ${playing ? "is-playing" : "is-idle"}`} style={style}>
      <div className="music-aurora" aria-hidden="true"><i /><i /><i /></div>
      <canvas ref={canvasRef} className="music-planet-canvas" />
    </div>
  );
}
