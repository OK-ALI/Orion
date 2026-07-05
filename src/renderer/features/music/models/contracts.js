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
 * @property {string} url Opaque orion-music URL.
 * @property {number} expiresAt
 *
 * @typedef {Object} MusicArtworkPalette
 * @property {string} base
 * @property {string} primary
 * @property {string} spectral
 * @property {string} foreground
 * @property {'dark'|'light'} contrast
 */

export {};
