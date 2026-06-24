export const AMBIENT_INJECTION_SCRIPT = `
(function() {
  try {
    const setup = () => {
      const v = document.querySelector('video');
      if (!v) return;
      if (v._ambientAttached) return;
      v._ambientAttached = true;

      const canvas = document.createElement('canvas');
      canvas.width = 4;
      canvas.height = 4;
      const ctx = canvas.getContext('2d');

      const update = () => {
        if (v.paused || v.ended) return;
        try {
          ctx.drawImage(v, 0, 0, 4, 4);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.1);
          console.log('__orion_ambient_color::' + dataUrl);
        } catch (e) {
          // Cross-origin issues are bypassed via webSecurity=no,
          // but we still wrap it in try-catch to keep it safe.
        }
      };

      // Poll color at a lightweight 4Hz (every 250ms)
      const timer = setInterval(update, 250);
      
      // Clean up if video element is removed or replaced
      const checkRemoved = setInterval(() => {
        if (!v.isConnected) {
          clearInterval(timer);
          clearInterval(checkRemoved);
        }
      }, 2000);
    };

    setup();
    const observer = new MutationObserver(setup);
    observer.observe(document.body, { childList: true, subtree: true });
  } catch (e) {
    console.error("Ambient Glow setup failed:", e);
  }
})();
`;

export function setupAmbientGlow(webview, onColor) {
  if (!webview) return () => {};

  const handleConsole = (e) => {
    if (e.message && e.message.startsWith('__orion_ambient_color::')) {
      const dataUrl = e.message.substring('__orion_ambient_color::'.length);
      onColor(dataUrl);
    }
  };

  const handleLoad = () => {
    try {
      webview.executeJavaScript(AMBIENT_INJECTION_SCRIPT).catch(() => {});
    } catch (e) {
      console.warn("Ambient injection failed (webview not ready):", e);
    }
  };

  webview.addEventListener('console-message', handleConsole);
  webview.addEventListener('did-finish-load', handleLoad);
  webview.addEventListener('dom-ready', handleLoad);

  // Trigger setup in case it already loaded
  handleLoad();

  return () => {
    try {
      webview.removeEventListener('console-message', handleConsole);
      webview.removeEventListener('did-finish-load', handleLoad);
      webview.removeEventListener('dom-ready', handleLoad);
    } catch {}
  };
}
