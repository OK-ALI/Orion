import "../../styles/components/cinema-availability.css";

export default function CinemaAvailabilityNotice({ activity, connectionState = "online", error = "", retained = false, onNavigate, onCheckConnection, onRetry }) {
  if (connectionState === "online" && !error) return null;
  const copy = {
    offline: ["You're offline", `Cinema ${activity} requires a connection. Your downloads and library remain available.`],
    checking: ["Checking connection", `Cinema ${activity} will be available when the connection is ready. Your downloads and library remain available.`],
    reconnecting: ["Reconnecting", `Cinema ${activity} will resume when the connection is ready. Your downloads and library remain available.`],
    degraded: ["Cinema service is limited", `Remote ${activity} may be limited. Your downloads and library remain available.`],
    online: [activity === "discovery" ? "Cinema discovery is limited" : "Cinema search is unavailable", error],
  }[connectionState];
  return (
    <section className="cinema-availability" aria-label={`Cinema ${activity} availability`}>
      <div role="status" aria-live="polite" aria-atomic="true">
        <h2>{copy[0]}</h2>
        <p>{copy[1]}</p>
        {retained && <p>Showing previously loaded discovery information; it may be out of date.</p>}
      </div>
      <div className="cinema-local-actions">
        {onNavigate && <>
          <button type="button" className="btn btn-secondary" onClick={() => onNavigate("downloads")}>Open Downloads</button>
          <button type="button" className="btn btn-secondary" onClick={() => onNavigate("library")}>Open Library</button>
        </>}
        {onCheckConnection && <button type="button" className="btn btn-ghost" onClick={onCheckConnection}>Check connection</button>}
        {error && onRetry && (connectionState === "online" || connectionState === "degraded") && <button type="button" className="btn btn-ghost" onClick={onRetry}>Retry</button>}
      </div>
    </section>
  );
}
