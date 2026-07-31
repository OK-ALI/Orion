export function handleNativePlayerKey(event, video, actions = {}) {
  if (!video || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return false;
  const target = event.target;
  if (target?.closest?.("input, textarea, select, [contenteditable='true']")) return false;
  const key = String(event.key || "").toLowerCase();
  const duration = Number(video.duration) || 0;
  let handled = true;
  if (key === " " || key === "k") video.paused ? video.play().catch(() => {}) : video.pause();
  else if (key === "j" || key === "arrowleft") video.currentTime = Math.max(0, video.currentTime - 10);
  else if (key === "l" || key === "arrowright") video.currentTime = Math.min(duration || Infinity, video.currentTime + 10);
  else if (key === "arrowup") video.volume = Math.min(1, video.volume + 0.1);
  else if (key === "arrowdown") video.volume = Math.max(0, video.volume - 0.1);
  else if (key === "m") video.muted = !video.muted;
  else if (key === "f") {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else video.requestFullscreen?.().catch(() => {});
  } else if (key === "i") actions.onMini?.();
  else if (event.shiftKey && key === "n") actions.onNext?.();
  else if (event.shiftKey && key === "p") actions.onPrevious?.();
  else if (key === "home" || key === "0") video.currentTime = 0;
  else if (key === "end") video.currentTime = Math.max(0, duration - 0.25);
  else if (/^[1-9]$/.test(key) && duration) video.currentTime = duration * (Number(key) / 10);
  else if (key === ">") video.playbackRate = Math.min(2, Math.round((video.playbackRate + 0.25) * 4) / 4);
  else if (key === "<") video.playbackRate = Math.max(0.25, Math.round((video.playbackRate - 0.25) * 4) / 4);
  else if (key === "c") {
    const tracks = Array.from(video.textTracks || []);
    const showing = tracks.some((track) => track.mode === "showing");
    tracks.forEach((track, index) => { track.mode = !showing && index === 0 ? "showing" : "disabled"; });
  } else handled = false;
  if (handled) event.preventDefault();
  return handled;
}
