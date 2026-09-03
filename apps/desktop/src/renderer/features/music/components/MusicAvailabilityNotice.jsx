export default function MusicAvailabilityNotice({ connectionState = "offline" }) {
  return <div className="music-provider-warning" role="status" aria-live="polite" aria-label="Music availability">
    {connectionState === "offline" ? "You’re offline." : connectionState === "reconnecting" ? "Reconnecting." : "Checking connection."} Local Music is available. Remote search, discovery and tracks require a connection.
  </div>;
}
