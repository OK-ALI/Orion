export const SIDEBAR_MODES = Object.freeze({
  AUTO: "auto",
  PINNED: "pinned",
});

export const SIDEBAR_MODE_OPTIONS = Object.freeze([
  { value: SIDEBAR_MODES.AUTO, label: "Auto rail (recommended)" },
  { value: SIDEBAR_MODES.PINNED, label: "Keep open" },
]);

const MODE_KEYS = Object.freeze({
  cinema: "orion.sidebar.cinema.mode",
  music: "orion.sidebar.music.mode",
});

export const SIDEBAR_MODE_EVENT = "orion:sidebar-mode-change";

const isMode = (value) => Object.values(SIDEBAR_MODES).includes(value);

export function getSidebarModeKey(world) {
  return MODE_KEYS[world === "music" ? "music" : "cinema"];
}

export function readSidebarMode(world) {
  const normalizedWorld = world === "music" ? "music" : "cinema";
  try {
    const saved = window.localStorage.getItem(MODE_KEYS[normalizedWorld]);
    if (isMode(saved)) return saved;

    // DUX-1 migration: the previous expanded / compact / collapsed cycle is
    // intentionally retired. Every legacy width starts in the new auto rail,
    // which is the canonical resting state for both Cinema and Music.
    if (saved === "expanded" || saved === "compact" || saved === "collapsed") {
      writeSidebarMode(normalizedWorld, SIDEBAR_MODES.AUTO, { notify: false });
      return SIDEBAR_MODES.AUTO;
    }
  } catch {}

  writeSidebarMode(normalizedWorld, SIDEBAR_MODES.AUTO, { notify: false });
  return SIDEBAR_MODES.AUTO;
}

export function writeSidebarMode(world, mode, { notify = true } = {}) {
  if (!isMode(mode)) return;
  const normalizedWorld = world === "music" ? "music" : "cinema";
  try {
    window.localStorage.setItem(MODE_KEYS[normalizedWorld], mode);
  } catch {}
  if (notify) {
    window.dispatchEvent(new CustomEvent(SIDEBAR_MODE_EVENT, {
      detail: { world: normalizedWorld, mode },
    }));
  }
}

export function cycleSidebarMode(mode) {
  return mode === SIDEBAR_MODES.PINNED ? SIDEBAR_MODES.AUTO : SIDEBAR_MODES.PINNED;
}

// Compatibility shim for callers/tests from the retired three-width sidebar.
// "Open" now means the single full-navigation presentation.
export function readSidebarOpenMode() {
  return SIDEBAR_MODES.PINNED;
}
