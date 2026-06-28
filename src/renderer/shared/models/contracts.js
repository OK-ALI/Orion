/**
 * Runtime data contracts used across Orion. These are documentation-only JSDoc
 * definitions; persistent migrations continue to be owned by their stores.
 *
 * @typedef {Object} MediaIdentity
 * @property {"movie"|"tv"} mediaType
 * @property {number|string} mediaId
 * @property {number=} season
 * @property {number=} episode
 *
 * @typedef {Object} CaptureSession
 * @property {string} id
 * @property {MediaIdentity} mediaIdentity
 * @property {string|null} sourceId
 * @property {"detecting"|"ready"|"expired"|"browser-only"|"drm"|"unsupported"} status
 * @property {number} startedAt
 * @property {number} updatedAt
 *
 * @typedef {Object} StreamCandidateSummary
 * @property {string} id Opaque candidate ID.
 * @property {string} sessionId
 * @property {"hls"|"dash"|"direct"} kind
 * @property {string} host
 * @property {string} contentType
 * @property {string} displayUrl Redacted URL with no query or credentials.
 * @property {number} capturedAt
 *
 * @typedef {Object} PlaybackSession
 * @property {string} id
 * @property {MediaIdentity} mediaIdentity
 * @property {string|null} sourceId
 * @property {string} playbackUrl
 * @property {"embedded"|"mini"|"popout"} mode
 * @property {number} currentTime
 * @property {number} duration
 * @property {boolean} paused
 * @property {boolean} muted
 * @property {number} volume
 * @property {Object=} subtitleState
 * @property {number} updatedAt
 *
 * @typedef {Object} PlaybackHandoff
 * @property {string} sessionId
 * @property {PlaybackSession["mode"]} from
 * @property {PlaybackSession["mode"]} to
 * @property {number} requestedAt
 * @property {number} currentTime
 * @property {boolean} paused
 * @property {boolean} muted
 * @property {number} volume
 *
 * @typedef {Object} PlaybackProgressDetails
 * @property {number} currentTime
 * @property {number} duration
 * @property {number} percent
 * @property {number} updatedAt
 *
 * @typedef {Object} DownloadRecordV3
 * @property {3} schemaVersion
 * @property {string} id
 * @property {"queued"|"preflighting"|"downloading"|"paused"|"processing"|"completed"|"failed"|"cancelled"} status
 * @property {number} progress
 * @property {number} downloadedBytes
 * @property {number} totalBytes
 * @property {number|null} etaSeconds
 * @property {number} retryCount
 * @property {number} updatedAt
 *
 * @typedef {Object} LocalMediaToken
 * @property {string} url Opaque orion-media URL.
 * @property {string} downloadId
 * @property {number} expiresAt
 *
 * @typedef {Object} DiscoveryHub
 * @property {string} id
 * @property {string} name
 * @property {"provider"|"world"} kind
 * @property {string} gradient
 * @property {Array<Object>=} filters
 *
 * @typedef {Object} SubtitleResult
 * @property {string} provider
 * @property {string} language
 * @property {string} release
 * @property {string} downloadToken
 *
 * @typedef {Object} SettingsSchema
 * @property {"auto"|"ask"|"manual"} miniPlayerBehavior
 * @property {"off"|"low"|"balanced"|"vivid"} ambientProfile
 * @property {"calm"|"balanced"|"expressive"} motionPreset
 * @property {string} discoveryRegion
 */

export const CONTRACT_VERSION = "1.0.9";
