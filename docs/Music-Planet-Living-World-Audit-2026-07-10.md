# Music Planet living-world audit and stabilization plan

**Date:** July 10, 2026
**Scope:** Music Planet visual identity, navigation behavior, Echo-aligned sources, catalog reliability, player behavior and audio-reactive scene polish.
**Status:** Active implementation tracker. Neutral Eclipse supersedes the earlier cyan-heavy recommendations below.

## Neutral Eclipse completion status

| Checkpoint | Status | Result |
|---|---|---|
| Persistent analyser and orb synchronization | Implemented; live-device confirmation required | Loading no longer drives the orb. One gesture-unlocked graph survives track changes, requires consecutive non-zero frames before reporting synchronization, exposes actionable diagnostics, and preserves playback when Web Audio is unavailable. Protected audio now uses an opaque loopback grant with range and CORS support. |
| Neutral Eclipse tokens | Implemented | Music cyan was removed from Music production surfaces and guarded by the theme-color repository check. |
| Open layouts and artwork | Implemented | Detail pages no longer receive another outer card, track lists use open glass rows, album/artist geometry is distinct, and artwork has shimmer/fallback states. |
| Unified loading | Implemented | Lazy pages, search, artwork and playback use explicit labelled loaders instead of empty rings or the orb. |
| Full Music dock | Implemented | Music always uses the complete dock; the compact strip is reserved for Cinema. |
| Queue, radio and history | Implemented | Play-next, add-to-queue, clearing, persistent recovery, watch-next radio and autoplay continuation are connected. |
| Library and favorites | Implemented | Library views/sorting and track, album and artist favorites are connected. |
| Playlist completion | Implemented | Themed creation/editing, folders, duplicate, reorder, import/export and playback are connected with schema-v4 migration and backup-v2 compatibility. |
| Search completion | Implemented | The dedicated Search view now keeps an explicit input and uses dashboard shelves for its default browse state; typed search, suggestions and recent searches remain connected. |
| Live visual/playback acceptance | Manual validation required | Test real resolved audio for continuous orb response, Next/Previous settling, all themes and extended playback before release. |

## Orbital Stage completion (July 10, 2026)

- Music navigation is grouped into **Listen**, **Explore**, **Yours** and **System**, with the Cinema world control isolated below the Music destinations.
- Home chapters now share one Orbital Stage shell with a reserved orb-safe zone, bounded glass lens, consistent heading hierarchy, and common loading/empty/error behavior.
- Home and the dedicated Now Playing route share one polished Listening Core backed by the same `MusicProvider` and single audio element.
- The persistent dock owns Queue, Lyrics, Source, Details, More and Error overlays. Only one can be open, placement clears the dock/sidebar/title bar, Escape and outside-click dismiss it, and focus returns to its trigger.
- The dock timeline now renders separate base, buffered, played, waveform and thumb layers with semantic theme tokens and an accessible duration/remaining toggle.
- The Electron audio fixture verifies opaque range delivery and CORS. On machines where every `AudioContext` is system-suspended, Orion reports `awaiting-gesture`/`suspended` instead of falsely reporting synchronization; the frequency fixture independently requires consecutive non-zero bass/mid/treble frames before `active`.
- The dashboard IPC now returns the renderer contract (`ok`, `dashboard.sections`, partial errors) rather than a bare section list. When anonymous YouTube Music Home does not return enough shelves, Orion falls back to a normalized **Top songs** search shelf.
- YouTube Music artwork from `yt3.googleusercontent.com` and `lh3.googleusercontent.com` is now admitted through the main-process artwork cache and presented only through opaque `orion-music://` grants. The renderer never receives a local artwork path.

### Current visual rule

Music Planet uses **Neutral Eclipse**: obsidian/graphite glass, pearl highlights, restrained violet selection and corrected artwork reflections. Cyan is not a Music semantic color. The animated scene remains the identity, but loading and network activity are represented by labelled UI loaders, never by the orb.

### Current player rule

The full persistent dock is mandatory inside Music Planet. Compact playback exists only as the Cinema-world strip. The dock retains timeline, previous/play/next, volume, favorite, shuffle/repeat, queue, lyrics and Now Playing access.

## Music backup scope

Music Planet participates in Orion's existing Google Drive backup through the same
Google account and the same `orion-sync-manifest.json` app-data record as Cinema.
It does not need a second sign-in. A portable Music backup includes playlists,
favorites, listening history, provider preferences, cache limit, queue order and
safe Music appearance preferences.

It intentionally excludes local audio files and folders, artwork/cache files,
signed stream URLs, cookies, credentials and machine-specific floating-player
geometry. On another computer, users restore their organization immediately, then
reconnect or rescan their local Music folder if they use one. This keeps cloud
backup private, small and portable rather than attempting to upload media.

## 1. Current findings

### 1.1 The disliked color

The color visible in the screenshot is Orion's current Music cyan accent, exposed through `--music-cyan` and also used as the fallback visual color `#22d3ee`.

It currently appears on:

- Music eyebrow labels such as `YOUTUBE MUSIC + LOCAL LIBRARY`.
- hover highlights and focus-like edges;
- the Music world switch in the sidebar;
- search and source cards;
- waveform and preview accents;
- several glass borders and glow layers.

The problem is not only the hue. The problem is that it is being used as readable text too often. On the current dark green/blue-black Music background, this cyan feels loud, synthetic and less premium. It should become a rare spectral highlight, not the main Music text color.

### 1.2 Music navigation does not feel scroll-synced

Music Home is built as one scrollable journey with sections such as Now Playing, Library, Albums, Artists, Playlists, Favorites and Sources. The sidebar also has separate labels that navigate to separate route overlays.

That creates a mismatch:

- the Home page feels like one continuous story;
- the nav labels feel like separate pages;
- scrolling through Home does not visibly sync the sidebar;
- clicking a nav item can feel disconnected from the scroll chapter already visible on Home.

The desired behavior is a chapter navigation model: Music Home remains the living scroll journey, but the sidebar understands and highlights the active chapter while scrolling.

### 1.3 Music Planet logo is too raw

The current Music Planet mark is functional but not expressive enough. It does not yet feel like a premium Orion object. The icon should become a Music Planet sigil: part planet, part vinyl, part waveform orbit.

### 1.4 Cinema to Music transition needs a stronger world change

The transition exists, but it does not yet feel slow, cinematic or emotionally different enough. It should feel like Orion is entering a sound universe, not just changing a page.

### 1.5 Artist pages show no tracks

This has two likely causes in the current implementation:

1. The YouTube Music parser is too shallow. It mainly normalizes `musicResponsiveListItemRenderer`, while Echo's parser handles multiple YouTube Music renderer shapes, including:
   - page headers;
   - shelves;
   - two-row cards;
   - multi-row items;
   - playlist panels;
   - continuations;
   - endpoint page types.
2. Artist and album detail pages consume the returned details wrapper imperfectly. The main process returns structures like `{ artist, albums, tracks }`, while the renderer sometimes treats the whole wrapper as the artist object.

The empty artist page is therefore not proof that sources are disconnected. It is mostly a catalog-normalization and details-page mapping problem.

### 1.6 Sections showing “Connect sources to discover artists”

This is most likely caused by the dashboard extractor not returning artist sections from YouTube Music Home. The source is registered, but Orion's current parser misses common YouTube Music home-card shapes.

### 1.7 Echo source model

Echo's practical source model is:

- YouTube Music for search, browse, home sections, artists, albums and playlists.
- YouTube audio stream resolution through `youtube_explode_dart` and a range-aware stream source.
- LRCLib/LRCNet-style lyrics.
- Spotify/Billboard charts and Spotify import as metadata that is mapped back to YouTube Music for playback.
- Local library/downloaded files when present.

Orion's current source direction matches this at a high level:

- YouTube Music catalog/search/dashboard.
- YouTube Audio playback resolver through Orion's managed tooling.
- LRCLib lyrics.
- Spotify Charts/Import as metadata-only.
- Local Library.

The gap is that Echo has a much stronger YouTube Music response parser and more careful track-switch playback control.

### 1.8 Music player should support floating and fixed modes

The persistent player is currently a fixed bottom dock. The user expectation is:

- default floating player that can be moved and resized;
- optional lock/fix mode at the bottom;
- never overlap the sidebar;
- remember position, size and mode;
- adapt to available space.

### 1.9 Previous track continues briefly after selecting another track

Root cause: when a new track is selected, the previous `stream.url` can remain available while the new track is resolving. Because `playing` stays true, the audio element can continue playing the previous source until the new source is resolved and loaded.

This needs a generation-safe handoff:

- immediately pause or detach the old audio source on track change;
- clear the old stream while resolving the new track;
- tag resolve results with the requested track id/generation;
- ignore stale resolve results;
- only play when the resolved stream matches the current track.

### 1.10 Orb beat sync is separated from loading and driven by real audio

Music now keeps one analyser graph for the lifetime of the audio element. Frequency-aware bass, mid and treble bands, adaptive beat detection, noise-floor suppression and track-change settling feed the scene imperatively. Track resolution no longer sends a loading pulse to the orb; loading uses explicit control and section indicators instead. The orb remains calm until playable audio is flowing and falls back to a clearly non-reactive idle state when analysis is unavailable.

### 1.11 Search track rows and artwork do not fit the Music Planet identity

Search results still feel list-like and inconsistent. Some artwork is missing because:

- YouTube Music thumbnail extraction is incomplete;
- Spotify image URI normalization is only partly handled;
- low-res thumbnails are not consistently upgraded;
- track rows sometimes use direct image URLs instead of the secure artwork/cache path.

The target is a “moon track row” system: compact, readable, orbital glass, artwork-safe, with generated fallback art that still feels intentional.

## 2. Design direction

### 2.1 Neutral Eclipse palette

- primary text: warm off-white / pearl;
- secondary text: mist grey;
- panels: theme-aware obsidian or smoked-white glass;
- borders: neutral glass edges used only where hierarchy requires them;
- hover: a light glass wash without colored outlines;
- active state: restrained violet plus a pearl focus indicator;
- artwork influence: corrected, low-opacity reflection;
- danger/warning/success: semantic tokens only.

Cyan is removed from Music tokens, visualizers, generated artwork, loaders, cursor effects and player chrome. Artwork-derived cyan is redirected into the violet/pearl spectrum before it reaches reactive surfaces.

### 2.2 Music sidebar as scroll-synced chapter navigation

Music nav should work in two layers:

1. **Home chapters**
   - Now Playing
   - Library
   - Albums
   - Artists
   - Playlists
   - Favorites
   - Signal Sources
2. **Overlay actions**
   - Search
   - Full Library
   - Full Now Playing
   - Music Settings

When the user is on Music Home:

- scrolling updates the active sidebar chapter;
- clicking a chapter scrolls smoothly to that section;
- each section can still have an “Open full view” action.

When the user is inside a detail overlay:

- sidebar can either return to the matching Home chapter or open the full overlay, depending on the item.

### 2.3 New Music Planet sigil

Create a CSS/SVG sigil with:

- circular vinyl/planet core;
- angled orbit ring;
- small waveform notch or three frequency bars;
- tiny star/node;
- audio-reactive pulse when music is playing;
- reduced-motion static state.

### 2.4 Slower world-switch transition

Target transition: 1.1s to 1.4s.

Sequence:

1. Cinema dims and slows.
2. Music sigil expands from sidebar.
3. Orbital ring sweeps across the app.
4. Star particles fade in.
5. Music Home foreground appears after the background is already alive.
6. Optional soft portal chime.

Reduced Motion: short crossfade with no tunnel or scaling.

### 2.5 Music typography and controlled personalization

Music should not inherit Cinema typography blindly. It needs a recognisable audio-world voice, while controls, metadata and long titles stay comfortably readable.

The default pairing should be **Sora** for Music display headings, artist names and Observatory titles, with **Inter** for controls, track metadata, settings and dense library tables. Sora gives Music its geometric, spacious character; Inter keeps the functional surfaces legible.

The Music Settings overlay should provide a compact **Typography & atmosphere** section with five locally bundled, license-reviewed display-font choices:

- **Sora** — default, precise cosmic editorial tone.
- **Space Grotesk** — more technical, constellation-like headings.
- **Manrope** — softer, calm listening-room character.
- **DM Sans** — clean, minimal and neutral.
- **Outfit** — bolder, contemporary album-poster feel.

The body/control font remains Inter by default. A separate body-font selector is intentionally deferred: changing both display and interface fonts at once harms queue, search and Settings readability and makes six-theme visual QA needlessly fragile.

Music-specific customization stays together in this overlay rather than becoming scattered global settings:

- display scale: Compact, Comfortable (default), Spacious;
- glass density: Clear, Balanced (default), Deep;
- artwork influence: Off, Gentle (default), Strong;
- player dock: Bottom dock or Floating; Cinema automatically owns the compact strip;
- floating-dock position, width and lock state;
- visual atmosphere, visualizer, intensity, portal sound and portal-sound volume;
- one **Reset Music appearance** action.

Each option applies live, persists under namespaced Music preferences, participates in backup/restore, and respects Reduced Motion and readability requirements. Fonts load locally and non-blockingly; a failed font load falls back to Sora/Inter without affecting playback or layout.

## 3. Backend/source plan

### 3.1 Replace the shallow YouTube Music parser with Echo-inspired normalization

Do not copy Echo code. Recreate the behavior in Orion JavaScript:

- parse page headers;
- parse `musicResponsiveListItemRenderer`;
- parse `musicTwoRowItemRenderer`;
- parse `musicMultiRowListItemRenderer`;
- parse `musicShelfRenderer`;
- parse `gridRenderer`;
- parse playlist panels;
- preserve browse endpoints, watch endpoints, page type, video id, playlist id, thumbnails, artists and albums;
- normalize every item into Orion contracts: track, artist, album, playlist or section.

### 3.2 Add continuation and section support

Needed for:

- artist pages;
- album pages;
- dashboard home;
- more complete search;
- charts/import follow-up.

### 3.3 Fix artist/album detail mapping

Renderer pages should use:

- `res.value.artist` as the artist object;
- `res.value.album` as the album object;
- `res.value.tracks` and `res.value.albums` as lists;
- loading, partial and empty states that distinguish “still mapping” from “source returned nothing”.

### 3.4 Artwork normalization

- Upgrade YouTube Music thumbnails from small sizes when possible.
- Normalize Spotify `spotify:image:*` URIs to displayable CDN URLs.
- Cache/fetch artwork through Orion's secure artwork path.
- Use generated constellation artwork for missing images.
- Make search/list rows use `MusicArtwork` consistently.

## 4. Player behavior plan

### 4.1 Fix stale audio during track changes

Implement a generation-based stream handoff:

- `requestedTrackIdRef` or `resolveGenerationRef`;
- clear old stream on track change;
- pause or detach audio immediately;
- only assign resolved stream if it matches current generation;
- set `playing` after the new source is attached.

### 4.2 Floating/resizable player

Add modes:

- `dock`: fixed bottom, current behavior, no sidebar overlap.
- `float`: draggable/resizable card, default after user enables it.
- `compact`: small always-on-top Music capsule.

Persist:

- mode;
- x/y position;
- width;
- snap preference;
- locked/unlocked.

### 4.3 Orb and player beat sync

- Use `visualBus.beat` to pulse orb halo and album disc.
- Use bass for breathing scale.
- Use mids for orbital drift.
- Use treble for sparse particle sparkle.
- Respect battery, reduced motion and low-GPU settings.

## 5. UI plan

### Phase A — Safety and color correction

- Replace cyan text-heavy styling with warm Music tokens.
- Keep cyan as spectral accent only.
- Audit headings, labels, hover states, sidebar world switch and source cards.
- Validate Projector Silver and Custom themes.

### Phase B — Navigation/chapter sync

- Add Music chapter registry.
- Scroll Home sections with `IntersectionObserver`.
- Update sidebar active item from scroll.
- Make sidebar chapter clicks scroll to sections.
- Keep overlays for full pages.

### Phase C — Source/catalog reliability

- Implement Echo-inspired YouTube Music normalizer.
- Fix artist/album detail pages.
- Fix dashboard artist/album sections.
- Add partial-source diagnostics.

### Phase D — Artwork and search-row polish

- Normalize and cache artwork.
- Redesign search tracks as moon rows.
- Add meaningful fallback artwork.
- Make result cards visually match Music Planet.

### Phase E — Player handoff and floating mode

- Fix stale previous-track audio.
- Add floating/resizable player mode.
- Add lock-to-bottom mode.
- Ensure no sidebar overlap.

### Phase F — Logo and transition

- Replace Music Planet logo with sigil.
- Rework Cinema/Music portal transition.
- Add reduced-motion path and optional sound.

### Phase G — Beat-synced orb

- Add beat uniform/subscription to the scene engine.
- Make the orb pulse musically but subtly.
- Validate CPU/GPU usage.

### Phase H — Music typography and appearance controls

- Bundle the five approved display fonts locally in a dedicated Music font bundle and declare them through semantic font tokens.
- Add typography, display-scale, glass-density, artwork-influence and player-dock controls to the Music Settings overlay.
- Apply every setting live through CSS variables; do not reload the route, scene engine or audio element.
- Add a small live preview containing an album card, moon track row, orbital-glass button and player-dock fragment.
- Persist namespaced Music preferences, include them in backup/restore and migrate existing profiles silently to Sora/Inter, Comfortable, Balanced glass and Gentle artwork influence.
- Test title truncation, queue density, long non-Latin artist names, all six themes and Reduced Motion for every supported display font.

## 6. Acceptance tests

- The cyan screenshot color no longer dominates readable labels or hover highlights.
- Music Home scrolling updates the Music sidebar active state.
- Music nav can scroll to Home chapters and still open full overlays.
- Music Planet logo is a polished sigil, not a raw icon.
- Cinema-to-Music transition feels slower, smoother and world-changing.
- Artist pages show tracks/albums where YouTube Music returns them.
- Home Artists section no longer says “Connect sources” when YouTube Music is active and returns artists.
- Missing artwork uses intentional generated art.
- Selecting a second track stops the previous track immediately.
- Player can float, resize, snap and lock to bottom without overlapping the sidebar.
- Orb visibly responds to beat while respecting reduced motion and battery/performance safeguards.
- Music uses Sora/Inter by default and can switch among the five approved local display fonts without layout shift, unreadable text or playback interruption.
- Typography, display scale, glass density, artwork influence and dock preferences apply live, persist, restore from backup and reset cleanly.
- Source UI shows only Echo-aligned sources.
- Automated gates pass: source-size, binding, IPC, secret, theme-color, cycle, node tests, renderer tests, Electron Music smoke and production build.

## 7. Living implementation tracker

This section is the active implementation record for the Music Planet goal. It is updated after each completed pass with the current status, remaining work and direct verification evidence. A feature is not marked complete merely because code exists; it needs the listed evidence.

| Checkpoint | Status | Implemented evidence | Remaining evidence required |
| --- | --- | --- | --- |
| Safe audio handoff | In progress | `MusicProvider` clears the old stream before resolving the new track; `AudioEngine` detaches its source when no current stream exists; stale resolve generations are ignored. A focused renderer test proves the prior protected source is paused, removed and reloaded before the replacement grant attaches. An isolated Electron integration check resolved a public track to an opaque grant, served an MP4 byte range through `orion-music://`, and reached the media element `canplay` event. | Manual playback test: select a second remote track while the first is playing and confirm the first stops immediately. |
| Music typography and glass preferences | In progress | Five local display fonts were already bundled. Live, persisted font, display-scale, glass-density and player-dock preferences now flow through `MusicAppearanceSettings`, `MusicProvider` and `MusicPlanet` token attributes. The Settings preview now visibly reflects display font, glass density and artwork influence; preferences are included in portable settings backup/restore. Build, renderer, theme-color and binding checks passed July 10, 2026. | Manual font, scale and glass-density interaction verification across all themes. |
| Neutral Eclipse/readability correction | Complete | Music cyan literals and the former cyan token were replaced by semantic pearl, violet, glass-edge, waveform and artwork-reflection tokens. A repository check prevents cyan values from returning to Music surfaces. The six-theme Electron test measures title, subtitle, header-search and populated dock contrast across Midnight Premiere, AMOLED, Mocha, Slate, Projector Silver and Custom; the dock now owns Music-scene foreground tokens even when rendered outside the Music page container. | None for this checkpoint. |
| Artist/album details | Complete | Renderer detail pages consume `value.artist`/`value.album` rather than the response wrapper and keep tracks/releases in their normalized lists. Focused renderer tests prove populated artist, populated album and provider-failure states, including preserved selected metadata during partial failure. Live public verification opened Discovery with 14 tracks and returned 6 tracks/10 albums for Thomas Bangalter. | None for this checkpoint. |
| YouTube Music catalog normalization | In progress | Normalizer now supports responsive list items, two-row artist cards, multi-row tracks, watch-next playlist-panel tracks and titled carousel/shelf groups, including higher-resolution thumbnail URLs and detail-header enrichment. It preserves artist, album and duration metadata separately, prioritizes the title endpoint/page type over artist metadata so albums do not become artists, and follows one bounded continuation for artist detail pages. Nine focused node tests pass. Live public verification on July 10, 2026 returned 14 tracks, 3 artists and 15 albums; repaired album IDs opened Discovery with 14 tracks, while Thomas Bangalter detail returned 6 tracks and 10 albums. | Add broader live-provider integration coverage. |
| Secure artwork consistency | In progress | Artist, album, star, moon-track and search-feature cards now use `MusicArtwork`; direct Music UI image URLs and SVG fallbacks were removed in favor of cached opaque delivery and generated constellation art. Renderer, binding, source-size and production-build checks passed July 10, 2026. | Validate missing, remote and embedded artwork end-to-end against live provider data. |
| Scroll-synced chapter navigation | Complete | Music Home determines its active chapter from the actual scroll marker across every section, avoiding observer callback-order errors. The Music sidebar highlights that chapter and chapter clicks return to/scroll the existing Home journey. Sidebar navigation supports Enter/Space and has a visible Music-world focus ring. Music now stores a session-scoped chapter-relative scroll snapshot so asynchronous dashboard layout changes cannot displace the restored chapter. The Electron Music test proves Sources remains active and aligned after Music → Cinema → Music and after Music Home → Settings → Home. | None for this checkpoint. |
| Full persistent Music dock | Complete | Music Planet always uses the full dock and migrates the obsolete Music-world Compact preference; Compact remains Cinema-only. The single audio owner exposes artwork, previous/play/next, seek and time, shuffle, repeat, favorite, volume, Queue, Lyrics, source access, radio and Now Playing. Floating mode retains clamped drag, resize, snapping and locking without creating a second player or audio element. Renderer geometry tests and the Electron dock test cover transport availability and sidebar clearance. | None for this checkpoint. |
| Music Planet sigil and portal transition | In progress | The Music mark is now a planet/vinyl/orbit sigil with a frequency cue. Explicit Cinema↔Music changes use a staged 1.2-second portal (300 ms route handoff). The supplied `Cinema to Music` and `Music to Cinema` local assets now play in their matching directions, with the existing synthetic tone used only if an asset cannot play. Both obey the existing sound toggle/volume and Reduced Motion path. Renderer, binding, secret and production-build checks passed July 10, 2026. | Manual visual/audio validation of both directions on all themes and performance/battery-pressure behavior. |
| Beat-synced orb | In progress | One persistent Web Audio graph publishes frequency-aware bass, mids, treble, energy, beat, timestamps and analyser health without React frame rerenders. Noise-floor suppression, automatic normalization, attack/release smoothing and a track-change settling window prevent silence movement and false Next/Previous pulses. The scene no longer receives loading state. Deterministic renderer tests distinguish frequency bands, silence and false beats; analyser diagnostics are visible in Music Settings. The custom cursor is mounted again with a fail-safe activation class, so the native cursor remains available if custom initialization is skipped or fails. | Manual verification with bass-heavy, vocal and treble-heavy real tracks, plus hidden/minimized and battery-tier observation. |
| Final acceptance | In progress | On July 10, 2026 the exact worktree passed source-size (272 files), renderer bindings (247 files), IPC compatibility (200 methods/120 channels), secret, theme-color and cycle checks, 48 Node tests, 100 renderer tests, a production build, and the complete 11-spec Electron matrix. Electron coverage includes Music/Cinema switching, cursor activation and cleanup, full dock controls, isolated schema-v4 startup, Projector Silver and all six theme contrast checks, Cinema player lifecycle, Library, Search/People and Constellation. Music Planet remains lazy-loaded, and raw streams, credentials and local paths stay behind opaque main-process boundaries. | Manual real-track orb response, live provider expiry/fallback, and populated artwork/overlay review remain required. |

### Status rules

- **Not started**: no behavior has been implemented.
- **In progress**: code exists, but at least one contract, visual state or verification requirement remains open.
- **Complete**: implementation and the stated validation evidence both exist; later regressions move it back to In progress.

## 8. Manual acceptance checklist

Run this in the packaged or development Electron app before marking the Music Planet
goal complete. Do not use a browser preview: playback, media controls and the protected
`orion-music://` protocol are Electron-only behavior.

### Playback and catalog

- Search for a common artist, open an artist, open one of its albums and begin a track.
- Confirm the player reports the correct title/artist/album, audible playback begins and
  the animated orb responds only while the track is playing.
- Start a second track while the first is audible. The first track must stop immediately;
  there must never be overlapping audio.
- Seek, pause/resume, next, previous, shuffle, repeat, queue and lyrics. Leave a track
  running for at least thirty seconds, then verify progress/history persist after navigation.
- Open **Change Source**, choose a candidate and confirm the replacement source keeps the
  correct track identity without exposing a URL, token or raw diagnostic in the UI.

### Player placement and worlds

- Test Bottom dock, Floating and Compact from Music Settings.
- With the sidebar both pinned and unpinned, drag and resize the floating dock at a normal
  window width and a narrow window. It must remain reachable and clear of the sidebar.
- Open Queue and Lyrics in normal, floating and compact modes. Each action must show one
  panel only.
- Switch Cinema → Music → Cinema with portal sound enabled, then disabled, and with
  Reduced Motion enabled. Confirm route/scroll restoration and no duplicate media audio.

### Appearance and accessibility

- In each of Midnight Premiere, AMOLED, Mocha, Slate, Projector Silver and Custom, verify
  readable headings, body text, sidebar items, search controls, cards, dock controls and
  focus rings against the orb background.
- In Music Settings, change all five display fonts, Compact/Comfortable/Spacious scale,
  Clear/Balanced/Deep glass and player placement. Every change must apply live without
  pausing playback; restart Orion once to confirm persistence.
- Enable Reduced Motion and Battery Saver visuals. The orb may become restrained/static,
  but labels, focus states and playback controls must remain usable.
