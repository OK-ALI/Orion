const catalog = Object.freeze([
  { id: "orion-core", name: "Orion Music Core", description: "Local library, media controls and secure playback grants.", categories: ["metadata", "streaming", "other"], version: "2.0.0", bundled: true, locked: true, defaultInstalled: true, permissions: ["library:read", "playback:resolve"] },
  { id: "orion-ytmusic", name: "YouTube", description: "YouTube Music catalog, discovery, radio candidates and just-in-time playback through Orion-managed stream resolution.", categories: ["metadata", "streaming", "dashboard"], version: "1.0.0", bundled: true, defaultInstalled: true, permissions: ["network:music.youtube.com", "network:youtube.com", "tools:yt-dlp"] },
  { id: "orion-lrclib", name: "LRCLib Lyrics", description: "Plain and synchronized lyrics matched by track metadata and duration.", categories: ["lyrics"], version: "1.0.0", bundled: true, defaultInstalled: true, permissions: ["network:lrclib.net"] },
  { id: "orion-spotify-import", name: "Spotify Charts / Import", description: "Spotify public charts are metadata-only. Playlist/album import is pending; playback always resolves through YouTube Audio or Local Library.", categories: ["dashboard", "playlists"], version: "0.1.0", bundled: true, defaultInstalled: true, permissions: ["network:charts-spotify-com-service.spotify.com"] },
]);

function getPlugin(id) { return catalog.find((plugin) => plugin.id === id); }
module.exports = { catalog, getPlugin };
