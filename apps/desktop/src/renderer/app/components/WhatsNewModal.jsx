const FEATURES = [
  {
    id: "music",
    title: "Music Planet",
    copy: "Search, play and organize music with the living Orb, lyrics, radio, playlists and a complete player dock.",
  },
  {
    id: "cinema",
    title: "Cinema evolved",
    copy: "Constellation, cast discovery, protected downloads, playback continuity and local media remain together in the story world.",
  },
  {
    id: "sync",
    title: "One Orion backup",
    copy: "Your portable Cinema and Music preferences, playlists, favorites, queue and history can travel through your Google account.",
  },
];

function FeatureIcon({ id }) {
  const paths = {
    music: <><circle cx="12" cy="12" r="7" /><path d="M5 12h14M12 5c2.5 2.1 2.5 11.9 0 14" /><path d="M8 9c1.4-1.7 6.6-1.7 8 0" /></>,
    cinema: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m8 5 2.5 4L13 5l2.5 4L18 5" /><path d="m10 11 5 3-5 3Z" /></>,
    sync: <><path d="M7 18a4 4 0 0 1-.4-8A6 6 0 0 1 18 9.5 4.5 4.5 0 0 1 17.5 18Z" /><path d="m9 14 2 2 4-5" /></>,
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[id]}
    </svg>
  );
}

/** Displays the current Orion edition once per installed release. */
export default function WhatsNewModal({ version, onEnterMusic, onContinueCinema }) {
  return (
    <div className="whats-new-overlay" role="dialog" aria-modal="true" aria-labelledby="whats-new-title">
      <section className="whats-new-modal">
        <div className="whats-new-orbit" aria-hidden="true"><span /><i /><i /></div>
        <div className="whats-new-badge">Orion X Music Planet · v{version || "2.0.0"}</div>
        <header>
          <p>A universe made to be felt.</p>
          <h1 id="whats-new-title">Two worlds. One Orion.</h1>
          <span>Cinema carries the stories. Music Planet carries their pulse.</span>
        </header>
        <div className="whats-new-features">
          {FEATURES.map((feature) => (
            <article key={feature.id}>
              <span className={`whats-new-feature-icon is-${feature.id}`}><FeatureIcon id={feature.id} /></span>
              <div><h2>{feature.title}</h2><p>{feature.copy}</p></div>
            </article>
          ))}
        </div>
        <footer>
          <button className="whats-new-cinema" onClick={onContinueCinema}>Continue to Cinema</button>
          <button className="whats-new-music" onClick={onEnterMusic}><span aria-hidden="true">♪</span> Enter Music Planet</button>
        </footer>
      </section>
    </div>
  );
}
