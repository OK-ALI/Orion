// ── Orion — Sidebar Navigation ────────────────────────────────────────────────
import { useState, useCallback, useEffect } from "react";
import {
  HomeIcon,
  SearchIcon,
  CompassIcon,
  ConstellationIcon,
  LibraryIcon,
  DownloadIcon,
  SettingsIcon,
  BackIcon,
  MusicPlanetIcon,
  CinemaIcon,
  ChevronRightIcon,
  ConnectIcon,
  MobileDeviceIcon,
  NowPlayingIcon,
  AlbumIcon,
  ArtistsIcon,
  SignalSourcesIcon,
  PlaylistIcon,
  HeartIcon,
  KeyboardIcon,
  SidebarDockIcon,
} from "../common/Icons";
import {
  SIDEBAR_MODES,
  SIDEBAR_MODE_EVENT,
  cycleSidebarMode,
  readSidebarMode,
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
    label: "Library",
    items: [
      { id: "library", label: "My Library", icon: LibraryIcon },
      { id: "downloads", label: "Downloads", icon: DownloadIcon },
    ],
  },
  {
    label: "Devices",
    items: [
      { id: "connect", label: "Orion Connect", icon: ConnectIcon },
      { id: "get-mobile", label: "Get Orion Mobile", icon: MobileDeviceIcon },
    ],
  },
];

const FOOTER_ITEMS = [
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

const MUSIC_NAV_GROUPS = [
  { label: "Listen", items: [
    { id: "music-home", label: "Home", icon: HomeIcon },
    { id: "music-search", label: "Search", icon: SearchIcon },
    { id: "music-chapter-now-playing", chapter: "now-playing", label: "Now Playing", icon: NowPlayingIcon },
  ] },
  { label: "Explore", items: [
    { id: "music-chapter-albums", chapter: "albums", label: "Albums", icon: AlbumIcon },
    { id: "music-chapter-artists", chapter: "artists", label: "Artists", icon: ArtistsIcon },
    { id: "music-chapter-sources", chapter: "sources", label: "Signal Sources", icon: SignalSourcesIcon },
  ] },
  { label: "Yours", items: [
    { id: "music-chapter-library", chapter: "library", label: "Library", icon: LibraryIcon },
    { id: "music-chapter-playlists", chapter: "playlists", label: "Playlists", icon: PlaylistIcon },
    { id: "music-chapter-favorites", chapter: "favorites", label: "Favorites", icon: HeartIcon },
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
  const [peeking, setPeeking] = useState(false);
  const [musicChapter, setMusicChapter] = useState("home");
  const [isConnectLive, setIsConnectLive] = useState(false);
  const activeDownloadCount = downloadCount || activeDownloads;
  const pinned = mode === SIDEBAR_MODES.PINNED;
  const revealed = pinned || peeking;

  useEffect(() => {
    if (window.electron?.getSmartConnectInfo) {
      window.electron.getSmartConnectInfo().then((info) => {
        setIsConnectLive(Boolean(info?.connected));
      });
    }

    let unsubscribe;
    if (window.electron?.onSmartConnectStatus) {
      unsubscribe = window.electron.onSmartConnectStatus((data) => {
        setIsConnectLive(Boolean(data?.connected));
      });
    }

    const onChapterChange = (event) => setMusicChapter(event.detail?.chapter || "home");
    window.addEventListener("orion:music-chapter-change", onChapterChange);

    return () => {
      if (unsubscribe) unsubscribe();
      window.removeEventListener("orion:music-chapter-change", onChapterChange);
    };
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
    setMode(nextMode);
    setPeeking(false);
    writeSidebarMode(world, nextMode, { notify: false });
  }, [world]);

  const togglePinned = useCallback(() => {
    applyMode(cycleSidebarMode(mode));
  }, [applyMode, mode]);

  useEffect(() => {
    setPeeking(false);
    setMode(readSidebarMode(world));
  }, [world]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--sidebar",
      pinned ? "var(--sidebar-expanded-width)" : "var(--sidebar-rail-width)",
    );
  }, [pinned]);

  useEffect(() => {
    const onModeChange = (event) => {
      if (event.detail?.world !== world || !event.detail?.mode) return;
      applyMode(event.detail.mode);
    };
    window.addEventListener(SIDEBAR_MODE_EVENT, onModeChange);
    return () => window.removeEventListener(SIDEBAR_MODE_EVENT, onModeChange);
  }, [applyMode, world]);

  useEffect(() => {
    const toggle = (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "b") return;
      event.preventDefault();
      togglePinned();
    };
    window.addEventListener("keydown", toggle);
    return () => window.removeEventListener("keydown", toggle);
  }, [togglePinned]);

  useEffect(() => {
    window.addEventListener("orion:toggle-sidebar", togglePinned);
    return () => window.removeEventListener("orion:toggle-sidebar", togglePinned);
  }, [togglePinned]);

  useEffect(() => {
    const closePeek = (event) => {
      if (event.key === "Escape" && peeking && !pinned) setPeeking(false);
    };
    window.addEventListener("keydown", closePeek);
    return () => window.removeEventListener("keydown", closePeek);
  }, [peeking, pinned]);

  const revealPeek = useCallback(() => {
    if (!pinned) setPeeking(true);
  }, [pinned]);

  return (
    <nav
      className={`sidebar mode-${mode}${pinned ? " expanded pinned-open" : ""}${revealed ? " revealed" : ""}${peeking ? " peeking" : ""}`}
      aria-label={`${musicWorld ? "Music Planet" : "Orion Cinema"} sidebar`}
      onMouseEnter={revealPeek}
      onMouseLeave={() => { if (!pinned) setPeeking(false); }}
    >
      <div className="sidebar-body" aria-hidden={!revealed}>
        <div className="sidebar-brand-row">
          <button
            className="sidebar-brand sidebar-brand-text"
            onClick={() => onNavigate("home")}
            aria-label="Go to Orion Home"
          >
            <span className="sidebar-brand-copy">
              <span className="sidebar-brand-tag">A universe made to be felt.</span>
            </span>
          </button>
          <button
            className={`sidebar-mode-control${pinned ? " is-pinned" : ""}`}
            onClick={togglePinned}
            aria-label={pinned ? "Use auto-hide sidebar rail" : "Keep sidebar open"}
            title={pinned ? "Use auto-hide rail (Ctrl+B)" : "Keep sidebar open (Ctrl+B)"}
          >
            <SidebarDockIcon size={17} collapse={pinned} />
          </button>
        </div>

        <div className="sidebar-nav">
          {canGoBack && (
            <div className="sidebar-item" onClick={onBack}>
              <span className="sidebar-item-icon"><BackIcon size={20} /></span>
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
                  >
                    <span className="sidebar-item-icon"><Icon size={20} /></span>
                    <span className="sidebar-item-label"><span className="sidebar-item-title">{label}</span></span>
                    {id === "downloads" && activeDownloadCount > 0 && (
                      <span className="badge badge-accent sidebar-count-badge">{activeDownloadCount}</span>
                    )}
                    {id === "connect" && (
                      <span
                        className={`sidebar-connect-status${isConnectLive ? " connected" : ""}`}
                        title={isConnectLive ? "Smart Connect: Connected" : "Smart Connect: Disconnected"}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          <div className="sidebar-group sidebar-worlds-group">
            <div className="sidebar-group-label">Worlds</div>
            <button
              className={`sidebar-world-switch${musicWorld ? " music-active" : ""}`}
              onClick={() => onNavigate(musicWorld ? "home" : "music-home")}
              aria-label={musicWorld ? "Return to Cinema" : "Enter Music Planet"}
              title={musicWorld ? "Cinema world" : "Music Planet"}
            >
              <span className="sidebar-world-orbit">{musicWorld ? <CinemaIcon size={21} /> : <MusicPlanetIcon size={21} />}</span>
              <span className="sidebar-item-label">{musicWorld ? "Cinema" : "Music Planet"}</span>
            </button>
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-group-label">System</div>
          {(musicWorld ? [{ id: "music-settings", label: "Music Settings", icon: SettingsIcon }] : FOOTER_ITEMS).map(({ id, label, icon: Icon }) => (
            <div
              key={id}
              className={`sidebar-item${currentPage === id ? " active" : ""}`}
              onClick={() => onNavigate(id)}
            >
              <span className="sidebar-item-icon"><Icon size={20} /></span>
              <span className="sidebar-item-label">{label}</span>
            </div>
          ))}
          {onShowShortcuts && (
            <div className="sidebar-item" onClick={onShowShortcuts}>
              <span className="sidebar-item-icon"><KeyboardIcon size={20} /></span>
              <span className="sidebar-item-label">Shortcuts</span>
            </div>
          )}
          {googleProfile && (
            <div
              className="sidebar-item sidebar-cloud-profile"
              onClick={() => onNavigate("settings")}
              title={`Cloud synced as ${googleProfile.name}`}
            >
              <span className="sidebar-item-icon sidebar-cloud-icon">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
                </svg>
              </span>
              <span className="sidebar-item-label sidebar-cloud-copy">
                <span className="sidebar-cloud-name">{googleProfile.name}</span>
                <span className="sidebar-cloud-state">Sync Active</span>
              </span>
            </div>
          )}
        </div>
      </div>

      <button
          className="sidebar-collapsed-rail"
          onMouseEnter={revealPeek}
          onFocus={revealPeek}
          onClick={revealPeek}
          onKeyDown={(event) => keyboardActivate(event, revealPeek)}
          aria-label={`Reveal ${musicWorld ? "Music Planet" : "Orion Cinema"} sidebar`}
          title={`Reveal ${musicWorld ? "Music Planet" : "Orion Cinema"} sidebar`}
          aria-hidden={revealed}
          tabIndex={revealed ? -1 : 0}
        >
          <span className="sidebar-rail-expand-icon" aria-hidden="true"><ChevronRightIcon size={17} /></span>
          <span>{musicWorld ? "MUSIC PLANET" : "ORION CINEMA"}</span>
        </button>
    </nav>
  );
}
