const ipc = require("./ipc");
const mediaProtocol = require("./playback/mediaProtocol");
const registry = require("./providers/registry");
const { createLocalProviders } = require("./providers/local");
const { createMusicBrainzProvider } = require("./providers/musicbrainz");
const { createListenBrainzProviders } = require("./providers/listenbrainz");
const { createSubsonicProviders } = require("./providers/subsonic");
const { createYtDlpStreamingProvider } = require("./providers/ytdlp");
const { createDiscogsProvider } = require("./providers/discogs");
const { createDeezerProviders } = require("./providers/deezer");
const plugins = require("./plugins/manager");
const { createYouTubePlaylistProvider } = require("./providers/youtubePlaylists");
const { createSoundCloudProviders } = require("./providers/soundcloud");
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
    "orion-subsonic": createSubsonicProviders,
    "orion-discogs": () => [createDiscogsProvider()],
    "orion-deezer-dashboard": createDeezerProviders,
    "orion-lrclib": () => [createLrcLibProvider()],
    "orion-youtube-playlists": () => [createYouTubePlaylistProvider()],
    "orion-soundcloud": createSoundCloudProviders,
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
