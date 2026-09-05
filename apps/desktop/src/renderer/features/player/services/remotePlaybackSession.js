/** A handoff replaces the execution target even when the media identity stays the same. */
export function createMiniPlaybackSession(session, ownerId) {
  if (!session) return null;
  return {
    ...session,
    mode: "mini",
    remoteOwnerId: ownerId,
    remoteAttachmentId: null,
    webContentsId: null,
    readPlaybackState: undefined,
    controlPlayback: undefined,
    // Episode callbacks belong to the embedded page that is being destroyed.
    previousAction: undefined,
    nextAction: undefined,
    handoffPending: true,
  };
}

export function acceptMiniPlaybackOwner(session, owner) {
  if (!session || session.mode !== "mini" || !owner?.remoteOwnerId
      || session.remoteOwnerId !== owner.remoteOwnerId) return session;
  return {
    ...session,
    webContentsId: owner.webContentsId || null,
    remoteAttachmentId: owner.remoteAttachmentId || null,
    local: Boolean(owner.local),
    readPlaybackState: owner.readPlaybackState,
    controlPlayback: owner.controlPlayback,
    handoffPending: !owner.attached,
  };
}

export function playbackTargetKey(session) {
  if (!session) return "";
  return JSON.stringify([
    session.id || session.mediaId || session.item?.id || "active",
    session.sourceId || session.playerSource || "",
    session.mode || "embedded", session.remoteOwnerId || "",
    session.webContentsId || null, Boolean(session.local), session.remoteAttachmentId || "",
  ]);
}

export function readRemotePlaybackState(session, electron, options) {
  return Promise.resolve().then(() => {
    if (!session) return null;
    if (session.readPlaybackState) return session.readPlaybackState(options);
    if (session.webContentsId && electron?.queryVideoProgress) return options ? electron.queryVideoProgress(session.webContentsId, options) : electron.queryVideoProgress(session.webContentsId);
    // A saved handoff snapshot is not a live observation of the replacement player.
    return null;
  }).catch(() => null);
}

export async function controlRemotePlayback(session, command, electron, operation) {
  try {
    if (operation?.signal.aborted || (operation && !operation.check())) return { ok: false, error: "The remote command expired." };
    if (session?.controlPlayback) return operation ? await session.controlPlayback(command, operation) : await session.controlPlayback(command);
    if (session?.webContentsId && electron?.controlVideo) {
      if (!operation) return await electron.controlVideo(session.webContentsId, command);
      const cancel = () => { electron.controlVideo(session.webContentsId, "cancelRemoteOperation", { id: operation.id }).catch(() => {}); };
      operation.signal.addEventListener("abort", cancel, { once: true });
      try {
        return await electron.controlVideo(session.webContentsId, command, { id: operation.id, deadlineAt: operation.deadlineAt });
      } finally { operation.signal.removeEventListener("abort", cancel); }
    }
    return { ok: false, error: "The current player target is unavailable." };
  } catch {
    return { ok: false, error: "The current player did not accept the command." };
  }
}
