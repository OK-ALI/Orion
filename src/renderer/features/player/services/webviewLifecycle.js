/**
 * Electron throws when getWebContentsId() is called before a webview has been
 * attached and emitted dom-ready. React refs can be populated before then, so
 * all renderer callers must use this guarded boundary.
 */
export function getReadyWebContentsId(webview) {
  if (!webview || !webview.isConnected) return null;
  try {
    const id = webview.getWebContentsId?.();
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}
