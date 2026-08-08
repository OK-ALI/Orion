# Orion v3 Mobile and Desktop Readiness Audit

**Audit date:** July 31, 2026  
**Current application baseline:** Orion Desktop 2.0.1 and Orion Mobile 2.0.1  
**Proposed release:** Orion 3.0 with Mobile Companion support  
**Status:** Reference audit and implementation roadmap; not a completed-release claim

## Living Roadmap Status

> **Overall Orion v3 implementation completion: 52%**
>
> **Last verified:** August 9, 2026
> **Release readiness:** Not ready  
> **Current stage:** Phase 3 complete and physically accepted; paused before Phase 4 planning and implementation.
> **Critical open blockers:** Source-aware video fitting, reliable player-overlay touch ownership, Smart Connect transport and pairing-UI hardening, player-surface laser, native provider shield, cross-platform profiles, Mobile updates, low-end-device performance validation, and deferred VidKing carried-position compatibility

The percentage is weighted by release risk. It is not based on the number of files changed or the number of visible screens. A high-risk playback or security phase contributes more than a small presentation task.

### Status legend

| Status | Meaning |
|---|---|
| Complete | Implemented, tested, and accepted |
| In progress | Meaningful implementation exists, but acceptance is incomplete |
| Foundation only | Reusable groundwork exists, but the v3 outcome is not delivered |
| Not started | No release-usable implementation exists |
| Blocked | Cannot proceed until a named dependency is resolved |

### Weighted phase tracker

| Phase | Weight | Phase completion | Weighted contribution | Status |
|---|---:|---:|---:|---|
| 0. Safety and observability | 8% | 100% | 8.0% | Complete |
| 1. Playback truth | 12% | 100% | 12.0% | Complete |
| 2. History and Continue Watching | 10% | 100% | 10.0% | Complete |
| 3. Trailer reliability | 8% | 100% | 8.0% | Complete |
| 4. Smart Connect experience | 12% | 45% | 5.4% | In progress |
| 5. Player-surface laser | 8% | 15% | 1.2% | Foundation only |
| 6. Native provider shield | 10% | 15% | 1.5% | Foundation only |
| 7. Adaptive Mobile UI | 10% | 30% | 3.0% | In progress |
| 8. Desktop Orion 3.0 integration | 7% | 20% | 1.4% | Foundation only |
| 9. Portable profile and Google authentication | 7% | 15% | 1.1% | Foundation only |
| 10. Mobile updates | 4% | 5% | 0.2% | Not started |
| 11. Release validation | 4% | 15% | 0.6% | Foundation only |
| **Total** | **100%** |  | **52.4%, rounded to 52%** | **Not release-ready** |

### How to update the percentage

For every phase:

```text
weighted contribution = phase weight × phase completion
overall completion = sum of all weighted contributions
```

Phase completion may increase only when:

1. The implementation exists in the active workspace.
2. Relevant automated checks pass.
3. Required real-device or live-provider validation is recorded.
4. No known P0 regression remains inside that phase.
5. The checklist item includes evidence in the Progress Log.

A feature that works only in Expo Web, only on one provider, or only on one machine remains partial.

## Master Implementation Checklist

### Phase 0 — Safety and observability

- [x] **V3-P0-001:** Mobile strict TypeScript compilation passes.
- [x] **V3-P0-002:** Desktop IPC contract check passes.
- [x] **V3-P0-003:** Desktop renderer-binding check passes.
- [x] **V3-P0-004:** Preserve an atomic pre-v3 rollback checkpoint.
- [x] **V3-P0-005:** Replace MMKV's silent in-memory fallback with persistent fallback or a blocking recovery state.
- [x] **V3-P0-006:** Split the oversized Connect screen into transport, controller, and presentation modules.
- [x] **V3-P0-007:** Split Discover into data, filters, responsive layout, and presentation modules.
- [x] **V3-P0-008:** Split Media Detail into metadata, episodes, trailers, actions, and adaptive layout modules.
- [x] **V3-P0-009:** Add redacted Mobile diagnostics and export.
- [x] **V3-P0-010:** Expand automated tests beyond the current narrow Smart Connect coverage.

### Phase 1 — Playback truth

- [x] **V3-P1-001:** Native direct playback can report time and duration.
- [x] **V3-P1-002:** Mobile has local progress-record storage.
- [x] **V3-P1-003:** Add versioned `MobilePlaybackSession`.
- [x] **V3-P1-004:** Add versioned `MobilePlaybackTelemetry`.
- [x] **V3-P1-005:** Add evidence classification for native, provider, message, manual, and opened-only records.
- [x] **V3-P1-006:** Add provider `<video>` telemetry where frame access permits it; inaccessible frames are classified as unobservable and cannot fabricate progress.
- [x] **V3-P1-007:** Add strict provider `postMessage` telemetry adapters. Providers without valid advancing-time evidence remain playable but cannot claim progress or continuity.
- [x] **V3-P1-008:** Save on start, interval, pause, seek, source change, background, exit, and completion.
- [x] **V3-P1-009:** Preserve and confirm verified position during healthy source failover. Physical testing accepted the verified Resume dialog and continuity across the working providers; VidKing is explicitly excluded from carried-position targets.
- [x] **V3-P1-010:** Prove that no provider creates fabricated duration or percentage data.
- [x] **V3-P1-011:** Validate every selectable Mobile source by declared telemetry strategy, including honest unobservable/deferred classifications; successful page loading alone is never counted as telemetry.
- [x] **V3-P1-012:** Honor source surface contracts so async/native AllManga is not routed through the generic embedded-player path. Mobile now quarantines async/anime-only sources from selection and failover; Desktop registration is unchanged.

### Phase 2 — History and Continue Watching

- [x] **V3-P2-001:** MMKV namespaces exist for `history`, `progress`, and `watched`.
- [x] **V3-P2-002:** Repair Library History to render actual History instead of Watched records.
- [x] **V3-P2-003:** Introduce non-destructive `PlaybackProgressV3` normalization while retaining readable V2 records.
- [x] **V3-P2-004:** Keep History, Progress, Watched, and My List independent.
- [x] **V3-P2-005:** Add Mobile Home Continue Watching rail.
- [x] **V3-P2-006:** Add Library Continue tab.
- [x] **V3-P2-007:** Show one latest incomplete episode per series.
- [x] **V3-P2-008:** Add Resume, Remove Progress, Mark Watched, Remove History, and View All.
- [x] **V3-P2-009:** Ensure Clear History does not erase progress, watched state, or My List.
- [x] **V3-P2-010:** Verify persistence across application restart and device reboot.
- [x] **V3-P2-011:** Synchronize Home, Hero, media cards, Continue Watching, Library tabs, actions, and empty states with the active Orion theme through semantic tokens.
- [x] **V3-P2-012:** Physically validate compact phone, standard phone, tablet/landscape, 200% font scaling, Reduced Motion, and the six-theme visual matrix without clipping or inaccessible actions.
- [x] **V3-P2-013:** Standardize Discover, Connect, Library, Downloads, and Settings on the shared safe-area-aware editorial page header.
- [x] **V3-P2-014:** Synchronize Discover/Search and Orion Connect structural surfaces with all six live theme token sets.
- [x] **V3-P2-015:** Add direction-locked finger paging between My List, Continue, and History while retaining accessible tab controls and per-tab scroll state.
- [x] **V3-P2-016:** Replace the unsafe root offline line with an accessible safe-area floating status pill.
- [x] **V3-P2-017:** Replace remaining application-owned raw alerts with the shared Orion themed dialog system.
- [x] **V3-P2-018:** Add a compact 16:9 Home Continue Watching presentation while retaining the larger Library presentation.

### Phase 3 — Trailer reliability

- [x] **V3-P3-001:** Trailer modal no longer renders only a blank WebView.
- [x] **V3-P3-002:** Retry and external YouTube fallback exist.
- [x] **V3-P3-003:** Preserve every viable YouTube and Vimeo TMDB trailer candidate, deduplicated only by provider and key.
- [x] **V3-P3-004:** Rank official, device/original-language-compatible, selected-season, recent and higher-resolution trailers while retaining penalized fallback candidates.
- [x] **V3-P3-005:** Preserve and classify YouTube IFrame error codes 2, 5, 100, 101, 150 and 153 without collapsing them into one generic failure.
- [x] **V3-P3-006:** Retry retryable failures once, unload the failed player, and rotate automatically through the bounded candidate set.
- [x] **V3-P3-007:** Replace the fake web origin and frozen Chrome user agent with Orion's Android application identity and a truthful app referrer; physical code-153 validation remains part of P3-010.
- [x] **V3-P3-008:** Add responsive Vimeo playback and provider-event/error handling when TMDB supplies Vimeo candidates.
- [x] **V3-P3-009:** Recompose the themed sheet around a stable 16:9 viewport, candidate chooser and persistent retry/next/provider/browser actions.
- [x] **V3-P3-010:** Physical Android testing confirms trailers now play inside Orion's Trailer Modal using the repaired in-app transport.

### Phase 4 — Smart Connect experience

- [x] **V3-P4-001:** Versioned command envelopes exist.
- [x] **V3-P4-002:** Authenticated WebSocket transport and acknowledgements exist.
- [x] **V3-P4-003:** QR and manual-IP pairing paths exist.
- [x] **V3-P4-004:** Ordinary-page touchpad and laser movement work.
- [ ] **V3-P4-005:** Replace manual Touchpad/D-pad/HUD/Keyboard modes with one Unified Control Surface.
- [ ] **V3-P4-006:** Add Desktop `RemoteUiContext`.
- [ ] **V3-P4-007:** Add live playback telemetry while an authenticated remote is connected.
- [ ] **V3-P4-008:** Interpolate Mobile progress locally and reconcile with authoritative snapshots.
- [ ] **V3-P4-009:** Replace the hard-coded seek width with measured geometry.
- [ ] **V3-P4-010:** Add code regeneration, expiry recovery, reconnect, lockout, rename, and revoke UX.
- [ ] **V3-P4-011:** Add automatic keyboard actions when Desktop focuses a text field.
- [ ] **V3-P4-012:** Meet command acknowledgement and telemetry freshness targets.
- [ ] **V3-P4-013:** Document and enforce the trusted-LAN threat model; warn when Desktop is on a public network and prevent accidental public-internet exposure.
- [ ] **V3-P4-014:** Replace plaintext bearer transport with pinned WSS or an equivalently authenticated encrypted session; never place a reusable token in a URL or unencrypted request.
- [ ] **V3-P4-015:** Add device-bound session keys, key rotation, token-version migration, and explicit re-pairing after trust material changes.
- [ ] **V3-P4-016:** Enforce monotonic sequences, replay rejection, and command-ID deduplication so WebSocket timeout followed by HTTP fallback cannot apply one action twice.
- [ ] **V3-P4-017:** Harden interface binding, firewall guidance, CORS/origin policy, request limits, and per-device/per-address rate limits.
- [ ] **V3-P4-018:** Measure command round-trip time and playback-telemetry age separately from Orion's internet latency indicator; record median, p95, timeout, and reconnect evidence.
- [ ] **V3-P4-019:** Prefer Android NSD/mDNS plus the saved trusted endpoint; retain bounded subnet probing only as an explicit fallback.
- [ ] **V3-P4-020:** Pass hostile-LAN, captured-token, replay, duplicate-command, network-change, sleep/wake, and reconnect security tests.
- [ ] **V3-P4-021:** Recompose the PIN/QR/Direct-IP pairing sheet for compact phones and keyboards: bounded PIN cells, keyboard-aware scrolling, safe-area/cutout clearance, and no clipped actions.
- [ ] **V3-P4-022:** Make PIN entry focus deterministic when the pairing sheet opens by focusing after modal presentation, restoring focus after method changes, and providing explicit keyboard recovery without requiring a QR-tab round trip.

### Phase 5 — Player-surface laser

- [x] **V3-P5-001:** Main-renderer `.orion-virtual-cursor` exists.
- [ ] **V3-P5-002:** Add main-process `RemotePointerSurfaceManager`.
- [ ] **V3-P5-003:** Register main, embedded, fullscreen, mini, pop-out, and local-player surfaces.
- [ ] **V3-P5-004:** Add transparent, click-through pointer overlay ownership.
- [ ] **V3-P5-005:** Map normalized coordinates to active surface bounds.
- [ ] **V3-P5-006:** Route click input to the correct `webContents`.
- [ ] **V3-P5-007:** Transfer laser ownership during player handoffs.
- [ ] **V3-P5-008:** Follow window movement, resize, maximize, and fullscreen.
- [ ] **V3-P5-009:** Hide on disconnect, inactivity, or surface destruction.
- [ ] **V3-P5-010:** Pass the complete laser acceptance matrix.

### Phase 6 — Native provider shield

- [x] **V3-P6-001:** Mobile has limited JavaScript and navigation filtering.
- [ ] **V3-P6-002:** Build Android `shouldInterceptRequest` boundary.
- [ ] **V3-P6-003:** Add provider-specific block and dependency profiles.
- [ ] **V3-P6-004:** Add required manifest, media, CDN, image, and subtitle allowlists.
- [ ] **V3-P6-005:** Block provider popup and unsafe external navigation.
- [ ] **V3-P6-006:** Report redacted blocked and allowed counts.
- [ ] **V3-P6-007:** Expose Verified, Limited, Disabled, Dependency Allowed, and Rule Failure states.
- [ ] **V3-P6-008:** Prove that Verified is never shown without native evidence.
- [ ] **V3-P6-009:** Validate VidSrc and every supported provider.
- [ ] **V3-P6-010:** Verify shield rules do not break playback or subtitles.

### Phase 7 — Adaptive Mobile UI

- [x] **V3-P7-001:** Six-theme Mobile foundation exists.
- [x] **V3-P7-002:** Basic phone navigation and safe-area support exist.
- [ ] **V3-P7-003:** Add shared compact-phone, phone, tablet, and large-tablet breakpoints.
- [ ] **V3-P7-004:** Replace fixed module-level dimensions with live responsive layout.
- [ ] **V3-P7-005:** Recompose Discover filters and genre density.
- [ ] **V3-P7-006:** Recompose Library grids, tabs, search, and sorting.
- [ ] **V3-P7-007:** Recompose Projector Silver theme selection.
- [ ] **V3-P7-008:** Repair episode metadata/action overflow.
- [ ] **V3-P7-009:** Recompose Media Detail hero and actions.
- [ ] **V3-P7-010:** Validate portrait, landscape, cutouts, 200% text, and Reduced Motion.
- [ ] **V3-P7-011:** Validate all six themes on the complete device matrix.
- [ ] **V3-P7-012:** Add source-aware video presentation modes—Fit, Fill, Stretch, and provider/original—without distorting unsupported embedded players.
- [ ] **V3-P7-013:** Give Orion's player overlay a native touch/reveal layer independent of cross-origin iframe tap propagation.
- [ ] **V3-P7-014:** Reconcile native and embedded HUD behavior through one reachable visible/hidden/pinned/sheet/buffering/error state machine.
- [ ] **V3-P7-015:** Validate overlay controls, safe areas, orientation, video fitting, and touch targets across phones, tablets, and every selectable provider.
- [ ] **V3-P7-016:** Revalidate VidKing startup/resume behavior on Mobile and Desktop mini/pop-out surfaces; Mobile carried-position continuity remains disabled until the provider no longer produces a startup audio/time glitch.
- [ ] **V3-P7-017:** Expand watched controls across Movie, TV, and Anime detail pages, individual episodes, whole seasons, and the player HUD/More sheet; add theme-aware watched tick badges while keeping Watched, Progress, and History independent, with confirmation and undo for season-wide changes.
- [ ] **V3-P7-018:** Organize the Mobile drawer into clear Browse, Your Orion, Connect, and System groups while preserving active-route state, accessibility order, theme behavior, and compact-height scrolling.
- [ ] **V3-P7-019:** Add adaptive performance profiles for low-end phones, including measured startup/navigation/playback targets, reduced image and animation pressure, list virtualization, memory/GPU limits, background-work throttling, and a representative low-end Android device matrix without removing features.

### Phase 8 — Desktop Orion 3.0 integration

- [x] **V3-P8-001:** Desktop Smart Connect pairing modal exists.
- [ ] **V3-P8-002:** Build Mobile Companion Center.
- [ ] **V3-P8-003:** Add separate Mobile-installation QR.
- [ ] **V3-P8-004:** Preserve separate short-lived pairing QR.
- [ ] **V3-P8-005:** Add connected-device management and last-seen status.
- [ ] **V3-P8-006:** Add protocol compatibility and upgrade guidance.
- [ ] **V3-P8-007:** Add profile synchronization and conflict status.
- [ ] **V3-P8-008:** Preserve Smart Connect v2 compatibility during migration.

### Phase 9 — Portable profile and Google authentication

- [x] **V3-P9-001:** Desktop Google authentication and Drive backup foundations exist.
- [x] **V3-P9-002:** Mobile uses MMKV for local data and SecureStore for selected secrets.
- [x] **V3-P9-003:** Replace silent in-memory MMKV fallback.
- [ ] **V3-P9-004:** Add account-namespaced Mobile profiles.
- [ ] **V3-P9-005:** Define shared `PortableProfileV3`.
- [ ] **V3-P9-006:** Add separate Android and Desktop OAuth clients under Orion's Google project.
- [ ] **V3-P9-007:** Keep OAuth tokens exclusively in platform secure storage.
- [ ] **V3-P9-008:** Add non-destructive anonymous-profile import on first sign-in.
- [ ] **V3-P9-009:** Add record-level merge, revisions, and deletion tombstones.
- [ ] **V3-P9-010:** Preserve unknown namespaces such as Desktop Music data on Mobile.
- [ ] **V3-P9-011:** Exclude credentials, device state, paths, downloads, and caches.
- [ ] **V3-P9-012:** Test account switching, offline edits, conflicts, interruption, and rollback.

### Phase 10 — Mobile updates

- [ ] **V3-P10-001:** Add `expo-updates`.
- [ ] **V3-P10-002:** Define runtime version and preview/production channels.
- [ ] **V3-P10-003:** Add staged OTA rollout and rollback.
- [ ] **V3-P10-004:** Detect Play versus side-loaded installation source.
- [ ] **V3-P10-005:** Add Play Core flexible updates.
- [ ] **V3-P10-006:** Add signed GitHub APK manifest and SHA-256 validation.
- [ ] **V3-P10-007:** Require matching Android signing identity.
- [ ] **V3-P10-008:** Add release notes, progress, failure, retry, and restart UX.

### Phase 11 — Release validation

- [x] **V3-P11-001:** Basic Mobile type and Smart Connect protocol checks exist.
- [ ] **V3-P11-002:** Pass native and embedded playback tests.
- [ ] **V3-P11-003:** Pass History and Continue Watching tests.
- [ ] **V3-P11-004:** Pass trailer candidate and fallback tests.
- [ ] **V3-P11-005:** Pass Smart Connect and laser surface matrix.
- [ ] **V3-P11-006:** Pass native shield provider matrix.
- [ ] **V3-P11-007:** Pass responsive, accessibility, and six-theme matrix.
- [ ] **V3-P11-008:** Pass cross-device profile migration and merge tests.
- [ ] **V3-P11-009:** Pass OTA/native update tests.
- [ ] **V3-P11-010:** Install signed Desktop and Android builds on clean devices.
- [ ] **V3-P11-011:** Upgrade copied 2.0.1 profiles without data loss.
- [ ] **V3-P11-012:** Confirm no Desktop Cinema or Music regressions.

## Progress Log

Every roadmap update should add one row. Do not delete older entries.

| Date | Checklist IDs | Change | Evidence | Overall completion |
|---|---|---|---|---:|
| 2026-07-31 | V3-P0-001, V3-P0-002, V3-P0-003 | Verified current type, IPC, and binding baseline | Local repository checks | 24% |
| 2026-07-31 | V3-P1-001, V3-P1-002, V3-P2-001 | Confirmed native progress and MMKV storage foundations; embedded telemetry remains missing | Code audit | 24% |
| 2026-07-31 | V3-P3-001, V3-P3-002 | Confirmed non-blank trailer surface and external fallback; in-Orion reliability remains partial | Physical-device screenshots and code audit | 24% |
| 2026-07-31 | V3-P4-001–V3-P4-004 | Confirmed WebSocket/acknowledgement/pairing and ordinary-page pointer foundation | Code audit and user device test | 24% |
| 2026-07-31 | V3-P5-001 | Confirmed main-renderer cursor; documented failure across every player surface | Code audit and user device test | 24% |
| 2026-07-31 | V3-P6-001 | Confirmed limited JavaScript/navigation shield and native interception gap | Code audit and provider test | 24% |
| 2026-07-31 | V3-P9-001, V3-P9-002 | Confirmed Desktop cloud foundation and Mobile MMKV/SecureStore foundation | Code audit | 24% |
| 2026-07-31 | V3-P0-004 | Created the Orion v3 rollback branch and preserved the monorepo/Mobile baseline | Branch `codex/orion-v3`; commit `66299bebc8e3e70bb7399c6c6f149ed7ed28827b` | 24% |
| 2026-07-31 | V3-P0-005–V3-P0-010 | Completed storage failure safety, route decomposition, redacted diagnostics, strict size gates, critical-route smoke coverage, and Phase 0 regression tests | Checkpoint `a409055`; Mobile typecheck; 7/7 Node tests; 48-file size gate; Expo Doctor 20/20; web export; standalone APK with bundled `assets/index.android.bundle`; Desktop 52 Node + 135 renderer tests, IPC/binding/secret/theme/cycle gates, and production build | 29% |
| 2026-07-31 | V3-P4-013–V3-P4-020 | Added the verified Smart Connect v2 transport limitations and v3 hardening requirements; no implementation credit awarded | Code audit of Desktop HTTP/WebSocket server, Mobile transport/fallback, shared protocol, pairing persistence, and status flow | 29% |
| 2026-07-31 | Pre-Phase-1 brand checkpoint | Replaced Desktop and Mobile application icon families from one transparent Orion master; added reproducible Windows ICO/PNG and Android adaptive/monochrome generation | Desktop production build; Mobile typecheck and web export; Expo public-config resolution; ICO decode and alpha validation | 29% |
| 2026-07-31 | V3-P1-003–V3-P1-005 | Added versioned playback-session and telemetry contracts, strict evidence classification, and a reducer that rejects stale, malformed, impossible, and unexplained-regression events | Commits `c0706f2`, `690fb71`; reducer and persistence unit coverage | 34% |
| 2026-07-31 | V3-P1-008–V3-P1-010, V3-P9-003 | Wired verified native/embedded telemetry, isolated unobservable opens in `recentOpensV1`, preserved verified failover position, enforced verified-only History/progress writes, and retained the Phase 0 persistent-storage recovery boundary | Commit `6a1e065`; Mobile typecheck; 18/18 Node tests; 60-file size gate; Expo Doctor 20/20; web export; standalone Android APK containing `index.android.bundle`; Desktop 52 Node + 135 renderer tests and all repository gates | 36% |
| 2026-08-02 | V3-P0-005, V3-P9-003 | Corrected the native storage adapter for the installed `react-native-mmkv` v4 factory/removal API after physical launch exposed `MMKV_INIT_FAILED`; clarified that app-private MMKV does not require Android file permission | Mobile typecheck; 18/18 Node tests; 60-file size gate; standalone arm64 APK rebuilt with bundled JavaScript and Nitro MMKV native libraries | 36% |
| 2026-08-02 | V3-P1-006, V3-P1-007, V3-P1-011, V3-P1-012, V3-P7-012–V3-P7-015 | Expanded acceptance from three representative sources to the complete selectable source matrix; recorded incorrect AllManga surface routing, missing source-aware fit modes, and unreliable cross-origin HUD tap propagation | Code audit of the shared source registry, Mobile source sheet, `PlayerScreen`, native HUD, and embedded surface; roadmap-only update with no completion credit | 36% |
| 2026-08-02 | V3-P1-006, V3-P1-007, V3-P1-009, V3-P2-002 | Physical-phone testing confirmed reopen/resume and successful stream loading across the tested source set, but source-to-source continuation stuck or resumed at an incorrect timestamp; Library History remained empty because its UI still renders `watched` instead of the persisted `history` collection | User physical-device report plus code trace of `LibraryContext`, Library route, `PlayerScreen`, embedded telemetry, and resume injection; `V3-P1-009` reopened and no runtime change made | 35% |
| 2026-08-02 | V3-P1-009, V3-P1-012 | Implemented capability-driven verified handoffs, fresh outgoing snapshot enforcement, bounded idempotent seeks, target-side ±5-second confirmation, 12-second timeout, hybrid manual recovery, health-aware automatic retries, strict VidKing/VidLink/VixSrc message adapters, Mobile-only AllManga quarantine, and redacted handoff diagnostics | Commits `c3d52be`, `fa73b2f`, `3edbbe4`, `e9de37c`; Mobile/shared typechecks; 25/25 Mobile tests; 63-file source-size gate; Mobile web export; final standalone arm64 APK with `assets/index.android.bundle` (SHA-256 `CD4D02B6CE0BD7962759B26206085A98814D692556B5B8C3C4D792055592888B`); Desktop 52 Node + 135 renderer tests and all source/binding/IPC/secret/theme/cycle/build gates. Expo Doctor passed 18 local checks; its two online metadata checks were unavailable under the validation network policy. No completion credit added before physical acceptance. | 35% |
| 2026-08-02 | V3-P1-009 | Physical testing found VidKing could remain stuck after a carried-position switch. Added early wrong-position classification after a four-second settling window and made manual Continue Here restart an unconfirmed URL-resume target without the stale resume parameter while retaining Return to Previous Source. | 27/27 Mobile tests; Mobile typecheck; 63-file source-size gate; Mobile web export; standalone arm64 APK with bundled `assets/index.android.bundle` (SHA-256 `3C181A0A96047884DB6CA49168A6D69992DB6B7ECA9E7AF268595B5AF93F5659`). Physical VidKing retest remains required; Phase 1 stays at 70%. | 35% |
| 2026-08-03 | V3-P1-009 | Follow-up physical testing confirmed general source continuation works, but switching into VidKing can briefly expose overlapping or pre-resume audio. Added an Android WebView audio-release boundary before mounting the next provider and prevented Desktop mini-player WebViews from mounting until the embedded owner has been released. | Commit `5fa9d1a`; Mobile typecheck; 28/28 Mobile tests; 63-file source-size gate; Mobile web export; standalone arm64 APK with bundled `assets/index.android.bundle` (SHA-256 `854CA3083345866327BB1D13A8EC3999F28A68A6AF43B51442BB36137AB09409`); Desktop mini-player ownership regression test (3/3), 136/136 renderer tests, source/binding/IPC/secret/cycle gates, and production build. Physical VidKing switch and Desktop mini-player retests remain required; Phase 1 stays at 70%. | 35% |
| 2026-08-03 | V3-P1-009 | Physical retesting showed the audio-release boundary did not remove VidKing's brief pre-resume audio, identifying the remaining behavior as provider startup ordering rather than two Orion playback owners. Added the Desktop-style pre-playback decision to Mobile initial playback and every verified manual source switch: Resume, Replay Last 30 Seconds, Start Over, or Cancel. A carried VidKing choice now overrides its default autoplay and opens paused at the selected position so its player cannot audibly start before applying `progress`. | Commit `588fa90`; Mobile typecheck; 29/29 Mobile tests; 65-file source-size gate; Mobile web export; standalone arm64 APK with bundled JavaScript (SHA-256 `EC70F1CF8800DFF85887DA88EA8F489389A9B9418DA0A3DFB85B1AC50D017F8F`). Physical VidKing retest remains required and the related Desktop mini/pop-out concern remains open; Phase 1 stays at 70%. | 35% |
| 2026-08-03 | V3-P1-006–V3-P1-011 | Physical testing accepted the new Resume dialog and cross-source continuation for the other working providers, while confirming VidKing still produces a provider-internal startup audio/time glitch. Phase 1 closes by making the capability boundary truthful: VidKing remains normally playable, but carried-position choices are replaced with Start Over/Cancel and automatic continuity skips it. The obsolete bottom handoff notice was removed and the dialog was made scroll-safe and compact in landscape. | Commit `562af47`; user physical-device report; Mobile typecheck; 30/30 Mobile tests; 64-file source-size gate; Mobile web export; standalone arm64 APK with bundled JavaScript (SHA-256 `8E4753DACF3B170821778D809B38531FA518845DDBFEA1806F0074AC0E813789`). VidKing startup/resume compatibility is deferred to `V3-P7-016` and is not represented as working. | 39% |
| 2026-08-03 | V3-P2-002 through V3-P2-009, V3-P2-011 | Repaired Library History, added verified Continue Watching to Home and Library, introduced lazy V3 progress normalization, kept History/Progress/Watched/My List mutations independent, carried artwork and episode context through playback, preferred the last healthy resume source, and synchronized the touched Home/Library presentation with live semantic theme tokens. | Commit `cca72a6`; Mobile typecheck; 37/37 Mobile tests including V2 compatibility, verified-evidence filtering, latest-episode selection, independent mutations, and theme-binding checks; 70-file source-size gate; Expo Doctor 20/20; production web export; standalone arm64 APK with bundled JavaScript (SHA-256 `2F7BFEC809A1A64F9A9F27C6BB40C7F750E64C199A5C4B59D3F29A281BC543D6`); Desktop full gate with 52 Node and 136 renderer tests plus source/binding/IPC/secret/theme/cycle/build checks. Physical restart/reboot and responsive six-theme visual acceptance remain open, so Phase 2 is 85%, not complete. | 46% |
| 2026-08-03 | V3-P2-013 through V3-P2-018, V3-P7-017 | Added shared editorial headers, six-theme Discover/Connect surfaces, direction-locked Library finger paging, a safe-area offline pill, Orion-themed application dialogs, and compact Home Continue cards. Recorded broader watched controls and badges under Phase 7 without awarding Phase 2 completion credit. | Commit `6e7d9e3`; Mobile typecheck; 43/43 Mobile tests; 72-file source-size gate; production web export; browser visual checks in Midnight Premiere and Projector Silver at a 390x844 viewport; successful swipe from My List to Continue; standalone arm64 APK with bundled JavaScript (SHA-256 `8BBF843755B528DC581C909098DC0837610B250447A1FCB6F0559E85ED7B00A8`); Desktop source/binding/IPC/secret/theme/cycle gates, 52/52 Node tests, 136/136 renderer tests, and production build. Expo Doctor passed its 18 local checks; two online Expo catalog checks were unavailable under the validation privacy/network policy. Physical restart/reboot and the complete device/theme/accessibility matrix remain open. | 47% |
| 2026-08-03 | V3-P2-010, V3-P2-012, V3-P4-021, V3-P4-022, V3-P7-018, V3-P7-019 | Physical-device acceptance closed Phase 2: History, Continue Watching, independent mutations, persistence, swipe navigation, offline placement, themed dialogs, compact cards, and the updated theme/UI matrix all passed. Recorded—not implemented—the drawer grouping, Smart Connect pairing keyboard/overflow, and low-end performance concerns under their owning phases. | User physical-device acceptance and screenshots `216812.jpg`, `216810.jpg`, and `216808.jpg`; no runtime change or completion credit was awarded to the newly recorded Phase 4/7 work. | 47% |
| 2026-08-03 | Pre-Phase-3 Portal Star checkpoint | Replaced the narrow oval icon family with the deterministic Obsidian Eclipse Portal Star across Desktop and Mobile. Added platform-fitted Desktop, Android legacy, adaptive, monochrome, splash, favicon, density and multi-resolution ICO assets; converted the former Desktop generator into a shared-generator wrapper; and moved historical Cinema icons outside production assets. No roadmap percentage credit was awarded. | Commit `5a2ba24`; generator validation measured Desktop occupancy at 89.3%, Android adaptive occupancy at 65.6%, and monochrome occupancy at 65.7%; ICO decoded with 16/24/32/48/64/128/256px entries; Android circle/squircle/rounded-square/teardrop previews showed no clipping; Mobile typecheck, 43/43 tests, 72-file size gate, web export and standalone APK passed; Desktop production build and Windows packaging passed. APK SHA-256 `FD29D510B81FB90EFAAEDBC01C7962B5E738725A849A762212B2BC55FEF267B8`; installer SHA-256 `78A00C34786EEDD22B5A559DD7C408D702620B4053A41E3333510D20DA84C9F5`; physical clean-install/update launcher-cache validation remains open. | 47% |
| 2026-08-03 | Pre-Phase-3 startup identity checkpoint | Added a guarded Portal Star startup sequence to Desktop and Mobile. The last selected theme and accessibility motion preference are applied before the custom intro appears; `ORION` reveals with a restrained typed-letter transition and the tagline `A universe made to be felt.`; the layer then fades, unmounts and releases input. Desktop now keeps its native window hidden until `ready-to-show`. Mobile retains the native splash until fonts and the themed React root are laid out, then hands off directly to the custom intro. Font failure cannot leave the app trapped on its splash. No roadmap percentage credit was awarded. | Commit `4ccddf1`; Mobile typecheck, 45/45 tests, 73-file source-size gate, web export and standalone Android APK passed; APK SHA-256 `9E76690DE331B9B130D2B606C8E419C35C1DB28201937D629CCA12F6204AD0E9`; Desktop source/binding/IPC/secret/theme/cycle gates, 53/53 Node tests, 138/138 renderer tests and production build passed. A real Electron launch observed Projector Silver while the intro was visible and confirmed the overlay was absent after completion. Expo Doctor passed all 18 local checks; two online catalog checks were unavailable under the validation network policy. Physical Mobile startup checks across saved themes and Reduced Motion remain open. | 47% |
| 2026-08-03 | Pre-Phase-3 Orion Pop icon checkpoint | Replaced the interim Portal Star production assets with the user-selected Orion Pop identity while retaining a single reproducible platform family. The high-resolution source is preserved in `assets/branding`; Desktop uses a visually full rounded tile and true small-size variants; Mobile uses an opaque legacy launcher tile plus isolated adaptive, monochrome, splash and startup marks. The shared generator is the sole asset authority and the former Desktop script is now a thin wrapper. No roadmap percentage credit was awarded. | Commit `04c977a`; source SHA-256 `CFD70ABE1B4F9D3B9BBB1053C16C0637AD3FC96AA968E102531247AB87AD2C35`; deterministic regeneration verified across the six primary outputs; Desktop occupancy measured 93.0%, adaptive foreground 58.2% × 64.2%, monochrome 58.3% × 64.1%; ICO contains real 16/24/32/48/64/128/256px entries. Mobile typecheck, 45/45 tests, 73-file size gate, web export and standalone Android APK passed. Desktop source/binding/IPC/secret/theme/cycle gates, 53/53 Node tests, 138/138 renderer tests, production build, ZIP and NSIS packaging passed. APK SHA-256 `4D97710DC06723F2FD427EC678607EB50244FF9B7A942EDCEE257F377E91513A`; installer SHA-256 `681CF689B89D7059911E6FF2C601D83734D3C54473EE175C2F2935F827A789DF`; ZIP SHA-256 `50F93ED29152E186D9DE3448E1C91930D60E9269F710C07F71E2D8112F35283F`. Physical clean-install/update launcher-cache, Android mask and saved-theme startup validation remain open. | 47% |
| 2026-08-08 | Pre-Phase-3 Phase 1/2 adaptive UI repair | Bounded the landscape playback-position prompt; rebuilt phone History cards into readable summary and action rows; reduced Home hero obscuration while retaining text contrast; synchronized Media Detail structural surfaces, episode lists and action sheets with live theme tokens; made Smart Connect PIN/IP pairing keyboard-aware with compact six-digit geometry; and repaired Follow System Appearance through live Appearance events plus foreground refresh. No roadmap percentage credit was awarded. | Mobile typecheck; 51/51 tests including six new checkpoint guards; 73-file source-size gate; production web export; standalone Android debug APK SHA-256 `DA71C6838BB6DE417C087B8F2D15710902B6F7008DAC9ACD1BA3BA3861A8DCE7`; Desktop source/binding/IPC/secret/theme/cycle gates, 53/53 Node tests, 138/138 renderer tests and production build. Expo Doctor passed all 18 local checks; its two online catalog checks could not run under the validation privacy/network policy. Physical device and six-theme visual acceptance remain open. | 47% |
| 2026-08-09 | Pre-Phase-3 semantic contrast closure | Converted the legacy Person/cast profile, biography HUD and Filmography surface to the active Mobile theme so its MediaCard captions inherit a matching background. Split Media Detail hero contrast at the image-to-page boundary: dark themes retain cinema-white over-media text while Projector Silver uses readable theme ink, borders and badges after the fade. Removed the legacy active-tab text override that made the Projector Silver Info label disappear. The same semantic bindings cover Midnight Premiere, AMOLED, Mocha, Slate, Projector Silver and Custom rather than special-casing one theme. No roadmap percentage credit was awarded. | Mobile typecheck; 53/53 tests including Person/filmography and hero-boundary regression guards; 73-file source-size gate; production web export; standalone Android debug APK SHA-256 `1F3D479EB0FDAA7F73AA39C96B507C9C650F12BCE188676BB69B563F831F1F66`; Desktop source/binding/IPC/secret/theme/cycle gates, 53/53 Node tests, 138/138 renderer tests and production build. Physical six-theme acceptance remains open. | 47% |
| 2026-08-09 | V3-P3-003 through V3-P3-009 | Rebuilt Mobile trailers around normalized YouTube/Vimeo candidates, deterministic ranking, exact provider error classification, bounded retry and automatic rotation, strict candidate-bound bridge events, truthful Android client identity, and a six-theme safe-area-aware 16:9 modal with persistent internal/external recovery actions. Previous players are unmounted by keyed attempts before another candidate is loaded. | Checkpoint `3ec037e`; Mobile typecheck; 59/59 tests including executable candidate/ranking and provider-error tests; 76-file source-size gate; production web export; standalone arm64 Android APK with bundled JavaScript (SHA-256 `C46897315EE0C25CB53D6BAE639C69FFB9E6858E7F38C8E9E45CF57C9A5F8FB8`); Desktop full gate with 53 Node and 138 renderer tests plus source/binding/IPC/secret/theme/cycle/build checks. Expo Doctor passed its 18 local checks; its two online catalog checks were not authorized under the validation privacy policy. Physical Android provider/orientation/background acceptance remains open under V3-P3-010, so Phase 3 is 90%, not complete. | 52% |
| 2026-08-09 | V3-P3-010 blocker repair | Physical Android testing found that every candidate failed after Preparing. The wrapper supplied an `android-app://` identity even though current YouTube embeds require an HTTP Referer or equivalent client identity, and compact-phone 16:9 geometry could place the player below YouTube's documented 200 CSS-pixel minimum height. Repaired the in-modal path with an HTTPS application origin and Referer, standard YouTube host first, a 200px minimum player viewport, a 25-second initialization window, and one bounded direct-provider embed retry inside Orion when the JavaScript wrapper cannot initialize. External app/browser actions remain final fallbacks only. | Mobile typecheck; 59/59 tests; 76-file source-size gate; production web export; standalone arm64 Android APK with bundled JavaScript (SHA-256 `A32B02800428AD6EEF50D9584CF1D06DBF9675CCB9628E219A590C3DF819A976`). Physical YouTube/Vimeo playback acceptance remains open, so Phase 3 stays at 90% and `V3-P3-010` remains incomplete. | 52% |
| 2026-08-09 | V3-P3-010 and Phase 3 acceptance | Physical Android testing of the repaired APK confirmed that trailers now play successfully inside Orion's Trailer Modal. In-app playback remains the primary path; candidate rotation and provider-app/browser actions remain recovery paths for genuinely removed, private or owner-disabled embeds. | User physical-device acceptance of APK SHA-256 `A32B02800428AD6EEF50D9584CF1D06DBF9675CCB9628E219A590C3DF819A976`, following the automated typecheck, 59/59 tests, source-size, web-export and standalone-build evidence recorded above. Phase 3 is complete at 100%. | 52% |

Phase 3 is complete. Orion now keeps
all viable TMDB YouTube and Vimeo candidates, ranks rather than prematurely
deletes weaker results, and advances through the bounded candidate list after an
accurately classified failure. Provider readiness and confirmed playback remain
separate states. The active candidate survives ordinary layout changes, stale
bridge messages are rejected, delayed rotation is cancelled when the modal
closes, and every candidate has Retry, Try Next, provider-app and browser
recovery paths. The latest physical blocker repair adds a second in-Orion provider
transport before those external fallbacks. Physical Android testing confirms that
the repaired transport plays trailers inside Orion's modal, closing V3-P3-010.

Phase 2 implementation is complete for automated validation. History now reads
the persisted History collection, Continue Watching derives only from verified
playback, and V2 progress is normalized lazily into V3 presentation records.
Home, Hero, cards, Library tabs, actions, loading/empty states, and the new
Continue surfaces consume the active semantic Mobile theme. Shared editorial
headers, Discover/Connect theme migration, Library finger paging, the safe-area
offline indicator, Orion dialogs, and compact Home Continue cards now pass the
automated and browser-preview gates. Physical-device testing subsequently
accepted restart/reboot persistence, the responsive layouts, theme behavior,
dialogs, offline placement, compact cards, and swipe navigation. Phase 2 is now
complete. The newly observed drawer organization and Smart Connect pairing-sheet
issues are assigned to Phases 7 and 4 respectively and do not reopen verified
History or Continue Watching behavior.

Phase 1 is complete at its verified-capability boundary. Reopening media at a
saved position works, and physical testing accepted the new user-selected
Resume/Replay behavior and continuity across the other working providers.
Source switching requires a fresh verified outgoing position and matching target
telemetry before Orion claims continuity. Async/native AllManga remains hidden on
Mobile until a safe native resolver exists. VidKing remains selectable for normal
playback and new episodes, but it is excluded from carried-position choices and
automatic continuity because physical testing repeatedly reproduced its
provider-internal startup audio/time glitch. That compatibility work is tracked
under `V3-P7-016`; Orion does not represent it as a Phase 1 success. Unobservable
opens remain isolated in the bounded `recentOpensV1` journal and cannot create
History, progress, percentages, completion, or watched records.

Phase 0 implementation is complete. The generated standalone Android APK was
inspected and contains its JavaScript bundle, so it does not depend on Metro.
Installation and launch on a separate clean physical device remain an external
release-verification action tracked by **V3-P11-010**, not evidence fabricated
by this checkpoint.

### Roadmap maintenance rules

- Update `Last verified` whenever the tracker changes.
- Update a phase percentage and weighted contribution together.
- Add test or device evidence to the Progress Log.
- Never mark a checklist item complete based only on a screenshot or a build succeeding.
- Never reduce the list of known blockers to increase the percentage.
- Reopen a checked item if a regression invalidates its acceptance.
- Keep package versions unchanged until Phase 11 passes.
- Preserve this document as the authoritative Orion v3 execution tracker.

## Executive Summary

Orion Mobile is a promising Android-first companion with working metadata browsing, media details, provider playback, themes, local state, and a substantially improved Smart Connect transport. It is not ready for an Orion 3.0 release yet.

The authoritative playback-truth pipeline now exists for native and embedded surfaces. It accepts only active-session telemetry, requires a real playing event plus advancing time before verification, and isolates unobservable embedded sessions in a bounded Recent Opens journal. Physical Android validation of the source-specific adapters remains the acceptance blocker. Until that evidence is recorded, these user-facing outcomes remain intentionally deferred or incomplete:

- Mobile History does not reliably update.
- Continue Watching is absent and cannot be populated reliably.
- Smart Connect's Now Playing HUD and progress pointer become stale.
- Embedded-player buffering and playback states can be misleading.
- Source changes cannot always preserve an exact resume position.

The next implementation should establish verified playback telemetry first. History, progress, Continue Watching, Smart Connect HUD, source failover, and cross-device synchronization should all consume that shared contract.

Other release blockers are:

- Trailer playback frequently falls back instead of succeeding inside Orion.
- Mobile ad blocking cannot inspect all Android WebView subrequests.
- The Smart Connect laser exists only in the main renderer and disappears over every player surface.
- Smart Connect still requires inconvenient manual switching between control modes.
- Mobile updates and cross-platform Google profile restoration are not implemented.
- Several phone layouts are oversized, clipped, or insufficiently adaptive.
- Automated coverage is too narrow for the current feature surface.

## Code-Verified Baseline

At the time of this audit:

- Mobile strict TypeScript compilation passes.
- Eighteen Mobile unit/safety tests pass, including playback-truth rejection and persistence guards; physical provider behavior remains unverified.
- Desktop IPC contract validation passes.
- Desktop renderer-binding validation passes.
- Mobile and Desktop package versions are both 2.0.1.
- Mobile does not currently include a complete `expo-updates` configuration.
- Connect, Discover, Media Detail, and Player routes are thin shims, and the Mobile source-size gate has no oversized allowlist.

These results confirm that the repository is buildable, but they do not establish release-level behavioral confidence.

## Priority Audit

| Priority | Area | Current condition | Required outcome |
|---|---|---|---|
| P0 | Embedded playback telemetry | Provider WebViews do not consistently report verified position, duration, pause, buffering, or completion | One source-aware `MobilePlaybackTelemetry` stream |
| P0 | History | Verified progress and History are written together, but Library renders the separate `watched` map instead of `history` | Chronological, evidence-backed History backed by the actual History collection |
| P0 | Source handoff | Reopening saved playback works, but physical source switching can stick or resume at an incorrect timestamp because verified snapshots and target seek capabilities are inconsistent | Persist outgoing verified time, negotiate target resume capability, and confirm the applied position from new-source telemetry |
| P0 | Continue Watching | Missing from Mobile Home and Library | Resumable Home rail and Library Continue tab |
| P0 | Trailers | WebView is no longer blank, but many YouTube embeds still fail inside Orion | Candidate rotation, precise errors, valid player identity, and fallback |
| P0 | Smart Connect laser | Works on ordinary pages but disappears over default, fullscreen, mini, and pop-out players | Player-surface-aware pointer compositor |
| P0 | Mobile provider shield | JavaScript and navigation filtering cannot intercept every iframe/subresource request | Native Android request interception with provider profiles |
| P0 | Smart Connect HUD | Desktop publishes occasional snapshots instead of continuous telemetry | Authoritative live status plus locally interpolated progress |
| P1 | Smart Connect UX | Users manually switch Touchpad, D-pad, HUD, and Keyboard modes | One context-aware Control Surface |
| P1 | Player HUD | Embedded controls can become difficult to reveal and use | Reachable, explicit HUD state machine |
| P1 | Player touch ownership | Embedded HUD reveal partly depends on page-level injected taps that nested cross-origin frames do not reliably propagate | Native Orion-owned gesture/reveal layer above the provider surface |
| P1 | Video presentation | The outer player fills the display, but inner provider video may remain cropped, letterboxed, or incorrectly sized with no user fit choice | Capability-aware Fit, Fill, Stretch, and Provider/Original modes |
| P1 | Source matrix | Nine sources are selectable, but only three representative telemetry paths were initially named; AllManga's async/native contract is not honored by Mobile routing | Per-source routing, health, telemetry, subtitle, shield, and UI acceptance matrix |
| P1 | Responsive UI | Fixed dimensions and oversized controls create clipping and wasted space | Phone, tablet, foldable, landscape, and large-text layouts |
| P1 | Mobile updates | No production OTA/native update flow | Runtime-safe OTA plus signed native updates |
| P1 | Cross-device profile | Mobile has no compatible Google authentication or profile restoration | Portable Profile v3 with record-level merging |
| P1 | Desktop integration | Smart Connect is a modal rather than a complete companion system | Orion 3.0 Mobile Companion Center |
| P2 | Architecture | Large screen files combine transport, state, layout, and presentation | Focused controllers, hooks, services, and components |
| Deferred | TV casting | Remote control foundations exist, but casting is a different protocol category | Separate post-v3 casting milestone |

## 1. Playback Truth, History, and Continue Watching

### Confirmed condition

Phase 1 now routes native and embedded observations through the versioned
telemetry reducer under `apps/mobile/src/features/playback`. Only verified,
advancing playback can reach `recordPlayback()` in the Library context.

Remaining conditions:

- Cross-origin provider frames do not automatically expose current time or duration, so every declared adapter still requires physical-device evidence.
- Unobservable providers are recorded only in `recentOpensV1`; they cannot create History, progress, watched state, completion, or percentages.
- `apps/mobile/app/(tabs)/library.tsx` obtains `history` from `useLibrary()` indirectly but renders values from the `watched` map as its History list.
- Mobile Home has no proper Continue Watching section.
- Online sources are still routed through `EmbedPlayerSurface`; this conflicts with AllManga's declared async/native strategy.

### Required data separation

Orion must preserve four independent concepts:

1. **History**
   - Chronological playback activity.
   - Ordered by `lastPlayedAt`.
   - Records content that genuinely began playback.

2. **Progress**
   - Current position and duration.
   - Used for resume and Continue Watching.

3. **Watched**
   - Completion state or an explicit manual action.
   - Must not be used as a substitute for History.

4. **Continue Watching**
   - A derived presentation of incomplete, resumable progress.
   - One latest episode per series.

### Proposed contract

```js
/**
 * @typedef {Object} PlaybackProgressV3
 * @property {3} schemaVersion
 * @property {string} key
 * @property {MediaIdentity} mediaIdentity
 * @property {number|null} season
 * @property {number|null} episode
 * @property {number} currentTime
 * @property {number} duration
 * @property {number|null} percent
 * @property {string|null} sourceId
 * @property {number} startedAt
 * @property {number} lastPlayedAt
 * @property {boolean} completed
 * @property {"native-video-event"|"provider-video-event"|"provider-message"|"manual-watched"|"opened-only"} evidence
 */
```

### Provider telemetry strategies

Provider adapters should report evidence through the strongest available method:

- Native video events for direct HLS, DASH, MP4, and local media.
- Injected polling of an accessible `<video>` element when the provider surface permits it.
- Known provider `postMessage` events.
- Provider-specific player events.
- An `opened-only` Recent Opens journal entry—not History—when no trustworthy timing signal exists.

Orion must not fabricate a percentage when the provider exposes no trustworthy position or duration.

### Complete selectable-source matrix

The three initially named sources are representative adapters, not the full
Mobile catalog. Physical acceptance must cover every source the UI lets a user
select:

| Strategy | Selectable sources | Required evidence |
|---|---|---|
| `frame-video` | Videasy, VidSrc, AutoEmbed, VsEmbed, 111Movies | Accessible video events, advancing time, pause/seek/buffer behavior, or an honest `unobservable` result |
| `player-event` | VidKing, VidLink, VixSrc | Documented provider messages with valid origin, session, source, sequence, time, and duration |
| async/native | AllManga | Correct async resolution into a native/direct surface before native telemetry can be accepted |

SuperEmbed remains quarantined. VidFast, Vidify, 2Embed, and VidSrc CC remain
disabled and are not release-selectable until their contracts are separately
validated. Disabled or quarantined sources must never be counted as working
because their URL loaded.

### Physical Phase 1 result — August 2, 2026

- Reopening a stream resumes from the previously saved position.
- Tested sources load and play, but loading alone does not prove that their declared telemetry adapters are reporting trustworthy time and duration.
- The verified Resume dialog corrected carried-position switching across the other working providers tested on the phone.
- Repeated device tests confirmed VidKing still produces a brief startup audio/time glitch even after outgoing-WebView release and autoplay suppression. Orion therefore no longer injects or claims a carried position into VidKing: it offers Start Over or Cancel, and automatic continuity skips VidKing. Ordinary VidKing playback and new-episode startup remain available. Mobile and Desktop mini/pop-out compatibility is tracked as `V3-P7-016`.
- The obsolete bottom handoff recovery bar was removed because it competed with the explicit Resume dialog. The dialog now has a compact landscape composition and scroll-safe fallback.
- The Library History tab remains empty after verified viewing because it reads the separate `watched` map rather than the persisted `history` array. Repairing that presentation is Phase 2 (`V3-P2-002`), not a reason to fabricate Phase 1 progress.

The handoff failure is consistent with the current capability boundary: an
outgoing source must provide a fresh verified snapshot, while the target must
either accept its declared resume URL parameter or expose a reachable video
element for a confirmed seek. Nested cross-origin players can prevent the
fallback seek script from reaching their media element. Orion must confirm the
new position from target telemetry before reporting handoff success.

### Phase 1 continuity candidate — August 2, 2026

The implementation candidate now applies the following truth rules:

- Outgoing telemetry must be finite, verified, and no older than five seconds.
- The outgoing record is synchronously persisted before the source changes.
- `url-param`, `verified-seek`, `native`, and `none` are explicit capabilities;
  the former `supportsResume` boolean no longer determines handoff behavior.
- A target confirms continuity only after its own advancing telemetry arrives
  within five seconds of the requested position.
- Manual selection remains usable when continuity cannot be observed, but Orion
  never labels an unconfirmed carried position as restored.
- Automatic failover marks an unconfirmed target unhealthy, tries another
  compatible source, and restores the last usable source if none confirms.
- The bounded seek waits for accessible media metadata, is idempotent per
  handoff, stops after 32 attempts, and reports applied/unavailable instead of
  repeatedly forcing `currentTime`.
- AllManga remains registered for Desktop but is absent from Mobile source
  selection and automatic failover.
- VidKing remains registered for ordinary Mobile playback but is absent from
  carried-position choices and automatic continuity targets until `V3-P7-016`
  passes physical revalidation.

Phase 1 physical acceptance played the working providers long enough to establish
an outgoing position and confirmed the new Resume dialog could carry that
position between them. VidKing did not pass and was removed from the continuity
capability set rather than counted as successful. Future re-enablement requires
movie and TV evidence within five seconds with no duplicate audio, startup
glitch, or frozen time.
### Persistence rules

Save verified progress:

- Once actual playback begins.
- Every five to ten seconds while advancing.
- After seeking.
- On pause.
- Before a source switch.
- When the application backgrounds.
- On navigation or player teardown.
- At verified completion.

### Continue Watching experience

Add a Home rail containing:

- One latest entry per TV series.
- Landscape artwork.
- Season and episode context.
- Percentage and remaining time when duration is known.
- Resume.
- Remove Progress.
- Mark Watched.
- View All to Library → Continue.

Recommended inclusion rules:

- Playback has advanced beyond a small threshold, such as 30 seconds.
- The record is not completed.
- Percentage is below the completion threshold, normally 90–95%.
- The media is still resolvable.

Library should expose:

- My List.
- Continue.
- History.

Clearing History must not delete My List, watched state, or progress unless the user explicitly chooses those operations.

## 2. Trailer Playback

### Confirmed condition

The Mobile trailer component uses a custom HTML wrapper around the YouTube IFrame API. It currently:

- Tries a selected YouTube trailer.
- Alternates between regular and privacy-enhanced YouTube hosts.
- Collapses several distinct playback errors into one generic embed failure.
- Can repeatedly retry the same unusable trailer.
- Uses an origin/base URL configuration that may not correctly represent Orion's application identity.

### Constraints

Some trailers cannot legally or technically play inside Orion because:

- The owner disabled embedding.
- The video is restricted or unavailable.
- The Android WebView cannot provide a valid referrer/client identity.
- A regional upload is blocked.

Orion cannot bypass an owner-disabled embed. External YouTube fallback must remain.

### Correct solution

1. Preserve all viable TMDB trailer candidates.
2. Rank:
   - Official trailers.
   - Preferred language.
   - Recent uploads.
   - Teasers after trailers.
3. Preserve and classify actual IFrame error codes.
4. Automatically advance to the next candidate after owner-disabled or unavailable errors.
5. Treat missing-client-identity errors as Orion player-boundary failures.
6. Use a properly identified first-party HTTPS wrapper with a matching origin and referrer, if a wrapper is retained.
7. Support Vimeo when TMDB supplies a Vimeo trailer.
8. Keep:
   - Retry in Orion.
   - Open in YouTube.
   - Open in browser.

### Trailer UI

- Reserve a fixed 16:9 playback region.
- Keep error information inside that region.
- Make trailer candidate tabs scroll without clipping.
- Keep fallback actions visible above the safe-area inset.
- Preserve modal state across temporary orientation and application interruptions.

Official references:

- [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference)
- [YouTube Videos API](https://developers.google.com/youtube/v3/docs/videos)

## 3. Unified Mobile Player HUD

Introduce explicit HUD states:

- `visible`
- `hidden`
- `pinned`
- `sheet-open`
- `buffering`
- `error`

Rules:

- Controls appear on entry.
- Controls hide only while verified playback is advancing.
- Controls remain visible while paused, buffering, seeking, selecting a source, or displaying an error.
- A persistent reveal handle remains reachable even when taps inside a cross-origin frame cannot be detected.
- Opening Sources, Subtitles, Shield, or Diagnostics pins the HUD.
- Meaningful interaction resets the hide timer.
- Portrait and landscape layouts must not overlap title, source, shield, or system insets.

The same `MobilePlaybackTelemetry` contract should feed:

- Mobile HUD.
- History.
- Progress.
- Continue Watching.
- Smart Connect.
- Source health.

### Confirmed player-presentation and touch defects

- `NativePlayerSurface` currently fixes video to `contentFit="contain"` and exposes no user presentation choice.
- `EmbedPlayerSurface` sizes the outer WebView to the screen, but the nested provider iframe/video controls its own crop and aspect ratio.
- Orion cannot assume that resizing the WebView also fits the provider's video.
- Embedded HUD reveal partly depends on an injected page-level `TAP` message. Taps inside nested cross-origin frames do not reliably bubble to that listener.
- Native and embedded surfaces use separate overlay implementations, timers, gesture ownership, and control sets, so behavior diverges.
- Fullscreen and orientation changes are not yet validated against cutouts, system bars, source sheets, shield state, and reveal controls.

### Deferred corrective design

- Keep playback itself unchanged until the dedicated Adaptive Mobile UI phase.
- Add Orion-owned touch capture and a persistent reveal affordance above the provider surface; provider DOM taps cannot be the only recovery path.
- Expose Fit, Fill, Stretch, and Provider/Original modes through a source-capability contract.
- Use `contentFit` directly for native media. For embedded media, resize only the Orion viewport by default and apply provider-specific safe fitting only where verified; never inject destructive CSS blindly into unknown players.
- Persist the user's preferred mode per surface/source while falling back safely when a provider cannot support it.
- Drive both native and embedded overlays from the same explicit HUD reducer and verified telemetry state.

## 4. Mobile Provider Shield and Subtitles

### Confirmed limitation

The current player uses injected JavaScript and `onShouldStartLoadWithRequest`. This can:

- Remove visible DOM overlays.
- Block some navigation.
- Block some known advertising URLs.

It cannot reliably inspect every request made inside cross-origin iframes on Android. This explains why VidSrc and similar providers can still display advertisements.

### Required Android boundary

Build a custom native WebView module or prebuilt Android boundary using `WebViewClient.shouldInterceptRequest`.

It should:

- Load provider-specific rule profiles.
- Allow required media, manifest, subtitle, image, and CDN domains.
- Block known advertising and tracking hosts.
- Block unwanted popups, new windows, and unsafe top-level navigation.
- Report redacted allowed/blocked counts.
- Distinguish required playback dependencies from advertising exceptions.

Shield states:

- Verified.
- Limited.
- Disabled.
- Playback dependency allowed.
- Rule failure.

The UI must never claim verified protection merely because JavaScript rules were injected.

Subtitle handling should support:

- Provider language parameters.
- Embedded text-track detection.
- Captured VTT tracks.
- Orion external subtitle fallback.
- Provider-required subtitle hosts in the allowlist.

## 5. Smart Connect Architecture

### Preserve

The current working foundations should remain:

- Versioned command envelopes.
- WebSocket transport.
- Pairing sessions.
- Acknowledgements.
- Secure token persistence.
- Accurate basic laser movement on ordinary Desktop pages.

### Unified Control Surface

Replace separate Touchpad, D-pad, HUD, and Keyboard modes with one adaptive screen:

- Top: live Now Playing and scrubber.
- Center: persistent touchpad.
- Bottom: context-aware action rail.
- One finger: pointer movement.
- Tap: selection.
- Two fingers: scrolling.
- Optional D-pad: accessibility overlay.
- Keyboard action appears when Desktop reports a text field.
- Playback controls appear when Desktop reports an active player.
- Rare actions move into a More sheet.

Introduce a Desktop context contract:

```js
{
  route,
  focusedRole,
  playerActive,
  canSeek,
  canType,
  fullscreen,
  surfaceId
}
```

### Live playback telemetry

Desktop should publish:

```js
{
  sessionId,
  sequence,
  currentTime,
  duration,
  buffered,
  paused,
  volume,
  muted,
  title,
  mediaIdentity,
  canSeek,
  updatedAt
}
```

Policy:

- Send immediately after play, pause, seek, source change, and media change.
- Send approximately twice per second while an authenticated remote is connected.
- Stop high-frequency updates when no remote is connected.
- Mobile interpolates the progress pointer locally with monotonic time.
- Reconcile after each authoritative snapshot.
- Measure the actual scrubber width; do not use a hard-coded width.
- Commit a seek on release and reconcile after acknowledgement.

### Pairing

- Six-digit, single-use code.
- Five-minute expiry.
- Visible Regenerate action.
- QR and manual-IP fallback.
- Local discovery when available.
- Rate-limit failures and temporary lockout.
- Name, inspect, and revoke paired devices.
- Accurate connected, reconnecting, expired, and disconnected states.

### Transport security and latency hardening

The current Smart Connect v2 transport is authenticated but not encrypted. Desktop binds an HTTP/WebSocket server to the local network on port `8924`, and Mobile currently opens a URL shaped like:

```text
ws://desktop-ip:8924/api/socket?token=<pairing-token>
```

This is fast on a trusted home network, but it has release-blocking limitations:

- HTTP and WebSocket traffic can be observed or modified by another party on a hostile LAN.
- A reusable bearer token appears in the WebSocket URL and may be exposed to network tooling or logs.
- Desktop listens on every network interface, while network trust and firewall scope are not communicated clearly to the user.
- The HTTP server currently uses permissive CORS and does not provide a complete origin/device policy.
- Commands contain IDs and sequences, but the server does not yet enforce a monotonic replay window or retain applied IDs for exactly-once behavior.
- When a WebSocket acknowledgement is delayed, Mobile may retry through HTTP; without deduplication, a non-idempotent action could be applied twice.
- Automatic `/24` subnet probing is a compatibility fallback rather than a durable discovery protocol and can be slow or noisy.
- Orion's global Online latency badge measures internet reachability, not Smart Connect command latency.

Required v3 security outcome:

1. Establish an authenticated encrypted channel using certificate-pinned WSS or an equivalent audited session protocol.
2. Bind the paired device identity to its session key and move reusable credentials out of URLs.
3. Use the six-digit code only to confirm pairing, then rotate trust material and support revocation and migration.
4. Enforce sequence windows and cache completed command IDs across WebSocket/HTTP fallback long enough to guarantee one logical application.
5. Restrict exposure to appropriate local interfaces and give actionable Windows firewall/public-network guidance.
6. Prefer Android NSD/mDNS discovery, then the saved verified endpoint, with bounded subnet scanning as an explicit fallback.

Required performance observability:

- Stamp command creation, Desktop receipt, renderer application, acknowledgement, and Mobile receipt.
- Display Smart Connect latency separately from internet latency.
- Track median and p95 round-trip time, acknowledgement timeouts, reconnect duration, telemetry age, and dropped pointer frames.
- Keep pointer updates coalesced near 30 Hz rather than allowing stale movement to queue.
- Keep playback telemetry pushed over the persistent socket and interpolate progress locally between authoritative snapshots.
- Treat command application as immediate; HTTP polling remains recovery only and must not drive the normal remote experience.

No diagnostics may expose pairing tokens, session keys, IP credentials, full URLs, media cookies, or provider secrets.

## 6. Smart Connect Laser on Player Surfaces

### Confirmed root cause

The Desktop renderer creates `.orion-virtual-cursor` inside the main document in:

- `apps/desktop/src/renderer/app/App.jsx`

It then uses `document.elementFromPoint()` in that document.

This works on normal Desktop pages, but player modes can use different rendering or window surfaces:

- Default embedded player: guest `webContents`.
- Fullscreen player: fullscreen or composited guest surface.
- Mini-player: video/webview surface over the main document.
- Pop-out player: separate `BrowserWindow`.
- Maximized pop-out: separate window and coordinate space.

CSS `z-index` cannot solve a cross-window or cross-`webContents` ownership problem.

### Required solution

Create a main-process `RemotePointerSurfaceManager`.

It maintains a registry of:

- Main application.
- Embedded player.
- Mini-player.
- Pop-out player.
- Fullscreen player.
- Local-media player.

Responsibilities:

- Determine the active pointer target.
- Map normalized mobile coordinates into that target's content bounds.
- Display the laser through a transparent, click-through overlay above the target surface.
- Follow movement, resizing, maximization, fullscreen transitions, and handoffs.
- Transfer ownership automatically during embedded → mini → pop-out transitions.
- Route click input to the correct `webContents`.
- Hide on disconnect, inactivity, player destruction, or window closure.
- Return the applied `surfaceId`, normalized coordinates, and acknowledgement.

Suggested pointer acknowledgement:

```js
{
  commandId,
  sequence,
  surfaceId,
  x,
  y,
  applied: true,
  appliedAt
}
```

### Laser acceptance matrix

The laser must remain visible, accurately mapped, and clickable in:

- Ordinary Orion pages.
- Default embedded playback.
- Default fullscreen playback.
- Mini-player.
- Pop-out player.
- Maximized pop-out.
- Local video playback.
- Source changes.
- Player handoffs.
- Window movement and resizing.

## 7. Responsive UI and UX Audit

### Discover

Observed:

- Oversized menu trigger.
- Oversized search and segmented filters.
- Horizontal filters clip.
- Genre cards create excessive vertical card traffic.
- Fixed column calculations do not adapt sufficiently.

Recommended:

- 48–52 dp menu control.
- Compact page title and search hierarchy.
- Horizontally scrollable filter rails with edge fades.
- 104–128 dp genre tiles.
- Two columns on phones and three or four on tablets.
- Consistent safe gutters.

### Library

Observed:

- Fixed dimensions calculated outside render.
- Three-column phone grid is too narrow.
- History tab appears visually disabled.
- No Continue tab.
- No search, sort, or useful counts.

Recommended:

- `useWindowDimensions()`.
- Adaptive minimum card width.
- Two phone columns and four or more tablet columns.
- My List, Continue, and History tabs.
- Search and visible sort.
- Actionable empty states.

### Projector Silver Settings

Observed:

- Large black theme buttons conflict with the light-theme surface.
- Excessive vertical scrolling.
- Selected state is visually heavy.

Recommended:

- Two-column phone theme previews.
- Three-column tablet preview grid.
- Miniature surface/accent/text previews.
- Semantic theme colors rather than dark hard-coded cards.

### Episode list

Observed:

- Metadata and buttons overflow compact cards.
- Recommended tab clips.
- Offline information repeats for every episode.
- Description and action rows compete horizontally.

Recommended:

- Stack thumbnail and metadata on compact phones.
- One primary Play action.
- Compact Watched action.
- Overflow menu for secondary actions.
- One section-level Downloads Locked explanation.
- Horizontal or wrapped tabs with correct safe padding.

### Media detail

Observed:

- Hero, poster, title, and actions are too large simultaneously.
- Genre text truncates.
- Watch and secondary actions are visually unbalanced.

Recommended:

- Shorter phone hero.
- Adaptive poster/title composition.
- Full-width Watch action.
- Compact secondary action rail.
- Wrapping or scrolling genre chips.
- Multi-column tablet layout.

### Trailer sheet

Observed:

- Sheet is too tall and narrow.
- Trailer selector clips.
- Fallback actions can leave the visible viewport.

Recommended:

- Stable 16:9 player.
- Safe-area-aware sheet height.
- Scrollable candidates.
- Persistent action footer.

### Responsive breakpoints

- Compact phone: below 360 dp.
- Standard phone: 360–599 dp.
- Tablet: 600–899 dp.
- Large tablet/foldable: 900 dp and above.

Validate:

- Portrait.
- Landscape.
- Cutouts and safe areas.
- 200% font scaling.
- Reduced Motion.
- Hardware keyboard and focus.
- All six Orion themes.

## 8. Mobile Updates

Orion Mobile requires two independent update paths.

### JavaScript and asset updates

Use `expo-updates` with:

- Explicit runtime version.
- Preview and production channels.
- Staged rollout.
- Rollback.
- Clear update status and release notes.

OTA updates cannot add or replace incompatible native modules.

### Native application updates

For Play installations:

- Google Play Core flexible updates by default.
- Immediate updates only for critical security or incompatibility cases.

For signed side-loaded builds:

- Stable HTTPS release manifest.
- Version and minimum-supported version.
- SHA-256 checksum.
- Same Android signing certificate.
- Android-controlled installation confirmation.

Detect the installation source and choose the correct update flow.

Official references:

- [Expo Updates](https://docs.expo.dev/versions/latest/sdk/updates/)
- [Expo runtime versions](https://docs.expo.dev/eas-update/runtime-versions/)
- [Android in-app updates](https://developer.android.com/guide/playcore/in-app-updates)

## 9. Desktop Orion 3.0 Mobile Companion Center

Desktop should not receive a version-only bump. Orion 3.0 should introduce a complete Mobile Companion Center:

- Get Orion Mobile QR.
- Pair this device QR and code.
- Connected devices.
- Device name and last seen.
- Revoke and disconnect.
- Protocol compatibility.
- Mobile/desktop upgrade guidance.
- Cross-device profile synchronization status.
- Source and shield diagnostics.

Use separate QR purposes:

1. **Installation QR**
   - Stable Orion HTTPS landing page.
   - Current compatible APK/store destination.
   - Checksum and release notes.

2. **Pairing QR**
   - Local Smart Connect endpoint.
   - Short-lived pairing session.
   - No permanent credentials.

Maintain Smart Connect v2 compatibility during the protocol migration.

## 10. Google Authentication and Portable Profiles

Users should not need to create Google Cloud credentials.

Orion should ship application-owned OAuth client IDs:

- Android OAuth client.
- Desktop installed-application OAuth client.
- Same verified Google Cloud project.

Installed applications cannot safely protect a confidential client secret. Use:

- Android Credential Manager or system authorization.
- Desktop system-browser OAuth.
- PKCE where supported.
- Android Keystore/SecureStore.
- Electron `safeStorage`.

Official references:

- [Google OAuth for installed applications](https://developers.google.com/identity/protocols/oauth2/native-app)
- [Google OAuth overview](https://developers.google.com/identity/protocols/oauth2)
- [Android Sign in with Google through Credential Manager](https://developer.android.com/identity/sign-in/credential-manager-siwg-implementation)

### Portable Profile v3

Use a sharded, versioned profile rather than one last-write-wins blob:

- Manifest.
- Cinema My List.
- Cinema History.
- Playback Progress.
- Watched status.
- Music playlists and folders.
- Music favorites and history.
- Portable appearance and accessibility preferences.
- Tombstones.
- Per-device revision and timestamp.

Preserve unknown namespaces so an older client does not erase newer feature data.

Exclude:

- OAuth tokens.
- Provider cookies and credentials.
- Signed stream URLs.
- Smart Connect pairing secrets.
- Downloads.
- Local filesystem paths.
- Managed tools and caches.

Use Google Drive's hidden application-data boundary:

- [Drive `appDataFolder`](https://developers.google.com/workspace/drive/api/guides/appdata)

Merge records individually. Google sign-in or network failure must not block local browsing and playback.

## 11. Architecture and Structure

Split oversized Mobile modules into focused boundaries.

Suggested structure:

```text
apps/mobile/
├── app/
│   ├── media/[id].tsx
│   ├── player/[id].tsx
│   └── (tabs)/
│       ├── connect.tsx
│       ├── discover.tsx
│       └── library.tsx
│
└── src/
    ├── playback/
    │   ├── contracts.ts
    │   ├── sessionStore.ts
    │   ├── telemetry.ts
    │   ├── progressStore.ts
    │   ├── continueWatching.ts
    │   └── providers/
    │       ├── native.ts
    │       ├── frameVideo.ts
    │       └── providerMessages.ts
    │
    ├── trailers/
    │   ├── candidateRanking.ts
    │   ├── TrailerPlayer.tsx
    │   └── trailerErrors.ts
    │
    ├── player/
    │   ├── PlayerHud.tsx
    │   ├── PlayerRevealHandle.tsx
    │   ├── SourceSheet.tsx
    │   └── ShieldStatus.tsx
    │
    ├── smart-connect/
    │   ├── useSmartConnectSession.ts
    │   ├── useRemoteTelemetry.ts
    │   ├── UnifiedControlSurface.tsx
    │   ├── TouchpadSurface.tsx
    │   ├── ContextActionRail.tsx
    │   ├── NowPlayingRemote.tsx
    │   └── PairingSheet.tsx
    │
    ├── library/
    │   ├── LibraryTabs.tsx
    │   ├── ContinueWatchingRail.tsx
    │   └── HistoryList.tsx
    │
    └── responsive/
        ├── breakpoints.ts
        └── useResponsiveLayout.ts
```

Desktop additions:

```text
apps/desktop/src/main/smart-connect/
├── server.js
├── sessionStore.js
├── playbackTelemetry.js
├── remotePointerSurfaceManager.js
└── protocolCompatibility.js
```

## 12. Implementation Phases

### Phase 0: Safety and observability

- Preserve the current monorepo state with an atomic checkpoint.
- Split high-risk monoliths without behavior changes.
- Expand logging with redaction.
- Add baseline Android device tests.

### Phase 1: Playback truth

- Add `MobilePlaybackSession`.
- Add source-aware telemetry adapters.
- Add evidence classification.
- Persist verified playback events.

### Phase 2: History and Continue Watching

- Repair Library History to consume actual history.
- Separate watched, progress, and history.
- Add migrations.
- Add Home Continue Watching.
- Add Library Continue tab.

### Phase 3: Trailer reliability

- Preserve multiple candidates.
- Add candidate ranking and rotation.
- Preserve exact error codes.
- Repair player origin/client identity.
- Keep reliable external fallback.

### Phase 4: Smart Connect experience

- Add live telemetry.
- Replace manual control modes with Unified Control Surface.
- Repair real-width seeking.
- Add pairing regeneration and connection states.

### Phase 5: Player-surface laser

- Add `RemotePointerSurfaceManager`.
- Register every player surface.
- Add transparent click-through pointer overlays.
- Route clicks to the active `webContents`.
- Verify every handoff and fullscreen transition.

### Phase 6: Native shield

- Add Android request interceptor.
- Add provider-specific rules.
- Add shield evidence and diagnostics.
- Validate playback and subtitles for each source.

### Phase 7: Adaptive UI

- Recompose Discover, Library, Settings, Episodes, Media Detail, Trailer, Player, and Connect.
- Validate all breakpoints, themes, orientations, and accessibility modes.

### Phase 8: Desktop Orion 3.0 integration

- Add Mobile Companion Center.
- Separate install and pairing QR flows.
- Add protocol compatibility and device management.

### Phase 9: Portable profile and Google authentication

- Add application-owned OAuth clients.
- Add Portable Profile v3.
- Add record-level merging, tombstones, and migrations.
- Preserve offline-first behavior.

### Phase 10: Mobile updates

- Add runtime-safe OTA updates.
- Add Play/GitHub native update paths.
- Add signing and checksum verification.

### Phase 11: Release validation

- Clean-device installation.
- Existing-profile upgrade.
- Network interruption and offline tests.
- Source/shield live tests.
- Desktop/Mobile compatibility matrix.
- Signed Android production build.

Set both packages to 3.0.0 only after the complete acceptance matrix passes.

## 13. Test and Acceptance Matrix

### Playback

- Native direct media.
- Embedded movie and TV playback across the complete selectable source matrix.
- `frame-video` acceptance for Videasy, VidSrc, AutoEmbed, VsEmbed, and 111Movies.
- `player-event` acceptance for VidKing, VidLink, and VixSrc.
- Async/native AllManga resolution through its declared surface rather than the generic embedded route.
- Honest `unobservable` classification when a provider exposes no trustworthy timing evidence.
- Source failover.
- Pause, seek, resume, completion, and backgrounding.
- No fake progress for unobservable providers.
- Native Fit, Fill, Stretch, and Original presentation modes.
- Embedded Provider/Original fallback plus only provider-specific fitting that has been safely verified.
- Reliable HUD reveal when touches occur over a nested cross-origin provider frame.
- Overlay controls, source sheets, shield state, safe areas, and orientation changes without collisions.

### History and Continue Watching

- Started items enter History.
- Manual watched state remains independent.
- Progress survives restart.
- One latest episode appears per series.
- Resume uses the stored source and position where still healthy.
- Removing Continue Watching does not erase History.
- Clearing History does not erase My List or progress.

### Trailers

- First candidate succeeds.
- First candidate fails and second succeeds.
- Owner-disabled embed.
- Missing/removed video.
- Offline state.
- YouTube app and browser fallback.

### Smart Connect

- Pair, expire, regenerate, reconnect, revoke.
- Acknowledgement timeout.
- Touchpad and two-finger scroll.
- Live Now Playing.
- Smooth locally interpolated progress.
- Seek commit and reconciliation.
- Automatic keyboard and playback actions.
- Trusted and hostile LAN behavior.
- Encrypted-channel establishment and certificate/session-key verification.
- Token redaction and proof that no reusable credential appears in URLs or logs.
- Replay, out-of-order sequence, and duplicate WebSocket-to-HTTP fallback rejection.
- Network-interface change, Wi-Fi roam, sleep/wake, and Desktop restart recovery.
- Per-device rate limiting, malformed-message limits, and public-network firewall guidance.
- Separate command RTT and telemetry-age measurements with median and p95 evidence.
- NSD/mDNS discovery, saved-endpoint recovery, and bounded explicit subnet fallback.

### Laser

- Main pages.
- Default player.
- Fullscreen player.
- Mini-player.
- Pop-out.
- Maximized pop-out.
- Local player.
- Window move/resize.
- Player handoff and source change.

### Shield

- VidSrc and every supported provider.
- Known advertisements.
- Required media/CDN dependencies.
- Provider subtitles.
- Popups and unsafe navigation.
- Honest Verified/Limited/Failed states.

### Responsive and accessibility

- Compact phone.
- Standard 1080p phone.
- Tall/notched phone.
- Small tablet.
- Large tablet/foldable.
- Landscape playback.
- 200% font scaling.
- Reduced Motion.
- Screen reader.
- All six themes.

### Sync and updates

- First sign-in.
- Multi-device merge.
- Conflicting edits.
- Deletion tombstones.
- Offline edits followed by sync.
- OTA runtime compatibility.
- Native APK/store update.
- Interrupted and checksum-failed update.

## 14. Orion 3.0 Release Gates

Orion 3.0 is acceptable only when:

- Trailers either play inside Orion or provide an accurate, actionable fallback.
- Embedded playback generates honest History and progress where verifiable.
- Continue Watching exists and survives restart and profile synchronization.
- Smart Connect HUD remains current within one second during playback.
- Smart Connect uses an authenticated encrypted transport and never exposes reusable bearer credentials in plaintext URLs or logs.
- Smart Connect rejects replayed and duplicate commands, including WebSocket-to-HTTP fallback races.
- Smart Connect reports its own measured command latency separately from general internet latency.
- Remote seeks use measured geometry and reconcile with Desktop.
- The laser works on every player surface and every window mode.
- Shield status is evidence-based.
- VidSrc and other supported-provider advertising behavior is validated.
- Mobile layouts pass the full phone/tablet matrix.
- Google profile restoration preserves Cinema and Music data without exposing credentials.
- OTA updates cannot cross an incompatible native runtime.
- Native updates verify signatures/checksums.
- Desktop and Mobile upgrade safely from 2.0.1 profiles.
- Existing Desktop Cinema and Music behavior remains regression-free.

## 15. Deferred TV Casting

TV casting remains a separate milestone.

Smart Connect v3 may reserve:

- Device capability negotiation.
- Receiver type.
- Supported media formats.
- Handoff capability.

It should not yet claim casting support. Casting requires separate strategies for:

- Google Cast/Chromecast.
- DLNA/UPnP.
- AirPlay where feasible.
- Provider and stream compatibility.
- Subtitle and DRM restrictions.

Remote control and casting must remain distinct architectural capabilities.

## Final Verdict

Orion Mobile should not be rebuilt from scratch. Its functioning metadata, provider navigation, theme foundation, Smart Connect transport, command acknowledgements, and ordinary-page laser are valuable.

The correct v3 strategy is to preserve those foundations while replacing the unreliable boundaries:

1. Playback truth.
2. History and Continue Watching.
3. Trailer identity and candidate handling.
4. Live Smart Connect UX.
5. Player-surface pointer routing.
6. Native provider shielding.
7. Adaptive Mobile composition.
8. Portable cross-device profiles.
9. Runtime-safe updates.

This order prevents Orion from displaying invented progress, stale remote state, false shield confidence, or unreliable synchronization. It also creates the contracts needed for a later TV-casting milestone without prematurely coupling casting to Smart Connect.
