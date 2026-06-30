// ── Orion — Sidebar Navigation ────────────────────────────────────────────────
import { useState, useCallback } from "react";
import {
  HomeIcon,
  SearchIcon,
  CompassIcon,
  LibraryIcon,
  DownloadIcon,
  SettingsIcon,
  BackIcon,
  HelpIcon,
  PinIcon,
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
}) {
  const [pinned, setPinned] = useState(() => !!storage.get(SIDEBAR_PINNED_KEY));
  const [peeking, setPeeking] = useState(false);
  const currentPage = activePage || page;
  const activeDownloadCount = downloadCount || activeDownloads;
  const expanded = pinned || peeking;

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
        {NAV_GROUPS.map((group) => (
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
      </div>
    </nav>
  );
}
