/**
 * @typedef {Object} MediaIdentity
 * @property {number|string} id
 * @property {"movie"|"tv"} mediaType
 * @property {string} title
 * @property {number|null} [year]
 * @property {number|null} [season]
 * @property {number|null} [episode]
 */

/**
 * @typedef {Object} PlaybackSession
 * @property {MediaIdentity} media
 * @property {string} sourceId
 * @property {string|null} resolvedUrl
 * @property {number} currentTime
 * @property {number} duration
 * @property {boolean} fullscreen
 * @property {boolean} pipOpen
 */

/**
 * @typedef {Object} DownloadProgress
 * @property {number} progress
 * @property {number} [completedFragments]
 * @property {number} [totalFragments]
 * @property {string} [speed]
 * @property {string} [eta]
 * @property {string} [size]
 */

/**
 * @typedef {Object} DownloadRecord
 * @property {number} schemaVersion
 * @property {string} id
 * @property {MediaIdentity} media
 * @property {"queued"|"preflighting"|"downloading"|"paused"|"processing"|"completed"|"failed"|"cancelled"} status
 * @property {string|null} filePath
 * @property {string} strategy
 * @property {DownloadProgress} progress
 */

/**
 * @typedef {Object} StreamCandidateSummary
 * @property {string} id Opaque main-process identifier.
 * @property {string} kind
 * @property {string} host
 * @property {string} contentType
 * @property {string} displayUrl Redacted renderer-safe URL.
 * @property {number} capturedAt
 */

/**
 * @typedef {Object} SubtitleResult
 * @property {string} provider
 * @property {string} language
 * @property {string} label
 * @property {string} assetId
 * @property {boolean} hearingImpaired
 */

/**
 * @typedef {Object} SettingsSchema
 * @property {string} startPage
 * @property {string} downloadPath
 * @property {string} downloadQuality
 * @property {number} downloadConcurrency
 * @property {string} theme
 * @property {string} accentColor
 * @property {boolean} closeToTray
 */

export {};
