const systemControl = require("./systemControl");

function isSystemCommand(action) {
  return (
    typeof action === "string" &&
    (action.startsWith("system.volume.") || action.startsWith("display.brightness."))
  );
}

async function executeSystemCommand(command) {
  const { action, value } = command;
  if (action === "system.volume.get") {
    return await systemControl.getSystemVolume();
  }
  if (action === "system.volume.set") {
    return await systemControl.setSystemVolume(Number(value));
  }
  if (action === "system.volume.mute") {
    return await systemControl.setSystemMute(value);
  }
  if (action === "display.brightness.get") {
    return await systemControl.getDisplayBrightness();
  }
  if (action === "display.brightness.set") {
    return await systemControl.setDisplayBrightness(Number(value));
  }
  return { ok: false, error: `Unknown system command: ${action}` };
}

function dispatchPlaybackCommand(command, socket, pendingCommands, notify, ordinaryTimeout) {
  if (isSystemCommand(command?.action)) {
    return executeSystemCommand(command).then((result) => ({
      id: command.id,
      sequence: command.sequence,
      ok: result?.ok !== false,
      appliedAt: Date.now(),
      commandResult: result,
      error: result?.error,
      controllerRevision: command.controllerRevision,
    }));
  }

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

function initSystemControlBroadcasting(getConnectedSockets, sendSocket) {
  systemControl.init();
  systemControl.onSystemVolumeChanged((snap) => {
    try {
      const sockets = typeof getConnectedSockets === "function" ? getConnectedSockets() : getConnectedSockets;
      if (!sockets) return;
      for (const [deviceId, socket] of sockets) {
        sendSocket(socket, "system_status", deviceId, snap);
      }
    } catch {}
  });
}

module.exports = {
  dispatchPlaybackCommand,
  initSystemControlBroadcasting,
  systemControl,
};

