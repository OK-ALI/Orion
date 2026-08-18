const VIDEO_SCAN_SCRIPT = `
  (() => {
    if (!globalThis.__orionPlaybackGestureTracking) {
      globalThis.__orionPlaybackGestureTracking = true;
      const markGesture = () => {
        globalThis.__orionLastPlaybackGestureAt = Date.now();
      };
      ["pointerdown", "pointerup", "mousedown", "mouseup", "touchstart", "touchend", "keydown"].forEach((type) => {
        document.addEventListener(type, markGesture, true);
      });
    }

    return {
      gestureAt: Number(globalThis.__orionLastPlaybackGestureAt) || 0,
      videos: Array.from(document.querySelectorAll("video")).map((v, index) => {
        if (!v._orionSeekTracked) {
          v._orionSeekTracked = true;
          v.addEventListener("seeked", () => {
            const now = Date.now();
            const programmaticUntil = Number(v._orionProgrammaticSeekUntil) || 0;
            const programmaticTarget = Number(v._orionProgrammaticSeekTarget);
            const currentTime = Number(v.currentTime) || 0;
            const matchesProgrammaticTarget =
              now <= programmaticUntil &&
              Number.isFinite(programmaticTarget) &&
              Math.abs(currentTime - programmaticTarget) <= 2;
            if (matchesProgrammaticTarget) return;
            v._orionLastExternalSeekAt = now;
            v._orionLastExternalSeekTo = currentTime;
          });
        }
        const rect = v.getBoundingClientRect?.() || { width: 0, height: 0 };
        const style = globalThis.getComputedStyle?.(v);
        const duration = Number(v.duration);
        const currentTime = Number(v.currentTime);
        return {
          index,
          currentTime: Number.isFinite(currentTime) ? currentTime : 0,
          duration: Number.isFinite(duration) && duration > 0 ? duration : 0,
          finiteDuration: Number.isFinite(duration) && duration > 0,
          paused: Boolean(v.paused),
          ended: Boolean(v.ended),
          muted: Boolean(v.muted),
          volume: Number.isFinite(Number(v.volume)) ? Number(v.volume) : 1,
          playbackRate: Number.isFinite(Number(v.playbackRate)) ? Number(v.playbackRate) : 1,
          readyState: Number(v.readyState) || 0,
          networkState: Number(v.networkState) || 0,
          videoWidth: Number(v.videoWidth) || 0,
          videoHeight: Number(v.videoHeight) || 0,
          clientWidth: Number(rect.width) || 0,
          clientHeight: Number(rect.height) || 0,
          visible: style ? style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0 : true,
          bufferedAhead: v.buffered && v.buffered.length
            ? Math.max(0, v.buffered.end(v.buffered.length - 1) - (Number(v.currentTime) || 0))
            : 0,
          droppedFrames: v.getVideoPlaybackQuality
            ? v.getVideoPlaybackQuality().droppedVideoFrames
            : 0,
          lastExternalSeekAt: Number(v._orionLastExternalSeekAt) || 0,
          lastExternalSeekTo: v._orionLastExternalSeekTo ?? null,
          lastInteractiveSeekAt: Number(v._orionLastInteractiveSeekAt) || 0,
          lastInteractiveSeekTo: v._orionLastInteractiveSeekTo ?? null,
        };
      }),
    };
  })()
`;

function videoCandidateScore(candidate = {}) {
  const duration = Number(candidate.duration) || 0;
  const renderedArea =
    Math.max(0, Number(candidate.clientWidth) || 0) *
    Math.max(0, Number(candidate.clientHeight) || 0);
  const intrinsicArea =
    Math.max(0, Number(candidate.videoWidth) || 0) *
    Math.max(0, Number(candidate.videoHeight) || 0);
  const area = Math.max(renderedArea, intrinsicArea);

  let score = 0;
  if (candidate.visible) score += 250;
  score += Math.min(400, Math.max(0, Number(candidate.readyState) || 0) * 100);
  if (area >= 1_000_000) score += 700;
  else if (area >= 300_000) score += 500;
  else if (area >= 80_000) score += 250;
  else if (area >= 10_000) score += 75;

  if (candidate.finiteDuration) {
    if (duration >= 1_200) score += 1_200;
    else if (duration >= 600) score += 900;
    else if (duration >= 180) score += 600;
    else if (duration >= 60) score += 300;
    else score += 75;
    score += Math.min(240, duration / 30);
  }

  if ((Number(candidate.currentTime) || 0) > 30) score += 160;
  if (candidate.ended) score -= 500;
  return score;
}

function selectPrimaryVideoCandidate(candidates = []) {
  return candidates
    .filter((candidate) => candidate && Number.isInteger(candidate.index))
    .map((candidate) => ({ ...candidate, score: videoCandidateScore(candidate) }))
    .sort((a, b) =>
      b.score - a.score ||
      (Number(b.duration) || 0) - (Number(a.duration) || 0) ||
      (Number(b.currentTime) || 0) - (Number(a.currentTime) || 0)
    )[0] || null;
}

function collectFrames(rootFrame) {
  const frames = [];
  const visit = (frame) => {
    if (!frame) return;
    frames.push(frame);
    for (const child of frame.frames || []) visit(child);
  };
  visit(rootFrame);
  return frames;
}

async function findPrimaryVideo(frames, { requireFiniteDuration = false } = {}) {
  const scans = await Promise.all((frames || []).map(async (frame) => {
    try {
      const found = await frame.executeJavaScript(VIDEO_SCAN_SCRIPT);
      const gestureAt = Array.isArray(found) ? 0 : Number(found?.gestureAt) || 0;
      const videos = Array.isArray(found) ? found : found?.videos;
      return {
        gestureAt,
        candidates: (Array.isArray(videos) ? videos : [])
          .filter((candidate) => !requireFiniteDuration || candidate?.finiteDuration)
          .map((candidate) => ({ ...candidate, frame })),
      };
    } catch {
      return { gestureAt: 0, candidates: [] };
    }
  }));
  const primary = selectPrimaryVideoCandidate(scans.flatMap((scan) => scan.candidates));
  if (!primary) return null;
  primary.lastPlaybackGestureAt = Math.max(0, ...scans.map((scan) => scan.gestureAt));
  return primary;
}

function qualifyUserSeek(candidate = {}, now = Date.now()) {
  const interactiveAt = Number(candidate.lastInteractiveSeekAt) || 0;
  if (interactiveAt > 0 && now - interactiveAt >= 0 && now - interactiveAt < 6000) {
    return {
      recentUserSeek: true,
      lastUserSeekTo: candidate.lastInteractiveSeekTo ?? null,
    };
  }

  const externalAt = Number(candidate.lastExternalSeekAt) || 0;
  const gestureAt = Number(candidate.lastPlaybackGestureAt) || 0;
  const gestureMatchesSeek = externalAt > 0 && gestureAt > 0 && Math.abs(externalAt - gestureAt) <= 2000;
  const recent = gestureMatchesSeek && now - externalAt >= 0 && now - externalAt < 6000;
  return {
    recentUserSeek: recent,
    lastUserSeekTo: recent ? candidate.lastExternalSeekTo ?? null : null,
  };
}

async function executeOnVideo(candidate, body) {
  if (!candidate?.frame || !Number.isInteger(candidate.index)) return null;
  const index = JSON.stringify(candidate.index);
  const script = `
    (async () => {
      const v = document.querySelectorAll("video")[${index}];
      if (!v) return null;
      ${body}
      return {
        currentTime: Number(v.currentTime) || 0,
        duration: Number.isFinite(Number(v.duration)) ? Number(v.duration) : 0,
        paused: Boolean(v.paused),
        muted: Boolean(v.muted),
        volume: Number(v.volume),
        playbackRate: Number(v.playbackRate) || 1,
        readyState: Number(v.readyState) || 0,
      };
    })()
  `;
  try {
    return await candidate.frame.executeJavaScript(script);
  } catch {
    return null;
  }
}

module.exports = {
  collectFrames,
  executeOnVideo,
  findPrimaryVideo,
  qualifyUserSeek,
  selectPrimaryVideoCandidate,
  videoCandidateScore,
};
