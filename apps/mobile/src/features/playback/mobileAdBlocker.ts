export const mobileAdBlockerScript = `
  (function() {
    if (window.__orionCinemaCleanupInstalled) return true;
    window.__orionCinemaCleanupInstalled = true;
    window.open = function() { return null; };
    window.alert = function() {};

    function isExternal(anchor) {
      try {
        if (!anchor || !anchor.href) return false;
        return new URL(anchor.href, location.href).origin !== location.origin;
      } catch (_) { return true; }
    }

    function coversPlayer(element) {
      try {
        var style = getComputedStyle(element);
        var rect = element.getBoundingClientRect();
        var viewport = Math.max(1, innerWidth * innerHeight);
        return (style.position === 'fixed' || style.position === 'absolute') &&
          rect.width * rect.height > viewport * 0.55 &&
          (Number(style.opacity || 1) < 0.08 || element.tagName === 'A');
      } catch (_) { return false; }
    }

    function removeAds() {
      var selectors = [
        "iframe[src*='doubleclick.net']",
        "iframe[src*='googlesyndication.com']",
        "iframe[src*='profitableratecpm.com']",
        "iframe[src*='adexchangeclear.com']",
        "ins.adsbygoogle",
        "[id^='google_ads_']",
        "div[style*='z-index: 2147483647']",
        "a[target='_blank'][style*='position: fixed']",
        "[class*='ad-overlay']",
        "[class*='popunder']",
        "[class*='adblock-detector']",
        "iframe[src*='gsbdom.click']",
        "iframe[src*='popcash.net']",
        "iframe[src*='exoclick.com']"
      ];
      document.querySelectorAll(selectors.join(',')).forEach(function(element) {
        element.remove();
      });
      document.querySelectorAll('a[target="_blank"], a[href]').forEach(function(anchor) {
        if ((isExternal(anchor) && coversPlayer(anchor)) || coversPlayer(anchor)) anchor.remove();
      });
    }

    function installObserver() {
      removeAds();
      var remaining = 80;
      var observer = new MutationObserver(function() {
        removeAds();
        remaining -= 1;
        if (remaining <= 0) observer.disconnect();
      });
      observer.observe(document.documentElement || document.body, { childList: true, subtree: true, attributes: true });
      setTimeout(function() { observer.disconnect(); }, 30000);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installObserver, { once: true });
    else installObserver();
    document.addEventListener('click', function(event) {
      var anchor = event.target && event.target.closest
        ? event.target.closest('a')
        : null;
      if (anchor && (anchor.target === '_blank' || isExternal(anchor))) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return false;
      } else if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'TAP' }));
      }
    }, true);
    document.addEventListener('touchstart', function() {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'TAP' }));
      }
    }, { passive: true });
  })();
  true;
`;

export function createVerifiedResumeScript(seconds: number, handoffId: string): string {
  const safeTime = Math.max(0, Math.floor(Number(seconds) || 0));
  const safeHandoffId = JSON.stringify(String(handoffId || 'resume'));
  return `
    (function() {
      var handoffId = ${safeHandoffId};
      if (window.__orionResumeHandoffId === handoffId) return true;
      window.__orionResumeHandoffId = handoffId;
      var attempts = 0;
      var done = false;
      function report(status, actualTime) {
        if (done) return;
        done = true;
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'ORION_RESUME_RESULT',
            handoffId: handoffId,
            status: status,
            actualTime: Number.isFinite(actualTime) ? actualTime : null
          }));
        }
      }
      function attempt() {
        if (done || window.__orionResumeHandoffId !== handoffId) return;
        attempts += 1;
        var video = document.querySelector('video');
        if (video && Number.isFinite(video.duration) && video.duration > 0 && ${safeTime} > 0) {
          video.currentTime = Math.min(video.duration, ${safeTime});
          setTimeout(function() {
            if (Math.abs(Number(video.currentTime) - ${safeTime}) <= 5) report('applied', Number(video.currentTime));
            else if (attempts >= 32) report('unavailable', Number(video.currentTime));
            else setTimeout(attempt, 250);
          }, 100);
          return;
        }
        if (attempts >= 32) report('unavailable', null);
        else setTimeout(attempt, 250);
      }
      attempt();
      return true;
    })();
    true;
  `;
}
