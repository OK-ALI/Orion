/** Self-contained so the same bounded Play implementation can run in a guest frame. */
function playMediaWithin(media, options = {}) {
  const deadlineAt = Math.min(Number(options.deadlineAt) || Infinity, Date.now() + 6000);
  if (!media || media.isConnected === false || media.error || Number(media.readyState) < 2
    || options.signal?.aborted || Date.now() >= deadlineAt) return Promise.reject(new Error("player-not-ready"));
  media._orionPendingRemotePlay?.();
  const source = media.currentSrc;
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer;
    const clean = () => {
      clearInterval(timer);
      options.signal?.removeEventListener("abort", cancel);
      media.removeEventListener?.("emptied", cancel);
      if (media._orionPendingRemotePlay === cancel) delete media._orionPendingRemotePlay;
    };
    const cancel = () => {
      if (settled) return;
      settled = true;
      // pause() aborts the outstanding play promise; no retry survives this request.
      if (media._orionPendingRemotePlay === cancel) media.pause();
      clean();
      reject(new Error("command-cancelled"));
    };
    const valid = () => !options.signal?.aborted && media.isConnected !== false && !media.error
      && media.currentSrc === source && Date.now() < deadlineAt;
    media._orionPendingRemotePlay = cancel;
    options.signal?.addEventListener("abort", cancel, { once: true });
    media.addEventListener?.("emptied", cancel, { once: true });
    timer = setInterval(() => { if (!valid()) cancel(); }, 20);
    let playing;
    try { playing = media.play(); } catch (error) { settled = true; clean(); reject(error); return; }
    Promise.resolve(playing).then(() => {
      if (settled) return;
      if (!valid()) { cancel(); return; }
      settled = true;
      clean();
      if (media.paused) reject(new Error("play-not-confirmed")); else resolve();
    }, (error) => { if (!settled) { settled = true; clean(); reject(error); } });
  });
}

module.exports = { playMediaWithin };
