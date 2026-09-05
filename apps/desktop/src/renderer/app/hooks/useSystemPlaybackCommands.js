import { useCallback } from "react";
import { getPlaybackOwner } from "../playback/PlaybackCoordinator";
import { playbackTargetKey, readRemotePlaybackState, controlRemotePlayback } from "../../features/player/services/remotePlaybackSession";
import { createPlaybackOperation } from "../../features/player/services/playbackOperation";
import { getRemoteMusicSession } from "../../features/music/services/remoteMusicSession";

export function useSystemPlaybackCommands({ playbackSessionRef, setPlaybackSession, setMiniPlayer }) {
  return useCallback(async (command, expected = {}, execution = {}) => {
    const failure = (session, failureCode, error, readiness = "unavailable") => ({
      ok: false, error, commandResult: { applied: false, sessionId: session?.id || null, sourceId: session?.sourceId || session?.playerSource || null, readiness, failureCode },
    });
    // AudioEngine keeps its existing system-key subscription. Connect uses this adapter.
    if (getPlaybackOwner() === "music" && !execution.signal) return failure(null, "system-owner", "Music owns the system media controls.");
    const getSession = () => getPlaybackOwner() === "music" ? getRemoteMusicSession() : playbackSessionRef.current;
    let session = getSession();
    if (!session) return failure(null, "player-unavailable", "No player is active.");
    const identityMatches = (candidate) => (!expected?.sessionId || String(candidate?.id || candidate?.mediaId || candidate?.item?.id) === String(expected.sessionId))
      && (!expected?.sourceId || String(candidate?.sourceId || candidate?.playerSource || "") === String(expected.sourceId));
    if (!identityMatches(session)) return failure(session, "stale-control-target", "The player source changed before the command was applied.", "failed");

    const operation = createPlaybackOperation({ getSession, getOwner: getPlaybackOwner, expected, command, execution });
    const ownerMatches = () => operation.check();
    try {
    const control = async (action) => {
      if (!ownerMatches()) return { ok: false, error: "The playback owner changed." };
      const targetKey = playbackTargetKey(session);
      const result = await operation.until(controlRemotePlayback(session, action, window.electron, operation));
      if (!ownerMatches() || playbackTargetKey(getSession()) !== targetKey) return { ok: false, error: "The playback target changed." };
      return result;
    };

    if (command === "play") {
      const ready = await operation.ready((target) => readRemotePlaybackState(target, window.electron, { controlReadiness: true }));
      if (!ready) return failure(session, "player-not-ready", "The provider player is not ready for remote control.", "loading");
      session = getSession();
    }
    if (!ownerMatches()) return failure(session, "stale-control-target", "The player changed before the command was applied.", "failed");
    if (session.kind === "music" && ["next", "previous"].includes(command)) {
      const result = await operation.until(session.changeQueue(command, operation));
      return result?.ok ? { ok: true, commandResult: { applied: true, appliedState: "unchanged", sessionId: getSession()?.id, sourceId: getSession()?.sourceId, readiness: result.readiness } }
        : failure(session, "capability-unavailable", "The Music queue did not confirm that selection.", "limited");
    }
    if (session.kind === "music" && command === "stop") {
      const stopped = session.stopPlayback();
      return stopped ? { ok: true, commandResult: { applied: true, appliedState: "paused", sessionId: session.id, sourceId: session.sourceId, readiness: "unavailable" } }
        : failure(session, "provider-control-limited", "Music did not confirm stop.", "limited");
    }
    if (command === "next") {
      session.nextAction?.();
      const ok = Boolean(session.nextAction);
      return ok ? { ok, commandResult: { applied: true, appliedState: "unchanged", sessionId: session.id || null, sourceId: session.sourceId || session.playerSource || null, readiness: "ready" } }
        : failure(session, "capability-unavailable", "No next item is available.", "limited");
    }
    if (command === "previous") {
      const targetKey = playbackTargetKey(session);
      const state = await operation.until(readRemotePlaybackState(session, window.electron));
      if (!ownerMatches() || playbackTargetKey(playbackSessionRef.current) !== targetKey) return failure(session, "stale-control-target", "The player changed before restart.", "failed");
      if (Number(state?.currentTime) > 5 || session.mediaType !== "tv") {
        if (session.webContentsId || session.controlPlayback) {
          const response = await control("restart");
          if (!response?.ok) return failure(session, "provider-control-limited", response?.error || "The provider did not accept restart.", "limited");
        } else {
          return failure(session, "provider-control-limited", "This playback surface must be restarted in its own player.", "limited");
        }
      } else if (session.previousAction) session.previousAction();
      else return failure(session, "capability-unavailable", "No previous item is available.", "limited");
      return { ok: true, commandResult: { applied: true, appliedState: "unchanged", sessionId: session.id || null, sourceId: session.sourceId || session.playerSource || null, readiness: "ready" } };
    }
    if (command === "stop") {
      if (session.webContentsId || session.controlPlayback) {
        const response = await control("pause");
        if (!response?.ok) return failure(session, "provider-control-limited", response?.error || "The provider did not accept stop.", "limited");
      }
      if (session.mode === "popout") window.electron?.closePipWindow?.();
      window.dispatchEvent(new CustomEvent("orion:media-command", { detail: "stop" }));
      setMiniPlayer(null);
      setPlaybackSession(null);
      return { ok: true, commandResult: { applied: true, appliedState: "paused", sessionId: session.id || null, sourceId: session.sourceId || session.playerSource || null, readiness: "ready" } };
    }
    const normalized = command === "playPause" ? "toggle" : command;
    if (session.webContentsId || session.controlPlayback) {
      const response = await control(normalized);
      if (!response?.ok) return failure(session, response?.error === "No active video was found yet." ? "player-not-ready" : "provider-control-limited", response?.error || "The player control boundary is unavailable.", response?.error === "No active video was found yet." ? "loading" : "limited");
      const appliedState = normalized === "play" ? "playing" : normalized === "pause" ? "paused" : "unchanged";
      return { ...response, commandResult: { applied: true, appliedState, sessionId: session.id || null, sourceId: session.sourceId || session.playerSource || null, readiness: "ready" } };
    }
    return failure(session, "provider-control-limited", "This playback surface must be controlled in its provider player.", "limited");
    } catch {
      const code = operation.signal.aborted ? operation.signal.reason : "provider-control-limited";
      return failure(session, code, code === "command-expired" ? "The playback command expired." : "The playback command was cancelled or rejected.", "failed");
    } finally { operation.finish(); }
  }, [playbackSessionRef, setPlaybackSession, setMiniPlayer]);
}
