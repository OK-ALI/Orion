"use strict";

const DEFAULT_MAX_DEPTH = 24;

function createReliableCommandScheduler({
  maxDepth = DEFAULT_MAX_DEPTH,
  isCurrent = () => true,
  isPreemptible = () => false,
  execute = async () => ({ ok: true }),
  cancelActive = () => {},
  deliver = () => {},
} = {}) {
  const limit = Math.max(1, Math.floor(Number(maxDepth) || DEFAULT_MAX_DEPTH));
  const queue = [];
  const detached = new Set();
  let active = null;
  let draining = false;
  let closed = false;

  const depth = () => queue.length + (active ? 1 : 0) + detached.size;
  const failure = (entry, code, error) => ({
    id: entry?.command?.id,
    sequence: entry?.command?.sequence,
    ok: false,
    appliedAt: Date.now(),
    code,
    error,
    controllerRevision: entry?.controllerRevision,
  });

  const finish = (entry, result) => {
    const reason = entry?.cancelReason;
    if (reason) {
      deliver(entry, failure(entry, "RELIABLE_COMMAND_CANCELLED", reason));
      return;
    }
    if (!isCurrent(entry)) {
      deliver(entry, failure(entry, "CONTROLLER_EPOCH_STALE", "Controller ownership changed before the command completed."));
      return;
    }
    deliver(entry, result);
  };

  const cancelDetached = (reason) => {
    for (const entry of detached) {
      if (!entry.cancelReason) entry.cancelReason = reason;
      cancelActive(entry, reason);
    }
  };

  const drain = async () => {
    if (draining || closed || active) return;
    draining = true;
    try {
      while (!closed && !active && queue.length) {
        const entry = queue.shift();
        if (!isCurrent(entry)) {
          deliver(entry, failure(entry, "CONTROLLER_EPOCH_STALE", "Controller ownership changed before the command could run."));
          continue;
        }

        if (detached.size) {
          cancelDetached("Superseded by a newer reliable command.");
        }

        if (isPreemptible(entry)) {
          detached.add(entry);
          Promise.resolve()
            .then(() => execute(entry))
            .then((result) => finish(entry, result))
            .catch((error) => finish(entry, failure(entry, "RELIABLE_COMMAND_FAILED", error?.message || "Reliable command failed.")))
            .finally(() => {
              detached.delete(entry);
              if (!closed && queue.length && !active) void drain();
            });
          continue;
        }

        active = entry;
        try {
          const result = await execute(entry);
          finish(entry, result);
        } catch (error) {
          finish(entry, failure(entry, "RELIABLE_COMMAND_FAILED", error?.message || "Reliable command failed."));
        } finally {
          if (active === entry) active = null;
        }
      }
    } finally {
      draining = false;
      if (!closed && queue.length && !active) Promise.resolve().then(drain);
    }
  };

  const enqueue = (entry) => {
    if (closed) return { ok: false, code: "RELIABLE_SCHEDULER_CLOSED", depth: depth() };
    if (depth() >= limit) return { ok: false, code: "RELIABLE_QUEUE_FULL", depth: depth() };
    queue.push(entry);
    void drain();
    return { ok: true, depth: depth() };
  };

  const invalidate = (predicate = () => true, reason = "Reliable command scheduling was reset.") => {
    const kept = [];
    for (const entry of queue) {
      if (predicate(entry)) {
        entry.cancelReason = reason;
        deliver(entry, failure(entry, "RELIABLE_COMMAND_CANCELLED", reason));
      } else kept.push(entry);
    }
    queue.splice(0, queue.length, ...kept);

    if (active && predicate(active)) {
      active.cancelReason = reason;
      cancelActive(active, reason);
    }
    for (const entry of detached) {
      if (!predicate(entry)) continue;
      entry.cancelReason = reason;
      cancelActive(entry, reason);
    }
  };

  const close = (reason = "Reliable command scheduler closed.") => {
    invalidate(() => true, reason);
    closed = true;
  };

  const snapshot = () => ({
    active: Boolean(active),
    detached: detached.size,
    queued: queue.length,
    depth: depth(),
    maxDepth: limit,
    closed,
  });

  return { close, enqueue, invalidate, snapshot };
}

module.exports = { createReliableCommandScheduler, DEFAULT_MAX_DEPTH };
