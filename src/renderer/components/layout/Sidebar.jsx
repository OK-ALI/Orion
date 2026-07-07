// ── Orion — Sidebar Navigation ────────────────────────────────────────────────
import { useState, useCallback } from "react";
import {
  HomeIcon,
  SearchIcon,
  CompassIcon,
  ConstellationIcon,
  LibraryIcon,
  DownloadIcon,
  SettingsIcon,
  BackIcon,
  HelpIcon,
  PinIcon,
  MusicPlanetIcon,
} from "../common/Icons";
import { storage } from "../../services/settingsStore";

const SIDEBAR_PINNED_KEY = "sidebarPinned";

const NAV_GROUPS = [
  {
    label: "Browse",
    items: [
  { id: "home", label: "Home", icon: HomeIcon },
  { id: "search", label: "Search", icon: SearchIcon },
  { id: "discover", label: "Discover", icon: CompassIcon },
  { id: "constellation", label: "Constellation", icon: ConstellationIcon },
    ],
  },
  {
    label: "Personal",
    items: [
  { id: "library", label: "My Library", icon: LibraryIcon },
  { id: "downloads", label: "Downloads", icon: DownloadIcon },
    ],
  },
];

const FOOTER_ITEMS = [
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

const MUSIC_ITEMS = [
  { id: "music-home", label: "Music Home", icon: MusicPlanetIcon },
  { id: "music-search", label: "Search", icon: SearchIcon },
  { id: "music-library", label: "Library", icon: LibraryIcon },
  { id: "music-playlists", label: "Playlists", icon: ConstellationIcon },
  { id: "music-favorites", label: "Favorites", icon: HomeIcon },
  { id: "music-sources", label: "Sources", icon: CompassIcon },
  { id: "music-plugins", label: "Plugins", icon: ConstellationIcon },
];

export default function Sidebar({
  activePage,
  page,
  onNavigate,
  onSearch,
  downloadCount = 0,
  activeDownloads = 0,
  canGoBack = false,
  onBack,
  onShowShortcuts,
  googleProfile,
}) {
  const [pinned, setPinned] = useState(() => !!storage.get(SIDEBAR_PINNED_KEY));
  const [peeking, setPeeking] = useState(false);
  const currentPage = activePage || page;
  const activeDownloadCount = downloadCount || activeDownloads;
  const expanded = pinned || peeking;
  const musicWorld = String(currentPage || "").startsWith("music-");

  const togglePinned = useCallback(() => {
    setPinned((prev) => {
      const next = !prev;
      storage.set(SIDEBAR_PINNED_KEY, next);
      return next;
    });
  }, []);

  return (
    <nav
      className={`sidebar${expanded ? " expanded" : ""}${pinned ? " pinned" : ""}`}
      onMouseEnter={() => setPeeking(true)}
      onMouseLeave={() => setPeeking(false)}
    >
      <button
        className="sidebar-edge-rail"
        onClick={togglePinned}
        aria-pressed={pinned}
        aria-label={pinned ? "Unpin and collapse sidebar" : "Pin sidebar open"}
        title={pinned ? "Unpin sidebar" : "Pin sidebar open"}
      />

      <div className="sidebar-brand-row">
        <button
          className="sidebar-brand sidebar-brand-text"
          onClick={() => onNavigate("home")}
          data-tooltip={!expanded ? "Orion Home" : undefined}
          aria-label="Go to Orion Home"
        >
          <span className="sidebar-brand-copy">
            <span className="sidebar-brand-tag">A Multiverse of Stories</span>
          </span>
        </button>
        <button
          className="sidebar-pin"
          onClick={togglePinned}
          aria-label={pinned ? "Unpin sidebar" : "Pin sidebar open"}
          title={pinned ? "Unpin sidebar" : "Pin sidebar open"}
        >
          <PinIcon
            size={16}
            fill={pinned ? "currentColor" : "none"}
            style={{
              transform: pinned ? "rotate(0deg)" : "rotate(-45deg)",
              transition: "transform var(--duration-normal) var(--ease-out)",
            }}
          />
        </button>
      </div>

      <div className="sidebar-nav">
        {canGoBack && (
          <div
            className="sidebar-item"
            onClick={onBack}
            data-tooltip={!expanded ? "Back" : undefined}
          >
            <span className="sidebar-item-icon">
              <BackIcon size={20} />
            </span>
            <span className="sidebar-item-label">Back</span>
          </div>
        )}
        {(musicWorld ? [{ label: "Music", items: MUSIC_ITEMS }] : NAV_GROUPS).map((group) => (
          <div className="sidebar-group" key={group.label}>
            <div className="sidebar-group-label">{group.label}</div>
            {group.items.map(({ id, label, icon: Icon }) => (
              <div
                key={id}
                className={`sidebar-item${currentPage === id ? " active" : ""}`}
                onClick={() => (id === "search" && onSearch ? onSearch() : onNavigate(id))}
                data-tooltip={!expanded ? label : undefined}
              >
                <span className="sidebar-item-icon">
                  <Icon size={20} />
                </span>
                <span className="sidebar-item-label">
                  <span className="sidebar-item-title">{label}</span>
                </span>
                {id === "downloads" && activeDownloadCount > 0 && (
                  <span className="badge badge-accent sidebar-count-badge">
                    {activeDownloadCount}
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
        <button
          className={`sidebar-world-switch${musicWorld ? " music-active" : ""}`}
          onClick={() => onNavigate(musicWorld ? "home" : "music-home")}
          aria-label={musicWorld ? "Return to Cinema" : "Enter Music Planet"}
          title={musicWorld ? "Cinema world" : "Music Planet"}
        >
          <span className="sidebar-world-orbit"><MusicPlanetIcon size={21} /></span>
          <span className="sidebar-item-label">{musicWorld ? "Cinema" : "Music Planet"}</span>
        </button>
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-group-label">System</div>
        {FOOTER_ITEMS.map(({ id, label, icon: Icon }) => (
          <div
            key={id}
            className={`sidebar-item${currentPage === id ? " active" : ""}`}
            onClick={() => onNavigate(id)}
            data-tooltip={!expanded ? label : undefined}
          >
            <span className="sidebar-item-icon">
              <Icon size={20} />
            </span>
            <span className="sidebar-item-label">{label}</span>
          </div>
        ))}
        {onShowShortcuts && (
          <div
            className="sidebar-item"
            onClick={onShowShortcuts}
            data-tooltip={!expanded ? "Shortcuts" : undefined}
          >
            <span className="sidebar-item-icon">
              <HelpIcon size={20} />
            </span>
            <span className="sidebar-item-label">Shortcuts</span>
          </div>
        )}
        {googleProfile && (
          <div
            className="sidebar-item"
            style={{ 
              marginTop: 12, 
              cursor: "pointer", 
              opacity: 0.85,
              background: "rgba(0, 168, 255, 0.04)",
              border: "1px solid rgba(0, 168, 255, 0.08)",
              borderRadius: 6,
              padding: "6px 8px"
            }}
            onClick={() => onNavigate("settings")}
            data-tooltip={!expanded ? `Cloud Synced as ${googleProfile.name}` : undefined}
          >
            <span className="sidebar-item-icon" style={{ color: "#00a8ff" }}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
              </svg>
            </span>
            <span className="sidebar-item-label" style={{ fontSize: 10, color: "var(--text3)", display: "flex", flexDirection: "column", lineHeight: 1.2, gap: 1 }}>
              <span style={{ fontWeight: 600, color: "var(--text2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 100 }}>{googleProfile.name}</span>
              <span style={{ fontSize: 9, opacity: 0.8 }}>Sync Active</span>
            </span>
          </div>
        )}
      </div>
    </nav>
  );
}
