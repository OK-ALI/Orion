export const mobileAdBlockerScript = `
  (function() {
    window.open = function() { return null; };
    window.alert = function() {};

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
        "[class*='adblock-detector']"
      ];
      document.querySelectorAll(selectors.join(',')).forEach(function(element) {
        element.remove();
      });
    }

    document.addEventListener('DOMContentLoaded', removeAds);
    setInterval(removeAds, 1000);
    document.addEventListener('click', function(event) {
      var anchor = event.target && event.target.closest
        ? event.target.closest('a[target="_blank"]')
        : null;
      if (anchor) {
        event.preventDefault();
        event.stopImmediatePropagation();
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

export function createVerifiedResumeScript(seconds: number): string {
  const safeTime = Math.max(0, Math.floor(Number(seconds) || 0));
  return `
    (function() {
      var video = document.querySelector('video');
      if (!video || !Number.isFinite(video.duration) || ${safeTime} <= 0) return false;
      video.currentTime = Math.min(video.duration, ${safeTime});
      return true;
    })();
    true;
  `;
}
