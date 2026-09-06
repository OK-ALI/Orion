function dispatchPlaybackCommand(command, socket, pendingCommands, notify, ordinaryTimeout) {
  return new Promise((resolve) => {
    const timeoutMs = command.action === "play" && command.playbackProtocolVersion === 1 ? 6000 : ordinaryTimeout;
    command.deadlineAt = Date.now() + timeoutMs;
    const timer = setTimeout(() => {
      pendingCommands.delete(command.id);
      notify("orion:remote-command", { action: "cancel_playback_operation", id: command.id });
      resolve({ id: command.id, sequence: command.sequence, ok: false, appliedAt: Date.now(),
        error: "Desktop did not acknowledge the command in time.", controllerRevision: command.controllerRevision });
    }, timeoutMs);
    pendingCommands.set(command.id, { resolve, timer, socket, sequence: command.sequence, controllerRevision: command.controllerRevision });
    notify("orion:remote-command", command);
  });
}

module.exports = { dispatchPlaybackCommand };
