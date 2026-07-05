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
 * @typedef {Object} PersonSummary
 * @property {number} id
 * @property {"person"} media_type
 * @property {string} name
 * @property {string|null} profile_path
 * @property {string} known_for_department
 * @property {Array<Object>} known_for
 *
 * @typedef {Object} PersonDetails
 * @property {number} id
 * @property {string} name
 * @property {string|null} profile_path
 * @property {string} biography
 * @property {string|null} birthday
 * @property {string|null} deathday
 * @property {string|null} place_of_birth
 * @property {string} known_for_department
 *
 * @typedef {Object} CreditItem
 * @property {number} id
 * @property {"movie"|"tv"} media_type
 * @property {string} title
 * @property {string} release_date
 * @property {Array<string>} roles
 * @property {Array<string>} jobs
 *
 * @typedef {Object} ConstellationPerson
 * @property {number} id
 * @property {"person"} media_type
 * @property {string} name
 * @property {string|null} profile_path
 * @property {Array<"acting"|"directing"|"writing"|"production">} crafts
 * @property {Array<"movie"|"tv">} mediaTypes
 * @property {Array<Object>} representativeCredits
 * @property {number} contributionCount
 * @property {number} score
 *
 * @typedef {Object} ConstellationPool
 * @property {1} version
 * @property {string} cinemaId
 * @property {Array<ConstellationPerson>} people
 * @property {number} seedPage
 * @property {number} totalPages
 * @property {number} generatedAt
 * @property {number} partialFailures
 *
 * @typedef {Object} ConstellationPreferences
 * @property {string} cinema
 * @property {"all"|"acting"|"directing"|"writing"|"production"} craft
 * @property {"all"|"movie"|"tv"} media
 * @property {"popular"|"credits"|"name"} sort
 *
 * @typedef {Object} ConstellationSearchState
 * @property {string} query
 * @property {Array<ConstellationPerson>} mappedMatches
 * @property {Array<PersonSummary>} globalMatches
 * @property {number} globalPage
 * @property {number} globalTotalPages
 * @property {boolean} loading
 * @property {string} error
 *
 * @typedef {Object} OrionErrorDescriptor
 * @property {string} code
 * @property {string} title
 * @property {string} guidance
 * @property {string} diagnostic
 * @property {string} recoveryId
 *
 * @typedef {Object} SettingsSchema
 * @property {"auto"|"ask"|"manual"} miniPlayerBehavior
 * @property {"off"|"low"|"balanced"|"vivid"} ambientProfile
 * @property {"calm"|"balanced"|"expressive"} motionPreset
 * @property {string} discoveryRegion
 * @property {"subtle"|"balanced"|"vivid"} interactionHoverPreset
 * @property {string} interactionHoverColor Empty for automatic, otherwise a six-digit hex color.
 * @property {number} interactionGlowStrength Integer from 0 through 100.
 */

/**
 * @typedef {Object} BatteryStatus
 * @property {boolean} available
 * @property {boolean} charging
 * @property {boolean} onBattery
 * @property {number|null} level
 * @property {number} updatedAt
 */

/**
 * @typedef {Object} NetworkStatus
 * @property {"checking"|"online"|"degraded"|"offline"} status
 * @property {number|null} latencyMs Rounded HTTP round-trip time to Orion's metadata service.
 * @property {"unknown"|"fast"|"fair"|"slow"} tier
 * @property {number} checkedAt
 */

/**
 * @typedef {Object} AdaptivePerformanceState
 * @property {"efficiency"|"balanced"|"quality"} tier
 * @property {number} cpuPercent
 * @property {number} freeMemoryMb
 * @property {number} eventLoopLagMs
 * @property {number} bufferingEvents
 * @property {string} reason
 */

/**
 * @typedef {"play"|"pause"|"toggle"|"stop"|"next"|"previous"|"restart"} MediaControlCommand
 */

/**
 * @typedef {Object} MusicProviderRef
 * @property {string} provider
 * @property {string} id
 *
 * @typedef {Object} MusicTrack
 * @property {string} id
 * @property {string} title
 * @property {string} artistName
 * @property {string|null} albumTitle
 * @property {number|null} durationMs
 * @property {string} provider
 * @property {Array<MusicProviderRef>=} providerRefs
 *
 * @typedef {Object} MusicArtist
 * @property {string} id
 * @property {string} name
 * @property {MusicProviderRef} source
 *
 * @typedef {Object} MusicAlbum
 * @property {string} id
 * @property {string} title
 * @property {string} artistName
 * @property {MusicProviderRef} source
 *
 * @typedef {Object} MusicProviderDescriptor
 * @property {string} id
 * @property {"metadata"|"streaming"|"lyrics"|"dashboard"|"playlists"|"discovery"} kind
 * @property {string} name
 * @property {Array<string>} capabilities
 *
 * @typedef {Object} MusicStreamCandidate
 * @property {string} id
 * @property {string} providerId
 * @property {string} title
 * @property {number|null} durationMs
 *
 * @typedef {Object} MusicResolvedStream
 * @property {string} url Opaque orion-music protocol grant.
 * @property {number} expiresAt
 * @property {MusicStreamCandidate} candidate
 *
 * @typedef {Object} MusicPlaybackSession
 * @property {MusicTrack|null} track
 * @property {boolean} playing
 * @property {number} currentTime
 * @property {number} duration
 * @property {number} volume
 *
 * @typedef {Object} MusicLyrics
 * @property {"plain"|"synced"} type
 * @property {string=} text
 * @property {Array<{time:number,text:string}>=} lines
 */

export const CONTRACT_VERSION = "1.1.0";
