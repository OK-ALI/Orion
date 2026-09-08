# Orion Phase 10A P10A.3 — Inspection, Ownership and Baseline Report

Date: 2026-09-02  
Authoritative workspace: C:\Projects\Orion - A Multiverse of Stories  
Inspection HEAD: 0a08be1f45d77f32670061ab1069dc71bbdbea48  
Branch: codex/orion-v3-p10-mobile-downloads-offline-library

> Export note: This document preserves the report delivered in the preceding conversation response. Its inspection-only and no-mutation statements describe that completed inspection pass. This Markdown file was subsequently created at the user's explicit request; implementation remains unstarted.

Inspection complete against the **current local workspace**. No implementation, documentation edits, tests, builds, or physical validation were performed during the inspection.

## 1. P10A.3 source ownership matrix

| Area | Current owners | Findings |
|---|---|---|
| Desktop connection | [networkStatus.js](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/services/networkStatus.js>), [useNetworkStatus.js](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/shared/hooks/useNetworkStatus.js>), [desktopConnectionPolicy.js](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/services/desktopConnectionPolicy.js>) | Renderer-owned transport probe, five product states, service health, manual recheck and recovery epochs. Transport probe runs on a 15-second schedule with a 6-second timeout. No separate Electron main-process connection authority was found. |
| Service validation and recovery | [App.jsx](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/app/App.jsx>), [useDesktopNetworkRecovery.js](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/app/hooks/useDesktopNetworkRecovery.js>), [useApiSession.js](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/app/hooks/useApiSession.js>) | App supplies TMDB validation. Recovery hook refreshes Home and emits `orion:network-restored`, deduplicated by epoch. API-session error presentation is separate and can remain stale. |
| Home | [HomePage.jsx](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/features/home/HomePage.jsx>), [AppRoutes.jsx](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/app/AppRoutes.jsx>) | App owns trending requests/cache; Home owns recommendations, top-rated and regional requests. Offline currently returns a Retry-only placeholder before rendering Continue Watching. Existing navigation can open Downloads and Library. |
| Persisted Cinema state | [useLibraryState.js](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/app/hooks/useLibraryState.js>), [settingsStore.js](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/services/settingsStore.js>) | Saved items, history, progress and watched state come from local storage. Continue Watching uses existing verified-progress policy. Remote metadata enrichment is additional work, not the underlying storage authority. |
| Discover and Cinema Search | [DiscoverPage.jsx](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/features/discover/DiscoverPage.jsx>), [SearchResultsPage.jsx](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/features/discover/SearchResultsPage.jsx>), [SearchModal.jsx](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/components/modals/SearchModal.jsx>), [search.js](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/services/search.js>) | Cinema search uses TMDB; there is no combined local Cinema search index. Downloads and Library filter their own local collections. Full Search has request-generation protection and error-aware empty rendering; Discover and quick search have misleading empty-state paths. |
| Downloads | [DownloadsPage.jsx](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/features/downloads/DownloadsPage.jsx>), [useDownloads.js](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/app/hooks/useDownloads.js>), [store.js](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/main/downloader/store.js>), [downloader IPC](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/main/downloader/ipc.js>) | Records persist in `userData/downloads.json`. Browsing loads records through Electron IPC, with local-file checks. Completed records can include cloud-offloaded items; completion alone does not prove offline playability. |
| Library | [LibraryPage.jsx](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/features/library/LibraryPage.jsx>), [useRatings.js](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/shared/utils/useRatings.js>) | Local collection browsing/search/sorting already exists. Its Downloads section launches LocalPlayer directly. Ordinary history/Continue Watching selection navigates to movie/TV details. Posters, ratings and metadata enrichment can require network access. |
| Local Cinema playback | [LocalPlayer.jsx](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/features/downloads/components/LocalPlayer.jsx>), [localMedia.js](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/main/player/localMedia.js>), [AppOverlays.jsx](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/app/AppOverlays.jsx>), [PlaybackCoordinator.js](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/app/playback/PlaybackCoordinator.js>) | Main resolves a download ID and validates its file before issuing an opaque media grant. Existing local files stream from disk. Drive-only records stream remotely. Player effects do not depend on connection state; App already owns expanded local playback. |
| Music routes and local collections | [MusicPlanet.jsx](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/features/music/MusicPlanet.jsx>), [MusicRoutes.jsx](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/features/music/MusicRoutes.jsx>), [MusicLibrary.jsx](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/features/music/pages/MusicLibrary.jsx>), [PlaylistsPage.jsx](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/features/music/pages/PlaylistsPage.jsx>), [useFavoritesStore.js](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/features/music/stores/useFavoritesStore.js>) | Local previews and remote dashboard requests are separate. Local folders, collections, favorites and history remain accessible without a global offline gate. A locally stored playlist may still reference remote-only tracks. |
| Music persistence, scanning and assets | [database.js](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/main/music/database.js>), [scanner.js](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/main/music/library/scanner.js>), [metadataReader.js](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/main/music/library/metadataReader.js>), [artworkCache.js](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/main/music/library/artworkCache.js>), [lyrics.js](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/main/music/library/lyrics.js>) | SQLite owns `music-library.sqlite`; scanner reads local files. Embedded artwork is cached on disk. Sidecar/embedded lyrics are extracted locally. Existing cached artwork is checked before remote fetching. |
| Music providers, search, radio and plugins | [Music IPC](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/main/music/ipc.js>), [registry.js](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/main/music/providers/registry.js>), [requestBroker.js](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/main/music/providers/requestBroker.js>), [local.js](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/main/music/providers/local.js>), [plugin manager](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/main/music/plugins/manager.js>), [plugin catalog](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/main/music/plugins/catalog.js>) | Main owns provider execution and individual health. Local metadata search uses SQLite. Remote search/dashboard/radio use providers. Authentication/configuration status belongs to providers; it is not transport truth. The core local plugin is locked. |
| Music playback | [MusicProvider.jsx](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/features/music/context/MusicProvider.jsx>), [AudioEngine.jsx](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/features/music/player/AudioEngine.jsx>), [streamResolver.js](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/main/music/playback/streamResolver.js>), [loopbackServer.js](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/main/music/playback/loopbackServer.js>) | Queue/player ownership persists across routes. However, ordinary track resolution prioritizes YouTube Music before the local streaming provider—even when the selected track is local. |
| Themes, motion and status | [appearance.js](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/shared/utils/appearance.js>), [tokens.css](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/styles/tokens.css>), [global.css](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/styles/global.css>), [applyStartupAppearance.js](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/app/startup/applyStartupAppearance.js>), [InterfaceSettings.jsx](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/features/settings/sections/InterfaceSettings.jsx>), [WindowTitlebar.jsx](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/components/layout/WindowTitlebar.jsx>), [Toast.jsx](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/components/layout/Toast.jsx>) | Six presets: Midnight Premiere, AMOLED, Obsidian Cyan, Mocha, Slate and Projector Silver, plus custom themes. Existing semantic tokens, focus styling, motion settings and status patterns should be reused. Toasts currently lack live-region semantics; titlebar consumes legacy status, hiding Reconnecting as Checking. |

## 2. Current behavior baseline/classification

These are source classifications. **None constitutes physical acceptance.**

| Surface | Classification | Evidence |
|---|---|---|
| Home cold start offline | **DEFECT** | Retry-only placeholder; Downloads, Library and local Continue Watching are absent. |
| Home mid-session loss | **DEFECT** | Offline early return hides existing Continue Watching. Loading also replaces local content with skeletons. |
| Home reconnect | **DEFECT** | Recovery refresh exists, but service validation can remain pending, degraded recovery can miss its epoch, and a separate TMDB Retry reloads Orion. |
| Discover offline | **DEFECT** | Offline/error banner can coexist with “No trending titles” or “No titles match.” Cached provider catalog is skipped by the early offline guard. |
| Search offline | **DEFECT** | Quick search can display both offline and “No results.” Full Search handles request errors better but lacks explicit connection-state consumption. |
| Downloads offline browse | **PASS AS-IS**, source-level | Records and local filtering do not require network. Artwork availability and cloud-only labeling need separate checks. |
| Downloaded/local playback offline | **PASS AS-IS for an existing local file**, source-level | Main serves validated files from disk. Drive-only entries are excluded from this assessment. Actual playback/seeking needs physical proof. |
| Library offline | **PARTIAL** | Persisted collections remain available. Some actions still open remote detail routes; downloaded indicators use completion status without establishing local-file availability. |
| Music local library offline | **PASS AS-IS**, source-level | Local database, folders, playlists, favorites and history are independently accessible. |
| Music local playback offline | **DEFECT** | Selected local tracks enter remote-first candidate discovery. Remote lookup can delay or influence resolution before the local provider is considered. |
| Music provider failure with transport online | **PARTIAL** | Health stays provider-specific and local collections remain visible. Local playback resolution and error/empty presentation still violate capability separation. |
| Music full transport offline | **PARTIAL** | Local routes survive, but remote requests/actions are not explicitly separated from transport availability. Search and lyrics can confuse failure with absence. |
| Music reconnect | **DEFECT** | No Music consumer of the existing recovery event was found. Failed dashboard/search state lacks a coordinated recovery refresh. |
| Restored acknowledgement duplication | **PARTIAL** | One epoch-deduplicated event emitter exists. No visible transient acknowledgement consumer was found; complete outage-cycle behavior is untested. |
| All-theme/accessibility presentation | **PARTIAL** | Semantic foundations exist, but offline-state contrast, announcements and keyboard flows lack coverage. Settings save Reduced Motion as `1/0`, while Music checks `=== true`. |

Additional recovery findings:

- The hook can transition **Degraded → Checking → Online**. Recovery detection examines adjacent states, so this sequence loses the degraded recovery event.
- TMDB health validation uses the shared five-minute response cache. A cached response is not fresh service-reachability evidence.
- Unlike the transport probe, this service-validation call has no explicit deadline. Scheduling resumes after it settles, creating a source-level risk of prolonged Checking/Reconnecting.
- Manual, visibility and browser-online triggers invalidate stale results but do not fully coalesce overlapping work.
- No automatic network-driven route change or player reset was found. The explicit TMDB banner’s `window.location.reload()` remains a disruption path.

## 3. Exact existing test inventory

Existing architecture: **Node test runner**, **Vitest/Testing Library with jsdom**, and **Playwright Electron**. No additional framework is needed.

The commands below identify the exact relevant files and are runnable from:

```powershell
Set-Location -LiteralPath 'C:\Projects\Orion - A Multiverse of Stories'
```

They were **not executed**.

Connection, status and appearance:

```powershell
npm.cmd run test:renderer --workspace @orion/desktop -- tests/unit/renderer/networkStatus.test.js tests/unit/renderer/desktopConnectionPolicy.test.js tests/unit/renderer/WindowTitlebar.test.jsx tests/unit/renderer/appearance.test.js
```

Local Cinema state and playback:

```powershell
npm.cmd run test:renderer --workspace @orion/desktop -- tests/unit/renderer/LibraryState.test.jsx tests/unit/renderer/LibraryUi.test.jsx tests/unit/renderer/libraryMetadata.test.js tests/unit/renderer/CountTruthParity.test.jsx tests/unit/renderer/MediaStateIndicators.test.jsx tests/unit/renderer/MiniPlayer.test.jsx tests/unit/renderer/playbackIntent.test.js tests/unit/renderer/playbackReset.test.js tests/unit/renderer/playbackSession.test.js tests/unit/renderer/playerEventProgress.test.js
```

Discover/Search and keyboard/dialog behavior:

```powershell
npm.cmd run test:renderer --workspace @orion/desktop -- tests/unit/renderer/PeopleUi.test.jsx tests/unit/renderer/discoveryHubs.test.js tests/unit/renderer/QuickSearchFilterRail.test.jsx tests/unit/renderer/nativeKeyboard.test.js tests/unit/renderer/ConfirmModal.test.jsx
```

Music collections, search, playback and presentation:

```powershell
npm.cmd run test:renderer --workspace @orion/desktop -- tests/unit/renderer/MusicLibraryLifecycle.test.jsx tests/unit/renderer/MusicCollections.test.jsx tests/unit/renderer/MusicSearchRouting.test.jsx tests/unit/renderer/MusicDetailPages.test.jsx tests/unit/renderer/MusicListeningCore.test.jsx tests/unit/renderer/AudioEngine.test.jsx tests/unit/renderer/MusicTrackList.test.jsx tests/unit/renderer/musicQueueNavigation.test.js tests/unit/renderer/MusicFinalCoherence.test.jsx tests/unit/renderer/PlaylistArtwork.test.jsx
```

Main-process download and local-media contracts:

```powershell
node --test apps/desktop/tests/unit/main/downloadStore.test.js apps/desktop/tests/unit/main/downloadPaths.test.js apps/desktop/tests/unit/main/downloadArtifactVerifier.test.js apps/desktop/tests/unit/main/downloadTaskCleanup.test.js apps/desktop/tests/unit/main/localMediaRange.test.js apps/desktop/tests/unit/main/playerVideoTargeting.test.js
```

Main-process Music contracts:

```powershell
node --test apps/desktop/tests/unit/main/musicFoundation.test.js apps/desktop/tests/unit/main/musicRemoteMediaRange.test.js apps/desktop/tests/unit/main/musicYoutubeStreamingPolicy.test.js apps/desktop/tests/unit/main/ytmusicNormalizer.test.js
```

Existing Electron coverage:

```powershell
npm.cmd run test:electron --workspace @orion/desktop -- startup.spec.js navigation.spec.js library.spec.js people.spec.js search-orb.spec.js playback-lifecycle.spec.js music.spec.js music-player.spec.js music-playlists.spec.js music-themes.spec.js music-final-coherence.spec.js
```

Coverage limits:

- Connection policy tests include pure-function assertions and source-text checks; they do not exercise the complete hook lifecycle.
- No direct Home offline, Discover offline, Downloads offline or recovery-cycle behavioral test was found.
- Library tests cover persistence, metadata and sorting; local-media main tests cover range behavior. They do not establish disconnected end-to-end playback.
- Music foundation tests cover identities, database migrations, lyrics, grants, provider health and ranking—not local-first resolver ordering.
- Theme Electron coverage checks six presets plus custom, but not the new offline states.
- Electron loads `apps/desktop/dist/index.html`; future source validation requires a fresh renderer build.

[music-p0-audio-network.spec.js](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/tests/electron/music-p0-audio-network.spec.js>) and [music-p0-real-profile-pipeline.spec.js](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/tests/electron/music-p0-real-profile-pipeline.spec.js>) explicitly use the real Orion profile. They should be excluded from the proposed automated gate. [music-provider-live.spec.js](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/tests/electron/music-provider-live.spec.js>) is a live-provider diagnostic, not deterministic offline proof.

## 4. Coverage gaps

Before changing each affected area, add behavioral coverage for:

- Home in all five connection states, with populated/empty local collections and unavailable artwork.
- Working Downloads/Library navigation and exact movie/episode matching for local Continue Watching.
- Existing local content remaining visible during loading, outage and recovery.
- Remote failure versus genuine empty results in Discover, full Search and quick search.
- Completed local, missing-file and Drive-only download records; no false offline-playable claims.
- Local Music resolution without invoking any remote provider.
- Local search, cached artwork and embedded lyrics remaining usable when remote providers fail or hang.
- Provider failure while transport remains online.
- Recovery epochs across intermediate states, repeated events, stale responses and service timeouts.
- Local video/audio continuing without remount, reload, queue replacement or position loss.
- Six themes, keyboard focus, live announcements and both numeric/boolean Reduced Motion settings.

F10A-D1 through D4 still require later physical validation.

## 5. Architecture risks

- **Replacing the network owner:** extend the current hook/service/policy only. Music does not need another polling service.
- **Provider failure becoming global offline:** preserve transport truth separately from TMDB or Music-provider health.
- **Downloader changes:** keep persistence, acquisition, verification, cleanup and scheduling frozen.
- **Network-required local playback:** fix Music’s resolver ordering; do not route local Cinema resume through remote metadata.
- **Duplicated Offline Library truth:** derive presentation from existing download records, file validation and verified history. Add no independent persisted availability store.
- **Reload during recovery:** remove the TMDB Retry reload through existing App integration.
- **Playback interruption:** recovery must refresh remote views without changing player identity, queue, active grant or playback ownership.
- **Hiding Music local capability:** remote dashboard/search failure must not replace the Music shell or local collections.
- **Duplicate ownership:** reuse existing theme, motion, performance and playback owners.
- **Insufficient request bounds:** broker timeouts depend on providers honoring abort signals; service probes and recovery need explicit lifecycle tests.

## 6. Recommended coherent implementation slices

The source names below refer to the exact ownership paths above unless another path is linked.

| Slice | Likely source files | Tests to add/change | Outcome, contracts and boundaries |
|---|---|---|---|
| **A — Home local continuity** | App, AppRoutes, HomePage, useRatings, [Home styles in part-03.css](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/styles/components/part-03.css>); a small derived local-media selector | New Home offline/rendering and availability-selector tests; extend existing local-state regression coverage; new isolated Electron Home case | Downloads, Library, valid local Continue Watching and Check connection remain available. Prepares **C07/C08/C14, D1/D2**. No downloader, player-engine, Music or connection-owner rewrite. No predecessor; full recovery acceptance remains in D. |
| **B — Discover/Search and local-media honesty** | AppRoutes, AppOverlays, DiscoverPage, SearchResultsPage, SearchModal, LibraryPage, DownloadsPage, useLibraryState, useRatings; reuse A’s selector | Error-versus-empty tests; local/cloud/missing-file presentation; Library/Downloads disconnected browsing and launch tests | Honest remote unavailability and usable local browsing/actions. Prepares **C07/C08/C14, D1/D2**. Depends on A’s capability derivation. Excludes Download Modal redesign, acquisition changes and a new search index. |
| **C — Music local-first separation** | MusicPlanet, MusicRoutes, MusicProvider, MusicSearch, [SourcesPage.jsx](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/features/music/pages/SourcesPage.jsx>), [useMusicQuickSearch.js](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/components/search/useMusicQuickSearch.js>), Music IPC, streamResolver, requestBroker and local provider as required | New local-first resolver/IPC tests; extend Music search, collections and listening tests; isolated offline Music Electron case | Local tracks, assets and collections work independently; remote failures explain themselves. Prepares **C09/C14, D3**. Reuses the Desktop connection owner. Excludes streaming optimization, provider replacement, scanner/database redesign and plugin expansion. |
| **D — Recovery and acceptance readiness** | useNetworkStatus, desktopConnectionPolicy, networkStatus, useDesktopNetworkRecovery, App, useApiSession, [Desktop TMDB bridge](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/services/tmdb.js>), affected remote consumers, WindowTitlebar, existing toast presentation, theme/motion files | Real hook lifecycle tests; one acknowledgement per cycle; hung/stale request cases; playback continuity; six-theme and keyboard/live-region checks | Bounded recovery without reload or player interruption; accessible transient acknowledgement. Completes **C07/C08/C09/C14**, prepares **D1–D4**, especially D4. Integrates A–C. Excludes performance-owner changes and physical acceptance execution. |

## 7. Preferred first implementation slice

**A — Home local continuity.**

It addresses the clearest F10A-D1 defect through existing local state, navigation and playback integration. Its behavior can be tested without modifying Electron downloader infrastructure or Music.

The first slice should retain local content during Checking/Reconnecting as well as Offline. It must not interpret every transient probe state as a reason to clear the page. Connection-owner defects remain explicit work for D, not an assumed pass.

## 8. Exact files expected for the first slice

Existing source:

- [App.jsx](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/app/App.jsx>) — pass connection/local capability data and connect local resume to the existing expanded LocalPlayer owner.
- [AppRoutes.jsx](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/app/AppRoutes.jsx>) — forward Home’s required data and callbacks.
- [HomePage.jsx](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/features/home/HomePage.jsx>) — local pathways, persistent local section and state-aware remote presentation.
- [useRatings.js](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/shared/utils/useRatings.js>) — retain cached ratings while allowing Home to suppress remote enrichment.
- [part-03.css](<C:/Projects/Orion - A Multiverse of Stories/apps/desktop/src/renderer/styles/components/part-03.css>) — narrowly scoped Home styling using existing semantic tokens.

Proposed new files, **not created**:

```text
C:\Projects\Orion - A Multiverse of Stories\apps\desktop\src\renderer\shared\utils\localMediaAvailability.js
C:\Projects\Orion - A Multiverse of Stories\apps\desktop\tests\unit\renderer\localMediaAvailability.test.js
C:\Projects\Orion - A Multiverse of Stories\apps\desktop\tests\unit\renderer\HomeOfflineExperience.test.jsx
C:\Projects\Orion - A Multiverse of Stories\apps\desktop\tests\unit\renderer\useRatings.test.jsx
C:\Projects\Orion - A Multiverse of Stories\apps\desktop\tests\electron\desktop-offline-home.spec.js
```

The selector would derive eligibility from existing records and identities; main-process file validation remains authoritative.

## 9. Verification commands for that first slice

Proposed future commands, **not executed now**. New test filenames become runnable after implementation.

```powershell
Set-Location -LiteralPath 'C:\Projects\Orion - A Multiverse of Stories'

npm.cmd run test:renderer --workspace @orion/desktop -- tests/unit/renderer/HomeOfflineExperience.test.jsx tests/unit/renderer/localMediaAvailability.test.js tests/unit/renderer/useRatings.test.jsx

npm.cmd run test:renderer --workspace @orion/desktop -- tests/unit/renderer/desktopConnectionPolicy.test.js tests/unit/renderer/LibraryState.test.jsx tests/unit/renderer/LibraryUi.test.jsx tests/unit/renderer/CountTruthParity.test.jsx tests/unit/renderer/MediaStateIndicators.test.jsx tests/unit/renderer/appearance.test.js

node --test apps/desktop/tests/unit/main/downloadStore.test.js apps/desktop/tests/unit/main/localMediaRange.test.js

npm.cmd run check:bindings --workspace @orion/desktop
npm.cmd run check:theme-colors --workspace @orion/desktop

npm.cmd run build --workspace @orion/desktop
npm.cmd run test:electron --workspace @orion/desktop -- desktop-offline-home.spec.js navigation.spec.js library.spec.js

git diff --check
git diff --stat
git status --short
git diff --cached --name-only
```

The build above is the future **Desktop renderer build required by Electron tests**, not an installer or APK build. The new Electron case should use an isolated temporary profile.

## 10. Final Git / HEAD / staging confirmation

This section records the final state of the original inspection pass, before the subsequent creation of this report file.

HEAD remains:

```text
0a08be1f45d77f32670061ab1069dc71bbdbea48
```

Branch remains:

```text
codex/orion-v3-p10-mobile-downloads-offline-library
```

`git status --short`:

```text
 M apps/mobile/tests/prePhase3UiPolish.test.cjs
 M docs/Orion-v3-Mobile-Desktop-Readiness-Audit-2026-07-31.md
```

`git diff --stat` — exclusively the two pre-existing protected changes:

```text
 apps/mobile/tests/prePhase3UiPolish.test.cjs       |   8 +-
 ...v3-Mobile-Desktop-Readiness-Audit-2026-07-31.md | 157 ++++++++++++---------
 2 files changed, 97 insertions(+), 68 deletions(-)
```

**Staging is empty.** Final comparison of **2,327 tracked files** against the starting snapshot found no changes to contents, sizes or modification times.

Both protected SHA256 values remain exact:

```text
prePhase3UiPolish.test.cjs
9B2B5048A85A1811EB72F42128B8D80ED1D268B3FB469FE8226013FAEB662652

Orion-v3-Mobile-Desktop-Readiness-Audit-2026-07-31.md
D07A1D8C3F60836037DB507EF444D4F7E3303F343A1C37981FF73E786184D48D
```

No source, documentation or runtime mutation occurred during the inspection. P10A.2 and published releases remain untouched; Master Audit reconciliation remains deferred. Stopped after inspection and reporting.
