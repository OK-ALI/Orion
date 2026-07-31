const MUSIC_SCHEMA_VERSION = 4;
const MUSIC_CACHE_VERSION = 1;

const MUSIC_PROVIDER_KINDS = Object.freeze({
  METADATA: "metadata",
  STREAMING: "streaming",
  LYRICS: "lyrics",
  DASHBOARD: "dashboard",
  PLAYLISTS: "playlists",
  DISCOVERY: "discovery",
  SCROBBLING: "scrobbling",
});

const MUSIC_EXTENSIONS = Object.freeze([
  ".mp3", ".m4a", ".aac", ".flac", ".ogg", ".opus", ".wav", ".webm",
]);

const MUSIC_IPC = Object.freeze({
  STATUS: "music:status",
  FOLDERS_LIST: "music:folders:list",
  FOLDERS_ADD: "music:folders:add",
  FOLDERS_REMOVE: "music:folders:remove",
  SCAN_START: "music:scan:start",
  SCAN_CANCEL: "music:scan:cancel",
  SCAN_PROGRESS: "music:scan:progress",
  TRACKS_LIST: "music:tracks:list",
  TRACK_GET_STREAM: "music:tracks:stream",
  TRACK_CANDIDATES: "music:tracks:candidates",
  TRACK_RESOLVE_CANDIDATE: "music:tracks:resolve-candidate",
  ARTWORK_GET: "music:artwork:get",
  LYRICS_GET: "music:lyrics:get",
  SEARCH: "music:search",
  SEARCH_SUGGESTIONS: "music:search:suggestions",
  SEARCH_CONTINUE: "music:search:continue",
  RADIO_GET: "music:radio:get",
  DASHBOARD_GET: "music:dashboard:get",
  DETAILS_GET: "music:details:get",
  PROVIDERS_LIST: "music:providers:list",
  PROVIDER_CONFIGURE: "music:providers:configure",
  PROVIDER_SAVE_CONFIG: "music:providers:save-config",
  PLUGINS_LIST: "music:plugins:list",
  PLUGIN_INSTALL: "music:plugins:install",
  PLUGIN_SET_ENABLED: "music:plugins:set-enabled",
  PLUGIN_REMOVE: "music:plugins:remove",
  PLAYLISTS_LIST: "music:playlists:list",
  PLAYLISTS_REMOTE_LIST: "music:playlists:remote-list",
  PLAYLISTS_SAVE: "music:playlists:save",
  PLAYLISTS_DELETE: "music:playlists:delete",
  PLAYLISTS_IMPORT: "music:playlists:import",
  PLAYLISTS_IMPORT_FILE: "music:playlists:import-file",
  PLAYLISTS_EXPORT_FILE: "music:playlists:export-file",
  PLAYLIST_FOLDERS_LIST: "music:playlist-folders:list",
  PLAYLIST_FOLDERS_SAVE: "music:playlist-folders:save",
  PLAYLIST_FOLDERS_DELETE: "music:playlist-folders:delete",
  FAVORITES_LIST: "music:favorites:list",
  FAVORITES_TOGGLE: "music:favorites:toggle",
  QUEUE_LOAD: "music:queue:load",
  QUEUE_SAVE: "music:queue:save",
  HISTORY_ADD: "music:history:add",
  HISTORY_LIST: "music:history:list",
  BACKUP_EXPORT: "music:backup:export",
  BACKUP_IMPORT: "music:backup:import",
  CACHE_STATUS: "music:cache:status",
  CACHE_SET_LIMIT: "music:cache:set-limit",
  CACHE_CLEAR: "music:cache:clear",
});

module.exports = {
  MUSIC_CACHE_VERSION,
  MUSIC_EXTENSIONS,
  MUSIC_IPC,
  MUSIC_PROVIDER_KINDS,
  MUSIC_SCHEMA_VERSION,
};
