const { collectFrames, findPrimaryVideo } = require("./videoTargeting");

function voiceBoostScript(candidate, enabled) {
  return `
    (async () => {
      const v = document.querySelectorAll("video")[${JSON.stringify(candidate.index)}];
      if (!v || v._orionControlToken !== ${JSON.stringify(candidate.controlToken)}
        || v.currentSrc !== ${JSON.stringify(candidate.controlSource)}) {
        return { ok: false, code: "video_changed" };
      }
      const old = globalThis.__orionVoiceBoost;
      if (!${Boolean(enabled)}) {
        if (old?.source && old.active) {
          old.source.disconnect();
          old.source.connect(old.context.destination);
          old.active = false;
        }
        return { ok: true, active: false };
      }
      const src = v.currentSrc || "";
      if (!src) return { ok: false, code: "video_not_ready" };
      try {
        const mediaUrl = new URL(src, location.href);
        if (["http:", "https:"].includes(mediaUrl.protocol)
          && mediaUrl.origin !== location.origin && !v.crossOrigin) {
          return { ok: false, code: "cross_origin_audio" };
        }
      } catch {
        return { ok: false, code: "video_not_ready" };
      }
      let context;
      let source;
      try {
        context = old?.context || new (globalThis.AudioContext || globalThis.webkitAudioContext)();
        if (context.state !== "running") await Promise.race([
          context.resume().catch(() => {}),
          new Promise((resolve) => setTimeout(resolve, 1500)),
        ]);
        if (context.state !== "running") return { ok: false, code: "audio_suspended" };
        if (old?.video === v && old.active) return { ok: true, active: true };
        if (old?.source) {
          old.source.disconnect();
          old.source.connect(context.destination);
          old.active = false;
        }
        source = old?.video === v ? old.source : context.createMediaElementSource(v);
        const highpass = context.createBiquadFilter();
        highpass.type = "highpass";
        highpass.frequency.value = 120;
        const presence = context.createBiquadFilter();
        presence.type = "peaking";
        presence.frequency.value = 2400;
        presence.Q.value = 0.9;
        presence.gain.value = 6;
        const compressor = context.createDynamicsCompressor();
        compressor.threshold.value = -22;
        compressor.knee.value = 24;
        compressor.ratio.value = 3;
        const gain = context.createGain();
        gain.gain.value = 1.15;
        source.disconnect();
        source.connect(highpass);
        highpass.connect(presence);
        presence.connect(compressor);
        compressor.connect(gain);
        gain.connect(context.destination);
        globalThis.__orionVoiceBoost = { video: v, context, source, active: true };
        return { ok: true, active: true };
      } catch {
        if (source && context) {
          try {
            source.disconnect();
            source.connect(context.destination);
          } catch {}
        }
        return { ok: false, code: "audio_unavailable" };
      }
    })()
  `;
}

async function setVoiceBoost(webContents, enabled) {
  if (!webContents || webContents.isDestroyed?.()) return { ok: false, code: "player_closed" };
  const primary = await findPrimaryVideo(collectFrames(webContents.mainFrame));
  if (!primary) return { ok: false, code: "video_not_ready" };
  try {
    return await primary.frame.executeJavaScript(voiceBoostScript(primary, enabled));
  } catch {
    return { ok: false, code: "audio_unavailable" };
  }
}

module.exports = { setVoiceBoost, voiceBoostScript };
