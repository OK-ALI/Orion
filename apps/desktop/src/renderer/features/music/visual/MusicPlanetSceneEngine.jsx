import React, { lazy, Suspense, useEffect, useMemo, useRef } from "react";
import { useMusic } from "../context/MusicProvider";
import { usePerformanceTier } from "../../../shared/utils/usePerformanceTier";
import { MUSIC_ORB_PLACEMENT, resolveMusicSceneParticleCount, resolveMusicVisualBudget } from "./musicPerformanceBudget";

const QualityThreeScene = lazy(() => import("./MusicPlanetThreeScene"));

function LightweightMusicOrb({
  visualBus,
  color,
  visualIntensity = 0.65,
  audioReactive = true,
}) {
  const orb = useRef();

  useEffect(() => {
    const element = orb.current;
    if (!element) return undefined;

    let frame = visualBus?.getFrame?.() || null;
    let drawId = 0;

    const draw = () => {
      drawId = 0;
      const bass = audioReactive ? (frame?.bass || 0) * visualIntensity : 0;
      const energy = audioReactive ? (frame?.energy || 0) * visualIntensity : 0;
      const beat = audioReactive ? (frame?.beat || 0) * visualIntensity : 0;
      const scale = 1 + bass * 0.08 + beat * 0.06;
      element.style.transform = `translate(-50%, -50%) scale(${scale.toFixed(3)})`;
      element.style.opacity = String(Math.min(0.92, 0.64 + energy * 0.22 + beat * 0.08));
    };

    draw();

    if (!audioReactive || !visualBus?.subscribe) return undefined;

    const unsubscribe = visualBus.subscribe((next) => {
      frame = next;
      if (!drawId) drawId = window.requestAnimationFrame(draw);
    });

    return () => {
      unsubscribe();
      window.cancelAnimationFrame(drawId);
    };
  }, [audioReactive, visualBus, visualIntensity]);

  return (
    <div
      aria-hidden="true"
      className="music-lite-reactive-orb"
      style={{
        position: "absolute",
        left: MUSIC_ORB_PLACEMENT.left,
        top: MUSIC_ORB_PLACEMENT.top,
        width: "min(22vw, 320px)",
        aspectRatio: "1",
        borderRadius: "50%",
        background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,.9) 0 7%, ${color} 34%, transparent 74%)`,
        boxShadow: `0 0 42px ${color}`,
        opacity: 0.64,
        transform: "translate(-50%, -50%)",
        willChange: "transform, opacity",
        pointerEvents: "none",
      }}
    />
  );
}

function resolveSceneColor(colorStr, fallback) {
  if (!colorStr || typeof colorStr !== "string") return fallback;
  let color = colorStr.trim();

  if (color.startsWith("var(")) {
    const varName = color.slice(4, -1).trim();
    const resolved = typeof window !== "undefined"
      ? window.getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
      : "";
    color = resolved || fallback;
  }

  const srgbMatch = color.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/i);
  if (srgbMatch) {
    const r = Math.round(parseFloat(srgbMatch[1]) * 255);
    const g = Math.round(parseFloat(srgbMatch[2]) * 255);
    const b = Math.round(parseFloat(srgbMatch[3]) * 255);
    return `rgb(${r}, ${g}, ${b})`;
  }

  return color;
}

export default function MusicPlanetSceneEngine({ sceneState = "idle-space", visualPreferences = {} }) {
  const { visualBus, artwork } = useMusic();
  const performanceTier = usePerformanceTier();
  const budget = resolveMusicVisualBudget(performanceTier, visualPreferences);

  const sceneConfig = {
    "idle-space": { color: "#050508", starColor: "#5c60f5", speed: 0.05 },
    library: { color: "#0a0a14", starColor: "#7d5fff", speed: 0.1 },
    playlists: { color: "#07070d", starColor: "#8b7cf6", speed: 0.08 },
    favorites: { color: "#090711", starColor: "#9b82f6", speed: 0.08 },
    albums: { color: "#1a0b12", starColor: "#e50914", speed: 0.15 },
    artists: { color: "#141405", starColor: "#ffd700", speed: 0.07 },
    "now-playing": { color: "#05020a", starColor: "#b779f7", speed: 0.2 },
    "queue-satellites": { color: "#05020b", starColor: "#a020f0", speed: 0.18 },
    "lyrics-rings": { color: "#050509", starColor: "#e6e2ef", speed: 0.12 },
  };

  const config = sceneConfig[sceneState] || sceneConfig["idle-space"];
  const effectiveStarColor = useMemo(
    () => resolveSceneColor(artwork?.palette?.primary || config.starColor, config.starColor),
    [artwork?.palette?.primary, config.starColor],
  );

  const requestedSceneStyle = visualPreferences.sceneStyle || "aurora";
  const renderMode = visualPreferences.staticBg ? "static" : budget.sceneMode;
  const sceneStyle = renderMode === "full" ? requestedSceneStyle : "minimal";
  const count = renderMode === "full"
    ? resolveMusicSceneParticleCount(visualPreferences, budget)
    : 0;
  const audioReactive = !visualPreferences.disableAudioReactiveBg
    && visualPreferences.atmosphere !== "off"
    && !visualPreferences.reduceMotion;
  const visualIntensity = Math.max(
    0,
    Math.min(1, Number(visualPreferences.intensity ?? 65) / 100),
  );
  const sceneColor = renderMode === "full" ? config.color : "var(--mp-bg)";

  const lightweightFallback = (
    <LightweightMusicOrb
      visualBus={visualBus}
      color={effectiveStarColor}
      visualIntensity={visualIntensity}
      audioReactive={audioReactive}
    />
  );

  return (
    <div
      className="music-planet-canvas-container"
      data-scene-style={sceneStyle}
      data-scene-state={sceneState}
      data-performance-tier={budget.tier}
      data-music-render-mode={renderMode}
      data-scene-fps={budget.sceneFps}
      data-scene-loop={budget.sceneLoop}
      style={{ "--music-scene-color": sceneColor }}
    >
      {renderMode === "full" && (
        <Suspense fallback={lightweightFallback}>
          <QualityThreeScene
            visualBus={audioReactive ? visualBus : null}
            sceneSpeed={config.speed}
            count={count}
            starColor={effectiveStarColor}
            visualIntensity={visualIntensity}
            segments={budget.sphereSegments}
            placement={MUSIC_ORB_PLACEMENT}
          />
        </Suspense>
      )}
      {renderMode === "orb" && lightweightFallback}
    </div>
  );
}
