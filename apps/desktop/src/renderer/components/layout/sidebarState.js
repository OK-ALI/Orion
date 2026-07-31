export const SIDEBAR_MODES = Object.freeze({
  EXPANDED: "expanded",
  COMPACT: "compact",
  COLLAPSED: "collapsed",
});

export const SIDEBAR_MODE_OPTIONS = Object.freeze([
  { value: SIDEBAR_MODES.EXPANDED, label: "Expanded" },
  { value: SIDEBAR_MODES.COMPACT, label: "Compact" },
  { value: SIDEBAR_MODES.COLLAPSED, label: "Collapsed rail" },
]);

const MODE_KEYS = Object.freeze({
  cinema: "orion.sidebar.cinema.mode",
  music: "orion.sidebar.music.mode",
});

const OPEN_MODE_KEYS = Object.freeze({
  cinema: "orion.sidebar.cinema.openMode",
  music: "orion.sidebar.music.openMode",
});

export const SIDEBAR_MODE_EVENT = "orion:sidebar-mode-change";

const isMode = (value) => Object.values(SIDEBAR_MODES).includes(value);
const parseLegacy = (key) => {
  try {
    const raw = window.localStorage.getItem(`orion_${key}`);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
};

export function getSidebarModeKey(world) {
  return MODE_KEYS[world === "music" ? "music" : "cinema"];
}

export function readSidebarMode(world) {
  const normalizedWorld = world === "music" ? "music" : "cinema";
  try {
    const saved = window.localStorage.getItem(MODE_KEYS[normalizedWorld]);
    if (isMode(saved)) return saved;
  } catch {}

  const pinned = parseLegacy("sidebarPinned");
  const expanded = parseLegacy("sidebarExpanded");
  const migrated = pinned === true || expanded === true
    ? SIDEBAR_MODES.EXPANDED
    : pinned === false || expanded === false
      ? SIDEBAR_MODES.COMPACT
      : SIDEBAR_MODES.EXPANDED;
  writeSidebarMode(normalizedWorld, migrated, { notify: false });
  return migrated;
}

export function readSidebarOpenMode(world) {
  const normalizedWorld = world === "music" ? "music" : "cinema";
  try {
    const saved = window.localStorage.getItem(OPEN_MODE_KEYS[normalizedWorld]);
    if (saved === SIDEBAR_MODES.EXPANDED || saved === SIDEBAR_MODES.COMPACT) return saved;
  } catch {}
  return SIDEBAR_MODES.EXPANDED;
}

export function writeSidebarMode(world, mode, { notify = true } = {}) {
  if (!isMode(mode)) return;
  const normalizedWorld = world === "music" ? "music" : "cinema";
  try {
    window.localStorage.setItem(MODE_KEYS[normalizedWorld], mode);
    if (mode !== SIDEBAR_MODES.COLLAPSED) {
      window.localStorage.setItem(OPEN_MODE_KEYS[normalizedWorld], mode);
    }
  } catch {}
  if (notify) {
    window.dispatchEvent(new CustomEvent(SIDEBAR_MODE_EVENT, {
      detail: { world: normalizedWorld, mode },
    }));
  }
}

export function cycleSidebarMode(mode) {
  if (mode === SIDEBAR_MODES.EXPANDED) return SIDEBAR_MODES.COMPACT;
  if (mode === SIDEBAR_MODES.COMPACT) return SIDEBAR_MODES.COLLAPSED;
  return SIDEBAR_MODES.EXPANDED;
}
