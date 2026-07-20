# Orion v2.0.1 — Cinema Source Stabilization and Cross-World Polish

## Summary

v2.0.1 is a focused reliability and finish release. It repairs stale Cinema provider contracts, introduces evidence-based source health and failover, strengthens embedded-player ad protection, makes subtitle handling provider-aware, and completes a bounded UI-polish pass across Cinema and Music Planet.

The visual work is refinement rather than a redesign. Cinema retains its red editorial identity and Music Planet retains its living orb, particles, Neutral Eclipse palette and orbital stages. The patch standardizes loading, offline, empty and error behavior; reduces unnecessary card nesting; improves alignment, contrast and responsive behavior; and removes cross-world state leakage. No downloader strategy change, DRM work, new catalog feature, provider expansion, or unrelated architectural rewrite enters v2.0.1.

Release objectives:

- Keep VidKing, Videasy and VidSrc as the primary Cinema choices after revalidation.
- Graduate VidLink and VidSrc CC from Experimental only after the complete movie/TV acceptance matrix passes.
- Repair AutoEmbed, VsEmbed, 111Movies and VixSrc, but retain Experimental status until live validation succeeds.
- Disable sources whose current contracts cannot be verified instead of presenting them as functional.
- Prevent a provider page or error document from being reported as active playback.
- Block popups, unwanted top-level redirects and known ad/tracker requests without blocking required player, subtitle or media traffic.
- Preserve playback time and episode identity through manual and automatic source changes.
- Replace indefinite spinners and blank screens with bounded skeleton, timeout, retry and offline states.
- Give Cinema pages a consistent editorial hierarchy without flattening their individual identities.
- Make Music Planet overlays feel integrated with its living scene rather than stacked above it as generic cards.
- Keep global status, world-specific status and player diagnostics distinct so the same failure is never presented twice.
- Validate every polished surface across all six themes, Reduced Motion and common desktop widths.

Package and release metadata remain at v2.0.0 until all v2.0.1 gates pass.

## Implementation Status

Last updated: July 17, 2026.

| Checkpoint | Status | Verified outcome |
|---|---|---|
| Safety and visual baseline | Complete in automation | Clean source-size, binding, IPC, secret, theme, cycle, unit, renderer, production-build and Electron baselines are recorded; live provider screenshots remain part of acceptance. |
| Registry extraction | Complete | Feature-owned source contracts, validation and compatibility exports replace the TMDB-service monolith. |
| Route repairs | Complete in code | Current documented movie/TV routes are unit-tested; live provider acceptance remains before promotion. |
| Playback evidence and health | Complete in code | Main-frame failures, PLAYER_EVENT progress, frame progress, bounded health records and cooldowns are connected. |
| Failover | Complete in code | Runtime health, cooldowns and session attempts rank Primary/Candidate sources without silently entering unvalidated Experimental providers; live playback handoff remains to smoke-test. |
| Ad and navigation protection | In progress | Popups remain denied and over-broad font/static blocking was removed; provider navigation and cosmetic cases remain in the live matrix. |
| Subtitles | In progress | URL and MIME-classified WebVTT capture are connected, including extensionless tracks; provider/external fallback needs live verification. |
| Shared states and UI | Complete in code | Cross-world banner leakage is removed, Home has bounded skeleton/slow/retry states and the welcome-to-Search navigation race is fixed. |
| Cinema polish | In progress | Discover hierarchy, semantic controls and live source-health menu are implemented; remaining page/theme review is pending. |
| Music Planet polish | Complete for v2.0.1 scope | Cinema status is scoped away, Search copy is user-facing and the existing six-theme Electron contrast suite passes. |
| Documentation and release | Pending | Release notes and version bump wait for all live and clean-machine gates. |

### Automated validation snapshot

- Repository quality gate: passed.
- Node tests: 52 passed.
- Renderer tests: 137 passed.
- Focused Cinema source/health/network tests: 39 passed after the final failover restriction.
- Electron tests: 13 passed together, covering startup, navigation, People search, Library, Constellation, Cinema playback lifecycle, sidebar restoration and Music playback/theme boundaries.
- Production renderer build: passed with the existing lazy Three.js chunk advisory only.
- IPC compatibility: 206 preload methods and 125 channels preserved.
- Package version: remains `2.0.0` until the live source, subtitle and ad acceptance matrix succeeds.

## Rendered UI Audit

The audit used a clean temporary Orion profile, a production renderer build and Electron screenshots at 1440×900. Static inspection covered the Home, Discover and Music feature boundaries plus their theme/style layers. The same scenarios will be retained as visual-regression fixtures.

### Cross-world findings

- The global TMDB connectivity banner remains visible inside Music Planet even though Music search and local playback have different dependencies. A Cinema catalog outage must not visually imply that Music Planet is offline.
- Global and page-local error notices can appear together with nearly identical wording. Status ownership is unclear and valuable vertical space is lost.
- Sidebar navigation is structurally clear, but the world switch, active-state ornamentation and section spacing use different visual grammars. The Cinema/Music switch should remain prominent while sharing the same focus, hover and density rules.
- Loading, warning, empty and retry states use several unrelated components and phrases. Some surfaces show a lone spinner, some a full bordered card, and others a banner.
- Page title positions and maximum widths differ enough that switching destinations feels like moving between separate applications instead of two worlds inside Orion.
- Theme-sensitive literals and inline layout declarations still bypass semantic tokens in Discover and legacy Music styles, increasing Projector Silver and Custom-theme risk.

### Cinema findings

- Home can render a lone circular spinner in a nearly empty black viewport. It provides no page structure, progress context, timeout or fallback action.
- Discover repeats offline status when the global banner is already present.
- Discover nests a large “Choose your orbit” surface, section containers and individual provider/world cards, creating unnecessary card traffic.
- Provider tiles marked unavailable use low-contrast text and look disabled without explaining why or how to refresh availability.
- Story-world and genre tiles use many hard-coded, fully saturated gradients. They overpower the Cinema palette and do not adapt consistently across themes.
- Discover mixes inline spacing/color rules with stylesheet rules, making alignment and theme behavior fragile.
- The page uses several accent languages at once: Cinema red, active violet, cyan eyebrow text and provider brand colors. Brand colors may remain, but navigation and structural accents need one semantic hierarchy.
- Failure/loading treatments on Home, Discover, Search and player surfaces do not yet share a predictable retry, cached-content and offline pattern.

### Music Planet findings

- Music Home successfully preserves the orb and living scene, but the cross-world TMDB warning sits above it and incorrectly frames the whole Music experience as unavailable.
- Search places an outer orbital panel around another search/filter panel, a warning panel and a large empty-state panel. This returns to the dense card-on-card style the Music design previously moved away from.
- The Search heading uses implementation language (“Echo-aligned catalog sources” and “protected behind Orion's main process”) instead of user-facing discovery copy.
- Empty and partial-provider states dominate the viewport and visually compete with the scene. They should become light lenses with a direct action rather than full nested containers.
- The scene is a large lazy-loaded Three.js chunk. It must remain isolated from Cinema startup and must not render at full cost while hidden, minimized, battery-restricted or under Reduced Motion.
- Music styling is split across `planet.css`, `planet-v2.css`, `planet-polish.css`, `planet-bridge.css`, `orbital-stage.css` and `layout.css`. Overlapping generations and hard-coded translucent colors make cascade ownership difficult to reason about.
- Music’s sidebar is well grouped, but selected icons combine multiple rings, dots and glows. The state should remain distinctive with fewer simultaneous decorations.
- Music Settings was not reached reliably through the first automated navigation attempt, which is itself a route/transition acceptance case: world navigation must become interactive only after its destination is ready, or preserve the previous view without an error overlay.

## UI Scope and Principles

### Fixed identities

- Cinema keeps editorial poster/landscape rails, red eclipse accents, cinematic imagery and its existing sidebar model.
- Music Planet keeps the animated scene, orb, particles, Neutral Eclipse token family, orbital stages and persistent dock.
- Brand/provider colors are allowed only for identity badges and verified provider tiles, never for structural layout or generic interaction states.
- v2.0.1 does not introduce a new theme, navigation architecture, player surface or page type.

### Shared state hierarchy

Use one status hierarchy across both worlds:

1. **Global application status** — authentication, update, battery and true whole-app connectivity only.
2. **World status** — Cinema catalog reachability or Music provider reachability, scoped to that world’s shell.
3. **Page status** — loading, partial, empty, offline-cache and retry for the current destination.
4. **Player status** — resolving, buffering, source failure and recovery, owned by the active player.

Rules:

- Only one message may represent the same failure at a time.
- A TMDB outage is Cinema-scoped and does not label Music Planet offline.
- Music provider partial failure does not become a global offline banner.
- Page skeletons appear immediately; a concise slow-state message appears after a bounded delay; Retry and available offline actions appear after timeout.
- Error messages state what failed, what remains usable and what the user can do next.
- Successful retry clears every related stale banner and accessibility announcement.

### Shared visual primitives

Create or normalize narrow primitives rather than another page framework:

- `WorldStatusBanner` for world-scoped connectivity and partial-service state.
- `PageStateShell` for skeleton, slow, offline, empty and fatal states.
- `EditorialPageHeader` for Cinema title, eyebrow, description and actions.
- `OrbitalPageHeader` for Music title, description, orb-safe spacing and actions.
- `InlineNotice` for non-blocking partial data and subtitle/provider warnings.
- `ActionableEmptyState` with one primary and at most one secondary action.
- `SourceHealthBadge` using text, icon and color rather than color alone.

Each primitive uses semantic tokens, visible focus, live-region behavior where appropriate and Reduced Motion fallbacks. Feature modules may compose these primitives but must not import another feature’s private internals.

## Cinema UI Polish

### Home and shared rails

- Replace the lone Home spinner with a structural skeleton for hero, Continue Watching and the first two rails.
- Add slow-network copy after five seconds and Retry/offline-library actions after the request timeout.
- Preserve the previous successful Home payload during background refresh instead of blanking the page.
- Keep carousel hover headroom, edge shadows and keyboard focus visible without clipping.
- Standardize rail headers, “View all” placement, empty states and card metadata spacing.
- Ensure Continue Watching, My List and recommendation rails retain useful content when TMDB enrichment is temporarily unavailable.

### Discover

- Reduce the initial hub hierarchy to one open editorial section with provider and story-world rails; avoid an outer card around inner cards.
- Convert genre gradients to theme-aware tinted lenses derived from semantic genre hues at controlled saturation.
- Retain provider brand colors only in logos/markers; unavailable providers use readable neutral treatment plus “Unavailable in {region}” and Refresh guidance.
- Move inline layout declarations into focused Discover styles and replace structural white/cyan/purple literals with semantic tokens.
- Use one active accent for tabs and filters, while Cinema red remains the world identity.
- Consolidate the global/page offline state and keep cached regions/genres navigable when possible.
- Align hub, region, genre and results headers to the same content grid.

### Search, Library, Downloads and Settings

- Apply the shared editorial header grid and loading/error hierarchy to Search, Library, Downloads and Settings.
- Keep search filters compact and result metadata legible when titles share a name; year, media type, origin/language and person context must not collapse into the title.
- Keep Library sorting/filter controls visible and prevent missing enrichment from producing misleading `N/A` layouts.
- Ensure Download cards use consistent status badges, detail expansion and primary-action order without changing downloader behavior.
- Remove duplicate setting descriptions, orphan spacing and raw diagnostic phrasing from ordinary settings surfaces; diagnostics remain in explicit expandable areas.
- Verify Jump to section, focus restoration and live-setting updates after layout changes.

### Cinema player and source surfaces

- Rebuild the source selector around the new runtime-health contract: label, readiness, experimental status, subtitle capability and concise reason.
- Keep manual source selection one action away; move detailed evidence into a separate diagnostics view.
- Use a single player status overlay for loading, slow startup, ad-navigation block, title unavailable, source failure and failover.
- Preserve video visibility while a background failover candidate is checked.
- Keep source, subtitle, mini-player and pop-out controls aligned and non-overlapping at narrow widths.
- Ensure provider errors never expose raw URLs or appear as unstyled browser text.

## Music Planet UI Polish

### Living scene and performance

- Preserve the orb/background implementation and audio-reactive behavior; do not redesign or replace it.
- Keep Three.js and scene code behind the Music route’s lazy boundary so Cinema startup does not download or initialize it.
- Stop or reduce scene work when Music is hidden, minimized, paused, battery-restricted or under Reduced Motion.
- Show a lightweight static Neutral Eclipse fallback while the scene chunk initializes or when GPU initialization fails.
- Ensure foreground lenses reserve orb-safe space and never cover the focal orb at supported widths.

### Home, Search and content pages

- Keep Home as the immersive entry scene with one hero search action; avoid showing duplicate search inputs in the shell and page.
- Replace Search’s nested outer/inner cards with one restrained orbital lens: open header, search/filter row, inline partial notice and results/empty content.
- Replace implementation-facing copy with user language such as “Search tracks, albums, artists and playlists.”
- Keep partial-source warnings compact and name the affected capability only when it helps recovery.
- Normalize Albums, Artists, Library, Playlists, Favorites, Sources and Settings around the existing Orbital Stage spacing, header and empty-state grammar.
- Preserve square album art, circular artist portraits, playlist clusters and compact track rows without over-cropping or fallback-art congestion.
- Keep actions discoverable on hover, keyboard focus and touch; no action may rely on hover alone.

### Dock, overlays and Settings

- Preserve the full Music dock and its single playback owner.
- Verify docked, floating and narrow layouts keep artwork, identity, previous/play/next, timeline, volume and overflow reachable without overlap.
- Keep Queue, Lyrics, Source, Details, Playlist and Error panels mutually exclusive and clamped above the dock.
- Apply one glass-edge, shadow, radius and surface hierarchy to Music Settings; remove hard-edged nested settings containers.
- Consolidate legacy Music CSS rules into documented layers: tokens, scene, stages, dock/overlays and responsive overrides. Remove superseded declarations only after screenshot and behavior parity.
- Route every remaining theme-sensitive color through Music semantic tokens, including Projector Silver corrections and Custom-theme inheritance.

### Sidebar and world switching

- Retain Listen, Explore, Yours and System groups.
- Reduce selected-state ornamentation to one ring/marker plus a readable active surface; preserve the constellation identity without simultaneous competing glows.
- Keep the Cinema world control visually separated but align its radius, focus ring and pointer behavior with the Music navigation system.
- Preserve both worlds’ last route and scroll position; failed lazy navigation keeps the current screen usable and offers Retry rather than showing a root error boundary.

## Confirmed Baseline Problems

### Provider contracts

- Videasy uses a potentially stale `player.videasy.to` endpoint and must be revalidated against the current canonical player domain.
- AutoEmbed's TV route uses slash-separated season/episode values instead of its documented hyphenated contract.
- VsEmbed's domain and episode route no longer match its current documented contract.
- 111Movies and VixSrc incorrectly include an `/embed/` path segment.
- 2Embed uses a stale domain/route and does not reliably route TMDB versus IMDb identifiers.
- VidFast and Vidify have no dependable current public integration contract and cannot be treated as working choices.

### Health and failover

- `ready` and `experimental` are static source declarations, not runtime health.
- `did-fail-load` currently clears the loading state instead of recording a source failure.
- A finished HTML document can be labelled Playing before a video is present or advancing.
- Experimental sources are excluded from automatic failover even when individually validated.
- Failures are not retained per provider, media type, title, region or session.
- A 15-second zero-progress timer cannot distinguish slow startup, an error page, an ad page and unavailable media.

### Advertising and navigation

- Popup creation is denied, but same-tab advertising redirects are not generally stopped.
- The global hostname list cannot block first-party ad overlays or rapidly changing ad domains.
- Broad global blocks can remove legitimate player dependencies.
- There is no provider-specific navigation policy, required-domain allowlist or cosmetic cleanup boundary.

### Subtitles

- Captured subtitles are limited mainly to URLs containing `.vtt`.
- Extensionless subtitle responses, SRT, TTML, JSON manifests and blob-backed tracks are missed.
- Source `subtitleMode` metadata is not driving a real subtitle strategy.
- VidSrc CC and VidLink external-subtitle URL parameters are not used.
- Provider-captured subtitles are not consistently scoped to the active media/source session.

## Target Architecture

Move Cinema source ownership out of `renderer/services/tmdb.js` and into a focused feature boundary:

```text
src/
├── main/
│   └── player/
│       └── sources/
│           ├── healthStore.js
│           ├── requestPolicy.js
│           ├── navigationGuard.js
│           ├── subtitleCapture.js
│           └── diagnostics.js
├── renderer/
│   └── features/
│       └── player/
│           └── sources/
│               ├── registry.js
│               ├── contracts.js
│               ├── sourceEvents.js
│               ├── sourceSelection.js
│               └── adapters/
│                   ├── videasy.js
│                   ├── vidsrc.js
│                   ├── vidking.js
│                   ├── vidsrccc.js
│                   ├── vidlink.js
│                   ├── autoembed.js
│                   ├── vsembed.js
│                   ├── movies111.js
│                   ├── vixsrc.js
│                   └── allmanga.js
└── shared/
    └── cinemaSourceConstants.cjs
```

The Movie and TV controllers consume the same source registry and health service. TMDB metadata fetching remains separate.

## Source Contract

Add a JSDoc `CinemaSourceDescriptor`:

```js
{
  id,
  label,
  releaseStatus: "primary" | "candidate" | "experimental" | "disabled",
  media: { movie, tv, anime },
  idPolicy: { movie, tv },
  buildMovieUrl,
  buildEpisodeUrl,
  expectedOrigins,
  allowedNavigationOrigins,
  requiredRequestOrigins,
  progressStrategy: "player-event" | "frame-video" | "native" | "none",
  subtitleStrategy: "url-param" | "request-capture" | "text-track" | "provider" | "external",
  supportsResume,
  supportsExternalSubtitles,
  supportsDownloads
}
```

The renderer may receive only safe public descriptors and redacted diagnostics. Cookies, request headers, signed media URLs and unrestricted navigation rules remain main-process-only.

## Provider Corrections and Release Status

### Primary sources

#### VidKing

- Retain TMDB movie and TV routes.
- Consume documented `PLAYER_EVENT` messages for play, pause, seek, duration and progress.
- Fall back to frame video inspection only when events are absent.
- Validate captured subtitles and provider server switching.

#### Videasy

- Confirm and use the current canonical player domain.
- Preserve overlay and theme parameters only when supported.
- Add required-domain allow rules, including subtitle/player support endpoints.
- Detect quality-change video recreation without resetting stored progress.

#### VidSrc

- Retain its documented TMDB/IMDb embed routes.
- Stop same-tab navigation away from the approved player chain.
- Replace assumed `ds_lang` behavior with parameters verified against the current provider.
- Support explicit external VTT subtitles where possible.

### Promotion candidates

#### VidSrc CC

- Keep the documented `/v2/embed/movie` and `/v2/embed/tv` contracts.
- Integrate `PLAYER_EVENT` progress messages.
- Add optional external subtitle parameters.
- Promote only after movie, TV, resume, subtitle and ad-navigation tests pass.

#### VidLink

- Retain documented TMDB routes.
- Integrate `PLAYER_EVENT` messages, `startAt`, external VTT subtitles and provider failure reporting.
- Do not give the provider an unrestricted `fallback_url`; Orion owns failover.
- Promote only after the complete acceptance matrix passes.

### Repaired but experimental

#### AutoEmbed

- Preserve movie routes.
- Change TV routes to the documented `{id}-{season}-{episode}` form.
- Use IMDb only when available and explicitly required; otherwise use TMDB.

#### VsEmbed

- Replace stale embed domains with a verified current domain.
- Use the current episode path or explicit query contract.
- Add default subtitle language only when supported.

#### 111Movies

- Replace `/embed/movie/{id}` with `/movie/{id}`.
- Replace `/embed/tv/{id}/{season}/{episode}` with `/tv/{id}/{season}/{episode}`.

#### VixSrc

- Replace `/embed/movie/{id}` with `/movie/{id}`.
- Replace `/embed/tv/{id}/{season}/{episode}` with `/tv/{id}/{season}/{episode}`.
- Integrate its documented player events and optional audio-language parameter.

### Disabled or quarantined

- VidFast: Disabled until a current authoritative contract and clean live test exist.
- Vidify: Disabled until a current authoritative contract and clean live test exist.
- 2Embed: Disabled until its current domain, ID policy and redirect behavior are verified.
- SuperEmbed: Quarantined as Experimental because of aggressive redirects and security reports; never selected automatically.

Disabled sources remain visible only in diagnostics, not the normal source selector.

## Runtime Health Model

Add `CinemaSourceHealthRecord`:

```js
{
  sourceId,
  mediaType,
  state: "unknown" | "checking" | "ready" | "slow" | "degraded" | "failed" | "disabled",
  lastSuccessAt,
  lastFailureAt,
  consecutiveFailures,
  startupMs,
  cooldownUntil,
  reasonCode,
  redactedMessage
}
```

A source becomes ready only after playback evidence is observed:

1. Main provider document loads without a main-frame error.
2. A supported player event arrives or a playable video element is found.
3. Duration is finite or a live-stream state is explicitly reported.
4. Playback time advances across two observations while unpaused.

Classify failures as:

- Navigation blocked.
- Provider unavailable.
- Title unavailable.
- Media server unavailable.
- Startup timeout.
- Provider error page.
- Unsupported browser/player.
- Network offline.
- Subtitle-only failure.

Health records use a bounded, versioned store with cooldowns. A single failure does not permanently disable a source. Repeated failures temporarily lower its rank.

## Health-Aware Source Selection

- Default ordering: healthy primary sources, healthy promoted sources, unknown primary sources, then user-selected experimental sources.
- Never automatically select quarantined or disabled sources.
- Skip providers in an active failure cooldown.
- Preserve current time, paused state, volume, subtitle preference, season and episode during failover.
- Require positive readiness from the destination before releasing the previous playback owner.
- Prevent loops by tracking attempted sources for the current playback session.
- Manual source selection overrides ranking for that attempt but still reports accurate diagnostics.
- Display Ready, Slow, Degraded, Unavailable, Experimental and Disabled labels in the source menu.
- Add Retry current source and Refresh source health actions.

## Provider-Aware Ad Protection

Use four layers:

1. **Popup denial**
   - Preserve `setWindowOpenHandler({ action: "deny" })` for all player webContents.
   - Record blocked popup origin without exposing the target URL.

2. **Main-frame navigation guard**
   - Associate each webContents with its selected source.
   - Permit the provider's documented redirect chain and required player origins.
   - Reject top-level navigation to unrelated advertising, gambling, notification and download pages.
   - Do not apply this rule blindly to media subframes.

3. **Provider request policies**
   - Split global safety rules from provider-specific deny and allow rules.
   - Required media, subtitle, key, font and player-script origins override broad cosmetic blocks.
   - Remove broad blocks that are proven to break player dependencies.
   - Keep request statistics redacted to hostname and rule category.

4. **Conservative cosmetic cleanup**
   - Use narrowly scoped, versioned selectors only for known provider ad overlays.
   - Never hide generic buttons, player controls, captions or server selectors.
   - Disable a cosmetic rule automatically when it causes player readiness failure.

No code clicks advertisements, circumvents access controls, or attempts DRM bypass.

## Subtitle Strategy

- Detect subtitle responses by URL, response MIME type and content disposition.
- Support VTT, SRT, TTML/XML and known JSON subtitle manifests.
- Associate captured tracks with the active playback/source session.
- Deduplicate tracks by normalized language, label and content URL identity.
- Discover `<track>` and text-track metadata in accessible player frames.
- Prefer provider-native subtitles when healthy.
- Pass Orion-selected external subtitles through documented source parameters where supported.
- Fall back to Orion's configured SubDL/Wyzie flow when provider subtitles fail.
- Treat subtitle failure as non-fatal to video playback.
- Keep subtitle request headers and signed URLs private to the main process.

## UI and Diagnostics

Update the source selector to show:

- Source label and release status.
- Live health and last successful check.
- Movie/TV availability.
- Subtitle and progress capabilities.
- A concise failure reason when unavailable.

Add a source diagnostics panel containing:

- Current provider.
- Startup time.
- Readiness evidence.
- Blocked popup/request counts.
- Subtitle tracks detected.
- Failover attempts.
- Redacted provider errors.

Do not display raw media URLs, cookies, tokens, headers or local paths.

## Implementation Checkpoints

### 1. Safety and visual baseline

- Snapshot current source IDs, saved settings and default-source behavior.
- Add URL-contract unit tests before changing routes.
- Add fixtures for v2.0.0 source preferences and failover records.
- Capture Home, Discover, Search, Library, Downloads, Settings and player/source surfaces in Cinema.
- Capture Home, Search, Library, Albums, Artists, Favorites, Settings and the dock in Music Planet.
- Record loading, slow, offline, partial, empty and error variants at 1280×720, 1440×900 and 1920×1080.
- Freeze the six-theme and Reduced Motion screenshots as comparison baselines before structural CSS changes.

### 2. Registry extraction

- Move source declarations from the TMDB service into the Cinema source boundary.
- Keep compatibility exports while Movie/TV callers migrate.
- Add descriptor validation and unique-ID checks.

### 3. Route repairs

- Correct Videasy, AutoEmbed, VsEmbed, 111Movies and VixSrc.
- Disable unverified providers.
- Add movie/TV URL snapshots for every registered source.

### 4. Playback evidence and health

- Separate load success from playback readiness.
- Record main-frame failures and player error states.
- Add event-based progress adapters.
- Add bounded health persistence and cooldowns.

### 5. Failover

- Implement ranked, session-scoped failover.
- Preserve playback state and avoid duplicate audio.
- Add manual retry and health refresh.

### 6. Ad and navigation protection

- Add source-aware navigation rules.
- Split global and provider request policies.
- Add conservative cosmetic cleanup and regression safeguards.

### 7. Subtitles

- Add MIME-based capture and text-track discovery.
- Add supported external-subtitle parameters.
- Verify SubDL/Wyzie fallback.

### 8. Shared state and UI primitives

- Introduce the scoped global/world/page/player status hierarchy.
- Add shared status, notice and actionable-empty primitives with accessibility coverage.
- Remove duplicate connectivity messaging and ensure retries clear stale states.
- Add semantic tokens needed for structural accents, unavailable providers, tinted genres and Music glass hierarchy.

### 9. Cinema polish

- Replace empty Home loading with structural skeletons, slow state and retry/offline actions.
- Simplify Discover’s card hierarchy, migrate inline layout rules and normalize genre/provider styling.
- Align Search, Library, Downloads and Settings to the Cinema editorial grid.
- Polish the source selector and player recovery overlay around live health evidence.
- Verify mini-player, pop-out and local playback surfaces remain visually and behaviorally unchanged except for token/state consistency.

### 10. Music Planet polish

- Scope Cinema/TMDB status away from Music Planet.
- Flatten Search’s nested card stack and replace implementation-facing copy.
- Normalize Orbital Stage alignment and empty/loading behavior across Music destinations.
- Consolidate legacy Music style ownership without replacing the scene, orb or dock.
- Verify scene lazy loading, static fallback, dock responsiveness, panel placement and all six themes.

### 11. Documentation and release

- Add health/status information to the source menu.
- Add redacted diagnostics.
- Update v2.0.1 release notes plus Cinema source, UI-state and Music visual-boundary documentation.
- Bump package metadata only after acceptance succeeds.

Each checkpoint receives an atomic commit and rollback point.

## Test Matrix

### Unit tests

- Descriptor validation and ID resolution.
- Movie and TV URL generation for every source.
- IMDb-preferred fallback behavior.
- Health transitions, cooldowns and ranking.
- Failure classification and diagnostic redaction.
- Navigation allow/deny decisions.
- Subtitle MIME classification and deduplication.

### Integration tests

- Main-frame load failure must never become Playing.
- Error documents and unavailable-title pages must be detected.
- Player-event and frame-video readiness paths.
- Popup denial and same-tab redirect protection.
- Required provider script/media/subtitle origins remain reachable.
- Extensionless HLS and subtitle requests.
- Manual and automatic failover with playback-state preservation.
- Offline handling and recovery.

### Renderer and visual tests

- Global status appears only for true app-wide conditions.
- TMDB failure appears in Cinema and does not leak into Music Planet.
- Duplicate page/global notices collapse to one source of truth.
- Home loading renders structural skeletons, then slow and timeout recovery at the expected boundaries.
- Cached content remains visible during background refresh and partial-provider failures.
- Discover provider availability remains readable in every theme and exposes a reason/action.
- Discover genre tinting preserves contrast without restoring fully saturated hard-coded gradients.
- Search, Library, Downloads and Settings share the editorial header grid at supported widths.
- Music Search uses one content lens and one search field, with compact partial/empty states.
- Orbital Stages preserve their orb safe zone and align headings/actions consistently.
- Music dock controls and panels do not overlap at docked, floating and narrow sizes.
- Keyboard focus, screen-reader announcements and focus return work for notices, retries, source menus and dock panels.
- Reduced Motion removes decorative movement while preserving state, focus and contrast.
- Projector Silver and Custom inherit every new semantic token without dark-theme literals leaking through.

### Performance tests

- Cinema startup does not initialize or fetch the Music scene chunk.
- Music scene initialization does not block shell navigation or audio playback.
- Hidden/minimized/battery-constrained Music reduces or stops scene work as configured.
- Loading skeletons and status transitions do not cause cumulative layout shift in the primary page grid.
- Source-health probing remains bounded and does not contend with TMDB navigation, playback metadata or Music providers.

### Live provider validation

For each promotion candidate, validate:

- Three older and three recent movies.
- Three TV series with at least two seasons.
- One regional/non-English title.
- Playback start, pause, seek, resume and fullscreen.
- Mini-player and pop-out handoff.
- Provider-native and Orion fallback subtitles.
- Ad-click and popup behavior.
- Source switching without duplicate audio.

Run tests from a clean player session and a retained v2.0.0 session because provider cookies can change behavior.

### Repository gates

- Source-size check.
- Renderer binding check.
- IPC contract check.
- Secret scan.
- Theme-color check.
- Visual-state ownership check preventing duplicate global/world/page messages.
- Inline-style and theme-literal budget check for touched Cinema and Music files.
- Dependency-cycle check.
- Node and renderer tests.
- Electron Movie/TV playback tests.
- Electron Cinema/Music world-switch, lazy-route and offline-status tests.
- Visual screenshots for all audited surfaces, six themes and Reduced Motion.
- Production build and clean Windows install.
- Music Planet playback and world-switch regression smoke test.

## Release Acceptance

v2.0.1 can ship only when:

- Every visible source has a verified current contract.
- Disabled sources are absent from the normal source menu.
- VidLink and VidSrc CC pass the complete promotion matrix before losing Experimental status.
- A provider page cannot be labelled Playing without playback evidence.
- Main-frame failures produce actionable errors.
- Automatic failover preserves position within five seconds and never duplicates audio.
- VidSrc popup and same-tab advertising paths are contained without breaking playback.
- Required provider media and subtitle requests are not overblocked.
- Captured and fallback subtitles work for both movies and episodes.
- Existing v2.0.0 source preferences migrate safely.
- Cinema, downloader, local playback, Music Planet and Google backup smoke tests pass.
- Home never leaves the user with only an indefinite spinner or blank viewport.
- The same connectivity/provider failure is never displayed by more than one status layer.
- A TMDB outage does not label Music Planet offline or block local Music use.
- Discover no longer relies on nested outer/inner cards or hard-coded saturated gradients for structural hierarchy.
- Every unavailable provider is readable and explains its status without color-only communication.
- Cinema page headers, rail headers and recovery states align consistently at all accepted widths.
- Music Search and Orbital Stages use one coherent glass hierarchy over the existing living scene.
- Music’s orb, particles, audio-reactive behavior, dock and playback ownership remain intact.
- The Music scene remains lazy and cannot regress Cinema startup responsiveness.
- Every touched surface passes Midnight Premiere, AMOLED, Mocha, Slate, Projector Silver, Custom and Reduced Motion validation.

## Assumptions

- Windows remains the primary release platform.
- Provider availability is inherently external and can change after release; Orion reports health rather than promising universal availability.
- Users access only content they are authorized to view.
- DRM circumvention is out of scope.
- Music Planet backend, catalogs, provider selection and playback behavior remain frozen; only bounded visual/state/performance polish enters this patch.
- Cinema UI work is polish and state repair, not a navigation or player redesign.
- No new provider is added merely to increase the source count.
