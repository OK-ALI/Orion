# Orion Music Planet Completion Goal

**Target:** Stable first-party Music Planet v2  
**Reference baseline:** Orion v1.0.10 workspace after the v1.1 Search/Constellation work  
**Visual direction:** Living Album Cosmos  
**Navigation:** Dedicated Music shell  
**Home focus:** Now Playing world  
**Status:** Active engineering goal

## Engineering progress

- **Phase 1:** Complete and verified. Renderer demo providers were removed, production search now uses the main-process capability host, shell controls and panel ownership were repaired, semantic theme checks pass, and regression coverage was added.
- **Phase 2:** In progress. Subsonic/Navidrome now supports catalog search and details, dashboard sections, server playlists, private artwork delivery, fresh stream resolution and actionable connection errors. Remaining work covers live-provider validation and normalized partial/offline states.
- **Phase 3:** Complete in code. Local scans use bounded metadata concurrency, cancellation, corrupt-file diagnostics and content fingerprints that preserve identity after moves or renames. Manual and scheduled backups include sanitized playlists, favorites, history and provider preferences without credentials, paths or signed URLs. JSON and extended-M3U interchange is validated and collision-safe. Artwork caching has bounded pruning, live controls and safe recovery. ReplayGain and configurable single-pipeline queue transitions are connected, and pending shuffle order survives restart.
- **Phases 4–5:** Pending after backend and listening-state acceptance.

## Objective

Turn the current Music Planet foundation into a reliable, original and release-ready first-party listening world. Complete the production provider path, remove duplicate/demo architecture, finish the local and online playback experience, and replace the mixed Observatory/dashboard UI with a coherent Living Album Cosmos.

Downloadable third-party JavaScript plugins are not part of this goal. The existing curated compiled adapters remain the safe v2 plugin model until signed packages, utility-process isolation and enforceable permissions receive their own security milestone.

## Product identity: Living Album Cosmos

Music Planet must feel like entering another zone inside Orion rather than recoloring Cinema.

- The active album becomes a living celestial body that shapes the palette, orbital geometry, waveform horizon and ambient depth.
- The portal enters a dedicated Music shell with Music Home, Search, Library, Playlists, Favorites, Sources and Plugins. One persistent world control returns to the previous Cinema route.
- Music Home is dominated by the active listening world. Discovery, recent music, playlists and providers use compact rails below it.
- Idle state is a calm observatory with useful library/search entry points; it must not fabricate audio motion.
- Square album worlds, circular artist worlds, constellation playlist clusters and compact waveform track rows remain visually distinct.
- The persistent dock is the only global transport. Queue, lyrics and source panels have one owner and never render twice.
- Artwork influence is constrained by semantic theme tokens. Projector Silver and Custom themes retain accessible contrast.
- Motion follows the existing performance tier, battery policy and Reduced Motion preference.

## Phase 1 — Stabilize architecture and safety

- Remove the renderer-side `DemoMusicProvider`, `LocalMusicProvider` and duplicate `ProviderRegistry` production path.
- Route Search, details, artwork, candidates, playback, lyrics and provider health exclusively through the preload/main-process capability host.
- Remove every dummy URL, placeholder provider result and call to nonexistent preload methods.
- Consolidate Queue and Lyrics panel ownership between the Music shell and persistent dock.
- Wire Music header search to initialize the Search route query; connect Settings to Music appearance or remove the dead control.
- Replace new raw Music colors with semantic tokens and restore the theme-color gate.
- Update Music architecture documentation to reflect separate Plugins and Sources pages.
- Keep `references/nuclear-player-1.41.4` excluded from production packaging and Git unless intentionally archived separately.

## Phase 2 — Complete playback-critical backend

- Preserve the main-process provider registry as the single provider authority.
- Validate metadata search through Local Library, MusicBrainz and Deezer, with OmniSource deduplication and artwork enrichment.
- Validate candidate ranking, probing, six-candidate fallback and bounded expired-stream recovery for YouTube and SoundCloud.
- Finish Subsonic/Navidrome ping, browse, search, artwork, playlists, streaming refresh and actionable authentication errors.
- Preserve opaque `orion-music://` grants, range requests, private paths, private credentials and redacted diagnostics.
- Add explicit provider timeout, offline, rate-limit and partial-result states.
- Ensure a failed provider never blanks successful results from other providers.
- Verify LRCLib, embedded and sidecar lyrics through one normalized lyric contract.

## Phase 3 — Finish library and listening state

- Preserve stable local identities while handling moved, renamed, deleted and restored files.
- Add resumable/cancellable scans, bounded metadata concurrency and corrupt-file diagnostics.
- Add artwork cache pruning, configured cache limits and safe clear-cache behavior.
- Complete queue and deterministic shuffle recovery across restarts.
- Implement JSON and M3U playlist import/export with validation and collision-safe naming.
- Include portable playlists, favorites, history and Music preferences in backup/restore while excluding credentials, caches, signed URLs and machine paths.
- Complete ReplayGain when metadata exists and configurable crossfade without creating a second audible playback owner.

## Phase 4 — Build the dedicated Living Album Cosmos shell

- Replace the current mixed shell with a dedicated Music navigation rail, compact command/search surface and explicit Cinema return control.
- Build the Home listening world around one large artwork planet, waveform horizon, track metadata and essential transport context.
- Derive background layers from cached artwork palettes using gradients, masks, Canvas 2D and transforms—no expensive live blur or WebGL requirement.
- Use bass for restrained breathing depth, mids for orbital drift and treble for sparse spectral particles.
- Present discovery, recent listening, albums, artists and playlists as dense editorial rails inspired by mature music players without copying their branding or layouts.
- Polish Search, Artist, Album, Library, Playlist, Favorites, Sources and Plugins into one consistent visual system.
- Keep Plugins as a separate page with review, declared permissions, registration, ready, enable/disable and diagnostics states.
- Retain one audio element and one persistent transport across all Music routes and both Orion worlds.

## Phase 5 — Accessibility, performance and release validation

- Validate keyboard navigation, visible focus, screen-reader labels, contrast and responsive layouts.
- Reduced Motion removes orbital/particle movement but retains color, waveform progress and focus feedback.
- Efficiency mode caps visuals at 15 FPS and removes particles; Balanced uses 30 FPS; Quality may use 60 FPS.
- Stop analyser and visual work while paused, buffering, hidden, minimized or battery constrained.
- Test libraries containing 100, 10,000 and 50,000 tracks.
- Test offline startup, partial provider failure, expired streams, missing files, corrupted metadata and interrupted scans.
- Test Cinema/Music arbitration, media keys, Bluetooth controls, tray behavior and crash recovery.
- Validate Midnight Premiere, AMOLED, Mocha, Slate, Projector Silver and Custom themes.
- Run source-size, binding, IPC, secret, theme-color, cycle, unit, renderer, Electron and production-build gates.
- Package-test the Windows installer and ZIP on a clean machine without system Python, yt-dlp or ffmpeg.

## Acceptance criteria

- Real Music search never returns demo/fabricated content and always uses enabled main-process providers.
- A supported online search result can resolve and play through the secure protocol with artwork, seeking and automatic fallback.
- Local music scans, displays artwork, plays, seeks and survives restart without exposing paths.
- Queue, lyrics, plugins and sources have no duplicate or dead UI.
- Music and Cinema never produce simultaneous audio.
- Living Album Cosmos is visually distinct from Cinema and from the reference applications while remaining recognizably Orion.
- Every theme and Reduced Motion passes visual/accessibility review.
- All automated gates pass; no source file exceeds the established limit.
- `package.json` remains unchanged until the full Music release is accepted.

## Deferred follow-up

The following require a separate security/product goal after stable first-party v2:

- Downloaded third-party plugin packages.
- Signed registry manifests and checksums.
- Electron utility-process plugin workers.
- Enforced domain, storage and external-action permissions.
- Plugin resource limits, crash isolation, audit logs and automatic verified updates.
- Spotify/Last.fm user integrations requiring external credentials unless separately approved.
- MCP control of Music Planet.
