/**
 * Electron throws when getWebContentsId() is called before a webview has been
 * attached and emitted dom-ready. React refs can be populated before then, so
 * all renderer callers must use this guarded boundary.
 */
export function getReadyWebContentsId(webview) {
  if (!webview || !webview.isConnected) return null;
  try {
    const id = webview.getWebContentsId?.();
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}


/**
 * Electron reports ERR_ABORTED (-3) when a navigation is deliberately
 * superseded or cancelled. Provider switching and blocked redirects can
 * legitimately trigger this, so it must not be treated as source failure.
 */
export function isExpectedWebviewNavigationAbort(value) {
  if (!value) return false;
  const numericCode = Number(value.errorCode ?? value.errno);
  if (numericCode === -3) return true;
  if (value.code === "ERR_ABORTED") return true;
  const message = String(
    value.errorDescription ?? value.message ?? value.reason ?? "",
  );
  return /ERR_ABORTED|\(-3\)/i.test(message);
}

export function shouldHandleWebviewLoadFailure(event) {
  if (!event || event.isMainFrame === false) return false;
  return !isExpectedWebviewNavigationAbort(event);
}

/**
 * Enforce an explicit playback position through the provider-agnostic
 * main-process video selector. A provider may restore its own remembered
 * position after initial load, so Orion verifies the selected playback video
 * for a short stabilization window instead of trusting one assignment.
 */
export async function seekWebviewToPosition(
  webview,
  seconds,
  { attempts = 75, delayMs = 400, stabilizeMs = 12000 } = {},
) {
  const target = Math.max(0, Math.floor(Number(seconds) || 0));
  let firstAppliedAt = 0;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const webContentsId = getReadyWebContentsId(webview);
    if (!webContentsId) {
      if (attempt < attempts - 1) {
        await new Promise((resolve) => globalThis.setTimeout(resolve, delayMs));
      }
      continue;
    }

    let progress = null;
    if (window.electron?.queryVideoProgress) {
      try {
        progress = await window.electron.queryVideoProgress(webContentsId);
      } catch {}
    }

    const now = Date.now();
    const elapsedSeconds = firstAppliedAt
      ? Math.max(0, (now - firstAppliedAt) / 1000)
      : 0;
    const expected = target + (progress?.paused ? 0 : elapsedSeconds);
    const tolerance = target === 0 ? 5 : 7;
    const onTarget =
      progress &&
      Number.isFinite(Number(progress.currentTime)) &&
      Math.abs(Number(progress.currentTime) - expected) <= tolerance;
    const userSeekTo = Number(progress?.lastUserSeekTo);
    const gestureAt = Number(progress?.lastPlaybackGestureAt) || 0;
    const recentGestureAfterApply =
      firstAppliedAt > 0 &&
      gestureAt >= firstAppliedAt &&
      now - gestureAt >= 0 &&
      now - gestureAt <= 2500;
    const userOverrodeIntent =
      !onTarget &&
      ((progress?.recentUserSeek === true &&
        Number.isFinite(userSeekTo) &&
        Math.abs(userSeekTo - target) > tolerance) ||
        recentGestureAfterApply);

    if (userOverrodeIntent) return true;

    // If the provider is already at the requested position, begin the same
    // stabilization window instead of waiting for a redundant seek command.
    if (onTarget && !firstAppliedAt) firstAppliedAt = now;

    if (!onTarget && window.electron?.controlVideo) {
      try {
        const result = await window.electron.controlVideo(
          webContentsId,
          `intentSeek:${target}`,
        );
        if (result?.ok) {
          firstAppliedAt = Date.now();
          progress = result;
        }
      } catch {}
    } else if (onTarget && firstAppliedAt && now - firstAppliedAt >= stabilizeMs) {
      return true;
    }

    if (attempt < attempts - 1) {
      await new Promise((resolve) => globalThis.setTimeout(resolve, delayMs));
    }
  }

  return false;
}
