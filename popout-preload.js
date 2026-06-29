const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronPopout", {
  minimize: () => ipcRenderer.invoke("popout-window-minimize"),
  close: () => ipcRenderer.invoke("popout-window-close"),
  toggleMaximize: () => ipcRenderer.invoke("popout-window-toggle-maximize"),
  isMaximized: () => ipcRenderer.invoke("popout-window-is-maximized"),
  playbackState: () => ipcRenderer.invoke("popout-playback-state"),
  controlPlayback: (action, value) => ipcRenderer.invoke("popout-control", action, value),
});

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const BAR_H = 32;

function css(el, styles) {
  Object.assign(el.style, styles);
}

const ICON_MINIMIZE =
  '<svg width="10" height="1" viewBox="0 0 10 1" fill="none">' +
  '<rect width="10" height="1" fill="currentColor"/></svg>';

const ICON_MAXIMIZE =
  '<svg width="10" height="10" viewBox="0 0 10 10" fill="none">' +
  '<rect x="0.5" y="0.5" width="9" height="9" rx="0.5" stroke="currentColor" stroke-width="1" fill="none"/></svg>';

const ICON_RESTORE =
  '<svg width="10" height="10" viewBox="0 0 10 10" fill="none">' +
  '<rect x="2" y="0" width="8" height="8" rx="0.5" stroke="currentColor" stroke-width="1" fill="none"/>' +
  '<rect x="0" y="2" width="8" height="8" rx="0.5" stroke="currentColor" stroke-width="1" fill="none" style="fill:#0a0a0a"/></svg>';

const ICON_CLOSE =
  '<svg width="10" height="10" viewBox="0 0 10 10" fill="none">' +
  '<line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" stroke-width="1.2"/>' +
  '<line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" stroke-width="1.2"/></svg>';

function makeTitlebarBtn(iconHtml, hoverBg, title, onClick) {
  const btn = document.createElement("button");
  css(btn, {
    width: "46px",
    height: "100%",
    background: "transparent",
    border: "none",
    cursor: "default",
    color: "rgba(255,255,255,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 0.15s, color 0.15s",
    flexShrink: "0",
    padding: "0",
    outline: "none",
  });
  btn.title = title;
  btn.innerHTML = iconHtml;
  btn.addEventListener("mouseenter", () => {
    btn.style.background = hoverBg;
    btn.style.color = "#fff";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.background = "transparent";
    btn.style.color = "rgba(255,255,255,0.55)";
  });
  btn.addEventListener("click", onClick);
  return btn;
}

// ---------------------------------------------------------------------------
// Title bar injection
// ---------------------------------------------------------------------------

function injectTitlebar() {
  if (document.getElementById("__orion_titlebar__")) return;

  const bar = document.createElement("div");
  bar.id = "__orion_titlebar__";
  css(bar, {
    position: "fixed",
    top: "0",
    left: "0",
    right: "0",
    height: BAR_H + "px",
    zIndex: "2147483647",
    background: "#0a0a0f",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    display: "flex",
    alignItems: "center",
    userSelect: "none",
    WebkitAppRegion: "drag",
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    boxSizing: "border-box",
    opacity: "0",
    transform: "translateY(-100%)",
    transition: "opacity 0.2s, transform 0.2s",
    pointerEvents: "none",
  });

  const label = document.createElement("div");
  css(label, {
    paddingLeft: "12px",
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "2px",
    color: "rgba(255,255,255,0.35)",
    flexGrow: "1",
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  });
  label.textContent = "ORION";
  bar.appendChild(label);

  const btns = document.createElement("div");
  css(btns, { display: "flex", height: "100%", WebkitAppRegion: "no-drag" });

  const minimizeBtn = makeTitlebarBtn(
    ICON_MINIMIZE,
    "rgba(255,255,255,0.08)",
    "Minimize",
    () => ipcRenderer.invoke("popout-window-minimize"),
  );
  const maximizeBtn = makeTitlebarBtn(
    ICON_MAXIMIZE,
    "rgba(255,255,255,0.08)",
    "Maximize",
    () => ipcRenderer.invoke("popout-window-toggle-maximize"),
  );
  const closeBtn = makeTitlebarBtn(
    ICON_CLOSE,
    "rgba(229,9,20,0.85)",
    "Close",
    () => ipcRenderer.invoke("popout-window-close"),
  );

  btns.appendChild(minimizeBtn);
  btns.appendChild(maximizeBtn);
  btns.appendChild(closeBtn);
  bar.appendChild(btns);

  let visible = false;
  let hideTimer = null;

  const showBar = () => {
    clearTimeout(hideTimer);
    if (!visible) {
      visible = true;
      bar.style.opacity = "1";
      bar.style.transform = "translateY(0)";
      bar.style.pointerEvents = "auto";
      sensor.style.pointerEvents = "none";
    }
    hideTimer = setTimeout(hideBar, 2500);
  };

  const hideBar = () => {
    if (visible) {
      visible = false;
      bar.style.opacity = "0";
      bar.style.transform = "translateY(-100%)";
      bar.style.pointerEvents = "none";
      sensor.style.pointerEvents = "all";
    }
  };

  bar.addEventListener("mouseenter", () => clearTimeout(hideTimer));
  bar.addEventListener("mouseleave", () => {
    hideTimer = setTimeout(hideBar, 2500);
  });

  const sensor = document.createElement("div");
  sensor.id = "__orion_sensor__";
  css(sensor, {
    position: "fixed",
    top: "0",
    left: "0",
    right: "0",
    height: BAR_H + "px",
    zIndex: "2147483646",
    pointerEvents: "all",
    background: "transparent",
  });
  sensor.addEventListener("mouseenter", showBar);

  document.addEventListener("mousemove", showBar);

  if (document.body) {
    document.body.insertBefore(bar, document.body.firstChild);
    document.body.appendChild(sensor);
  }

  showBar();
  injectPlaybackControls();

  ipcRenderer.invoke("popout-window-is-maximized").then((isMax) => {
    applyMaximizeIcon(maximizeBtn, isMax);
  });
  ipcRenderer.on("popout-window-maximized", (_, isMax) => {
    applyMaximizeIcon(maximizeBtn, isMax);
  });

  function applyMaximizeIcon(btn, isMax) {
    btn.title = isMax ? "Restore" : "Maximize";
    btn.innerHTML = isMax ? ICON_RESTORE : ICON_MAXIMIZE;
  }
}

function injectPlaybackControls() {
  if (document.getElementById("__orion_transport__")) return;
  const transport = document.createElement("div");
  transport.id = "__orion_transport__";
  css(transport, {
    position: "fixed", left: "50%", bottom: "14px", transform: "translateX(-50%)",
    zIndex: "2147483647", display: "flex", alignItems: "center", gap: "8px",
    width: "min(560px, calc(100% - 28px))", minHeight: "42px", padding: "7px 10px",
    border: "1px solid rgba(255,255,255,.14)", borderRadius: "12px",
    background: "rgba(8,7,12,.84)", backdropFilter: "blur(16px)",
    boxShadow: "0 16px 45px rgba(0,0,0,.5), 0 0 34px rgba(139,92,246,.2)",
    color: "#f7f2ea", fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    opacity: ".92", transition: "opacity .2s",
  });
  const button = (label, title, action, value) => {
    const el = document.createElement("button");
    el.textContent = label; el.title = title;
    css(el, { border:"0", borderRadius:"8px", minWidth:"34px", height:"28px", padding:"0 8px", background:"rgba(255,255,255,.08)", color:"inherit", cursor:"pointer", fontWeight:"700" });
    el.addEventListener("click", () => ipcRenderer.invoke("popout-control", action, value));
    return el;
  };
  const play = button("Pause", "Play or pause", "toggle", 0);
  const back = button("−10", "Back 10 seconds", "seek", -10);
  const next = button("+10", "Forward 10 seconds", "seek", 10);
  const mute = button("Sound", "Mute or unmute", "mute", 0);
  const progress = document.createElement("input");
  progress.type = "range"; progress.min = "0"; progress.max = "1"; progress.step = "1"; progress.value = "0";
  progress.setAttribute("aria-label", "Playback position");
  css(progress, { flex:"1", minWidth:"70px", accentColor:"#8b5cf6" });
  progress.addEventListener("change", () => ipcRenderer.invoke("popout-control", "position", Number(progress.value)));
  transport.append(back, play, next, progress, mute);
  document.body?.appendChild(transport);
  const ambient = document.createElement("div");
  ambient.id = "__orion_ambient__";
  css(ambient, { position:"fixed", inset:"0", zIndex:"2147483645", pointerEvents:"none", boxShadow:"inset 40px 0 80px rgba(76,29,149,.28), inset -40px 0 80px rgba(14,116,144,.24)", transition:"box-shadow .8s ease" });
  document.body?.appendChild(ambient);
  ipcRenderer.on("popout-ambient-palette", (_event, colors) => {
    if (!Array.isArray(colors) || colors.length < 2) return;
    ambient.style.boxShadow = `inset 44px 0 92px ${colors[0]}66, inset -44px 0 92px ${colors[1]}55`;
    transport.style.boxShadow = `0 16px 45px rgba(0,0,0,.5), 0 0 38px ${colors[0]}55`;
  });
  const sync = async () => {
    try {
      const state = await ipcRenderer.invoke("popout-playback-state");
      if (!state?.ok) return;
      play.textContent = state.paused ? "Play" : "Pause";
      mute.textContent = state.muted ? "Muted" : "Sound";
      progress.max = String(Math.max(1, Number(state.duration) || 1));
      progress.value = String(Math.min(Number(progress.max), Number(state.currentTime) || 0));
    } catch {}
  };
  sync();
  setInterval(sync, 1000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", injectTitlebar);
} else {
  injectTitlebar();
}

let _lastUrl = location.href;
const _onNav = () => {
  if (location.href !== _lastUrl) {
    _lastUrl = location.href;
    setTimeout(injectTitlebar, 50);
  }
};
const _origPush = history.pushState.bind(history);
const _origReplace = history.replaceState.bind(history);
history.pushState = (...a) => {
  _origPush(...a);
  _onNav();
};
history.replaceState = (...a) => {
  _origReplace(...a);
  _onNav();
};
window.addEventListener("popstate", _onNav);
