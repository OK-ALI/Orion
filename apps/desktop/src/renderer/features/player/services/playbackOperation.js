import { playbackTargetKey } from "./remotePlaybackSession";

export const PLAY_READINESS_MS = 5_000;
export const PLAY_COMMAND_MS = 6_000;
export const ORDINARY_COMMAND_MS = 1_800;

function ownerKey(session) {
  return JSON.stringify([session?.id, session?.sourceId || session?.playerSource, session?.mode, session?.remoteOwnerId]);
}

/** One cancellable command, scoped to its live playback owner and local clock. */
export function createPlaybackOperation({ getSession, getOwner, expected = {}, command, execution = {} }) {
  const initial = getSession();
  const initialOwner = getOwner();
  const identity = ownerKey(initial);
  let targetKey = !initial?.handoffPending && (initial?.webContentsId || initial?.controlPlayback) ? playbackTargetKey(initial) : null;
  let transitionId = null;
  const controller = new AbortController();
  const id = crypto.randomUUID();
  const startedAt = Date.now();
  const maximum = command === "play" ? PLAY_COMMAND_MS : ORDINARY_COMMAND_MS;
  const deadlineAt = Math.min(startedAt + maximum, Number(execution.deadlineAt) || Infinity);
  const abort = (code) => { if (!controller.signal.aborted) controller.abort(code); };
  const check = () => {
    const current = getSession();
    if (Date.now() >= deadlineAt) abort("command-expired");
    else if (!current || getOwner() !== initialOwner || (ownerKey(current) !== identity && current.id !== transitionId)
      || (targetKey && playbackTargetKey(current) !== targetKey)) abort("stale-control-target");
    return !controller.signal.aborted;
  };
  if ((expected.sessionId && String(initial?.id || initial?.mediaId || initial?.item?.id) !== String(expected.sessionId))
    || (expected.sourceId && String(initial?.sourceId || initial?.playerSource || "") !== String(expected.sourceId))
    || (expected.ownerRevision && expected.ownerRevision !== initial?.remoteRevision)) abort("stale-control-target");
  execution.signal?.addEventListener("abort", () => abort("command-cancelled"), { once: true, signal: controller.signal });
  if (execution.signal?.aborted) abort("command-cancelled");
  const timer = setInterval(check, 25);
  const until = async (promise) => {
    if (!check()) throw new Error(controller.signal.reason);
    return new Promise((resolve, reject) => {
      const cancelled = () => reject(new Error(controller.signal.reason));
      controller.signal.addEventListener("abort", cancelled, { once: true });
      Promise.resolve(promise).then((value) => {
        controller.signal.removeEventListener("abort", cancelled);
        if (check()) resolve(value); else cancelled();
      }, (error) => { controller.signal.removeEventListener("abort", cancelled); reject(error); });
    });
  };
  return {
    id, deadlineAt, signal: controller.signal, check, until,
    getSession,
    expectTransition(sessionId) { transitionId = sessionId; targetKey = null; },
    bindTarget(session) { targetKey = playbackTargetKey(session); return check(); },
    async ready(read) {
      const readyUntil = Math.min(startedAt + PLAY_READINESS_MS, deadlineAt - 100);
      while (check() && Date.now() < readyUntil) {
        const session = getSession();
        const queriedKey = playbackTargetKey(session);
        // A hung query must not extend the readiness budget or block a replacement.
        let queryTimer;
        const state = await until(Promise.race([
          read(session), new Promise((resolve) => { queryTimer = setTimeout(() => resolve(null), Math.min(250, readyUntil - Date.now())); }),
        ])).finally(() => clearTimeout(queryTimer));
        if (Date.now() >= readyUntil) break;
        if (queriedKey === playbackTargetKey(getSession()) && (state?.controlReady === true || (state?.controlReady !== false && Number(state?.readyState) >= 2))) {
          return this.bindTarget(getSession());
        }
        await until(new Promise((resolve) => setTimeout(resolve, Math.min(100, readyUntil - Date.now()))));
      }
      return false;
    },
    finish() { clearInterval(timer); abort("command-finished"); },
  };
}
