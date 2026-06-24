export const AMBIENT_INJECTION_SCRIPT = `
(function() {
  try {
    console.log('__orion_ambient_log:: Injected script executing...');
    const setup = () => {
      const videos = Array.from(document.querySelectorAll('video'));
      console.log('__orion_ambient_log:: setup scan found ' + videos.length + ' video elements.');
      for (const v of videos) {
        if (v._ambientAttached) continue;

        // Skip tiny videos (ads, tracking pixels, etc.)
        const rect = v.getBoundingClientRect();
        console.log('__orion_ambient_log:: Video element found. dimensions: ' + rect.width + 'x' + rect.height + ', src: ' + v.src);
        if (rect.width > 0 && rect.width < 150) continue;
        if (rect.height > 0 && rect.height < 100) continue;

        v._ambientAttached = true;
        console.log('__orion_ambient_log:: Attaching ambient glow to video element.');

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
            console.error("__orion_ambient_error::", e.message || e);
            
            // Self-healing: if we get a SecurityError (canvas tainted), 
            // force a reload with CORS enabled.
            if (e.name === 'SecurityError' || (e.message && e.message.includes('Tainted'))) {
              if (v.crossOrigin !== 'anonymous') {
                v.crossOrigin = 'anonymous';
              }
              if (!v._corsReloaded) {
                v._corsReloaded = true;
                console.warn("__orion_ambient_error:: Tainted canvas detected. Attempting to reload video with CORS...");
                const currentSrc = v.src;
                if (currentSrc && !currentSrc.startsWith('blob:')) {
                  v.removeAttribute('src');
                  v.load();
                  v.src = currentSrc;
                  v.load();
                } else {
                  const sources = Array.from(v.querySelectorAll('source'));
                  if (sources.length > 0) {
                    sources.forEach((s) => {
                      const src = s.src;
                      s.src = '';
                      s.src = src;
                    });
                    v.load();
                  }
                }
              }
            }
          }
        };

        const timer = setInterval(update, 250);
        
        const checkRemoved = setInterval(() => {
          if (!v.isConnected) {
            console.log('__orion_ambient_log:: Video element disconnected. Cleaning up timers.');
            clearInterval(timer);
            clearInterval(checkRemoved);
          }
        }, 2000);
      }
    };

    setup();
    const targetNode = document.documentElement || document.body;
    if (targetNode) {
      const observer = new MutationObserver(setup);
      observer.observe(targetNode, { childList: true, subtree: true });
    }
  } catch (e) {
    console.error("__orion_ambient_error:: Setup exception: " + (e.message || e));
  }
})();
`;

export function setupAmbientGlow(webview, onColor) {
  if (!webview) {
    window.electron?.logToTerminal("[setupAmbientGlow] Webview is falsy.");
    return () => {};
  }

  window.electron?.logToTerminal(`[setupAmbientGlow] Initializing. webview: ${webview.tagName}, has getWebContentsId: ${typeof webview.getWebContentsId === 'function'}`);

  const handleConsole = (e) => {
    if (e.message && e.message.startsWith('__orion_ambient_color::')) {
      const dataUrl = e.message.substring('__orion_ambient_color::'.length);
      onColor(dataUrl);
    } else if (e.message && e.message.startsWith('__orion_ambient_error::')) {
      window.electron?.logToTerminal(`[Webview Ambient Error] ${e.message.substring('__orion_ambient_error::'.length)}`);
      console.error("[Webview Ambient Error]", e.message.substring('__orion_ambient_error::'.length));
    } else if (e.message && e.message.startsWith('__orion_ambient_log::')) {
      window.electron?.logToTerminal(`[Webview Ambient Log] ${e.message.substring('__orion_ambient_log::'.length)}`);
    }
  };

  const handleLoad = () => {
    try {
      if (window.electron?.injectScriptAllFrames) {
        const id = webview.getWebContentsId();
        window.electron?.logToTerminal(`[setupAmbientGlow handleLoad] Injecting to all frames for ID: ${id}`);
        window.electron.injectScriptAllFrames(id, AMBIENT_INJECTION_SCRIPT).catch((err) => {
          window.electron?.logToTerminal(`[setupAmbientGlow handleLoad] injectScriptAllFrames promise rejected: ${err.message}`);
        });
      } else {
        window.electron?.logToTerminal("[setupAmbientGlow handleLoad] injectScriptAllFrames missing, using executeJavaScript");
        webview.executeJavaScript(AMBIENT_INJECTION_SCRIPT).catch((err) => {
          window.electron?.logToTerminal(`[setupAmbientGlow handleLoad] executeJavaScript promise rejected: ${err.message}`);
        });
      }
    } catch (e) {
      window.electron?.logToTerminal(`[setupAmbientGlow handleLoad] Exception caught: ${e.message}`);
      console.warn("Ambient injection failed (webview not ready):", e);
    }
  };

  webview.addEventListener('console-message', handleConsole);
  webview.addEventListener('did-finish-load', handleLoad);
  webview.addEventListener('dom-ready', handleLoad);
  webview.addEventListener('did-frame-finish-load', handleLoad);

  handleLoad();

  return () => {
    try {
      window.electron?.logToTerminal("[setupAmbientGlow] Cleaning up listeners.");
      webview.removeEventListener('console-message', handleConsole);
      webview.removeEventListener('did-finish-load', handleLoad);
      webview.removeEventListener('dom-ready', handleLoad);
      webview.removeEventListener('did-frame-finish-load', handleLoad);
    } catch {}
  };
}
