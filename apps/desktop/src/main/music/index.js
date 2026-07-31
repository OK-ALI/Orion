const ipc = require("./ipc");
const mediaProtocol = require("./playback/mediaProtocol");
const loopbackServer = require("./playback/loopbackServer");
const tokens = require("./playback/tokenRegistry");
const registry = require("./providers/registry");
const { createLocalProviders } = require("./providers/local");
const { createYtMusicProviders } = require("./providers/ytmusic");
const { createSpotifyChartsProvider } = require("./providers/spotifyCharts");
const plugins = require("./plugins/manager");
const { createLrcLibProvider } = require("./providers/lrclib");

function registerScheme() { mediaProtocol.registerScheme(); }

function registerProviders() {
  if (registry.list().length) return;
  plugins.initialize({
    "orion-core": createLocalProviders,
    "orion-ytmusic": createYtMusicProviders,
    "orion-lrclib": () => [createLrcLibProvider()],
    "orion-spotify-import": () => [createSpotifyChartsProvider()],
  });
}

async function register() {
  registerProviders();
  mediaProtocol.register();
  await loopbackServer.start();
  tokens.setAudioUrlFactory((token) => loopbackServer.createUrl(token));
  ipc.register();
  await ipc.start();
}

async function stop() {
  await ipc.stop();
  tokens.setAudioUrlFactory(null);
  tokens.revokeAll();
  await loopbackServer.stop();
}

module.exports = { register, registerScheme, stop };
