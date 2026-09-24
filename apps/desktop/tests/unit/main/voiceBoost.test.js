const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { setVoiceBoost, voiceBoostScript } = require("../../../src/main/player/voiceBoost");

function fixture(src, crossOrigin = "") {
  const connections = [];
  const node = () => ({
    frequency: { value: 0 }, gain: { value: 0 }, Q: { value: 0 },
    threshold: { value: 0 }, knee: { value: 0 }, ratio: { value: 0 },
    connect(target) { connections.push(target); },
    disconnect() { connections.push("disconnected"); },
  });
  const video = { currentSrc: src, crossOrigin, _orionControlToken: "active-video" };
  let sourceCalls = 0;
  class AudioContext {
    constructor() { this.state = "running"; this.destination = { destination: true }; }
    createMediaElementSource() { sourceCalls += 1; return node(); }
    createBiquadFilter() { return node(); }
    createDynamicsCompressor() { return node(); }
    createGain() { return node(); }
  }
  const scope = {
    AudioContext, URL, location: { href: "https://player.example/watch", origin: "https://player.example" },
    document: { querySelectorAll: () => [video] }, setTimeout,
  };
  const candidate = { index: 0, controlToken: "active-video", controlSource: src };
  return {
    async apply(enabled) { return vm.runInNewContext(voiceBoostScript(candidate, enabled), scope); },
    connections, get sourceCalls() { return sourceCalls; },
    video,
  };
}

test("Voice Boost engages only on the selected playable video and restores direct audio when disabled", async () => {
  const player = fixture("blob:https://player.example/video");
  assert.deepEqual({ ...(await player.apply(true)) }, { ok: true, active: true });
  assert.equal(player.sourceCalls, 1);
  assert.deepEqual({ ...(await player.apply(true)) }, { ok: true, active: true });
  assert.equal(player.sourceCalls, 1);
  assert.deepEqual({ ...(await player.apply(false)) }, { ok: true, active: false });
  assert.ok(player.connections.some((target) => target?.destination));
});

test("Voice Boost does not mute cross-origin media without CORS audio permission", async () => {
  const player = fixture("https://cdn.example/video.mp4");
  assert.equal((await player.apply(true)).code, "cross_origin_audio");
  assert.equal(player.sourceCalls, 0);
});

test("Voice Boost rejects a video replaced after frame targeting", async () => {
  const player = fixture("https://player.example/video.mp4");
  player.video._orionControlToken = "replacement";
  assert.equal((await player.apply(true)).code, "video_changed");
  assert.equal(player.sourceCalls, 0);
});

test("Voice Boost targets a playable video inside a nested provider frame", async () => {
  const executed = [];
  const child = {
    frames: [],
    async executeJavaScript(script) {
      executed.push(script);
      if (script.includes("__orionPlaybackGestureTracking")) return {
        videos: [{
          index: 0, controlToken: "nested-video", controlSource: "blob:https://embed.example/video",
          duration: 3600, finiteDuration: true, readyState: 4, visible: true,
          clientWidth: 960, clientHeight: 540,
        }],
      };
      return { ok: true, active: true };
    },
  };
  const root = { frames: [child], executeJavaScript: async () => ({ videos: [] }) };
  const result = await setVoiceBoost({ mainFrame: root, isDestroyed: () => false }, true);
  assert.deepEqual(result, { ok: true, active: true });
  assert.ok(executed.some((script) => script.includes("nested-video")));
});
