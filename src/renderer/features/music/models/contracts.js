/**
 * @typedef {Object} MusicVisualFrame
 * @property {number} bass
 * @property {number} mids
 * @property {number} treble
 * @property {number} energy
 * @property {number} beat
 * @property {number} timestamp
 * @property {Uint8Array} bins
 *
 * @typedef {Object} MusicVisualPreferences
 * @property {'off'|'calm'|'pulse'|'immersive'} atmosphere
 * @property {'off'|'orbit'|'wave'|'bars'} visualizer
 * @property {number} intensity
 * @property {boolean} artworkColor
 * @property {boolean} lyricsMotion
 * @property {boolean} adaptPerformance
 *
 * @typedef {Object} MusicArtworkRef
 * @property {string} url Opaque protected Music URL. The renderer never receives its backing path or provider URL.
 * @property {number} expiresAt
 *
 * @typedef {Object} MusicArtworkPalette
 * @property {string} base
 * @property {string} primary
 * @property {string} spectral
 * @property {string} foreground
 * @property {'dark'|'light'} contrast
 *
 * @typedef {'idle'|'initializing'|'awaiting-gesture'|'active'|'silent'|'suspended'|'failed'} MusicAnalyserState
 *
 * @typedef {Object} MusicAnalyserDiagnostics
 * @property {MusicAnalyserState} state
 * @property {string} contextState
 * @property {boolean} sourceConnected
 * @property {number} frameCount
 * @property {number} nonZeroFrameCount
 * @property {number} lastEnergy
 * @property {number} lastFrameAt
 * @property {string} blockedReason
 *
 * @typedef {Object} MusicLoadingState
 * @property {'idle'|'loading'|'partial'|'ready'|'offline'|'error'} status
 * @property {'button'|'artwork'|'section'|'page'|'playback'} scope
 * @property {string} [message]
 * @property {boolean} [retryable]
 *
 * @typedef {'track'|'album'|'artist'|'playlist'|'now-playing'} MusicArtworkPresentation
 *
 * @typedef {'play'|'play-next'|'queue'|'favorite'|'playlist'|'radio'|'details'} MusicEntityAction
 *
 * @typedef {Object} MusicRadioRequest
 * @property {string} id
 * @property {'track'|'album'|'artist'} kind
 * @property {Object} source
 *
 * @typedef {Object} MusicPlaylistFolder
 * @property {string} id
 * @property {string|null} parentId
 * @property {string} name
 * @property {number} position
 *
 * @typedef {Object} MusicLibraryFilter
 * @property {'overview'|'songs'|'albums'|'artists'|'playlists'|'recent'|'local'} view
 * @property {'title'|'artist'|'album'|'newest'} sort
 * @property {string} query
 *
 * @typedef {'dock'|'float'|'cinema-compact'} MusicDockPresentation
 *
 * @typedef {'loading'|'ready'|'empty'|'partial'|'offline'|'error'} MusicStageState
 * @typedef {'left'|'right'} MusicStageAnchor
 * @typedef {'queue'|'lyrics'|'sources'|'details'|'more'|'error'} MusicPlayerOverlay
 *
 * @typedef {Object} MusicProgressState
 * @property {number} currentTime
 * @property {number} duration
 * @property {number} bufferedRatio
 * @property {number} playedRatio
 * @property {number|null} seekPreviewTime
 */

export {};
