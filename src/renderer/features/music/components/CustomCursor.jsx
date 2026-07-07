import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';

export default function CustomCursor() {
  const cursorRef = useRef(null);

  useEffect(() => {
    const cursor = cursorRef.current;
    if (!cursor) return;

    // Move cursor
    const onMouseMove = (e) => {
      gsap.to(cursor, {
        x: e.clientX,
        y: e.clientY,
        duration: 0.1,
        ease: "power2.out"
      });
    };

    // Hover effects
    const onMouseOver = (e) => {
      if (e.target.closest('button, a, input, .planet-card, .star-card, .constellation-card, .moon-track-item')) {
        cursor.classList.add('hovering');
      }
    };
    const onMouseOut = (e) => {
      if (e.target.closest('button, a, input, .planet-card, .star-card, .constellation-card, .moon-track-item')) {
        cursor.classList.remove('hovering');
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseover', onMouseOver);
    window.addEventListener('mouseout', onMouseOut);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseover', onMouseOver);
      window.removeEventListener('mouseout', onMouseOut);
    };
  }, []);

  return <div ref={cursorRef} className="music-planet-cursor" />;
}
