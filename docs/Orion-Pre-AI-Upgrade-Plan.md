# Orion pre-AI roadmap

> **Historical roadmap:** The pre-v2 Cinema milestones in this document are complete. Orion X Music Planet v2.0.0 is now the shipped baseline; future sequencing belongs in a post-v2 roadmap.

- **Latest stable release:** v2.0.0 — Orion X Music Planet
- **Completed metadata milestone:** v1.1.x — Search, People, Cast and Constellation
- **Current baseline:** v2.0.0
- **Status updated:** July 11, 2026

## Product direction

Orion will become a reliable, distinctive desktop media application before AI features become part of its identity. Streaming, downloader recovery, architecture refactoring, playback continuity, local playback, adaptive performance, Windows integration and the first visual-polish cycle are complete foundations. The next milestones deepen metadata, offline ownership, curation, playback capabilities, privacy and resilience without adding AI or DRM circumvention.

The v1.1 metadata work and Music Planet program are incorporated into the v2.0.0 application package.

## Completed foundations

### v1.0.7 — Downloader recovery

- Added app-managed Windows installation and repair of pinned `yt-dlp` and ffmpeg tools.
- Added scoped HLS capture using private browser headers and cookies, protected-stream proxy fallback, resumable fragments and provider retries.
- Added persistent queues, pause/resume/retry/cancel, process-tree cleanup, tray progress, movie/series organization and subtitle sidecars.
- Reconnected downloader installation, settings, download-dialog and Downloads-page controls.

### v1.0.8 — Behavior-preserving refactor

- Organized main, preload and renderer code by domain while preserving navigation, playback, settings and storage behavior.
- Split Settings, App shell, downloader, Movie, TV, AllManga and subtitle responsibilities into focused modules.
- Preserved `window.electron`, `orion_*` storage, secure credentials, download records and existing user profiles.
- Established binding, IPC, secret, cycle, source-size, unit, renderer, Electron and production-build gates.

### v1.0.9 — Cosmic Polish and Playback Continuity

- Added capture sessions for HLS, DASH, direct video and extensionless manifests, including live detection updates and actionable unsupported states.
- Added Download Record v3 metrics, filters, sorting, expandable diagnostics and bulk actions.
- Added restricted `orion-media://` local playback with range requests, resume, watched state and sidecar subtitles.
- Added one logical playback session across embedded, mini, pop-out and local modes, with exclusive audio ownership and state handoffs.
- Added adaptive ambient sampling, cinematic themes, bundled fonts, motion/background choices, discovery hubs and improved Continue Watching and Library experiences.
- Added deterministic recommendations from recent history, configurable Home row order/visibility, carousel/grid presentation and editorial Top Rated/K-drama rows.
- Completed live streaming/downloader stabilization and v1.0.7/v1.0.8 profile compatibility checks.

### v1.0.10 — Performance, Windows Integration and Final Visual Polish

- Added local Quality, Balanced and Efficiency adaptation driven by CPU, memory, playback pressure, battery and Windows power state.
- Added title-bar/tray battery state, low and critical alerts, and resumable critical-battery download pausing.
- Added Windows media-session metadata and Bluetooth/media-key support without competing with Windows-owned output volume.
- Added YouTube-style shortcuts across embedded, mini, pop-out and local playback.
- Added a true 16:9 mini-player with migrated dimensions, auto-hiding overlay chrome and preserved handoff behavior.
- Added live interaction appearance controls, six-theme semantic synchronization, carousel hover fixes and a theme-color regression gate.
- Preserved downloader, playback, subtitles, secure credentials, history, progress and partial-job compatibility.

## v1.1.0 — Search, People and Cast

v1.1.0 is a focused metadata and navigation release. It must not absorb downloader, playback, manual-collection, social-profile or AI work.

**Implementation status (July 3, 2026):** the renderer implementation and automated acceptance coverage are complete on top of v1.0.10. Quick/full search retains people and adds independent cinema filtering, the Person route and normalized filmography are active, Movie/TV pages expose cast and key crew, and Constellation provides a dedicated credit-derived people catalog. Constellation search now merges filtered mapped matches with independent paginated global person lookup, removing the previous dependency on Load more mapping. A shared measured Online/Degraded/Offline state now drives the title bar and renderer recovery states, with redacted route diagnostics. Existing v1.0.10 streaming behavior is intentionally preserved after experimental media-readiness changes proved incompatible with some nested provider players. The package remains v1.0.10 and no v1.1.0 release is published while user validation, the complete six-theme visual review, live regression smoke tests, copied-profile validation and clean Windows packaging remain pending.

### Search

- Retain TMDB person results in quick search and full-page search instead of discarding them.
- Add All, Movies, TV and People filters with accurate visible counts.
- Add an independent cinema filter to quick and full search: Global, Hollywood, Bollywood, South Indian, Korean, Japanese and Chinese. Classify media from original-language and available origin-country metadata, never from title text or a person's birthplace.
- Keep quick search debounced and capped for fast keyboard use.
- Add an explicit **Load more** action to full-page search, preserving the current query/filter while fetching successive TMDB pages.
- Deduplicate appended results by `media_type` and TMDB ID, ignore stale responses after query changes, and retain recent-search behavior.
- Give people a distinct result layout with profile image, name, known department and representative known-for titles.
- Disambiguate same-name media with year, original language, available origin-region context, rating and original title; mark repeated localized titles in the current result set rather than making users guess between otherwise identical cards.
- Present cinema identity directly in each media result and allow users to isolate the intended cinema instead of manually scanning a mixed TMDB relevance list.
- Provide All, Movies, TV and People filters in quick search as well as full search, while keeping each quick-filter view capped at 12 visible results.

### Person page and filmography

- Add a `person` navigation target that participates in Orion’s existing back stack and scroll restoration.
- Show profile art, biography, birth/death details, place of birth, known department and missing-data fallbacks.
- Build a Known For rail from the selected person’s TMDB credits, not from a new provider or a text search for their name.
- Normalize movie and TV credits into one filmography model, deduplicate repeated titles, and merge multiple characters/jobs for the same media identity.
- Add All, Movies and TV filmography filters and display release year plus character or job context.
- Navigate filmography cards into existing Movie and TV pages and return to the same Person-page position when navigating back.
- Defer social links, external IDs, alternate-name galleries and image galleries.

### Movie and TV credits

- Add a cast rail to Movie and TV detail pages with profile image, person name and character.
- Add a compact key-crew group for directors, writers, creators and lead producers.
- Add **View all** behavior without introducing department-heavy crew pages.
- Make every cast and crew entry keyboard accessible and navigable to the Person page.
- Defer episode guest stars and complete crew-department browsing.

### Constellation

- Add **Constellation** after Discover in Browse navigation as Orion's dedicated performers-and-creators catalog.
- Provide a Featured person, Trending this week, device-local From Your Stories rail and filterable people catalog.
- Map Hollywood, Bollywood, South Indian, Korean, Japanese and Chinese pools from representative TMDB movie/TV discoveries and their actual credits; never infer cinema membership from birthplace.
- Use TV aggregate credits, the first twelve cast members and key directing, writing and production roles to build deduplicated person records.
- Bound Constellation credit work to two concurrent requests and preserve successful results after partial failures.
- Support cinema, craft, media-influence and sorting preferences plus instant session-only filtering of the loaded pool.
- Search TMDB people independently after two characters, present global results separately from filter-truthful mapped matches, cancel stale queries and paginate without blocking regional mapping.
- Persist compact generated pools for 24 hours with a seven-pool limit, exclude those pools from backup, and retain user filter preferences in backup/restore.
- Derive From Your Stories from up to eight unique History/My List titles on the device without uploading or persisting a preference profile.
- Reuse the Person page, Movie/TV routes, semantic themes, custom navigation stack, scroll restoration and automatic mini-player continuity.

### Contracts and boundaries

- Define `PersonSummary`, `PersonDetails` and normalized `CreditItem` JSDoc contracts.
- Define `ConstellationPerson`, `ConstellationPool` and `ConstellationPreferences` contracts.
- Keep TMDB requests behind the existing renderer metadata service and session cache; do not add credentials or providers.
- Keep person metadata independent from playback, downloader, local-media and subtitle state.
- Keep network measurement renderer-only: report an HTTP round trip to Orion's metadata service every 30 seconds and on reconnect/visibility changes without adding IPC or exposing credentials.
- Preserve the custom route/navigation system; do not introduce React Router or a global state library.

### Experience and acceptance

- Provide loading skeletons, empty results, partial biography/credit states, missing-image placeholders, retryable API errors and offline guidance.
- Preserve quick-search focus, Escape behavior and recent searches; support logical arrow/Tab navigation and visible focus.
- Use semantic tokens across Midnight Premiere, AMOLED, Mocha, Slate, Projector Silver and Custom.
- Reduced Motion removes movement while retaining focus, tint and border feedback.
- Test normalization, role merging, pagination, stale-response rejection, cinema query generation, South Indian pool merging, bounded credit aggregation, cache rules, preference persistence, route/back-stack behavior and Movie/TV/Person navigation.
- Release only after the full repository gates, Electron navigation flows and six-theme visual matrix pass without downloader or playback regressions.
- Show Online with rounded milliseconds, slow-link warning styling, Checking during startup and immediate Offline state beside battery status in the custom title bar.
- Preserve the application shell and local features during route failures, expose redacted diagnostics, and retry one failed metadata request after confirmed reconnection.

## Later pre-AI milestones

### v1.2.0 — Manual collections

- Add user-created collections that can contain both movies and series without changing My List.
- Support collection names, descriptions, optional artwork, manual title ordering and membership in multiple collections.
- Add create, rename, duplicate, delete and add/remove-title workflows with clear destructive confirmations.
- Include collection records and ordering in backup/restore and privacy-safe export.
- Reuse Orion’s existing media cards, TMDB identities, navigation and semantic theme tokens.
- Keep already-completed Home recommendations, Home row customization and TMDB franchise rails out of this milestone.

### v1.3.0 — Advanced playback and diagnostics

- Add Orion-owned audio and subtitle track selection where the active source exposes usable tracks.
- Add codec/container compatibility reporting and controlled support for additional local formats where Chromium can play or safely remux them.
- Add a user-facing playback diagnostics panel for resolution, codec, dropped frames, buffering, selected source and current performance tier.
- Persist privacy-safe source-health summaries without storing signed URLs, cookies or request headers.
- Add monitor selection, per-display window placement and stronger multi-monitor fullscreen restoration.
- Preserve completed source failover, adaptive performance, battery behavior, ambient safeguards and basic fullscreen/pop-out functionality.

### v1.4.0 — Privacy, notifications and recovery

- Add quiet hours and finer event controls on top of existing download, episode and battery notifications.
- Add history/progress retention periods and clearer credential inventory with individual delete/revoke actions.
- Version backup schemas and test supported cross-version migrations using sanitized fixtures.
- Add failed-update recovery, updater rollback guidance and health checks for recoverable local state.
- Build on existing secure storage, redacted diagnostics, scheduled backups, reset controls and downloader repair instead of replacing them.

### v1.5.0 — AI readiness, without AI features

- Stabilize and version metadata, person, playback, collection, search and settings contracts.
- Define explicit consent and data classification for any future catalog or preference indexing.
- Define local/cloud processing policy, export/deletion lifecycle, storage/performance budgets and opt-in migrations.
- Require a separate product decision and release plan before any AI capability can be enabled.

## AI boundary

AI remains deferred until the pre-AI milestones pass acceptance. Future work may include semantic search, mood discovery or enhanced personalized recommendations, but Orion must never silently upload watch data, search history, subtitles or provider credentials.

## Non-negotiable engineering rules

- DRM circumvention remains out of scope.
- Cookies, captured headers, provider keys, tool paths, arbitrary filesystem paths and spawn arguments remain outside React.
- Profile and record migrations are additive and reversible where practical.
- Flat preload aliases remain until an explicitly planned breaking migration includes compatibility tests and release guidance.
- Feature modules do not import sibling feature internals, and pages do not import other pages.
- Hand-written source files remain below 800 lines and should normally remain below 500.
- A release is incomplete until repository checks, Electron flows, clean Windows packages, upgrade-profile testing and live streaming/downloader smoke tests pass.
