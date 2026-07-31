import React, { useEffect, useRef } from 'react';

export default function CustomCursor({ reducedMotion = false }) {
  const cursorRef = useRef(null);

  useEffect(() => {
    const cursor = cursorRef.current;
    const finePointer = window.matchMedia?.("(pointer: fine)");
    const systemReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!cursor || reducedMotion || !finePointer?.matches || systemReducedMotion?.matches) return undefined;

    document.documentElement.classList.add("music-custom-cursor-active");

    let frame = 0;
    let position = { x: 0, y: 0 };

    const onMouseMove = (e) => {
      position = { x: e.clientX, y: e.clientY };
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        cursor.style.transform = `translate3d(${position.x}px, ${position.y}px, 0) translate(-50%, -50%)`;
        frame = 0;
      });
    };

    // Hover effects
    const interactiveSelector = [
      "button",
      "a",
      "input",
      ".planet-card",
      ".star-card",
      ".constellation-card",
      ".moon-track-item",
      ".music-signal-card",
      ".music-orbital-search",
      ".glass-music-player",
      ".music-track-list button",
    ].join(", ");

    const onMouseOver = (e) => {
      if (e.target.closest(interactiveSelector)) {
        cursor.classList.add('hovering');
      }
    };
    const onMouseOut = (e) => {
      if (e.target.closest(interactiveSelector)) {
        cursor.classList.remove('hovering');
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseover', onMouseOver);
    window.addEventListener('mouseout', onMouseOut);

    return () => {
      document.documentElement.classList.remove("music-custom-cursor-active");
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseover', onMouseOver);
      window.removeEventListener('mouseout', onMouseOut);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [reducedMotion]);

  return <div ref={cursorRef} className="music-planet-cursor" />;
}
