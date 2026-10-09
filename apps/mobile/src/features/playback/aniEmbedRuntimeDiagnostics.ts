/** Passive P102 data only: no URLs, storage, commands, listeners or timers. */
export function createAniEmbedRuntimeDiagnosticScript(): string {
  return `var aniEmbedDiagnostics = (function() {
    var ids = new WeakMap(), nextId = 0, history = [], events = {};
    var hostSeekRequests = 0, lastHostTarget = null, firstId = 0, firstChanges = 0;
    function id(video) {
      if (!ids.has(video) && nextId < 64) ids.set(video, ++nextId);
      return ids.get(video) || 0;
    }
    function number(value, maximum) {
      return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= maximum
        ? Math.round(value * 1000) / 1000 : null;
    }
    function media(video) {
      var rect = video.getBoundingClientRect();
      return { id: id(video), time: number(video.currentTime, 86400), duration: number(video.duration, 86400),
        paused: video.paused === true, seeking: video.seeking === true, connected: video.isConnected === true,
        ready: number(video.readyState, 4), network: number(video.networkState, 3),
        error: video.error ? number(video.error.code, 4) : null,
        width: number(rect.width, 8192), height: number(rect.height, 8192) };
    }
    return {
      observe: function(video, event) {
        try {
          if (!['attached','sample','playing','pause','waiting','stalled','seeking','seeked','ended','error','durationchange'].includes(event)) return;
          events[event] = Math.min(64, (events[event] || 0) + 1);
          if (event !== 'sample') {
            var entry = media(video); entry.event = event;
            history.push(entry); if (history.length > 6) history.shift();
          }
        } catch (_) {}
      },
      noteHostSeek: function(target) {
        hostSeekRequests = Math.min(64, hostSeekRequests + 1);
        lastHostTarget = number(target, 86400);
      },
      snapshot: function() {
        var videos = Array.from(document.querySelectorAll('video')).slice(0, 4);
        var currentId = videos.length ? id(videos[0]) : 0;
        if (currentId !== firstId) { firstId = currentId; firstChanges = Math.min(64, firstChanges + 1); }
        return { firstId: firstId, firstChanges: firstChanges, hostSeekRequests: hostSeekRequests,
          lastHostTarget: lastHostTarget, videos: videos.map(media), history: history.slice(), events: Object.assign({}, events) };
      }
    };
  })();`;
}
