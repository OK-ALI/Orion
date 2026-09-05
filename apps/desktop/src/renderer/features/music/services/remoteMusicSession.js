// A view of MusicProvider's controller, not another queue or playback owner.
let controller = null;
let identity = { key: "", stream: null, owner: "", revision: "" };

export function updateRemoteMusicController(value) { controller = value; }
const trackId = (track) => track ? `music:${track.provider || "music"}:${track.id}` : "";

export function getRemoteMusicSession() {
  const music = controller;
  if (!music?.current || music.playbackStatus === "idle") return null;
  const id = trackId(music.current);
  if (identity.key !== id) identity = { key: id, stream: music.stream, owner: crypto.randomUUID(), revision: crypto.randomUUID() };
  else if (identity.stream !== music.stream) identity = { ...identity, stream: music.stream, revision: crypto.randomUUID() };
  const source = music.stream;
  const valid = () => trackId(controller?.current) === id && controller?.stream === source;
  const read = () => valid() && source?.url ? music.engineRef.current?.readRemoteState?.(source.url) : null;
  return {
    id, mediaId: music.current.id, title: music.current.title, kind: "music", mode: "music",
    sourceId: music.current.provider || "music", sourceLabel: "Music Planet",
    remoteOwnerId: identity.owner, remoteAttachmentId: source?.url ? identity.revision : null,
    remoteRevision: identity.revision, handoffPending: !source?.url,
    readPlaybackState: read,
    nextAction: music.remoteQueueTarget?.("next") != null,
    previousAction: music.remoteQueueTarget?.("previous") != null,
    stopPlayback() {
      if (!valid()) return false;
      const stopped = music.stop();
      if (stopped) controller = { ...controller, playbackStatus: "idle", playing: false };
      return stopped;
    },
    async changeQueue(action, operation) {
      if (!valid() || !operation.check()) return { ok: false };
      const nextIndex = music.remoteQueueTarget?.(action);
      const nextId = trackId(music.queue[nextIndex]);
      if (nextIndex == null || !nextId) return { ok: false };
      operation.expectTransition(nextId);
      if (action === "next") music.playNext(); else music.playPrevious();
      while (operation.check()) {
        const currentState = controller?.engineRef.current?.readRemoteState?.(controller?.stream?.url);
        if (controller?.index === nextIndex && trackId(controller?.current) === nextId
          && (nextIndex !== music.index || (currentState && currentState.currentTime <= 1))) return { ok: true, readiness: currentState?.controlReady ? "ready" : "loading" };
        await operation.until(new Promise((resolve) => setTimeout(resolve, 25)));
      }
      return { ok: false };
    },
    async controlPlayback(command, operation) {
      if (!valid() || !source?.url) return { ok: false, error: "Music is preparing its playback source." };
      const response = await music.engineRef.current?.controlRemote?.(command, operation, source.url);
      if (!response?.ok || !valid()) return { ok: false, error: "Music did not confirm the requested control." };
      const state = response.state;
      if (["play", "pause", "toggle", "playPause"].includes(command)) music.setPlaying(!state.paused);
      if (["volumeUp", "volumeDown"].includes(command)) music.setVolume(state.volume);
      if (["mute", "unmute", "toggleMute", "volumeUp"].includes(command)) music.setMuted(state.muted);
      return response;
    },
  };
}
