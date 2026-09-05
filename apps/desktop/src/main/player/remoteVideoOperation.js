const { playMediaWithin } = require("@orion/shared/remote-media-play");
const pending = new Map();

function cancelRemoteVideoOperation(senderId, id) {
  const operation = pending.get(`${senderId}:${id}`);
  if (!operation) return;
  operation.cancelled = true;
  if (operation.frame) operation.frame.executeJavaScript(`globalThis.__orionRemoteControls?.get(${JSON.stringify(operation.id)})?.abort()`)
    .catch(() => {});
}

function beginRemoteVideoOperation(senderId, options) {
  if (!options?.id || typeof options.id !== "string" || !Number.isFinite(options.deadlineAt)
    || options.deadlineAt <= Date.now() || pending.size >= 32) return null;
  const key = `${senderId}:${options.id}`;
  if (pending.has(key)) return null;
  const operation = { id: options.id, deadlineAt: Math.min(options.deadlineAt, Date.now() + 6000), cancelled: false, frame: null };
  pending.set(key, operation);
  operation.valid = () => !operation.cancelled && Date.now() < operation.deadlineAt;
  operation.finish = () => { clearTimeout(timer); pending.delete(key); };
  const timer = setTimeout(() => { cancelRemoteVideoOperation(senderId, options.id); operation.finish(); }, Math.max(0, operation.deadlineAt - Date.now()));
  return operation;
}

function remoteVideoScript(operation, action, body) {
  const id = JSON.stringify(operation.id);
  const guarded = action === "play" ? "await playMediaWithin(v, { signal: controller.signal, deadlineAt });"
    : action === "toggle" ? "if (v.paused) await playMediaWithin(v, { signal: controller.signal, deadlineAt }); else { v._orionPendingRemotePlay?.(); v.pause(); }"
      : body.replaceAll("await v.play();", "await playMediaWithin(v, { signal: controller.signal, deadlineAt });");
  return `
    const deadlineAt = ${operation.deadlineAt};
    if (Date.now() >= deadlineAt) return null;
    const controller = new AbortController();
    const controls = globalThis.__orionRemoteControls ||= new Map();
    controls.set(${id}, controller);
    const playMediaWithin = ${playMediaWithin.toString()};
    try {
      if (controller.signal.aborted || Date.now() >= deadlineAt) return null;
      ${action === "pause" ? "v._orionPendingRemotePlay?.();" : ""}
      ${guarded}
      if (controller.signal.aborted || Date.now() >= deadlineAt) return null;
    } finally { controls.delete(${id}); }
  `;
}

module.exports = { beginRemoteVideoOperation, cancelRemoteVideoOperation, remoteVideoScript };
