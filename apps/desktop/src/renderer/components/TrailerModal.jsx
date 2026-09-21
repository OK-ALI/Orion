import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CloseIcon,
  ExternalLinkIcon,
  TrailerIcon,
  WarningIcon,
} from "./common/Icons";
import { storage, STORAGE_KEYS } from "../services/settingsStore";
import { setupAmbientGlow } from "../shared/utils/playerAmbient";

// Retained as a compatibility export for older settings modules and backup data.
// Orion Trailer no longer routes playback through Invidious.
export const DEFAULT_INVIDIOUS_BASE = "https://inv.nadeko.net";
import { useTrailerSession } from "../features/trailers/hooks/useTrailerSession";
import {
  createTrailerEmbedUrl,
  createTrailerExternalUrl,
} from "../features/trailers/trailerProviders";

function errorCopy(state, provider) {
  if (state === "removed" || state === "private") {
    return [
      "Trailer is unavailable",
      "This upload was removed or made private. Orion is trying another trailer.",
    ];
  }
  if (state === "embed-disabled") {
    return [
      "Embedding is disabled",
      `The owner does not allow this ${provider || "provider"} trailer inside apps. Orion is trying another one.`,
    ];
  }
  if (state === "client-identity-error") {
    return [
      "Player identification failed",
      "The provider could not verify Orion on this device. You can retry or continue externally.",
    ];
  }
  if (state === "network-error") {
    return [
      "Trailer connection failed",
      "Check your connection, retry this trailer, or open it with the provider.",
    ];
  }
  if (state === "exhausted") {
    return [
      "No in-app trailer is available",
      "Every available trailer rejected embedded playback or could not be reached.",
    ];
  }
  return [
    "Trailer could not play",
    "Orion could not start this candidate. Try it again, choose another trailer, or open it externally.",
  ];
}

export default function TrailerModal({ visible = true, candidates = [], title, onClose }) {
  const webviewRef = useRef(null);
  const modalRef = useRef(null);
  const previousFocusRef = useRef(null);
  const [ambientColor, setAmbientColor] = useState("");
  const [playerFullscreen, setPlayerFullscreen] = useState(false);
  const [ambientGlowEnabled, setAmbientGlowEnabled] = useState(
    () => storage.get(STORAGE_KEYS.AMBIENT_GLOW) !== false,
  );
  const session = useTrailerSession(visible, candidates);
  const candidate = session.activeCandidate;

  const embedUrl = useMemo(
    () => createTrailerEmbedUrl(candidate, session.transport),
    [candidate, session.transport],
  );
  const externalUrl = useMemo(() => createTrailerExternalUrl(candidate), [candidate]);
  const activeAttemptKey = `${candidate?.id || "none"}:${session.transport}:${session.attempt}`;
  const isPreparing = session.state === "preparing" || session.state === "rotating";
  const showError = [
    "network-error",
    "removed",
    "private",
    "embed-disabled",
    "client-identity-error",
    "playback-error",
    "exhausted",
  ].includes(session.state);
  const [errorTitle, errorText] = errorCopy(session.state, candidate?.site);

  const exitPlayerFullscreen = useCallback(() => {
    setPlayerFullscreen(false);
    document.documentElement.removeAttribute("data-trailer-fullscreen");
    webviewRef.current?.executeJavaScript?.(
      "document.fullscreenElement ? document.exitFullscreen().catch(() => {}) : undefined",
    ).catch?.(() => {});
  }, []);

  useEffect(() => {
    const handler = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (playerFullscreen) {
          exitPlayerFullscreen();
          return;
        }
        onClose();
        return;
      }
      if (event.key !== "Tab" || !modalRef.current) return;
      const focusable = Array.from(modalRef.current.querySelectorAll(
        'button:not([disabled]), webview, [href], [tabindex]:not([tabindex="-1"])',
      ));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    if (visible) {
      previousFocusRef.current = document.activeElement;
      requestAnimationFrame(() => modalRef.current?.querySelector(".trailer-close-btn")?.focus());
    }
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      if (previousFocusRef.current?.focus) previousFocusRef.current.focus();
    };
  }, [exitPlayerFullscreen, onClose, playerFullscreen, visible]);

  useEffect(() => {
    if (!visible) return undefined;
    const ownsActiveTrailer = (owner) => {
      if (owner?.partition && owner.partition !== "persist:trailer") return false;
      if (!owner?.webContentsId) return true;
      try {
        const activeId = webviewRef.current?.getWebContentsId?.();
        return !activeId || owner.webContentsId === activeId;
      } catch {
        return true;
      }
    };
    const enter = (owner) => {
      if (!ownsActiveTrailer(owner)) return;
      setPlayerFullscreen(true);
      document.documentElement.setAttribute("data-trailer-fullscreen", "1");
    };
    const leave = (owner) => {
      if (!ownsActiveTrailer(owner)) return;
      setPlayerFullscreen(false);
      document.documentElement.removeAttribute("data-trailer-fullscreen");
    };
    const enterHandler = window.electron?.onWebviewEnterFullscreen?.(enter);
    const leaveHandler = window.electron?.onWebviewLeaveFullscreen?.(leave);
    return () => {
      if (enterHandler) window.electron?.offWebviewEnterFullscreen?.(enterHandler);
      if (leaveHandler) window.electron?.offWebviewLeaveFullscreen?.(leaveHandler);
      document.documentElement.removeAttribute("data-trailer-fullscreen");
    };
  }, [visible]);

  useEffect(() => {
    const handler = () => {
      setAmbientGlowEnabled(storage.get(STORAGE_KEYS.AMBIENT_GLOW) !== false);
    };
    window.addEventListener("orion:player-settings-changed", handler);
    return () => window.removeEventListener("orion:player-settings-changed", handler);
  }, []);

  useEffect(() => {
    if (!ambientGlowEnabled || !candidate || showError || isPreparing) {
      setAmbientColor("");
      return undefined;
    }
    const webview = webviewRef.current;
    if (!webview) return undefined;
    const cleanup = setupAmbientGlow(webview, (colorDataUrl) => setAmbientColor(colorDataUrl));
    return () => cleanup();
  }, [activeAttemptKey, ambientGlowEnabled, candidate, isPreparing, showError]);

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview || !candidate || !embedUrl) return undefined;

    let disposed = false;

    const failOnce = (error) => {
      if (disposed) return;
      session.fail(error);
    };

    const onDomReady = () => {
      if (session.transport === "direct") {
        session.handleMessage({ candidateId: candidate.id, type: "direct-loaded" });
      }
    };

    const onIpcMessage = (event) => {
      if (event?.channel !== "orion-trailer-event") return;
      session.handleMessage(event.args?.[0]);
    };

    const onFailLoad = (event) => {
      if (event?.errorCode === -3) return;
      failOnce({
        provider: candidate.site,
        category: "network",
        publicCode: event?.errorCode ?? null,
        retryable: true,
      });
    };

    const onWillNavigate = (event) => {
      if (!event?.url || event.url === embedUrl) return;
      const allowed = session.transport === "wrapper"
        ? event.url.startsWith("orion-trailer://player/")
        : candidate.site === "Vimeo"
          ? event.url.startsWith("https://player.vimeo.com/")
          : event.url.startsWith("https://www.youtube.com/")
            || event.url.startsWith("https://www.youtube-nocookie.com/");
      if (!allowed) {
        event.preventDefault?.();
      }
    };

    webview.addEventListener("dom-ready", onDomReady);
    webview.addEventListener("ipc-message", onIpcMessage);
    webview.addEventListener("did-fail-load", onFailLoad);
    webview.addEventListener("will-navigate", onWillNavigate);

    return () => {
      disposed = true;
      webview.removeEventListener("dom-ready", onDomReady);
      webview.removeEventListener("ipc-message", onIpcMessage);
      webview.removeEventListener("did-fail-load", onFailLoad);
      webview.removeEventListener("will-navigate", onWillNavigate);
    };
  }, [activeAttemptKey, candidate, embedUrl, session.fail, session.handleMessage, session.transport]);

  const openProvider = useCallback(() => {
    if (externalUrl) window.electron?.openExternal?.(externalUrl);
  }, [externalUrl]);

  if (!visible) return null;

  return (
    <div className={`trailer-overlay${playerFullscreen ? " is-fullscreen" : ""}`} onClick={playerFullscreen ? undefined : onClose} role="presentation">
      <section
        ref={modalRef}
        className={`trailer-modal${playerFullscreen ? " is-fullscreen" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={`${title} trailer`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="trailer-modal-header">
          <div className="trailer-header-identity">
            <span className="trailer-header-icon"><TrailerIcon size={20} /></span>
            <div className="trailer-header-copy">
              <span className="trailer-eyebrow">TRAILER</span>
              <h2 className="trailer-modal-title">{title}</h2>
            </div>
          </div>
          <button className="trailer-close-btn" onClick={onClose} title="Close trailer" aria-label="Close trailer">
            <CloseIcon size={18} />
          </button>
        </header>

        <div className={`trailer-modal-body${candidates.length > 1 ? "" : " no-candidate-rail"}`}>
          {candidates.length > 1 && (
            <aside className="trailer-candidate-rail" aria-label="Available trailers">
              {candidates.map((item, index) => {
                const active = index === session.activeIndex;
                return (
                  <button
                    key={item.id}
                    className={`trailer-candidate${active ? " is-active" : ""}`}
                    onClick={() => session.select(index)}
                    aria-pressed={active}
                    title={item.name}
                  >
                    <span className="trailer-provider-mark">{item.site === "Vimeo" ? "V" : "YT"}</span>
                    <span className="trailer-candidate-copy">
                      <span className="trailer-candidate-name">{item.name}</span>
                      <span className="trailer-candidate-meta">
                        {item.official ? "OFFICIAL" : item.type.toUpperCase()}
                        {item.season ? ` · S${item.season}` : ""}
                      </span>
                    </span>
                  </button>
                );
              })}
            </aside>
          )}

          <div className="trailer-stage-column">
            <div className="trailer-player-frame">
              {ambientColor && (
                <div className="player-ambient-glow" style={{ backgroundImage: `url(${ambientColor})` }} />
              )}

              {candidate && !showError && embedUrl && (
                <webview
                  key={activeAttemptKey}
                  ref={webviewRef}
                  src={embedUrl}
                  partition="persist:trailer"
                  preload={window.electron?.trailerWebviewPreloadPath || undefined}
                  webpreferences="backgroundThrottling=no,contextIsolation=yes"
                  className={`trailer-webview${isPreparing ? " is-preparing" : ""}`}
                />
              )}

              {isPreparing && (
                <div className="trailer-player-overlay" aria-live="polite">
                  <span className="trailer-loading-ring" aria-hidden="true" />
                  <strong>{session.state === "rotating" ? "Trying another trailer…" : "Preparing trailer…"}</strong>
                  <span>{candidate ? `${candidate.site} · ${candidate.name}` : "Finding a playable trailer"}</span>
                </div>
              )}

              {showError && (
                <div className="trailer-player-overlay trailer-player-error" aria-live="polite">
                  <WarningIcon size={34} color="var(--warning)" />
                  <strong>{errorTitle}</strong>
                  <span>{errorText}</span>
                </div>
              )}
            </div>

            <div className="trailer-now-playing" aria-live="polite">
              <div>
                <strong>{candidate?.name || "No trailer selected"}</strong>
                <span>{candidate ? `${candidate.site}${candidate.official ? " · Official" : ""}` : "Orion Trailer"}</span>
              </div>
              {candidate?.language && <span className="trailer-language-chip">{candidate.language.toUpperCase()}</span>}
            </div>
          </div>

          <aside className="trailer-action-rail" aria-label="Trailer actions">
            <button className="trailer-action trailer-action-primary" onClick={session.retry} disabled={!candidate}>
              Retry
            </button>
            {candidates.length > 1 && (
              <button className="trailer-action" onClick={session.next}>Try next</button>
            )}
            <button className="trailer-action" onClick={openProvider} disabled={!candidate}>
              <ExternalLinkIcon size={14} />
              Open {candidate?.site || "provider"}
            </button>
            <span className="trailer-action-hint">Opens in your default browser</span>
          </aside>
        </div>
      </section>
    </div>
  );
}
