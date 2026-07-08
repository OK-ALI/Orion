const ipc = require("./ipc");
const mediaProtocol = require("./playback/mediaProtocol");
const registry = require("./providers/registry");
const { createLocalProviders } = require("./providers/local");
const { createMusicBrainzProvider } = require("./providers/musicbrainz");
const { createListenBrainzProviders } = require("./providers/listenbrainz");
const { createYtDlpStreamingProvider } = require("./providers/ytdlp");
const { createSaavnProviders } = require("./providers/saavn");
const plugins = require("./plugins/manager");
const { createLrcLibProvider } = require("./providers/lrclib");

function registerScheme() { mediaProtocol.registerScheme(); }

function registerProviders() {
  if (registry.list().length) return;
  plugins.initialize({
    "orion-core": createLocalProviders,
    "orion-omnisource": () => [],
    "orion-musicbrainz": () => [createMusicBrainzProvider()],
    "orion-youtube": () => [createYtDlpStreamingProvider()],
    "orion-listenbrainz": createListenBrainzProviders,
    "orion-saavn": createSaavnProviders,
    "orion-lrclib": () => [createLrcLibProvider()],
    "orion-deezer-dashboard": () => [],
    "orion-subsonic": () => [],
    "orion-soundcloud": () => [],
    "orion-discogs": () => [],
    "orion-youtube-playlists": () => [],
    "orion-khinsider": () => [],
  });
}

async function register() {
  registerProviders();
  ipc.register();
  mediaProtocol.register();
  await ipc.start();
}

async function stop() { await ipc.stop(); }

module.exports = { register, registerScheme, stop };
