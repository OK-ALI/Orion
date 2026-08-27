export const mobileAdBlockerScript = `
  (function() {
    if (window.__orionCinemaCleanupInstalled) return true;
    window.__orionCinemaCleanupInstalled = true;
    var cosmeticEvidence = { popup: 0, navigation: 0, advertisement: 0 };
    var cosmeticFlushTimer = null;
    var cosmeticFlushes = 0;
    var removedElements = typeof WeakSet === 'function' ? new WeakSet() : null;

    function flushCosmeticEvidence() {
      cosmeticFlushTimer = null;
      if (!window.ReactNativeWebView || cosmeticFlushes >= 12) return;
      var total = cosmeticEvidence.popup + cosmeticEvidence.navigation + cosmeticEvidence.advertisement;
      if (total <= 0) return;
      cosmeticFlushes += 1;
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'ORION_COSMETIC_BLOCK',
        counts: cosmeticEvidence
      }));
      cosmeticEvidence = { popup: 0, navigation: 0, advertisement: 0 };
    }

    function recordCosmeticBlock(kind, amount) {
      if (!Object.prototype.hasOwnProperty.call(cosmeticEvidence, kind)) return;
      cosmeticEvidence[kind] += Math.max(1, Number(amount) || 1);
      if (!cosmeticFlushTimer && cosmeticFlushes < 12) {
        cosmeticFlushTimer = setTimeout(flushCosmeticEvidence, 900);
      }
    }

    window.open = function() {
      recordCosmeticBlock('popup', 1);
      return null;
    };
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

    var adSelectors = [
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

    function removeAds(root) {
      var scope = root && root.querySelectorAll ? root : document;
      if (root && root.matches && root.matches(adSelectors.join(','))) {
        if (!removedElements || !removedElements.has(root)) {
          if (removedElements) removedElements.add(root);
          recordCosmeticBlock('advertisement', 1);
        }
        root.remove();
      }
      scope.querySelectorAll(adSelectors.join(',')).forEach(function(element) {
        if (!removedElements || !removedElements.has(element)) {
          if (removedElements) removedElements.add(element);
          recordCosmeticBlock('advertisement', 1);
        }
        element.remove();
      });
      if (!scope.querySelectorAll) return;
      scope.querySelectorAll('a[target="_blank"], a[href]').forEach(function(anchor) {
        if ((isExternal(anchor) && coversPlayer(anchor)) || coversPlayer(anchor)) {
          if (!removedElements || !removedElements.has(anchor)) {
            if (removedElements) removedElements.add(anchor);
            recordCosmeticBlock(isExternal(anchor) ? 'navigation' : 'advertisement', 1);
          }
          anchor.remove();
        }
      });
    }

    var reportedTracks = Object.create(null);
    function reportTextTracks() {
      if (!window.ReactNativeWebView) return;
      document.querySelectorAll('video').forEach(function(video, videoIndex) {
        try {
          Array.from(video.textTracks || []).forEach(function(track, trackIndex) {
            var language = String(track.language || 'und').slice(0, 12);
            var label = String(track.label || track.kind || 'Embedded subtitles').slice(0, 80);
            var identity = [videoIndex, trackIndex, language, label].join(':');
            if (reportedTracks[identity]) return;
            reportedTracks[identity] = true;
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'ORION_SUBTITLE_TRACK',
              language: language,
              label: label,
              method: 'text-track'
            }));
          });
        } catch (_) {}
      });
    }

    function installObserver() {
      removeAds();
      reportTextTracks();
      var remaining = 80;
      var observer = new MutationObserver(function(mutations) {
        if (remaining <= 0) return observer.disconnect();
        mutations.forEach(function(mutation) {
          Array.prototype.forEach.call(mutation.addedNodes || [], function(node) {
            if (node && node.nodeType === 1) removeAds(node);
          });
        });
        remaining -= 1;
        if (remaining <= 0) observer.disconnect();
      });
      observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
      // Text tracks change far less frequently than player DOM. Sample them
      // separately so subtitle discovery never rescans on every video mutation.
      setTimeout(reportTextTracks, 1800);
      setTimeout(reportTextTracks, 6000);
      setTimeout(function() {
        observer.disconnect();
      }, 20000);
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
        recordCosmeticBlock(anchor.target === '_blank' ? 'popup' : 'navigation', 1);
        return false;
      }
    }, true);
  })();
  true;
`;

/**
 * Applies narrowly scoped provider presentation repairs. These scripts do not
 * inspect or modify media requests, playback elements, or shield decisions.
 */
export function createProviderPresentationScript(sourceId: string): string {
  if (sourceId !== 'vidking') return 'true;';

  return `
    (function () {
      if (window.__orionVidKingSubtitleScrollInstalled) return true;
      window.__orionVidKingSubtitleScrollInstalled = true;

      var observer = null;
      var stopTimer = null;
      var scheduled = [];

      function isSubtitleDialog(node) {
        if (!node || !node.querySelector) return false;
        var search = node.querySelector('input[type="search"], input[placeholder*="language" i]');
        if (!search) return false;
        var text = String(node.textContent || '').slice(0, 1600).toLowerCase();
        return text.indexOf('subtitle') !== -1 &&
          (text.indexOf('advanced') !== -1 || text.indexOf('language') !== -1);
      }

      function patchDialog(dialog) {
        var viewportHeight = window.visualViewport
          ? window.visualViewport.height
          : window.innerHeight;
        dialog.style.setProperty(
          'max-height',
          Math.max(280, Math.floor(viewportHeight - 24)) + 'px',
          'important'
        );
        dialog.style.setProperty('overflow-y', 'auto', 'important');
        dialog.style.setProperty('overscroll-behavior', 'contain', 'important');
        dialog.style.setProperty('touch-action', 'pan-y', 'important');
        dialog.style.setProperty('-webkit-overflow-scrolling', 'touch', 'important');
        dialog.style.setProperty('min-height', '0', 'important');
        dialog.setAttribute('data-orion-scroll-fixed', 'vidking-subtitles');
      }

      function applyRepair() {
        var candidates = document.querySelectorAll(
          '[role="dialog"], [aria-modal="true"], dialog, .modal, [class*="modal" i]'
        );
        for (var i = 0; i < candidates.length; i += 1) {
          if (isSubtitleDialog(candidates[i])) patchDialog(candidates[i]);
        }
      }

      function stopObservation() {
        if (observer) observer.disconnect();
        observer = null;
        if (stopTimer) clearTimeout(stopTimer);
        stopTimer = null;
        scheduled.forEach(clearTimeout);
        scheduled = [];
      }

      function armRepair() {
        stopObservation();
        applyRepair();
        if (!document.documentElement) return;
        observer = new MutationObserver(applyRepair);
        observer.observe(document.documentElement, { childList: true, subtree: true });
        [80, 220, 500, 900].forEach(function (delay) {
          scheduled.push(setTimeout(applyRepair, delay));
        });
        stopTimer = setTimeout(stopObservation, 1600);
      }

      document.addEventListener('click', armRepair, true);
      window.addEventListener('resize', applyRepair, { passive: true });
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', applyRepair, { passive: true });
      }
      armRepair();
      return true;
    })();
    true;
  `;
}

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
        if (video && Number.isFinite(video.duration) && video.duration > 0) {
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
