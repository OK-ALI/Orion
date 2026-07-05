# Orion Music Planet Roadmap

**Target release:** Orion v2.0  
**Document status:** Authoritative Music Planet implementation roadmap  
**Baseline date:** July 3, 2026  
**Current application version:** v1.0.10  
**Prerequisite:** Complete and stabilize Orion v1.1 before publishing Music Planet

## 1. Vision

Music Planet is a separate listening world inside Orion rather than another Cinema sidebar page.

- **Orion Cinema** is the story world: red eclipse, posters, cinematic depth and video playback.
- **Orion Music** is the pulse world: violet/cyan energy, album artwork, waveforms, lyrics and audio-reactive motion.
- Both worlds share one application shell, identity, theme system, accessibility model and playback owner.
- Music navigation must remain fast after entry. The full portal transition runs only when explicitly moving between Cinema and Music.
- Orion must never play Cinema and Music audio simultaneously.

Nuclear is used as clean-room architecture research. Orion will reproduce the useful separation between plugins, providers, application-owned playback and source selection without copying Nuclear code, UI or unsafe runtime behavior.

## 2. Current Implementation Baseline

The first Music Planet vertical slice is implemented.

### Main-process foundation

- Versioned SQLite music database using WAL mode.
- Local music-folder registration and scanning.
- Incremental folder watching through `chokidar`.
- Tag and duration parsing through `music-metadata`.
- Supported local formats: MP3, M4A/AAC, FLAC, OGG/Opus, WAV and compatible WebM audio.
- Stable local-track identities that do not expose paths.
- Opaque `orion-music://` grants with byte-range support.
- Local paths, remote provider stream URLs and credentials remain in the main process.
- Queue, playlist, favorite and listening-history persistence.
- Plain, embedded and `.lrc` lyric parsing foundation.

### Provider host foundation

The provider host supports the same primary provider categories used by Nuclear:

- Metadata
- Streaming
- Lyrics
- Dashboard
- Playlists
- Discovery

Implemented provider behavior includes:

- Provider registration and capability declaration.
- Active-provider selection for selectable provider categories.
- Metadata-to-streaming provider pairing.
- Provider-specific references retained after result normalization.
- Candidate discovery followed by just-in-time stream resolution.
- Provider timeouts and partial-result handling.
- Local Library metadata, streaming and embedded-lyrics adapters.
- MusicBrainz metadata search.
- Cover Art Archive URL support.
- Subsonic/Navidrome metadata and streaming connection foundation.
- ListenBrainz discovery/dashboard descriptors awaiting complete integration.

### Renderer foundation

- Music world navigation and planet switcher.
- Music Home and Now Playing chamber foundation.
- Music Search.
- Music Library and folder controls.
- Artist and Album page foundations.
- Playlists, Favorites and Sources pages.
- Sidebar-aware full Music dock and compact Cinema transport strip.
- Seekable buffered timeline, mute/volume, previous/next, deterministic shuffle cycle and repeat state.
- Queue, lyrics, details and secure source-selection panels.
- Immersive Now Playing route with synchronized lyric highlighting and source controls.
- Cinema/Music playback arbitration.
- Windows media-session metadata and command routing foundation.
- Portal-style world transition.
- Music semantic color tokens and responsive base styles.

### Resonance Observatory checkpoint — completed July 4, 2026

- A single Web Audio analyser now derives smoothed bass, mid, treble, energy and beat signals from Orion's existing audio element.
- Canvas visualizers subscribe through an imperative signal bus, avoiding frame-rate React rerenders and duplicate audio elements.
- Quality, Balanced and Efficiency policies cap visual work at 60, 30 and 15 FPS; visuals stop while paused, hidden, buffering, reduced-motion or battery constrained.
- Music Home now uses the Listening Orbit, editorial rails, playlist constellations and provider-health cards.
- Now Playing now uses the Resonance Observatory with an optional immersive view, waveform seeking, auto-follow lyrics and drag-reorderable queue.
- Embedded local artwork is extracted into bounded 128/512px caches. Approved remote artwork is fetched, validated, cached and served through opaque `orion-music://` grants.
- Missing artwork receives deterministic constellation art and a theme-safe fallback palette.
- Music appearance settings apply live and cover atmosphere, visualizer geometry, artwork color, intensity, lyric motion, portal sound and performance adaptation.
- Explicit Cinema/Music switches now include a restrained local spatial chime and an enhanced reduced-motion-aware portal.

### Reference-led usability pass — completed July 4, 2026

- Spotube was studied for compact catalog hierarchy, artwork-led browsing, track-list density and persistent-player ergonomics; Pear Desktop was studied for restrained desktop chrome and extension boundaries.
- No source code, artwork or branded surface was copied. Orion retains its Resonance Observatory identity, semantic themes and capability-owned provider model.
- Music Home now pairs its audio-reactive Listening Orbit with a practical quick deck, library/source vitals and direct collection shortcuts.
- Search now supports live Tracks, Albums and Artists scopes, a top-result surface, quick play and artwork-backed artist results.
- Library now exposes collection totals, a clearer filter surface and denser artwork-backed track rows.
- The persistent dock now blends the active artwork palette into Orion's theme tokens without compromising text contrast.
- Responsive and Reduced Motion behavior covers the new cards, track states and two-column layouts.

### Playable provider backend and plugin separation — completed July 4, 2026

- Automatic playback now ranks candidates by title, artist, duration and official-source signals instead of trusting provider order alone.
- Orion probes resolved remote audio and retries up to six alternate candidates across enabled streaming providers before reporting failure.
- Expired or rejected playback URLs trigger two bounded automatic re-resolution attempts in the audio engine.
- YouTube candidate artwork is normalized from yt-dlp thumbnail arrays, MusicBrainz album art is inherited by recording and album-track results, and the artwork boundary accepts normalized cover, profile and thumbnail fields.
- Deezer Catalog now contributes searchable track, artist and album metadata plus artwork; OmniSource retains that artwork when a higher-ranked duplicate supplies the primary metadata.
- LRCLib is available as a default curated lyrics provider for plain and synchronized lyrics without exposing provider networking to the renderer.
- Music Plugins is now a dedicated Music route. Music Sources is limited to provider health, configuration and routing.
- Curated plugin installation uses an explicit review, permission, registration and ready flow. Compiled adapters are never presented as an external package download.

### Completed safety gates

- Main and renderer test suites pass.
- Music Electron startup and repeated Cinema/Music switching pass.
- Production renderer build passes.
- IPC compatibility, secret scanning, source-size, theme-color and cycle checks pass.
- `package.json` remains at v1.0.10.

## 3. Known Incomplete Areas

The current implementation is not a release-ready Music Planet.

- The curated compiled-plugin manager and catalog are implemented; signed, isolated third-party package installation remains deferred.
- Artist and Album pages remain functional foundations requiring the same editorial polish now applied to Home, Search, Library and Now Playing.
- ListenBrainz behavior is incomplete.
- MusicBrainz detail pages, rate-policy handling and complete relationships are incomplete.
- Artwork pruning and cache-size controls remain incomplete.
- Queue crash recovery exists; complete deterministic shuffle recovery across restarts remains.
- Playlist M3U/JSON import and export are missing.
- Additional online lyric providers remain deferred; embedded, sidecar and synchronized presentation are implemented.
- Crossfade and ReplayGain are not complete.
- Backups do not yet include the complete portable Music dataset.
- Large-library and clean-machine acceptance testing is outstanding.
- macOS/Linux parity is deferred until Windows behavior is stable.

## 4. Architecture Rules

### Ownership boundaries

- `src/main/music` owns databases, filesystem scanning, credentials, provider networking and stream grants.
- `src/preload/api/music.js` exposes narrow namespaced methods.
- `src/renderer/features/music` owns the Music experience.
- Cinema features cannot import Music feature internals.
- Shared playback ownership occurs only through `PlaybackCoordinator`.
- Shared appearance uses semantic tokens rather than Music-specific hard-coded colors in unrelated features.
- No Music source file may exceed 500 lines without a documented exception.
- The renderer never receives machine paths, provider passwords, signed stream URLs or arbitrary filesystem access.

### Provider and plugin distinction

A **provider** supplies one capability such as metadata, streaming or lyrics. A **plugin** is an installable package that may register several providers.

Examples:

- A YouTube-oriented plugin may register a streaming provider and dashboard provider.
- A Subsonic plugin may register metadata, streaming, dashboard and playlists providers.
- A lyrics plugin may register only a lyrics provider.

The Orion application continues to own:

- Playback engine
- Queue
- Favorites
- Local playlists
- History
- Settings
- Database migrations
- Themes and accessibility
- Windows media controls

Providers supply data and streams through capability contracts; they do not own Orion's core state.

## 5. Phase A — Stabilize the Existing Vertical Slice

**Checkpoint status (July 3, 2026): in progress.** Transactional migrations, unchanged-file scan skipping, completed-scan reconciliation, progressive scan phases, redacted provider health, MusicBrainz request serialization, zero-configuration yt-dlp fallback, structured playback errors and full Music-route lifecycle validation are implemented. The Playlists/Sources async-effect cleanup defect that caused first-navigation “Try again” failures is resolved. Moved-file identity preservation, resumable scans, artwork reconciliation and extended live-provider validation remain.

### World switching

- Complete Cinema-to-Music and Music-to-Cinema route restoration.
- Restore each world's last route, selected entity and scroll position.
- Use only Orion's portal transition during world changes; do not stack browser-native transitions.
- Eagerly retain critical world-entry modules to avoid dynamic-chunk failures.
- Add graceful recovery if a lazy secondary Music route fails to load.
- Confirm switching while Cinema, local video or Music playback is active.
- Confirm no duplicate audio and no lost playback session.

### Database and scanning

- Add explicit database migrations under `src/main/music/migrations`.
- Detect moved, renamed, deleted and restored files.
- Reuse metadata when size and modification time are unchanged.
- Add scan cancellation, pause and resumable scan state.
- Add bounded worker concurrency for metadata parsing.
- Add progress phases: discovering, reading metadata, artwork, reconciliation and complete.
- Surface corrupt-file diagnostics without aborting the scan.
- Prevent network or removable-drive failures from freezing startup.

### Provider reliability

- Add provider health state: healthy, slow, unavailable, authentication required and rate limited.
- Persist the last successful provider and last redacted error.
- Implement MusicBrainz request serialization and published rate-policy compliance.
- Add retry-after handling and bounded exponential backoff.
- Complete Subsonic/Navidrome ping, search, browse, playlists, artwork and stream refresh.
- Finish ListenBrainz authentication, recommendations and optional listen submission.

### Acceptance

- Existing v1.1 Cinema behavior remains unchanged.
- Music startup cannot delay the Orion window.
- Switching worlds succeeds repeatedly on slow storage.
- Scanner failures are isolated per file.
- Provider failures produce partial results rather than a blank page.

## 6. Phase B — Secure Installable Plugin Platform

**Checkpoint status (July 4, 2026): curated host implemented; isolated third-party runtime pending.** Orion now has persistent install/enable/disable/remove state, provider ownership, protected core packages, declared capabilities and permissions, and Store/Installed/Provider Routing UI. Discogs metadata, Deezer dashboards and ListenBrainz dashboards have been live-validated. Additional bundled integrations cover SoundCloud through managed yt-dlp, YouTube streaming and playlist import, MusicBrainz, Local Library and Subsonic/Navidrome. OmniSource performs cross-provider deduplication, reference preservation and relevance scoring.

The catalog also exposes Spotify, Last.fm, Bandcamp and KHInsider as unavailable or experimental rather than pretending incomplete adapters work. Bandcamp's current public page returns a browser challenge to server-side requests, so it remains planned pending a stable permitted interface. Raw Nuclear plugin packages are never downloaded or evaluated.

This phase adds Nuclear's simple install-and-enable experience with stronger isolation.

### Plugin store experience

- Add **Music Settings → Plugins** with Installed and Store tabs.
- Search and filter plugins by metadata, streaming, lyrics, dashboard, playlist and discovery capabilities.
- Show author, version, license, permissions, source repository, verification status and update date.
- Install, enable, disable, update, remove and view logs.
- Support automatic updates only for verified registry packages.
- Permit local development plugins only behind an explicit Developer Mode warning.
- Plugins requiring no credentials work immediately after installation.
- Plugins requiring credentials expose a provider-owned declarative settings form.

### Package format

Each package contains:

```text
orion-music-plugin/
├── manifest.json
├── main.js
├── assets/
├── schemas/
│   └── settings.json
└── LICENSE
```

Required manifest fields:

- Stable plugin ID.
- Name, description, author and version.
- Orion SDK compatibility range.
- Registered provider categories.
- Required network domains.
- Requested capabilities.
- Package checksum.
- Signature identity.
- Source and license information.

### Runtime isolation

- Execute every third-party plugin in a separate Electron `utilityProcess`.
- Provide a narrow message-based SDK rather than Node or Electron access.
- Deny DOM, renderer globals, preload access, arbitrary process spawning and unrestricted filesystem access.
- Enforce network-domain allowlists in the main-process request broker.
- Enforce per-request timeouts, response-size limits and concurrency limits.
- Rate-limit noisy plugins.
- Terminate and quarantine repeatedly crashing plugins.
- Maintain per-plugin redacted logs.

### Permissions

Supported permissions include:

- Network access to declared domains.
- Provider-scoped settings.
- Read-only normalized library metadata.
- Playback candidate resolution.
- Dashboard contribution.
- Playlist import.
- Lyrics lookup.
- External URL opening through confirmation.

Credentials are written and read only through host-mediated secure fields. Plugins receive a short-lived request capability instead of raw credential-store access.

### Registry security

- Use a reviewed Orion plugin registry.
- Require signed immutable release artifacts.
- Verify checksums before extraction.
- Reject path traversal, symlinks outside the managed directory and executable side-loading.
- Display permissions before installation and when permissions change during update.
- Keep the last known-good plugin version for rollback.
- Provide registry revocation and emergency-disable support.

### Deferred from v2.0

- Raw custom CSS plugins.
- Unsigned automatic updates.
- Arbitrary local JavaScript execution outside Developer Mode.
- Plugins sharing a process.
- MCP control of Music.

## 7. Phase C — Music Information and Source Completion

### Metadata aggregation

- Normalize tracks, artists, albums and playlists across enabled metadata providers.
- Preserve every provider reference.
- Deduplicate using recording IDs when available, then normalized artist/title/duration heuristics.
- Show source attribution and allow inspection of alternate matches.
- Never merge clearly different recordings, remixes, live versions or covers solely by name.

### Search

- Unified Artists, Albums, Tracks and Playlists tabs.
- Quick suggestions and complete paginated results.
- Local and remote provider sections with partial loading.
- Search history, recent searches and clear-history controls.
- Keyboard navigation and command-style actions.
- Filters for source, duration, release period, format and local availability.
- Explicit offline and provider-unavailable states.

### Artist pages

- Profile-world header with artwork, biography and provider attribution.
- Top tracks.
- Albums, singles, EPs and compilations.
- Related artists.
- Appears-on credits where provided.
- Local-library availability badges.
- Favorite, play, shuffle and add-to-queue actions.

### Album pages

- Large artwork and release metadata.
- Disc-aware track table.
- Track number, title, duration, format and source.
- Play, shuffle, queue and favorite actions.
- Alternate releases and provider matches.
- Missing-track and partial-album states.

### Artwork

- Extract embedded local artwork.
- Fetch remote artwork through approved providers.
- Store bounded, versioned artwork caches.
- Generate Orion gradient artwork for missing covers.
- Deduplicate artwork by content hash.
- Avoid exposing remote signed URLs to renderer persistence.

## 8. Phase D — Playback Engine and Queue

**Checkpoint status (July 4, 2026): in progress.** The sidebar-aware dock, compact Cinema strip, real seek/mute/buffer state, persisted volume, five-second Previous behavior, deterministic shuffle bag, queue recovery, secure candidate grants, keyboard/media controls and Now Playing chamber are implemented. Dual-element crossfade, ReplayGain processing, drag reordering, gapless validation and live-provider fallback testing remain.

### Audio engine

- Candidate ranking based on artist, title, album, duration and provider confidence.
- Manual candidate selection and diagnostics.
- Just-in-time stream resolution.
- Refresh expiring streams without changing queue identity.
- Seamless local and remote range seeking.
- Provider fallback after resolution or playback failure.
- Buffering, stalled-stream and unsupported-codec states.
- Gapless playback where the source and runtime permit it.
- Configurable crossfade with a dual-element handoff.
- ReplayGain for supported local metadata.
- Volume normalization remains optional and transparent.

### Playback ownership

- One owner across embedded Cinema, mini-player, pop-out, local video and Music.
- Starting Music pauses and snapshots video.
- Starting video pauses Music without clearing its queue.
- Returning to a world offers Resume Music or Resume Story when appropriate.
- Media keys and Bluetooth controls always target the active owner.
- Music continues while navigating both worlds, minimizing Orion or closing to tray.

### Queue

- Drag-and-drop ordering with keyboard alternatives.
- Add next, add to end, remove, clear and save as playlist.
- Deterministic shuffle that does not repeat until the cycle completes.
- Repeat off, one and all.
- Queue history and restore-after-crash.
- Candidate/source inspection per item.
- Duplicate-aware add behavior without silently dropping intended repeats.

### Windows integration

- Track, artist, album and artwork metadata.
- Play, pause, stop, next, previous and seek.
- Bluetooth headset controls.
- Windows volume controls remain system-owned.
- Tray controls for current track, play/pause, next and opening Music Planet.

## 9. Phase E — Playlists, Favorites and Portable Data

### Playlists

- Create, rename, duplicate, reorder and delete.
- Drag and keyboard track ordering.
- Smart duplicate warnings rather than forced deduplication.
- JSON import/export preserving provider references.
- M3U/M3U8 import/export for local and compatible remote entries.
- Provider playlist import through installed playlist providers.
- Missing-source and unavailable-track repair workflow.

### Favorites

- Favorite tracks, albums and artists.
- Provider-aware identity.
- Offline availability badges.
- Sort and filter by kind, source and date added.
- Bulk remove and playlist creation.

### History

- Recently played tracks, albums and artists.
- Play counts and last-played time.
- Clear one item, date range or all Music history.
- Optional ListenBrainz submission with explicit consent.
- Private mode that pauses history and external scrobbling.

### Backup and restore

Portable backups include:

- Playlists.
- Favorites.
- Queue state.
- Listening history and preferences when selected.
- Provider identities and priorities.
- Plugin installation manifest and enabled state.

Backups exclude:

- Credentials.
- Signed or expiring URLs.
- Caches.
- Logs.
- Machine-specific library paths.
- Raw plugin binaries.

Restore reports missing plugins, unavailable providers and local folders requiring relinking.

## 10. Phase F — Lyrics and Right-Side Listening Panel

### Panel modes

- Queue.
- Lyrics.
- Track details.
- Source/candidate diagnostics.

### Lyrics

- Embedded lyrics.
- Plain sidecars.
- Synchronized `.lrc` sidecars.
- Online lyrics providers through the provider host.
- Source attribution and language information.
- Offset adjustment for synchronized lyrics.
- Active-line highlighting with gentle automatic scrolling.
- Manual scrolling temporarily pauses auto-follow.
- Missing, instrumental, unsynchronized and provider-error states.
- No unlicensed lyric caching beyond provider terms.

### Track details

- Album, artist, release year and genres.
- Duration, codec, bitrate, sample rate and channel count when known.
- ReplayGain and local availability.
- Active provider and candidate.
- Copyable redacted diagnostics.

## 11. Phase G — Premium Music Planet UI

The current UI is a structural foundation and will be replaced with a cohesive premium experience.

### World switcher redesign

- Replace the large isolated capsule with a compact planet control integrated into sidebar rhythm.
- Collapsed sidebar shows an animated Music planet with a restrained orbital ring.
- Expanded sidebar shows the current world and destination clearly.
- Cinema and Music have distinct active states without looking like unrelated applications.
- Hover, focus and pressed states use semantic tokens.
- The control remains understandable with motion disabled.

### Portal transition

- 650–800ms masked portal using transforms, opacity and gradients.
- Route replacement occurs beneath the portal at a deterministic midpoint.
- No expensive live blur or canvas dependency.
- Full transition once per session and on explicit world changes.
- Calm mode shortens movement and removes secondary particles.
- Reduced Motion uses a 150ms crossfade.
- Performance pressure automatically selects Calm behavior.

### Transition sound

- Bundle an original short orbital sweep with a restrained arrival tone.
- Play only for explicit Cinema/Music world changes.
- Never play on ordinary Music navigation.
- Do not interrupt or duck active media by default.
- Controls: enabled, volume and preview.
- Default volume remains subtle.
- Respect system mute, application setting and accessibility preferences.
- If audio initialization is unavailable, switching continues silently.

### Music Home

- Premium Now Playing chamber as the visual anchor.
- Recently played, local library, favorite albums and provider dashboard sections.
- Recommendations remain attributed to their providers.
- Square album rails rather than Cinema poster rails.
- Continue Listening and Recently Added sections.
- Offline-first presentation using local content.

### Player bar

- Clean album artwork, title and artist.
- Previous, play/pause, next, shuffle and repeat.
- Seekable progress with elapsed and remaining time.
- Volume, lyrics, queue and visualizer controls.
- Responsive collapse without hiding essential transport actions.
- Error and stream-refresh state without expanding the bar unpredictably.

### Visualizer

- Real Web Audio analyser data only.
- Modes: Off, Bars, Orbit and Wave.
- Atmosphere: Off, Calm, Pulse and Immersive.
- Performance-tier-aware sampling and drawing frequency.
- Stop animation while paused, hidden, minimized, on battery pressure or under Reduced Motion.
- Never retain or transmit analyser history.

### Six-theme support

Music inherits:

- Midnight Premiere.
- AMOLED.
- Mocha.
- Slate.
- Projector Silver.
- Custom.

Every Music surface uses semantic tokens. Projector Silver receives explicit contrast, shadow, glass and artwork-edge treatment. Custom themes derive Music colors from the active accent unless the user defines Music overrides.

## 12. Phase H — Settings Architecture

Music gets a dedicated Settings experience inside Music Planet. Global Settings keeps application-wide behavior.

### Music Settings

#### Playback

- Crossfade duration.
- Gapless playback preference.
- ReplayGain and normalization.
- Resume queue on startup.
- Preferred streaming provider.
- Candidate matching strictness.
- Default shuffle and repeat behavior.

#### Atmosphere

- Atmosphere: Off, Calm, Pulse and Immersive.
- Visualizer: Off, Bars, Orbit and Wave.
- Visualizer detail level.
- Artwork-based color influence.
- Battery/performance adaptation.

#### Library

- Music folders.
- Add, remove, rescan and relink.
- Watch folders automatically.
- Supported format explanation.
- Scan diagnostics.
- Artwork-cache size.

#### Sources

- Installed providers.
- Active metadata, streaming, lyrics and discovery providers.
- Provider priority and pairing.
- Provider health and last redacted error.
- Subsonic/Navidrome connection.
- ListenBrainz connection and consent.

#### Plugins

- Installed and Store tabs.
- Enable, disable, update and remove.
- Permissions and logs.
- Automatic update policy.
- Developer Mode.

#### Data

- Music history controls.
- Clear artwork and provider caches.
- Export playlists and favorites.
- Music database diagnostics.

### Global Settings additions

#### World transitions

- Transition animation: Full, Calm or Reduced.
- Transition sound enabled.
- Transition sound volume.
- Preview transition sound.
- Restore each world's last page.

The global theme, font, hover appearance, Reduced Motion, Windows media controls, battery policy, notifications and update policy continue to apply to both worlds.

## 13. Phase I — Accessibility and Localization Readiness

- Complete keyboard operation for every page and player action.
- Visible focus independent of hover styling.
- Screen-reader labels for transport state, queue position and time.
- Live regions for buffering, source fallback and scan progress.
- Proper tables for album tracklists.
- Reorder actions available without drag-and-drop.
- WCAG AA contrast across all themes.
- Reduced Motion disables orbital, waveform, portal and artwork-lift motion.
- High-contrast mode retains source, status and focus meaning.
- Externalize Music strings for future localization without shipping incomplete translations in v2.0.

## 14. Phase J — Performance and Reliability

### Library scale targets

- 100 tracks: near-instant startup and scan completion.
- 10,000 tracks: responsive navigation throughout scanning.
- 50,000 tracks: bounded memory, incremental rendering and indexed search.

### Performance measures

- Virtualize large track and album lists.
- Use paginated SQLite reads.
- Avoid retaining artwork blobs in React state.
- Decode and resize artwork off the renderer hot path.
- Bound provider and scanner concurrency independently.
- Yield main-process scan work regularly.
- Pause nonessential animation while hidden or under performance pressure.
- Prevent dashboard providers from delaying local Music Home.
- Measure time to first local result, first remote result and first playable audio.

### Recovery

- Recover queue and current index after crash.
- Mark interrupted scans and resume safely.
- Roll back failed database migrations.
- Keep the last known-good plugin package.
- Disable only the failing provider or plugin.
- Preserve local playback when remote services are offline.

## 15. Public Contracts

Add and stabilize JSDoc contracts for:

- `MusicTrack`
- `MusicArtist`
- `MusicAlbum`
- `MusicProviderRef`
- `MusicProviderDescriptor`
- `MusicProviderHealth`
- `MusicSearchResults`
- `MusicStreamCandidate`
- `MusicResolvedStream`
- `MusicQueueItem`
- `MusicQueueState`
- `MusicPlaylist`
- `MusicPlaybackSession`
- `MusicLyrics`
- `MusicPluginManifest`
- `MusicPluginPermission`
- `MusicPluginStatus`
- `MusicWorldState`

Provider operations remain namespaced and capability-checked. Compatibility aliases are permitted during development but must be documented and removed only through a versioned migration.

## 16. Test Plan

### Unit tests

- Metadata normalization and deduplication.
- Stable local identities.
- LRC parsing and offsets.
- Provider registration, selection and pairing.
- Provider timeout, retry and health classification.
- Candidate ranking.
- Queue shuffle and repeat behavior.
- Playlist import/export.
- Database migrations.
- Plugin manifest, signature and permission validation.
- Transition policy and sound preference.

### Integration tests

- Local scanning, rescanning, moved files and removed folders.
- Corrupt tags and unsupported formats.
- MusicBrainz rate limiting and partial results.
- Subsonic authentication, search, playlists, artwork, streaming and expiry.
- ListenBrainz consent and offline behavior.
- Local and remote byte-range seeking.
- Stream expiry and fallback.
- Plugin install, update, rollback, disable and removal.
- Plugin crash, timeout and denied permission.
- Backup and restore.

### Electron tests

- Repeated Cinema/Music switching.
- Last-route and scroll restoration.
- One active playback owner.
- Music continues across ordinary navigation and tray behavior.
- Windows media and Bluetooth commands.
- Queue recovery after forced termination.
- Plugin worker crash isolation.
- Clean profile, copied profile and migrated profile.

### Visual tests

- Music Home.
- Search.
- Artist.
- Album.
- Library.
- Playlists.
- Favorites.
- Sources.
- Plugin Store.
- Music Settings.
- Player bar, Queue, Lyrics and Details.
- Portal transition entry/exit states.
- All six themes, narrow layouts and Reduced Motion.

## 17. Release Gates

Music Planet v2.0 may ship only when:

- Orion v1.1 is stable and its data migrates unchanged.
- Cinema streaming, downloader, subtitles, mini-player and pop-out pass regression testing.
- Music and Cinema never produce simultaneous audio.
- Local libraries of 100, 10,000 and 50,000 tracks meet responsiveness targets.
- Local and remote seeking works through opaque grants.
- Credentials and private paths never cross into renderer diagnostics or backups.
- Plugin permissions are enforced rather than informational.
- Unsigned packages cannot auto-install or auto-update.
- Every Music page passes keyboard, focus, contrast and Reduced Motion validation.
- Every supported theme passes visual review.
- Windows installer and ZIP work on a clean machine.
- macOS/Linux compatibility status is accurately documented.
- Source-size, binding, IPC, secret, theme-color, cycle, unit, renderer, Electron and production-build checks pass.

## 18. Checkpoint Order

1. Stabilize current Music database, scanning, switching and provider behavior.
2. Complete local playback, queue recovery and Windows media ownership.
3. Complete metadata aggregation, Artist, Album and Search.
4. Complete playlists, favorites, history and portable backups.
5. Complete lyrics, right panel, artwork and provider dashboards.
6. Build the isolated plugin runtime, registry and store.
7. Build dedicated Music Settings and global world-transition settings.
8. Replace the structural UI with the premium Music Planet design.
9. Transition audio, analyser-driven visualizers and performance adaptation — completed in the Resonance Observatory checkpoint.
10. Complete accessibility, large-library testing and clean-machine packaging.

Each checkpoint requires:

- An atomic commit.
- A rollback point.
- Updated tests.
- Updated architecture documentation.
- No unrelated Cinema behavior changes.

## 19. Explicit Non-Goals for v2.0

- Copying Nuclear source code or UI.
- Running Nuclear plugins directly.
- Unrestricted plugin Node or Electron access.
- Raw custom CSS plugins.
- DRM circumvention.
- Downloading unauthorized copyrighted music.
- Cloud synchronization owned by Orion.
- Social messaging or public profiles.
- AI-generated playlists or recommendations.
- MCP control before authenticated transport, permissions and audit logs exist.

## 20. Definition of Complete

Music Planet is complete when it feels like a first-class Orion world rather than an embedded utility: users can install trusted source plugins, search and play authorized music, manage a large local library, browse rich artist and album pages, use queues/playlists/favorites/lyrics, control playback through Windows and Bluetooth devices, move between Cinema and Music without losing context, and customize the Music atmosphere through a dedicated settings experience—all without weakening Orion's security, performance or Cinema reliability.
