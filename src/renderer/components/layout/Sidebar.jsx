// ── Orion — Sidebar Navigation ────────────────────────────────────────────────
import { useState, useCallback, useEffect, useRef } from "react";
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
  MusicPlanetIcon,
  ChevronLeftIcon,
  PinIcon,
} from "../common/Icons";
import {
  SIDEBAR_MODES,
  SIDEBAR_MODE_EVENT,
  cycleSidebarMode,
  readSidebarMode,
  readSidebarOpenMode,
  writeSidebarMode,
} from "./sidebarState";

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

const MUSIC_NAV_GROUPS = [
  { label: "Listen", items: [
    { id: "music-home", label: "Home", icon: MusicPlanetIcon },
    { id: "music-search", label: "Search", icon: SearchIcon },
    { id: "music-chapter-now-playing", chapter: "now-playing", label: "Now Playing", icon: MusicPlanetIcon },
  ] },
  { label: "Explore", items: [
    { id: "music-chapter-albums", chapter: "albums", label: "Albums", icon: CompassIcon },
    { id: "music-chapter-artists", chapter: "artists", label: "Artists", icon: ConstellationIcon },
    { id: "music-chapter-sources", chapter: "sources", label: "Signal Sources", icon: CompassIcon },
  ] },
  { label: "Yours", items: [
    { id: "music-chapter-library", chapter: "library", label: "Library", icon: LibraryIcon },
    { id: "music-chapter-playlists", chapter: "playlists", label: "Playlists", icon: ConstellationIcon },
    { id: "music-chapter-favorites", chapter: "favorites", label: "Favorites", icon: HomeIcon },
  ] },
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
  const currentPage = activePage || page;
  const musicWorld = String(currentPage || "").startsWith("music-");
  const world = musicWorld ? "music" : "cinema";
  const [mode, setMode] = useState(() => readSidebarMode(world));
  const [closing, setClosing] = useState(false);
  const [peeking, setPeeking] = useState(false);
  const closeTimerRef = useRef(null);
  const [musicChapter, setMusicChapter] = useState("home");
  const activeDownloadCount = downloadCount || activeDownloads;
  const expanded = mode === SIDEBAR_MODES.EXPANDED || peeking;
  const collapsed = mode === SIDEBAR_MODES.COLLAPSED;

  useEffect(() => {
    const onChapterChange = (event) => setMusicChapter(event.detail?.chapter || "home");
    window.addEventListener("orion:music-chapter-change", onChapterChange);
    return () => window.removeEventListener("orion:music-chapter-change", onChapterChange);
  }, []);

  const navigateMusicItem = useCallback((item) => {
    if (!item.chapter) {
      onNavigate(item.id);
      return;
    }
    window.dispatchEvent(new CustomEvent("orion:music-scroll-chapter", { detail: { chapter: item.chapter } }));
    if (currentPage !== "music-home") onNavigate("music-home", { musicChapter: item.chapter });
  }, [currentPage, onNavigate]);

  const keyboardActivate = useCallback((event, action) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    action();
  }, []);

  const applyMode = useCallback((nextMode) => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
    setClosing(false);
    setPeeking(false);
    setMode(nextMode);
    writeSidebarMode(world, nextMode, { notify: false });
  }, [world]);

  const collapseSidebar = useCallback(() => {
    if (collapsed || closing) return;
    setClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      setMode(SIDEBAR_MODES.COLLAPSED);
      setClosing(false);
      writeSidebarMode(world, SIDEBAR_MODES.COLLAPSED, { notify: false });
      closeTimerRef.current = null;
    }, 220);
  }, [closing, collapsed, world]);

  const requestMode = useCallback((nextMode) => {
    if (nextMode === SIDEBAR_MODES.COLLAPSED) collapseSidebar();
    else applyMode(nextMode);
  }, [applyMode, collapseSidebar]);

  const revealSidebar = useCallback(() => {
    applyMode(readSidebarOpenMode(world));
  }, [applyMode, world]);

  useEffect(() => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
    setClosing(false);
    setPeeking(false);
    setMode(readSidebarMode(world));
  }, [world]);

  useEffect(() => {
    const width = collapsed
      ? "var(--sidebar-rail-width)"
      : expanded
        ? "var(--sidebar-expanded-width)"
        : "var(--sidebar-compact-width)";
    document.documentElement.style.setProperty("--sidebar", width);
  }, [collapsed, expanded]);

  useEffect(() => {
    const onModeChange = (event) => {
      if (event.detail?.world !== world || !event.detail?.mode) return;
      requestMode(event.detail.mode);
    };
    window.addEventListener(SIDEBAR_MODE_EVENT, onModeChange);
    return () => window.removeEventListener(SIDEBAR_MODE_EVENT, onModeChange);
  }, [requestMode, world]);

  useEffect(() => {
    const toggle = (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "b") return;
      event.preventDefault();
      if (collapsed) revealSidebar(); else requestMode(cycleSidebarMode(mode));
    };
    window.addEventListener("keydown", toggle);
    return () => window.removeEventListener("keydown", toggle);
  }, [collapsed, mode, requestMode, revealSidebar]);

  useEffect(() => {
    const closePeek = (event) => {
      if (event.key === "Escape" && peeking) setPeeking(false);
    };
    window.addEventListener("keydown", closePeek);
    return () => window.removeEventListener("keydown", closePeek);
  }, [peeking]);

  useEffect(() => () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
  }, []);

  return (
    <>
    <nav
      className={`sidebar sidebar-${mode}${expanded ? " expanded" : ""}${peeking ? " peeking" : ""}${closing ? " closing" : ""}`}
      aria-label={`${musicWorld ? "Music Planet" : "Orion Cinema"} sidebar`}
      onMouseEnter={() => mode === SIDEBAR_MODES.COMPACT && setPeeking(true)}
      onMouseLeave={() => setPeeking(false)}
    >
      {!collapsed && <div className="sidebar-body">
      <div className="sidebar-brand-row">
        <button
          className="sidebar-brand sidebar-brand-text"
          onClick={() => onNavigate("home")}
          data-tooltip={!expanded ? "Orion Home" : undefined}
          aria-label="Go to Orion Home"
        >
          <span className="sidebar-brand-copy">
            <span className="sidebar-brand-tag">A universe made to be felt.</span>
          </span>
        </button>
        <button
          className={`sidebar-mode-control mode-${mode}`}
          onClick={() => requestMode(cycleSidebarMode(mode))}
          aria-label={`Sidebar mode: ${mode}. Change mode`}
          title={`Sidebar mode: ${mode}. Click to cycle (Ctrl+B)`}
        >
          <PinIcon size={16} />
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
        {(musicWorld ? MUSIC_NAV_GROUPS : NAV_GROUPS).map((group) => (
          <div className="sidebar-group" key={group.label}>
            <div className="sidebar-group-label">{group.label}</div>
            {group.items.map((item) => {
              const { id, label, icon: Icon } = item;
              const active = item.chapter
                ? currentPage === "music-home" && musicChapter === item.chapter
                : currentPage === id || (id === "music-home" && currentPage === "music-home" && musicChapter === "home");
              const activate = () => (item.chapter ? navigateMusicItem(item) : (id === "search" && onSearch ? onSearch() : onNavigate(id)));
              return (
              <div
                key={id}
                className={`sidebar-item${active ? " active" : ""}`}
                role="button"
                tabIndex={0}
                onClick={activate}
                onKeyDown={(event) => keyboardActivate(event, activate)}
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
              );
            })}
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
        {(musicWorld ? [{ id: "music-settings", label: "Music Settings", icon: SettingsIcon }] : FOOTER_ITEMS).map(({ id, label, icon: Icon }) => (
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
      </div>}
      {collapsed && (
      <button
        className="sidebar-collapsed-rail"
        onClick={revealSidebar}
        onKeyDown={(event) => keyboardActivate(event, revealSidebar)}
        aria-label={`Expand ${musicWorld ? "Music Planet" : "Orion Cinema"} sidebar`}
        title={`Expand ${musicWorld ? "Music Planet" : "Orion Cinema"} sidebar`}
      >
        <span className="sidebar-rail-expand-icon" aria-hidden="true"><ChevronLeftIcon size={17} /></span>
        <span>{musicWorld ? "MUSIC PLANET" : "ORION CINEMA"}</span>
      </button>
      )}
    </nav>
    </>
  );
}
