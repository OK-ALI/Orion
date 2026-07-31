export function MusicStageSkeleton({ variant = "rail", count = 4 }) {
  return <div className={`music-stage-skeleton is-${variant}`} role="status" aria-label="Loading Music content">
    {Array.from({ length: count }, (_, index) => <i key={index} aria-hidden="true" />)}
  </div>;
}

export function MusicStageState({ state, title, message, onRetry, actions, variant = "rail" }) {
  if (state === "loading") return <MusicStageSkeleton variant={variant} />;
  return <div className={`music-stage-state is-${state || "empty"}`} role={state === "error" ? "alert" : "status"}>
    <span className="music-stage-state-orbit" aria-hidden="true"><i /></span>
    <div>
      <strong>{title}</strong>
      {message && <p>{message}</p>}
      <div className="music-stage-state-actions">
        {onRetry && <button type="button" onClick={onRetry}>Retry</button>}
        {actions}
      </div>
    </div>
  </div>;
}

export default function MusicOrbitalStage({ id, sceneState, eyebrow, title, description, anchor = "right",
  action, state = "ready", stateTitle, stateMessage, onRetry, stateActions, skeleton = "rail", children }) {
  const showContent = state === "ready" || state === "partial";
  return <section className={`music-planet-section music-orbital-stage anchor-${anchor}`} id={id} data-scene-state={sceneState} data-orb-anchor={anchor}>
    <header className="music-stage-heading">
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {action && <div className="music-stage-heading-action">{action}</div>}
    </header>
    <div className={`music-stage-lens state-${state}`}>
      {showContent ? children : <MusicStageState state={state} title={stateTitle} message={stateMessage}
        onRetry={onRetry} actions={stateActions} variant={skeleton} />}
    </div>
  </section>;
}
