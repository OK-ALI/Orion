import { useEffect, useRef, useState } from "react";
import "./startup.css";

const LETTERS = [..."ORION"];

export default function StartupIntro({ reducedMotion = false, onComplete }) {
  const [exiting, setExiting] = useState(false);
  const completeRef = useRef(onComplete);

  useEffect(() => {
    completeRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const revealDuration = reducedMotion ? 180 : 1120;
    const exitDuration = reducedMotion ? 130 : 300;
    const exitTimer = window.setTimeout(() => setExiting(true), revealDuration);
    const completeTimer = window.setTimeout(
      () => completeRef.current?.(),
      revealDuration + exitDuration,
    );
    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(completeTimer);
    };
  }, [reducedMotion]);

  return (
    <div
      className={`orion-startup-intro${exiting ? " is-exiting" : ""}${reducedMotion ? " is-reduced" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="Orion is starting"
    >
      <div className="orion-startup-aura" aria-hidden="true" />
      <div className="orion-startup-content">
        <img className="orion-startup-mark" src="./brand-mark.png" alt="" draggable="false" />
        <div className="orion-startup-word" aria-hidden="true">
          {LETTERS.map((letter, index) => (
            <span key={`${letter}-${index}`} style={{ "--startup-letter": index }}>
              {letter}
            </span>
          ))}
        </div>
        <p className="orion-startup-tagline">A universe made to be felt.</p>
      </div>
    </div>
  );
}
