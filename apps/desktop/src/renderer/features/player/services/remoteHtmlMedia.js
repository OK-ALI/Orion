import { playMediaWithin } from "@orion/shared/remote-media-play";

function finite(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Read the attached media element, never a saved handoff snapshot. */
export function readHtmlMedia(media) {
  if (!media || media.isConnected === false) return null;
  const readyState = finite(media.readyState) ?? 0;
  let bufferedTime = null;
  try {
    if (media.buffered?.length) bufferedTime = finite(media.buffered.end(media.buffered.length - 1));
  } catch {
    // Ranges can disappear as the media source is replaced.
  }
  return {
    currentTime: readyState >= 1 ? finite(media.currentTime) : null,
    duration: readyState >= 1 ? finite(media.duration) : null,
    bufferedTime,
    paused: Boolean(media.paused),
    muted: Boolean(media.muted),
    volume: finite(media.volume),
    playbackRate: finite(media.playbackRate),
    readyState,
    buffering: !media.paused && readyState < 3,
    controlReady: !media.error && readyState >= 2,
  };
}

/** Operate once on this element. Readiness waiting belongs to the command owner. */
export async function controlHtmlMedia(media, command, options = {}) {
  const fail = (error) => ({ ok: false, error });
  const before = readHtmlMedia(media);
  if (options.signal?.aborted || Date.now() >= (options.deadlineAt ?? Infinity)) return fail("The command expired.");
  if (!before) return fail("No active video was found yet.");
  if (media.error) return fail("The local media could not be played.");
  const action = command === "playPause" ? "toggle" : String(command);
  const wantsPlay = action === "play" || (action === "toggle" && before.paused);
  const wantsPause = action === "pause" || action === "stop" || (action === "toggle" && !before.paused);
  const source = media.currentSrc;
  try {
    if (wantsPlay) {
      if (!before.controlReady) return fail("No active video was found yet.");
      await playMediaWithin(media, options);
    } else if (wantsPause) {
      media._orionPendingRemotePlay?.();
      media.pause();
    } else if (["mute", "unmute", "toggleMute"].includes(action)) {
      media.muted = action === "toggleMute" ? !media.muted : action === "mute";
    } else if (action === "volumeUp" || action === "volumeDown") {
      if (action === "volumeUp") media.muted = false;
      media.volume = Math.max(0, Math.min(1, media.volume + (action === "volumeUp" ? 0.05 : -0.05)));
    } else if (action.startsWith("speed:")) {
      const speed = Number(action.slice(6));
      if (!Number.isFinite(speed) || speed < 0.25 || speed > 4) return fail("The requested playback speed is invalid.");
      media.playbackRate = speed;
    } else if (["restart", "seekBackward", "seekForward"].includes(action) || action.startsWith("seek:")) {
      if (before.duration == null || before.duration <= 0 || before.currentTime == null) {
        return fail("Seeking is unavailable until media timing is known.");
      }
      const seconds = action === "restart" ? 0 : action === "seekBackward" ? before.currentTime - 10
        : action === "seekForward" ? before.currentTime + 10 : Number(action.slice(5));
      if (!Number.isFinite(seconds) || (action.startsWith("seek:") && !action.slice(5).trim())) {
        return fail("The requested seek position is invalid.");
      }
      media.currentTime = Math.max(0, Math.min(before.duration, seconds));
    } else {
      return fail("This media command is unsupported.");
    }
    const state = readHtmlMedia(media);
    if (!state || media.error || media.currentSrc !== source) return fail("The playback target changed while applying the command.");
    if ((wantsPlay && state.paused) || (wantsPause && !state.paused)) {
      return fail("The media did not confirm the requested playback state.");
    }
    return { ok: true, state };
  } catch {
    // Do not expose media URLs or provider error details through Connect.
    return fail("The media did not accept the requested command.");
  }
}
