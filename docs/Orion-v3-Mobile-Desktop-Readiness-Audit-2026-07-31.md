# Orion v3 Mobile and Desktop Readiness Audit

**Audit date:** July 31, 2026  
**Starting audit baseline:** Orion Desktop 2.0.1 and Orion Mobile 2.0.1
**Proposed release:** Orion 3.0 with Mobile Companion support  
**Status:** Living reference audit and implementation roadmap; Phase 9 completion does not imply Orion 3.0 release readiness

## Living Roadmap Status

> **Overall Orion v3 implementation completion: 87%**
>
> **Last verified:** August 24, 2026
> **Release readiness:** Not ready  
> **Current stage:** Phases 0 through 9 are COMPLETE & LOCKED. Phase 10 Mobile downloads and Offline Library is the next active implementation phase; Phase 11 remains the deferred Orion Connect expansion and Phase 12 remains final release validation.
> **Critical open blockers:** a real resumable Mobile downloader and Offline Library; the explicitly deferred Orion Connect expansion in Phase 11; and the complete Phase 12 release-validation matrix.

The percentage is weighted by release risk. It is not based on the number of files changed or the number of visible screens. A high-risk playback or security phase contributes more than a small presentation task.

### Canonical Phase 7-8 reconciliation - August 21, 2026

This section is the current source of truth for the Phase 7 and Phase 8 boundary. Dated checkpoint sections later in this document preserve what was true at those earlier moments; any historical `NOT LOCKED` statement is superseded by the final locks below.

| Boundary | Canonical evidence | Verified result |
|---|---|---|
| Phase 7 implementation | Lock `437640f5e6c7d16d0dad2b020d34b06436731acd` (`checkpoint: lock post-Phase-7 mobile viewing foundation`) | Complete and locked on August 16, 2026 |
| Phase 7 archive/readiness | Commit `ec65bec235087cba72ed6388b8fa4be1c09289ef`; `docs/checkpoints/candidate-archives/Orion-Phase7-Candidates.zip`; archive SHA-256 `27865B59D381A72D915B955DE912169EAFF29DA52499C920233656D15C4474B7` | Accepted candidates are preserved; rejected Phase 7.10.2 remains archival only and is not part of the canonical lock |
| Phase 8 implementation | Lock `5b9cb7ad8824b24cecccc83f5cee52614c72a8ee` (`lock: complete Phase 8 cross-platform sync`) | Complete and locked on August 21, 2026 |
| Phase 8 final acceptance | Audit commit `9be060d0f0288e4c8fefdbd72dd1e04c19127d6e`; `docs/audits/ORION-V3-P8.7-PHASE-8-FINAL-LOCK-AUDIT.md` | Bidirectional My List, Watched, History and verified Progress sync, conflict recovery, account/profile fencing, data truth and production gates accepted |
| Phase 8 Android artifact | Bundled APK, 112.63 MB; SHA-256 `FB27A130BB383A5EDB6A140CB927149E3C48BE0B4F9260FACBB3F55EFFD48DAD` | Final Phase 8 Mobile artifact recorded and physically validated |
| Roadmap/repository alignment | Reconciliation commit `ca8e04130b60b81f3533f70a1d190fc550129a42`; local branch and upstream were aligned with a clean worktree before this audit amendment | 82.53% weighted completion, rounded to 83%; Phase 9 is the next active phase |

Phase 8 intentionally keeps Continue Watching as a local derived view, application preferences platform-local, and Music Planet Desktop-only. These are accepted scope decisions, not missing Phase 8 work.

**Phase 9 branch and lock boundary:** Phase 9 finalization is on `codex/orion-v3-p9-distribution-updates`. The latest pre-P9-F10 pushed checkpoint is `919f7b31f23bdc2a14201a8e044ca6f0bec413d3` (`checkpoint: prepare Phase 9 mobile 2.1.10 banner validation target`). That checkpoint is identity-only relative to Mobile 2.1.9 for the banner/updater implementation: only `apps/mobile/app.json`, `apps/mobile/package.json`, and `package-lock.json` changed.

### Canonical Phase 9 reconciliation - August 24, 2026

This section is the current source of truth for the Phase 9 boundary. Older Phase 9 Progress Log rows preserve what was accepted at those earlier checkpoints, but any older statement that treats Expo runtime updates or Play Core as a required Orion Mobile production path is superseded by the architecture below.

| Boundary | Canonical evidence | Verified result |
|---|---|---|
| Desktop distribution/update | Physically accepted configured 2.0.1 baseline -> real `v2.1.0` Preview detection -> Orion-owned download/self-update -> relaunch/current settlement; Get Orion Mobile exposed Preview version, Android `7.0+ / API 24`, installer readiness, direct signed APK action and installation QR | `V3-P9-001` through the Desktop portions of `V3-P9-007` accepted |
| Mobile production updater architecture | GitHub Preview/Stable release truth -> integrity/signer/package/version checks -> Orion-native APK download -> Android Package Installer -> in-place package replacement -> relaunch/current settlement | Native signed GitHub/APK updater is the sole Orion Mobile production application-update boundary |
| P9-F6 | Expo runtime update/recovery path was diagnosed and retired from production by architectural amendment; Play Core is not part of the current direct-GitHub distribution plan | **RETIRED BY ARCHITECTURAL AMENDMENT**, not fixed/green and not a remaining Phase 9 blocker |
| P9-F9 native lifecycle | Physical `2.1.7/code9 -> 2.1.8/code10` lifecycle passed; later `2.1.8/code10 -> 2.1.9/code11` also completed through Orion with preserved install history/state and resumed `com.okali.orion/.MainActivity` | **COMPLETE**; `adb install` was not used as updater-lifecycle evidence |
| Mobile 2.1.9 production artifact | APK SHA-256 `42C980B858DC93CC4DECB23F46CD93612D9DF6B473C49B266AE6FC26F7F683BF`; permanent signer SHA-256 `4422EC4BC16B1C83C914A0AD1B688BE8F7C158FF7F99BCD223A909966AC7A1BD`; integrity manifest SHA-256 `B2B4A273BDFA1BD8B19DEC5EF89C9110ABD3E22CFFDF9D885E9857DE59076822` | Installed through Orion and physically launched; banner implementation origin |
| Post-F9 Mobile banner parity amendment | Installed Mobile `2.1.9/code11` detected real Preview `v2.1.10`; full-width Orion/Desktop red banner, safe-area/Menu clearance, portrait/landscape behavior, `View Update`, dismiss and cross-platform visual grammar were physically accepted | **PHYSICALLY GREEN** |
| Mobile 2.1.10 trigger target | Source checkpoint `919f7b31f23bdc2a14201a8e044ca6f0bec413d3`; APK SHA-256 `7078FADC0D16E48FBD22BB57C9799018EB8B1B88B52231436B1B94969653C8B2`; code `12`; banner/updater source unchanged from 2.1.9 | Identity-only real Preview offer used to trigger the new banner. It is **not** claimed physically installed. |
| Phase 9 scoring | `V3-P9-001` through `V3-P9-010` reconciled against implementation, automated, package/release and physical evidence | Phase 9 `100%`; weighted contribution `5.0%`; Orion v3 exact total `87.28%`, rounded to `87%` |

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
| 4. Secure Orion Connect foundation | 8% | 100% | 8.0% | Complete at rebaselined scope |
| 5. Streaming safety and source reliability | 11% | 100% | 11.0% | Complete at accepted physical boundary |
| 6. Unified Mobile player experience | 10% | 100% | 10.0% | Complete / locked |
| 7. Complete Mobile UX and performance | 8% | 100% | 8.0% | Complete / locked |
| 8. Google identity and portable profiles | 6% | 100% | 6.0% | Complete |
| 9. Distribution, updates, availability and notifications | 5% | 100% | 5.0% | Complete / locked |
| 10. Mobile downloads and Offline Library | 8% | 10% | 0.8% | In progress |
| 11. Deferred Orion Connect expansion | 2% | 10% | 0.2% | Deferred |
| 12. Release validation | 4% | 7% | 0.28% | Foundation only |
| **Total** | **100%** |  | **87.28%, rounded to 87%** | **Not release-ready** |

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

### Phase 4 — Secure Orion Connect foundation

- [x] **V3-P4-001:** Use versioned command envelopes, authenticated acknowledgements and bounded retries.
- [x] **V3-P4-002:** Pair through QR, PIN and Direct IP recovery with matching-phrase trust.
- [x] **V3-P4-003:** Protect ordinary remote traffic with pinned WSS and device-bound identity.
- [x] **V3-P4-004:** Enforce replay rejection, command deduplication, rate limits and private-LAN policy.
- [x] **V3-P4-005:** Reconnect trusted devices and handle expiry, lockout, rename and revoke honestly.
- [x] **V3-P4-006:** Preserve a unified remote foundation with acknowledged commands and continuous ordinary-page touchpad movement.
- [x] **V3-P4-007:** Present source-aware playback capabilities without fabricating timing or command success.
- [x] **V3-P4-008:** Clear remote cursor and focus state on disconnect, revoke, timeout and renderer restoration.

Phase 4 is closed at this deliberately narrower, physically accepted foundation.
Automated work beyond the boundary remains preserved, but five failed or incomplete
physical outcomes are transferred to Phase 11 and are not represented as passed:

- startup remote Play may not apply before an embedded provider becomes ready;
- Desktop context may retain stale media after navigation away from playback;
- the current remote cursor appearance is unsuitable;
- pointer movement still needs latency refinement; and
- Mobile has no remote source selector.

This scope change awards no completion credit by itself. Historical Checkpoints
1–4, their rollback hashes and their physical findings remain unchanged in the
Progress Log.

### Phase 5 — Streaming safety and source reliability

- [x] **V3-P5-001:** Replace the initial limited JavaScript/top-level filtering boundary with the accepted Android-native Cinema shield foundation.
- [x] **V3-P5-002:** Add an Android-native request-interception boundary capable of observing provider subresources.
- [x] **V3-P5-003:** Add provider-specific ad, tracker, popup and unsafe-navigation rules. The final physical pass accepted popup/ad containment on the currently selectable providers without sacrificing stream startup.
- [x] **V3-P5-004:** Allow required manifests, media, images, CDNs, player dependencies and subtitle hosts without weakening top-level popup/navigation protection.
- [x] **V3-P5-005:** Validate every selectable provider through a maintained capability and health matrix.
- [x] **V3-P5-006:** Add failure classification and health-aware failover without losing verified playback state.
- [x] **V3-P5-007:** Complete the Phase 5 subtitle boundary: embedded text-track discovery and Orion external fallback are present. Safe opaque captured-VTT delivery and its player presentation move to Phase 6 and final release validation.
- [x] **V3-P5-008:** Revalidate VidKing startup/audio continuity and retain truthful restrictions until it passes. VidKing is Limited Resume and is not an automatic continuity target.
- [x] **V3-P5-009:** Classify WebView lifecycle, unexpected navigation abort, cache and GPU diagnostics. Remaining presentation/performance investigation moves to Phases 6, 7 and 12 and does not reopen the accepted shield.
- [x] **V3-P5-010:** Expose only evidence-backed Verified, Limited, Disabled, Dependency Allowed and Rule Failure shield states.
- [x] **V3-P5-011:** Physical Android testing confirmed that the repaired blocking rules preserve stream startup and playback while preventing the tested popup/ad escapes.
- [x] **V3-P5-012:** Close the Phase 5 provider/shield/playback matrix at the owner-accepted physical boundary. Exhaustive subtitle presentation and release regression matrices remain mandatory in Phases 6 and 12.

Phase 5 accepted source capability boundary:

- **Seamless continuity and automatic targets:** Videasy, VidLink, VixSrc and 111Movies.
- **Verified outgoing progress only:** VidSrc and VsEmbed; neither is an automatic carried-position target.
- **Limited manual continuity:** VidKing; provider-side jumps/glitches prevent automatic targeting.
- **Historical protection quarantine superseded:** the earlier AutoEmbed popup failure remains in the dated Progress Log, while the final owner-accepted Phase 5 pass confirms the repaired shield and working streaming boundary. Continuity ranking remains evidence-based and independent of shield status.

Phase 5 closed after owner physical testing confirmed that streaming remained
functional and popup/ad blocking worked. The yellow `Shield active` badge without
a numeric count is a presentation bridge limitation, not a protection failure:
native interception is working, but its evidence count is not yet delivered to
React reliably. The shield implementation is frozen at this accepted boundary.
Phase 6 owns a direct native view event for the HUD count, safe captured-VTT
delivery and responsive subtitle/shield presentation. Phase 12 retains the full
release regression matrix; neither item reduces Phase 5's accepted completion.

### Phase 6 — Unified Mobile player experience

- [x] **V3-P6-001:** Native and embedded Mobile playback surfaces and a shared Orion HUD foundation exist.
- [x] **V3-P6-002:** Drive native and embedded playback through one reachable HUD state machine.
- [x] **V3-P6-003:** Own touch/reveal handling outside cross-origin provider frames.
- [x] **V3-P6-004:** Add Fit, Fill, Stretch and Provider/Original presentation modes with truthful provider limits.
- [x] **V3-P6-005:** Correct portrait, landscape, fullscreen, tablet, foldable and cutout geometry.
- [x] **V3-P6-006:** Give the Mobile player explicit immersive system-bar ownership: hide Android status and navigation bars while watching; allow temporary reveal through the platform edge gesture; auto-hide them again during active playback; respect display cutouts and safe geometry; and restore normal system bars immediately on every playback exit, teardown or error path.
- [x] **V3-P6-007:** Recompose source, subtitle, shield, diagnostics and error sheets responsively, including safe opaque captured-VTT delivery.
- [x] **V3-P6-008:** Keep controls reachable while paused, buffering, seeking, switching sources or showing errors.
- [x] **V3-P6-009:** Unify loading, buffering and source-switch presentation without fake state.
- [x] **V3-P6-010:** Prevent overlapping Orion/provider controls, duplicate surfaces and duplicate audio.
- [x] **V3-P6-011:** Validate every provider and presentation mode with 200% text and Reduced Motion.
- [x] **V3-P6-012:** Deliver native shield evidence counters directly through the Android view event boundary to the unified HUD without depending on provider-page JavaScript or changing/blocking playback.

Historical Phase 6 checkpoint: the phase was open at 75% at this point. The controller, HUD, presentation preferences,
immersive Android ownership, mutually exclusive overlays, state-driven recovery
and native shield callback are implemented and automated. `V3-P6-005` and
`V3-P6-011` require the physical layout/provider matrix. `V3-P6-007` remains
open because embedded/external subtitle discovery is presented through opaque
identities, but captured subtitle bytes are not yet delivered through a safe,
session-bound VTT grant.

**Physical-acceptance repair (2026-08-13):** the embedded upper toolbar now
uses a separate user-intent chrome state (`initial`, `visible-explicit`,
`hidden`, `pinned-by-sheet`, `recovery`). Provider telemetry, buffering and
provider-page touches can no longer reveal or toggle it. The injected `TAP`
bridge was removed; a top-center handle is the sole reveal interaction and a
matching collapse handle remains available while visible. Sheets restore the
prior visibility intent, stale source sessions are ignored, and timers are
cancelled across source changes, backgrounding and teardown. This closes the
implementation defect only; no additional completion credit is awarded until
the physical eight-provider/orientation matrix passes.

**Final Phase 6 closeout:** COMPLETE & LOCKED. The older partial-status prose above is retained only as historical checkpoint context. Subsequent implementation, automated gates and accepted physical validation closed the remaining Phase 6 work before Phase 8 began.

### Phase 7 — Complete Mobile UX and performance

- [x] **V3-P7-001:** Six-theme semantic foundation and basic phone safe-area navigation exist.
- [x] **V3-P7-002:** Shared editorial headers and several Home, Discover, Library, Settings and detail surfaces are adaptive and theme-aware.
- [x] **V3-P7-003:** Finish compact-phone, phone, tablet, large-tablet, foldable and landscape layouts across all routes.
- [x] **V3-P7-004:** Complete Discover, Library, Settings, episode and Media Detail responsive composition.
- [x] **V3-P7-005:** Complete six-theme contrast and semantic-color validation, including Projector Silver and Custom.
- [x] **V3-P7-006:** Add watched movie, episode and season actions with badges, confirmation and undo.
- [x] **V3-P7-007:** Organize the drawer into Browse, Your Orion, Connect and System groups.
- [x] **V3-P7-008:** Complete screen-reader order, labels, visible focus and 44×44 dp targets.
- [x] **V3-P7-009:** Add list virtualization, image-memory limits and background-work throttling.
- [x] **V3-P7-010:** Add automatic Efficiency, Balanced and Quality performance profiles.
- [x] **V3-P7-011:** Meet measured startup, navigation, playback, memory and GPU targets on representative low-end Android hardware.
- [x] **V3-P7-022:** Reorganize Mobile Settings into scalable sections—Account, Appearance, Sync, Playback, Accessibility, Updates, Connect and Downloads—using Desktop Settings as a parity reference without copying desktop-only layout.
- [x] **V3-P7-023:** Add concise descriptions to every theme and bring Custom-theme controls toward supported Desktop parity while preserving responsive Mobile composition and live semantic-token updates.

**Final Phase 7 closeout:** COMPLETE & LOCKED. The older partial-status prose above is retained only as historical checkpoint context. Subsequent responsive-layout, six-theme, accessibility, watched-state, Settings-architecture and performance acceptance work completed before Phase 8 began.

### Phase 8 — Google identity and portable profiles

- [x] **V3-P8-001:** Desktop Google authentication/Drive backup and Mobile MMKV/SecureStore foundations exist.
- [x] **V3-P8-002:** Native Mobile storage fails safely instead of silently falling back to volatile production memory.
- [x] **V3-P8-003:** Add Orion-owned Android and Desktop OAuth clients; users never supply cloud credentials.
- [x] **V3-P8-004:** Add account-namespaced Mobile profiles and non-destructive anonymous-profile import.
- [x] **V3-P8-005:** Define and validate `PortableProfileV3` across Desktop and Mobile.
- [x] **V3-P8-006:** Synchronize My List, watched state, History and verified playback positions across supported Orion platforms; derive Continue Watching locally from synchronized playback truth.
<!-- V3-P8-006A-C3-2026-08-20 -->
  - **V3-P8-006A C3 checkpoint:** History and verified playback Progress now have steady-state cross-platform Orion Cloud synchronization after explicit enrollment. Desktop and Mobile reuse the existing PortableProfileV3/CloudProfileStore architecture, profile-scoped checkpoints, conditional writes, semantic read-back verification and existing Library owners.
  - **Continue Watching remains derived locally.** It is reconstructed from synchronized verified Progress and is not an independent Cloud namespace.
  - **C3 physical acceptance:** Mobile -> Desktop History/Progress propagation passed; Desktop -> Mobile propagation passed; Continue Watching re-derived correctly on the receiving device; Auto Sync OFF prevented automatic propagation; explicit Sync now reconciled successfully.
  - **Offline playback physical test:** N/A under the current streaming-only offline UX. Downloaded offline playback remains Phase 10 work. Automated offline/reconciliation safety remains required.
  - **C3 automated closeout:** Mobile 239/239 tests, 137-file source-size gate, Expo Doctor 20/20 and web export passed; Desktop 106/106 Node tests, 262/262 renderer tests across 59 files, source/binding/IPC/secret/theme/cycle gates and production build passed; Electron E2E passed 22/22 after repairing one stale hidden-Sidebar test-harness assumption.
  - **V3-P8-006 functional sync scope is complete.** Portable Preferences are intentionally excluded so Desktop and Mobile retain independent application preferences. Music Planet remains Desktop-only in Orion v3 and cross-platform Music synchronization is deferred until Mobile has a Music Planet product surface.
- [x] **V3-P8-007:** Add record revisions, merge rules and deletion tombstones.
- [x] **V3-P8-008:** Preserve offline-first operation and reconcile later without erasing unknown namespaces.
- [x] **V3-P8-009:** Exclude credentials, caches, downloads, signed URLs and machine-specific paths.
- [x] **V3-P8-010:** Keep tokens exclusively in platform secure storage and test account switching, interruption and rollback.
<!-- V3-P8-FUNCTIONAL-CHECKLIST-RECONCILIATION-2026-08-21 -->
  - **Phase 8 functional checklist reconciliation:** P8-003, P8-004, P8-005, P8-007, P8-008, P8-009 and P8-010 were re-audited after V3-P8-006 functional closure and are now reconciled to their implemented state.
  - OAuth/account evidence exists on Desktop and Mobile; Mobile Library ownership is account/profile scoped; PortableProfileV3 is the active shared profile contract.
  - My List, Watched and Viewing Activity carry revision/merge/deletion safety; steady-state synchronization is checkpoint-gated and network-aware; unrelated/unknown namespaces are preserved.
  - Portable user-data contracts exclude credential, signed-URL, provider, download-path and machine-specific data.
  - Platform secure-storage ownership, account/profile fencing and fail-closed interruption/recovery behavior are present.
  - This reconciliation changes roadmap bookkeeping only. No new runtime implementation was required.
  - Phase 8 functional checklist reconciliation remained open only for the mandatory pre-lock productization and P8.7 acceptance work, which subsequently completed and is recorded in the final lock audit.

<!-- PHASE-8-PRE-LOCK-PRODUCTIZATION-2026-08-20 -->
### Phase 8 pre-lock productization gates

Phase 8 must not lock immediately after the final functional synchronization domain. The following work is mandatory before the final Phase 8 lock.

1. **Count Semantics & Data Truth Audit**
   - Trace every displayed My List, Watched, History, playback-position/Progress, Continue Watching and Orion Cloud count to its real Desktop and Mobile owner.
   - Prove the population represented by every number before changing labels or layout.
   - Same data must use the same count. Different populations must use explicit language rather than being forced to match.
   - Library remains the user-facing content truth.
   - Settings -> Account communicates account and Orion Cloud synchronization truth.
   - Watched Library counts and Orion Cloud Watched record counts must be described according to their actual populations.
   - Continue Watching is a derived resumable view and must not be treated as numerically equivalent to the underlying playback-position records.
   - Any unexplained difference is a functional/data defect and must be resolved before presentation polish.

2. **Phase 8 production UI/UX polish**
   - Consistency over invention. Preserve Orion's established Desktop and Mobile interaction grammar.
   - Unify Mobile Settings -> Account, including account identity, Orion Cloud, synchronization domains, status hierarchy, Auto Sync, manual actions, review/conflict states and destructive actions.
   - Normalize user-facing state vocabulary across platforms: Set up, Synced, Syncing, Paused, Offline, Needs review, Check now / Sync now, Auto sync and Orion Cloud.
   - Replace backend-shaped wording such as generic Progress with clearer product language such as playback positions where appropriate.
   - Remove or rewrite developer-oriented product copy such as Manual status, portable state terminology, v1 checkpoint language and other implementation details.
   - Explicit Sync now must expose an active busy/Syncing state while the operation runs, then return to Paused when Auto Sync remains OFF.
   - Audit responsive behavior, accessibility, themes, spacing, typography, loading, disabled and busy states on both platforms.

**Pre-P8.7 checkpoint status, 2026-08-21:** COMPLETE for Count Semantics & Data Truth and production polish. Mobile Account productization, Desktop global media-state visibility, Desktop Account/Settings/title-detail consistency, accessibility repairs, passive Desktop Cloud pickup, and Viewing Activity steady-state recovery passed their accepted physical checks. P8.7 subsequently completed and Phase 8 is locked at `5b9cb7ad8824b24cecccc83f5cee52614c72a8ee`.

3. **Final P8.7 cross-platform audit**
   - Re-audit every Phase 8 requirement and locked boundary.
   - Require code, automated tests, production builds and physical evidence.
   - Do not declare Phase 8 locked while productization findings, Count Semantics & Data Truth findings or final audit requirements remain open.

**P8.7 final closure, 2026-08-21: COMPLETE & LOCKED.**

- Final P8.7 re-audit covered every Phase 8 requirement and locked boundary.
- Desktop -> Cloud -> Mobile and Mobile -> Cloud -> Desktop physical propagation passed for My List, Watched and Viewing Activity.
- Passive open-app remote discovery passed.
- Auto Sync OFF safety and explicit reconciliation passed.
- Deliberate My List, Watched and Viewing Activity conflict decisions passed with cross-domain isolation.
- P8.7 repaired shared PortableProfileV3 transaction serialization, bounded passive heartbeat behavior, namespace-scoped verification, the native Drive HTTP-400 update defect, passive retry churn and Mobile conflict/review dead-end UX.
- Final canonical Desktop and Mobile production gates passed; standalone Android production build passed.
- Canonical implementation lock: `5b9cb7ad8824b24cecccc83f5cee52614c72a8ee`.
- Local/remote lock SHA matched and the working tree was clean.
- Detailed evidence: `docs/audits/ORION-V3-P8.7-PHASE-8-FINAL-LOCK-AUDIT.md`.

### Phase 9 — Distribution, updates, availability and notifications

- [x] **V3-P9-001:** Desktop updater/status foundations are established and physically accepted against the real Preview release path, including genuine Desktop self-update and current/up-to-date settlement.
- [x] **V3-P9-002:** Desktop Get Orion Mobile provides a distinct installation QR and signed direct APK action; physical QR scanning reached the real GitHub APK.
- [x] **V3-P9-003:** Stable/Preview channel, latest Mobile version, minimum Android version and installer availability are presented from shared release truth.
- [x] **V3-P9-004:** Checking, available, rollout, downloading, verifying, installing, action-required, current, failed and unsupported states converge on canonical presentation truth; post-update badges settle correctly.
- [x] **V3-P9-005:** Production update architecture is accepted: Desktop uses the signed Preview self-update path and Mobile uses the native permanently signed GitHub/APK updater. Expo runtime updates are retired from Orion Mobile production by architectural amendment, and Play Core is outside the current direct-GitHub distribution plan.
- [x] **V3-P9-006:** Integrity manifest, artifact checksum, package/version identity and permanent Android signing identity are validated before Mobile installation.
- [x] **V3-P9-007:** Staged rollout eligibility, rollback/recovery semantics, clean release notes, retry/failure handling and restart/relaunch UX are implemented and accepted across the production update paths.
- [x] **V3-P9-008:** Local-first Android checks cover updates, sync failures, offline recovery, provider degradation, watchlist releases and availability changes.
- [x] **V3-P9-009:** Per-category controls, quiet hours, deduplication and whitelisted deep links are implemented and physically accepted.
- [x] **V3-P9-010:** Notification permission is requested contextually and per-device notification preferences persist locally.

**Phase 9 production architecture:** Google Play / Play Core is not part of Orion Mobile's current distribution plan. Expo runtime updates/recovery are also retired from production under the P9-F6 architectural amendment. The sole production Mobile application-update path is the permanently signed direct GitHub APK lifecycle: canonical release discovery -> eligibility/rollout -> integrity/signer/package/version verification -> Orion-native download -> Android installer handoff -> in-place replacement -> relaunch/current settlement. P9-F9 is complete. The post-F9 Desktop-parity Mobile banner amendment is physically green. `v2.1.10` remains an identity-only trigger target and is not claimed physically installed.

### Phase 10 — Mobile downloads and Offline Library

- [ ] **V3-P10-001:** Replace the engineering-oriented locked page with a premium, six-theme Downloads surface; keep Download actions disabled until the corresponding candidate and engine paths pass validation.
- [x] **V3-P10-002:** Add versioned `MobileDownloadCandidateV1`, `MobileDownloadJobV1`, `MobileDownloadAssetV1` and `OfflineMediaEntryV1` contracts with non-sensitive, restart-safe persistence.
  - **P10.1 checkpoint (2026-08-24):** `V3-P10-002` is complete at `9a105730d6d18d122d9553ebd19eff86b1f36dda`. The product surface and dual-destination foundations for `V3-P10-001` and `V3-P10-014` are implemented, but those contracts remain open for later physical/native acceptance.
- [x] **V3-P10-003:** Capture download candidates within the active playback session and classify direct video, HLS, DASH and MIME-detected extensionless media without exposing raw URLs, cookies or credentials to presentation code.
- [x] **V3-P10-004:** Preflight candidate reachability, expiry, request context, manifest shape, storage requirements and DRM/protection status; unsupported or protected media remains unavailable with an honest reason.
- [x] **V3-P10-005:** Build an Android-owned foreground download service with WorkManager recovery, durable queue ownership, progress notifications and restart/reboot continuation.
- [x] **V3-P10-006:** Implement the accepted Mobile production transfer boundary: authorized finite HLS/DASH fragment acquisition with bounded concurrency and deterministic fragment accounting. Direct execution is retired from Mobile production after physical evidence, and live/changing/open-ended manifests fail closed until a bounded finalizable refresh contract exists.
- [x] **V3-P10-007:** Add a narrow job-scoped request-context broker for providers that require the active WebView's permitted headers/cookies; it may access only the selected manifest and discovered descendants and must never become a general proxy.
  - **P10.2 checkpoint (2026-08-24):** `V3-P10-003`, `V3-P10-004` and `V3-P10-007` are complete at `5d7aec10b9b73cdedb0cde6f00dd6a60c5227fdf`. Real Videasy and VidSrc playback physically proved Fabric-scoped session delivery, subresource observation, direct/HLS/extensionless classification, truthful ready/unsupported/action-required preflight, descendant-origin fail-closed behavior and real `contextReady=true` candidates without diagnostic credential leakage. The remaining `ViewManagerPropertyUpdater` warning is non-blocking because direct runtime evidence proves Orion's Fabric delegate is receiving and applying the custom capture prop.
  - **P10.3 acceptance (2026-08-24):** `V3-P10-005`, `V3-P10-006`, `V3-P10-008` and `V3-P10-009` are complete at the native-engine boundary. Signed Preview `2.1.16/code18` physically proved multi-provider HLS capture for VidSrc, Videasy, VidKing, VixSrc and VSEmbed, real fragmented transfer, foreground notification progress truth, pause/resume, retained-fragment network recovery and verified Movie/TV completion. Candidate 6 then closed Retry All, battery/storage WorkManager policy and optional Phase 9 Downloads completion/failure/action-needed alerts with focused `52/52`, full Mobile `384/384`, 169-file source-size, Expo Doctor `20/20`, web export and Android compile green. Production Direct remains retired and finite HLS/DASH is the accepted Mobile transfer boundary. `V3-P10-014` remains open for P10.4 Device Storage fragment finalization / dual-destination product completion; full interruption/reboot/low-storage/subtitle/expiry/integrity matrices remain `V3-P10-016`.
- [x] **V3-P10-008:** Add pause, resume, retry, cancel, retry-all and durable recovery policy after network loss, application termination, reboot, low battery and storage pressure. Full representative interruption/reboot/low-storage matrix remains `V3-P10-016`.
- [x] **V3-P10-009:** Validate completed assets before atomic finalization; detect missing/empty/range-mismatched fragments, finalization/index failures and corrupt fragmented metadata, retain repairable partial jobs, and never report false completion. Monolithic-container validation is required only when a future finalizer emits a monolithic container.
- [ ] **V3-P10-010:** Preserve supported audio tracks, embedded/captured subtitles, episode identity, artwork and source attribution beside the downloaded asset.
- [ ] **V3-P10-011:** Build adaptive queue, active, completed and failed views with search, filters, sorting, storage usage, per-job diagnostics and clear recovery actions across all six themes.
- [ ] **V3-P10-012:** Add an Offline Library and route completed assets through Orion's unified native player with seek, subtitles, audio selection, playback speed and honest unsupported-format diagnostics.
- [ ] **V3-P10-013:** Integrate offline playback with History, Continue Watching, watched state and the existing Resume dialog without requiring network access.
- [ ] **V3-P10-014:** Use Android scoped storage and user-selected destinations without broad legacy storage permission; verify free space before starting and before final processing.
- [ ] **V3-P10-015:** Back up portable download metadata only; exclude media bytes, partial fragments, credentials, signed URLs, cookies and machine-specific paths from Google profiles.
- [ ] **V3-P10-016:** Pass direct/HLS/DASH, interruption, reboot, low-storage, subtitles, source expiry, integrity, offline playback, deletion and upgrade matrices on representative Android devices.

Desktop is the behavioral reference, not reusable Mobile implementation. Its proven
pattern is scoped `CaptureSession` detection, opaque candidates, preflight, captured
browser request context, a per-job restricted HLS proxy, managed fragmented tools,
durable records and local playback. Mobile must recreate those boundaries with
Android-native services and Media3-compatible download/playback components rather
than attempting to run Electron session code or silently bundling unrestricted
Desktop tooling.

### Phase 11 — Deferred Orion Connect expansion

- [x] **V3-P11-001:** Secure pairing, acknowledged transport and ordinary-page remote-control foundations remain available from Phase 4.
- [ ] **V3-P11-002:** Repair provider-ready startup Play without relying on the remote cursor.
- [ ] **V3-P11-003:** Clear or replace stale Desktop playback context after navigation away from media.
- [ ] **V3-P11-004:** Replace the raw cursor treatment with a polished theme-aware Orion cursor.
- [ ] **V3-P11-005:** Reduce pointer latency while preserving encrypted delivery, replay protection and bounded queues.
- [ ] **V3-P11-006:** Add Mobile source selection from Desktop's live healthy-provider catalog.
- [ ] **V3-P11-007:** Add player-surface cursor ownership for embedded, fullscreen, mini, pop-out and local players.
- [ ] **V3-P11-008:** Transfer cursor ownership safely across player handoffs, window movement and teardown.
- [ ] **V3-P11-009:** Finish Mobile Companion Center and advanced device/status presentation.

### Phase 12 — Release validation

- [x] **V3-P12-001:** Basic Mobile, Desktop and Smart Connect automated gates exist.
- [ ] **V3-P12-002:** Pass the complete provider, ad-shield, failover and subtitle matrix.
- [ ] **V3-P12-003:** Pass player fitting, overlay touch, orientation, cutout and accessibility matrices.
- [ ] **V3-P12-004:** Pass low-end startup, navigation, memory, GPU and playback validation.
- [ ] **V3-P12-005:** Pass Google profile migration, merge, conflict and offline-recovery tests.
- [ ] **V3-P12-006:** Pass signed installation, update, rollback and release-channel tests.
- [ ] **V3-P12-007:** Pass notification permission, quiet-hours, deduplication and deep-link tests.
- [ ] **V3-P12-008:** Pass Mobile download capture, fragment recovery, integrity, scoped-storage and offline-playback matrices.
- [ ] **V3-P12-009:** Install signed Desktop and Android builds on clean devices.
- [ ] **V3-P12-010:** Upgrade copied 2.0.1 profiles and active/partial download records without data loss or false completion.
- [ ] **V3-P12-011:** Confirm no Cinema, Music Planet, Desktop downloads, trailers or secure Connect regressions.

## Checklist ID Migration — August 11, 2026 Rebaseline

Historical checklist IDs and Progress Log rows remain valid evidence for the
scope they described at that time. The table below redirects unfinished work;
it does not retroactively rename old commits, rewrite old evidence or award
completion credit.

| Previous checklist scope | Revised destination | Migration rule |
|---|---|---|
| Old `V3-P4-001`–`V3-P4-004`, `010`, `019`, `021`, `022` and physically accepted secure foundations from Checkpoints 2–4 | Revised Phase 4 | Closed only at the accepted secure-foundation boundary. |
| Old incomplete `V3-P4-005`–`V3-P4-009`, `011`, `012`, `018`, plus failed startup Play, stale context, cursor quality and pointer-latency findings | Revised `V3-P11-002`–`V3-P11-006` | Deferred, not passed. Security mechanisms retained by revised Phase 4 are not reopened. |
| Old `V3-P5-001`–`V3-P5-010` player-surface laser | Revised `V3-P11-004`, `V3-P11-007`, `V3-P11-008` | Deferred until the core Mobile experience is complete. |
| Old `V3-P6-001`–`V3-P6-010` native shield | Revised `V3-P5-001`–`V3-P5-012` | Expanded to include source health, failover, subtitles and provider diagnostics. |
| Old `V3-P7-012`–`V3-P7-015` player fitting/HUD ownership | Revised Phase 6 | Becomes the dedicated unified Mobile player phase. |
| Old `V3-P7-016` and `V3-P7-020` provider/lifecycle diagnostics | Revised `V3-P5-008`, `V3-P5-009` | Moves into source reliability before player presentation work. |
| Old `V3-P7-001`–`V3-P7-011`, `017`–`019` | Revised Phase 7 | Retains UI, watched-state, drawer, accessibility and performance evidence. |
| Unfinished `V3-P7-021` locked Downloads copy plus the previously deferred Mobile downloader | Revised Phase 10 | Becomes a complete downloader, fragment recovery, Offline Library and offline-playback milestone; the locked page alone earns no completion. |
| Old `V3-P8-002`–`V3-P8-006` Desktop companion/install/status work | Revised Phase 9 or Phase 11 | Installation/update status moves to Phase 9; advanced Connect presentation moves to Phase 11. |
| Old `V3-P9-001`–`V3-P9-012` portable profile/authentication | Revised Phase 8 | Same ownership outcome, moved earlier. |
| Old `V3-P10-001`–`V3-P10-008` Mobile updates | Revised Phase 9 | Combined with distribution, availability and notifications. |
| Old `V3-P11-001`–`V3-P11-012` | Revised Phase 12 | Expanded release gate; existing evidence remains foundational only. |

The reweighted tracker remained at 54% when this rebaseline was recorded because
reordering itself earned no credit. Revised Phase 4 is complete only because its
scope was narrowed to the accepted secure foundation; every excluded failed
outcome remains open in Phase 11. Phase 10 adds an essential Mobile downloader
without awarding completion for roadmap text alone. Phase 5 subsequently closed
at its physically accepted boundary; Phase 6 later completed and locked before Phase 8.

## Progress Log

Every roadmap update should add one row. Do not delete older entries.

| Date | Checklist IDs | Change | Evidence | Overall completion |
|---|---|---|---|---:|
| 2026-08-24 | P10.3; V3-P10-005, V3-P10-006, V3-P10-008, V3-P10-009; V3-P10-014 native foundation | Completed and physically accepted the Android-owned Mobile fragment engine at the P10.3 boundary. Mobile now captures and ranks multiple ready HLS/DASH candidates, executes finite HLS/DASH fragments with durable native progress, foreground ownership, pause/resume/retry/retry-all/cancel, network/battery/storage recovery policy, verified-fragment retention, integrity gating and atomic Orion Library fragmented-bundle finalization. Direct production execution is retired; changing/live/open-ended manifests fail closed. | Candidate 5/2.1.16 physical acceptance on S24 Ultra: VidSrc, Videasy, VidKing, VixSrc and VSEmbed all HLS-ready; real VidSrc + Videasy transfer; native notification title/progress/fragments/size/speed/ETA; pause/resume; paused Active semantics; network interruption recovery; verified Movie and TV episode completion. Candidate 6 focused `52/52`; full Mobile `384/384`; source-size 169; Expo Doctor `20/20`; web export; Android compile green; Candidate 6 keeps 2.1.16/code18 identity and transfer core unchanged. | 87% |
| 2026-08-24 | P10.2; V3-P10-003, V3-P10-004, V3-P10-007 | Completed active-playback download-candidate capture, real provider preflight and the narrow request-context security boundary. Fabric custom-prop delivery was physically repaired without creating a parallel WebView architecture. Videasy and VidSrc produced real direct/HLS/extensionless candidate truth, including ready, unsupported and action-required states. | Candidate checkpoint `3a84de3e7383551e5f86d16be6c48c9cddb237ce`; trace checkpoint `684c2903cb1675f212a63b4ef0ed64a38a34e58c`; accepted Fabric repair `5d7aec10b9b73cdedb0cde6f00dd6a60c5227fdf`; focused P10.2 `13/13`; native compile green; signed `2.1.13/code15` Preview APK SHA-256 `1FA3993724EED6AFC3DD4DE4671B4916840AF00EA265BD1A0A8C815E856072C7`; representative Videasy -> VidSrc physical source-switch pass; three ready `contextReady=true` candidates; redaction green. | 87% |
| 2026-08-24 | P10.1; V3-P10-002; V3-P10-001/V3-P10-014 foundations | Completed the P10.1 product, contract and destination-ownership foundation. Added the four versioned Mobile download contracts, restart-safe non-sensitive persistence, canonical state/progress truth, exact episode identity, dual destination settings, premium honest Downloads foundation and Downloads notification ownership under the existing Phase 9 notification architecture. `V3-P10-002` is complete; `V3-P10-001` and `V3-P10-014` remain open. | Checkpoint `9a105730d6d18d122d9553ebd19eff86b1f36dda`; executable P10.1 acceptance 12/12; full Mobile 332/332; typecheck; 162-file source-size; Expo Doctor 20/20; production web export; shared contract strict compile; exact 22-file commit; local/remote SHA equality; clean worktree. | 87% |
| 2026-08-24 | P9-F10; V3-P9-001-V3-P9-010 | Reconciled the complete Phase 9 evidence into the Master Audit: all ten Phase 9 checklist contracts are complete under the accepted direct-distribution architecture; Phase 9 is scored at 100% / 5.0 weighted points and the Orion v3 exact total becomes 87.28% (87% rounded). | Canonical Phase 9 authorities plus the pre-P9-F10 pushed checkpoint `919f7b31f23bdc2a14201a8e044ca6f0bec413d3`; this row becomes canonical only with the exact audit/document checkpoint, successful push, local/remote SHA equality and clean worktree required by the Phase 9 lock contract. | 87% |
| 2026-08-24 | P9-F9; V3-P9-004-V3-P9-007 | Completed and physically accepted the native Mobile updater lifecycle and final update-announcement consistency. Orion performed in-app signed APK replacement through Android Package Installer with preserved install history/state, settled Current/Up-to-date after relaunch, and later installed `2.1.9/code11` from `2.1.8/code10`. The Desktop-parity red Mobile banner was then physically accepted from installed 2.1.9 against the real identity-only `v2.1.10` Preview target in portrait and landscape, with Menu clearance, `View Update` and dismiss behavior accepted. | 2.1.9 APK SHA-256 `42C980B858DC93CC4DECB23F46CD93612D9DF6B473C49B266AE6FC26F7F683BF`; permanent signer `4422EC4BC16B1C83C914A0AD1B688BE8F7C158FF7F99BCD223A909966AC7A1BD`; 2.1.10 APK SHA-256 `7078FADC0D16E48FBD22BB57C9799018EB8B1B88B52231436B1B94969653C8B2`; user physical acceptance of the real production update/banner path. `2.1.10` is not claimed installed. | Phase 9 closure evidence; final Master Audit lock still pending at this checkpoint |
| 2026-08-24 | P9-F6 architectural amendment; V3-P9-005 | Retired Expo runtime update/recovery from Orion Mobile production after the Phase 9 diagnosis. Play Core remains outside the current direct-GitHub distribution plan. The native permanently signed GitHub/APK updater is the sole Mobile production application-update and recovery boundary. | P9-F continuation override and production-update validation plan; historical Expo failure evidence retained without representing the retired path as green. | No percentage change by architecture text alone |
| 2026-08-22 | P9.3; V3-P9-008-V3-P9-010 | Accepted P9.3 Availability & Notifications: local-first availability checks, contextual notification permission, per-device category preferences, quiet hours, persistent deduplication, whitelisted deep links and physically accepted 12-hour AM/PM quiet-hours control. The broader Notifications/Updates restructuring and production-language polish named here were subsequently closed by P9-F. | P9.2 + P9.3 focused regression 19/19 and initial full Mobile/Android candidate gates; final quiet-hours UX amendments passed focused 6/6, typecheck, source-size and `git diff --check`; production APK SHA-256 `3BA46D5E83B0A27DBD5E6CC84405D31D8D33028CD2E46E5202CA8CA9E4B588BA`; permanent signer SHA-256 `4422EC4BC16B1C83C914A0AD1B688BE8F7C158FF7F99BCD223A909966AC7A1BD`; same-signer `adb install -r` and S24 Ultra physical notification/deep-link/quiet-hours acceptance | 86% |
| 2026-08-22 | P9.2; V3-P9-004-V3-P9-006; V3-P9-007 foundations | Historical P9.2 checkpoint: Desktop integrity hardening, signed direct Android APK execution, and the then-current runtime-compatible Expo update/recovery path were accepted at this stage. The Expo path was later retired by the P9-F6 architectural amendment; Play Core remains outside Orion's direct-GitHub distribution plan. | Checkpoints `5c1bc4adea04b3446e801e092b2b3c6e9848b6fc`, `b0188a532506b82f71faaf483dd3552d100e6db1`, `5229a586923ec58b44c55b50de986a93c41afd17`; package/version/hash/permanent-signer verification; S24 Ultra physical update validation | 85% |
| 2026-08-22 | P9.1; V3-P9-001-V3-P9-006 foundations | Accepted P9.1 Distribution & Release Truth: dedicated Desktop Get Orion Mobile ownership, shared Stable/Preview truth, Mobile Updates productization, permanent Android release signing and integrity foundations without falsely publishing a Mobile release | docs/audits/ORION-V3-P9.1-DISTRIBUTION-RELEASE-TRUTH-AUDIT.md; Shared/Desktop/Mobile gates green; signed APK SHA-256 785EA4D68A5243B42D68C6D6897711D978931267E1A1007DC1A674F4F346824F; production-signer in-place S24 Ultra validation | 83% |
| 2026-08-21 | V3-P8-001-V3-P8-010, P8.7 | Completed final Phase 8 cross-platform audit, physical bidirectional sync/conflict/isolation acceptance, canonical production gates and implementation lock | Lock `5b9cb7ad8824b24cecccc83f5cee52614c72a8ee`; final lock audit in `docs/audits` | 83% |
| 2026-08-16 | V3-P7-001-V3-P7-011, V3-P7-022, V3-P7-023 | Locked the complete Mobile UX/performance boundary and preserved the accepted Phase 7 candidate history before Phase 8 | Implementation lock `437640f5e6c7d16d0dad2b020d34b06436731acd`; archive/readiness commit `ec65bec235087cba72ed6388b8fa4be1c09289ef`; candidate archive SHA-256 `27865B59D381A72D915B955DE912169EAFF29DA52499C920233656D15C4474B7` | Historical Phase 7 boundary; current total 83% |
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
| 2026-08-09 | V3-P4-010, V3-P4-019, V3-P4-021, V3-P4-022 implementation checkpoint | Implemented bounded Android-native NSD/mDNS discovery, saved-endpoint-first reconnection, explicit connection and pairing failure states, structured expiry/lockout recovery, responsive keyboard-safe pairing, and authenticated rename/revoke management on Mobile and Desktop. Automatic 253-address probing was removed; subnet discovery is now an explicit advanced fallback. No completion credit is awarded before physical-device acceptance. | Rollback checkpoint `5e22ac5`; implementation checkpoints `7aa3d73` and `43a3cbe`; Mobile typecheck; 68/68 tests; 79-file source-size gate; Expo Doctor 20/20; production web export; Expo prebuild; corrected standalone Android APK with compiled Orion NSD module and verified 4,705,085-byte `assets/index.android.bundle`, SHA-256 `2D251A03652CCCA4A855FF0FB9D0A8031ED56C2A146CB84C513518B645A5E289`; Desktop source/binding/IPC/secret/theme/cycle gates, 53/53 Node tests, 138/138 renderer tests and production build. The earlier `656D667F...` debug artifact was invalid because it omitted the JavaScript bundle and has been superseded. Physical NSD, lifecycle, keyboard, expiry, lockout, rename, revoke and six-theme validation remains open. | 52% |
| 2026-08-09 | Phase 4 Checkpoint 1 packaging correction | Corrected the Android standalone builder after physical installation proved that `assembleDebug` had skipped React Native bundling and produced a Metro-dependent APK. The builder now creates a minified production bundle first, assembles the debug-signed native application, inspects the APK archive, and fails unless `assets/index.android.bundle` is present. It publishes a distinctly named standalone artifact to prevent confusion with Gradle's ordinary Debug output. | 68/68 Mobile tests, including standalone-build regression guards; archive verification confirmed `assets/index.android.bundle` at 4,705,085 bytes inside the 105,563,769-byte APK; SHA-256 `2D251A03652CCCA4A855FF0FB9D0A8031ED56C2A146CB84C513518B645A5E289`. No roadmap completion credit awarded. | 52% |
| 2026-08-09 | Phase 4 Checkpoint 1 responsive-pairing follow-up | Corrected phone-landscape classification across the Mobile shell by using the shortest viewport edge, bounded Connect controls inside a scrollable landscape layout, and adjusted Home, Discover, Library, Downloads, shared headers and media-card density for rotated phones. Direct IP now discovers/verifies a Desktop and reconnects an existing trusted session; an untrusted endpoint proceeds to the single PIN flow instead of duplicating PIN entry. Desktop Connect visibly reports its current address. Pairing failures now expose a descending attempts counter, enter a timed lockout after the fifth failure, and persist attempts/lockout across Connect and application restarts on both Desktop and Mobile. | Mobile TypeScript passed; 71/71 tests passed; 82-file source-size gate passed; Expo Doctor 20/20 passed; production web export passed. Physical phone/tablet portrait and landscape validation, automatic discovery, attempt countdown, process-restart persistence and final standalone APK verification remain required, so no completion credit is awarded. | 52% |
| 2026-08-09 | V3-P4-010, V3-P4-019, V3-P4-021, V3-P4-022 | Closed Checkpoint 1 after the user physically accepted trusted discovery/reconnection, expiry and lockout UX, remembered-device management, keyboard-safe pairing and responsive phone/landscape behavior. | User physical-device acceptance following the standalone APK and responsive-pairing fixes; checkpoints `f34b14d` and prior implementation commits recorded above. | 54% |
| 2026-08-09 | Phase 4 Checkpoints 2–4 implementation | Added authoritative Desktop UI/playback context and telemetry, freshness-aware Mobile interpolation, measured acknowledged seeking, a persistent-touchpad adaptive remote, context-aware actions, protected-field typing rules, protocol-v3 pinned HTTPS/WSS, ECDSA Desktop identity, Android Keystore identity, matching-phrase trust, single-use tickets, private-LAN/public-profile policy, and replay/duplicate/rate-limit enforcement. Physical security, latency, device-layout and packaged Desktop acceptance remains open, so Phase 4 does not advance beyond 60%. | Checkpoints `f9562f1`, `2305893`, `5d49264`; Mobile typecheck, 79/79 tests, 89-file size gate and production web export passed; secure trust 5/5 tests and focused Smart Connect Electron test passed; Desktop source/binding/IPC/secret/theme/cycle/Node/renderer/build gate passed; full Electron suite passed 12/14 with Smart Connect green and two unrelated quick-search timing failures (one passed on isolated retry, one remains). Standalone APK: 110,289,054 bytes, SHA-256 `FABC15D210442D48F14769FC68FC6DE38AE70FF21942D3E06842D0BD765099DE`. | 54% |

| 2026-08-11 | Phase 4 pointer and command latency recovery implementation | Removed the telemetry-driven touch-target remount by extracting a stable memoized touchpad and isolated playback/action components. The parent scroll surface now yields while the touchpad owns a gesture. Pointer and two-finger scroll traffic share a latest-state scheduler near 30 Hz with an immediate first update and stale-state cleanup. Reliable command waiters are installed before transport send and accept acknowledgements only for the matching command sequence, device and connection. Production one-second diagnostics are disabled unless explicitly opted in. Protocol-v3 trust, WSS, replay protection and pairing remain unchanged. Physical latency acceptance is still required, so Phase 4 remains at 60%. | Safety checkpoint `7a0bbb4`; Mobile typecheck; 80/80 tests; 90-file source-size gate; production web export; Desktop source/binding/IPC/secret/theme/cycle gates, 58 Node tests, 139 renderer tests and production build; standalone bundled APK 110,260,295 bytes, SHA-256 `60F586B12BA30FA52FE988D914F1C6F9BF526E328A4DB06025FB670968BD6762`. Expo Doctor passed 18 local checks; two online catalog checks were blocked by the validation sandbox. Continuous 60-second pointer, command RTT and six-theme device acceptance remain open. | 54% |
| 2026-08-11 | Phase 4 source-aware final-acceptance implementation | Added exact Cinema source/session control targeting, bounded player readiness, idempotent Play/Pause, provider-accepted acknowledgement truth, stale-target rejection and cancellation-safe source changes. Mobile now exposes the provider label and readiness, suppresses fabricated timing and unsupported controls, keeps Back/Home/More available, uses a denser responsive playback/touchpad composition, and renders a lightweight Orion arrow cursor with target-change-only hover/press feedback. Pointer delivery adapts between 24, 30 and 40 Hz while retaining only the newest unsent realtime update. Protocol-v3 WSS, device trust and replay protection remain unchanged. Physical acceptance is still required; Phase 4 remains at 60% and Orion v3 at 54%. | Mobile typecheck; 81/81 tests; 90-file source-size gate; production web export; Desktop source/binding/IPC/secret/theme/cycle gates, 58/58 Node tests, 139/139 renderer tests and production build; `git diff --check` passed. Expo Doctor passed 18 local checks while two online catalog checks were unavailable under restricted validation egress. Standalone bundled APK `orion-mobile-standalone.apk`: 110,265,648 bytes, SHA-256 `11EE916E88AD7D5805388A7A73C5CD0D5435CF44FECC4E4952DA809ED690CEC0`; archive verification confirmed `assets/index.android.bundle`. Provider acceptance, continuous-pointer gaps, RTT/p95, six-theme layouts and packaged-Desktop security regression remain open. | 54% |
| 2026-08-11 | Orion v3 post-Phase-4 roadmap rebaseline | Reordered the remaining roadmap around Mobile viewing quality: streaming safety, unified player, complete Mobile UX, portable profiles, then distribution/updates/notifications. Closed Phase 4 only at its accepted secure-foundation boundary and transferred startup Play readiness, stale context, cursor quality, pointer latency, source selection and player-surface cursor work into deferred Phase 10. Added an explicit checklist-ID migration table and made native provider shielding—including ad/tracker interception and dependency allowlists—the active Phase 5. | Roadmap-only change based on the existing implementation record and user physical findings. Historical Progress Log rows are unchanged; no implementation or validation credit was added. Reweighted evidence remains 54.2%, rounded to 54%; package versions remain 2.0.1. | 54% |
| 2026-08-11 | Phase 7 product-language and Settings IA additions | Recorded three deferred Mobile UX requirements: replace engineering-oriented Downloads copy with a premium honest locked state; reorganize growing Settings into Account, Appearance, Sync, Playback, Accessibility, Updates, Connect and Downloads sections; and add theme descriptions plus validated Custom-theme parity using Desktop as a reference. | Roadmap-only clarification based on user review. No runtime implementation, acceptance result or percentage credit was added. | 54% |
| 2026-08-11 | V3-P10-001 through V3-P10-016, V3-P12-008 through V3-P12-010 | Added Mobile downloads and Offline Library as an essential Orion v3 milestone. Defined scoped candidate capture, direct/HLS/DASH fragment jobs, Android-native foreground execution, WorkManager recovery, request-context isolation, integrity-checked finalization, offline metadata/tracks/subtitles and unified native playback. Shifted deferred Connect expansion to Phase 11 and release validation to Phase 12. | Roadmap-only architecture update grounded in the existing Desktop downloader contracts and diagnostics. No downloader implementation or acceptance credit was added. Reweighted evidence remains 53.98%, rounded to 54%; package versions remain 2.0.1. | 54% |
| 2026-08-13 | V3-P5-002, V3-P5-003, V3-P5-005, V3-P5-006, V3-P5-008 | Recorded the physically accepted Phase 5 protection and continuity boundary. Android-native Cinema interception, provider-specific shield rules, source capability/health classification and health-aware failover are present. Videasy, VidLink, VixSrc and 111Movies are seamless automatic targets; VidSrc and VsEmbed are outgoing-only; VidKing remains Limited Resume/manual; AutoEmbed is Mobile-quarantined after two failed physical popup-containment repairs. | Accepted physical-device investigation summarized in the Phase 5 handoff; checkpoint `9098b53`; AutoEmbed quarantine commit `b3c94f8`; 89/89 Mobile tests. No accepted continuity behavior was reopened. | 58% |
| 2026-08-13 | V3-P5-004, V3-P5-007, V3-P5-010 implementation checkpoint | Added category-aware required/media/artwork/subtitle dependency handling to the shared source manifest and Android classifier, a native-session evidence handshake, redacted shield counters and truthful protection copy, plus read-only embedded text-track discovery. Protected no longer requires an ad to have appeared, but still requires an enforced native session with no rule failure. | Commit `dd2523c`; Mobile typecheck; 89/89 Mobile tests; 93-file source-size gate; production web export; `git diff --check`. Expo Doctor passed 18 local checks; its two online catalog checks were unavailable under restricted egress. Safe captured-VTT delivery, learned dependency population, lifecycle diagnosis and the complete physical provider matrix remain open. | 59% |
| 2026-08-13 | Phase 5 playback-compatibility repair candidate | Removed per-segment shield traffic from the React render path, bounded native evidence delivery to meaningful block/failure events, stopped full-document ad-cleanup rescans on every provider DOM mutation, stabilized the native WebView configuration, and corrected shield truth: an initialized native session with zero blocks now reports `Shield active` without a zero counter; `Protected` requires an observed blocked request. Popup and unauthorized top-level navigation enforcement remain enabled. | Mobile typecheck; 89/89 tests; 93-file source-size gate; production web export; `git diff --check`; fully bundled standalone APK 110,384,835 bytes, SHA-256 `7A41431AA89905A7A56EB214AAD30FD19AB8EAB30ED70312AEA921EB14D6CAF0`. Expo Doctor completed 18 local checks; its two online catalog checks were blocked by restricted validation egress. Physical movie/TV startup on Videasy, VsEmbed, VidLink, VidKing and VidSrc remains required, so no completion credit is added. | 59% |
| 2026-08-13 | Phase 5 bounded cosmetic shield evidence candidate | Connected confirmed JavaScript-side popup denial, external-navigation cancellation and removed click-capture/ad-overlay actions to the existing shield evidence counter. Evidence is aggregated for 900 ms, capped at 12 flushes per page and never observes or changes video, manifest, HLS/DASH, subtitle or provider dependency traffic. `Shield active` remains the honest zero-action state; `Protected N` appears only after Orion actually prevents an unwanted action. | Mobile typecheck; 89/89 tests including bounded cosmetic-evidence assertions; 93-file source-size gate; production web export; `git diff --check`; fully bundled standalone APK 110,387,613 bytes, SHA-256 `25A66507849D531F6C62B3E216D9917657E8C86D37B4EAD3BD628C311DBDB545`. Physical playback and counter validation remain required, so no completion credit is added. | 59% |
| 2026-08-13 | Phase 5 physical acceptance and closure | Owner physical testing confirmed that provider streaming is working and the repaired popup/ad protection is effective. The accepted native blocker is frozen to protect playback compatibility. The yellow `Shield active` badge without a count is recorded as a native-to-React evidence-presentation gap, not a shield failure; direct native HUD delivery moves to `V3-P6-012`. Safe captured-VTT presentation moves to Phase 6, while exhaustive provider/subtitle regression remains in Phase 12. | Owner physical Android acceptance; Mobile 89/89 tests; typecheck, 93-file source-size gate, production web export and `git diff --check`; source/embedded Android bundle identity `4C3AB18E7A0BFC5169E02BAB3D580B20673D2BB7D46D04A438A18CE0AA6FF03B`; accepted standalone APK 110,387,613 bytes, SHA-256 `25A66507849D531F6C62B3E216D9917657E8C86D37B4EAD3BD628C311DBDB545`. | 63% |
| 2026-08-13 | V3-P6-006 immersive system-bar ownership clarification | Added an explicit Mobile-player lifecycle requirement for Android status/navigation bar hiding, platform edge-swipe reveal, playback-aware re-hiding, cutout-safe geometry and immediate restoration on every exit path. Renumbered the previously open Phase 6 items `V3-P6-006` through `V3-P6-011` to `V3-P6-007` through `V3-P6-012`; historical old-phase migration references remain unchanged. | Roadmap-only clarification after confirming that the audit previously implied system-bar validation but did not specify ownership or restoration behavior. No implementation, validation or completion credit was added. | 63% |
| 2026-08-13 | V3-P6-002, V3-P6-003, V3-P6-004, V3-P6-006, V3-P6-008 through V3-P6-010 and V3-P6-012 implementation checkpoint | Added one controller/reducer for native and embedded HUD ownership; a persistent embedded reveal handle; truthful Fit, Fill, Stretch and Provider/Original capability handling; player-scoped Android immersive-system-bar ownership with restoration; mutually exclusive player sheets; state-driven preparation/buffering/switching/error presentation; and a typed native shield-evidence callback that is filtered by view, session, source and sequence. Preserved one playback surface and Phase 5 blocker behavior. Physical geometry/provider validation and safe captured-VTT byte delivery remain open. | Mobile typecheck; 96/96 tests; 100-file source-size gate; Expo Doctor 20/20; production web export (1,543 modules); native standalone Android compile with embedded Metro bundle; standalone APK 110,411,876 bytes, SHA-256 `75127F5623302AC55922C10E5BBB3D0094ED4A3502DC5B71A3345BCC5D816D5D`; embedded bundle 4,817,395 bytes, SHA-256 `5743AD887D1244C5BDCFB56F9D2A339A71438D8AFC072F32252092D2C713A116`; Desktop full check passed: 58/58 Node tests, 139/139 renderer tests and production build. | 69% |
| 2026-08-13 | Phase 6 provider-independent immersive HUD repair | Separated upper-toolbar intent from playback attention and provider telemetry; removed the provider-page `TAP` bridge; added explicit reveal/collapse handles to both embedded and controlled native HUDs; restored pre-sheet visibility; rejected stale sessions; and cancelled timers during backgrounding and teardown. Buffering and ordinary provider errors remain in the central status layer and cannot flash the toolbar. Physical provider acceptance remains open. | Mobile typecheck; 96/96 tests including chrome-intent, controlled-native-HUD, stale-session, sheet-restoration and no-`TAP` regression guards; 100-file source-size gate; Expo Doctor 20/20; production web export (1,543 modules); `git diff --check`; fully bundled standalone APK 110,410,524 bytes, SHA-256 `48DE28B6A2A583B06F3404733B6D835268E2898F4BC570E3FCB8B275CF1FCDEA`; independently verified `assets/index.android.bundle` inside the APK. No additional completion credit is awarded until the physical eight-provider/orientation matrix passes. | 69% |
| 2026-08-20 | V3-P8-006A C3 | Completed steady-state cross-platform Viewing Activity synchronization for verified History + Progress after enrollment; repaired metadata-only alignment and first-real-push reconciliation; preserved Continue Watching as a local derived view; repaired one stale Electron hidden-Sidebar harness assumption. C3 is checkpoint-ready while Phase 8 remains open. | Physical Mobile -> Cloud -> Desktop and Desktop -> Cloud -> Mobile acceptance; Auto Sync OFF + Sync now acceptance; Mobile 239/239, source-size 137, Expo Doctor 20/20, web export; Desktop 106/106 Node + 262/262 renderer, full structural gates and production build; Electron 22/22. Offline playback physical validation is N/A until Phase 10 downloads/offline playback exists. | No new release-readiness percentage claimed before Phase 8 closeout audit |
| 2026-08-21 | V3-P8-006 functional sync closure | Closed the functional Orion Cloud synchronization scope after read-only Phase 8 classification. Active domains remain My List, Watched and Viewing Activity. Continue Watching remains locally derived. Portable Preferences are intentionally excluded so Desktop and Mobile retain independent application preferences. Music Planet remains Desktop-only and cross-platform Music sync is deferred until Mobile has a Music Planet surface. | Compact closure probe at checkpoint f4fd5b1: no Preferences sync implementation; no Preferences/Music SyncPolicy domain; no independent Continue Watching Cloud owner; fail-closed Watched/Viewing Activity contracts present; account/profile fencing, unknown-namespace preservation and sensitive-field exclusion checks passed. | No release-readiness percentage change; Phase 8 remains open for Count/Data Truth, product polish and P8.7 |
| 2026-08-21 | Phase 8 functional checklist reconciliation | Re-audited P8-003, P8-004, P8-005, P8-007, P8-008, P8-009 and P8-010 after functional sync closure and reconciled the roadmap checkboxes to already-implemented architecture. No runtime source change was required. | Read-only checklist audit at e9377ff: OAuth/account ownership on both platforms; account-scoped Mobile Library evidence; PortableProfileV3 evidence; revisions/merge/tombstone evidence across My List, Watched and Viewing Activity; offline/reconciliation and unknown-namespace preservation; forbidden portable-field screen clean; secure-storage, account-fencing and interruption/recovery evidence present. | Phase 8 remains open for Count/Data Truth and productization |

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
- Use `2.1.x` production identities when a real signed update-validation target is required; reserve Orion `3.0.0` for the final release milestone.
- Preserve this document as the authoritative Orion v3 execution tracker.

## Executive Summary

Orion v3 Phases 0 through 9 are complete and locked at their accepted evidence boundaries. The completed foundation now covers safety/observability, playback truth, History/Continue Watching, trailer reliability, the rebaselined secure Orion Connect foundation, streaming safety/source reliability, the unified Mobile player, complete Mobile UX/performance, Google identity/portable profiles, and Phase 9 distribution/updates/availability/notifications.

Phase 9 closes with real production-path evidence rather than source-only claims. Desktop physically completed its configured `2.0.1 -> 2.1.0` Preview self-update and Get Orion Mobile QR/direct-APK flow. Mobile physically completed the native signed-APK updater lifecycle through `2.1.9/code11`, with integrity, signer, package/version validation, in-place Android replacement, preserved install history/state, relaunch/current settlement, and final Desktop-parity update-banner acceptance against the real identity-only `v2.1.10` Preview trigger.

Expo runtime updates/recovery are retired from Orion Mobile production by the P9-F6 architectural amendment. Play Core is also outside Orion's current direct-GitHub distribution plan. These are accepted architecture boundaries, not open Phase 9 defects.

The five physical Smart Connect outcomes that did not pass remain preserved as deferred Phase 11 work rather than being represented as Phase 4 successes:

- Startup remote Play may not apply before an embedded provider becomes ready.
- Desktop context can retain stale media after leaving playback.
- The remote cursor appearance is not yet release quality.
- Pointer movement still needs latency refinement.
- Mobile does not yet expose Desktop's healthy source catalog for source switching.

Orion is still not ready for the Orion 3.0 release. The remaining major release blockers are Phase 10's real resumable Mobile downloader and Offline Library, the explicitly deferred Phase 11 Orion Connect expansion, and the complete Phase 12 clean-install/upgrade/regression matrix. Casting remains a separate post-v3 milestone.

## Code-Verified Baseline

The dated Progress Log is the source of truth for individual build, package, release and physical results. The latest Phase 9 evidence includes focused and full Desktop/Mobile application gates, source-size/export/release-build checks, signed production package verification, canonical integrity manifests, live Preview publication checks, genuine in-app update execution, post-update settlement and physical cross-platform update UX acceptance.

Phase 9 production identities progressed through the `2.1.x` Preview sequence. The last explicitly proven installed Mobile package is `2.1.9/code11`; `v2.1.10/code12` is an identity-only published trigger target used to validate the 2.1.9 banner and is not claimed physically installed. Orion `3.0.0` remains reserved for the final release milestone.

## Priority Audit

| Priority | Area | Current condition | Required outcome |
|---|---|---|---|
| P0 | Provider shield | Phase 5 accepted the Android-native Cinema shield, provider-specific blocking/dependency rules and evidence-backed protection states at the physical playback boundary | Preserve the accepted shield unchanged and re-run the complete provider/protection regression matrix in Phase 12 |
| P0 | Source reliability | Phase 5 accepted the selectable-provider capability/health boundary, health-aware failover and truthful Verified/Limited classifications | Preserve source capability truth and run the exhaustive provider/subtitle regression matrix in Phase 12 |
| P0 | Unified player | Phase 6 is complete/locked with one Orion HUD/controller boundary, immersive ownership, responsive overlays and truthful presentation modes | Preserve the locked player boundary and revalidate provider/device regressions before final release |
| P1 | Responsive UX | Phase 7 is complete/locked at the accepted cross-platform Mobile UX, accessibility and adaptive-layout boundary | Preserve six-theme, orientation, large-text and Reduced Motion behavior through release regression |
| P1 | Low-end performance | Phase 7 is complete/locked at its accepted performance and product-polish boundary | Preserve the accepted performance controls and include representative-device checks in final release validation |
| P1 | Cross-device profile | Phase 8 is complete/locked with Orion-owned OAuth, Portable Profile v3, bidirectional sync/conflict recovery and account/profile fencing | Preserve profile migration, conflict, offline and unknown-namespace behavior in Phase 12 |
| P1 | Distribution and updates | Phase 9 accepted: Desktop signed self-update/Get Orion Mobile and Mobile native signed GitHub/APK lifecycle are complete; Expo runtime is retired and Play Core is outside current scope | Preserve integrity, rollout, rollback/recovery, banner, release-note and relaunch checks as recurring production regressions |
| P1 | Notifications | Phase 9 accepted: local-first categories, quiet hours, deduplication, contextual permission and deep links are implemented and physically validated | Preserve category controls, permission, deduplication and deep-link behavior in Phase 12 release regression |
| P1 | Mobile downloads | The visible Mobile page is intentionally locked and has no durable fragment engine or Offline Library | Android-owned candidate capture, resumable fragment jobs, integrity verification, scoped storage and unified offline playback |
| Deferred | Connect expansion | Five physical Phase 4 findings and player-surface cursor ownership remain open | Resume only after the core Mobile viewing and ownership experience is complete |
| Deferred | TV casting | Remote control foundations exist, but casting is a different protocol category | Separate post-v3 casting milestone |

## 1. Playback Truth, History, and Continue Watching

### Confirmed condition

Phases 1 and 2 are complete. Native and embedded observations pass through the
versioned telemetry reducer under `apps/mobile/src/features/playback`, and only
verified advancing playback can reach the Library repository. History consumes
the persisted History collection, while Continue Watching derives independently
from incomplete verified progress. Both surfaces were accepted on a physical
Android device, including persistence across restart and reboot.

Current boundaries:

- Unobservable providers remain isolated in `recentOpensV1`; they cannot create History, progress, watched state, completion or percentages.
- VidKing remains excluded from carried-position continuity because its provider-internal startup audio/time glitch failed physical testing.
- Async/native AllManga remains hidden on Mobile until a safe native resolver exists.
- The revised Phase 5 source matrix must validate the health, shield, subtitle and routing behavior of every selectable provider.

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
- Give the player lifecycle explicit ownership of Android immersive system bars: enter immersive mode only while watching, allow the platform edge gesture to reveal bars temporarily, request re-hide while playback remains active, recompute controls around cutouts and revealed insets, and restore the normal application bar state immediately on every exit, teardown and fatal-error path.

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

### Settings information architecture and themes

Observed:

- Theme selection currently dominates the Settings page even though Account, Sync, Playback, Accessibility, Updates, Connect and Downloads will expand the page.
- Theme names do not explain the atmosphere or display purpose of each preset.
- Mobile Custom-theme controls remain substantially behind the supported Desktop customization surface.

Recommended:

- Make Appearance a dedicated Settings subsection rather than the entire Settings identity.
- Use Desktop Settings as a feature and terminology reference while retaining adaptive Mobile navigation and control density.
- Add short descriptions, for example `Midnight Premiere — cinematic black with Orion red`, `AMOLED — deeper black for OLED screens`, and `Mocha — warmer brown-toned dark theme`.
- Treat Custom as a first-class differentiator with live preview, validated controls, reset behavior and portable-profile support where the corresponding setting is cross-platform.
- Do not expose Desktop-only controls on Mobile unless the Mobile runtime can apply and validate them.

### Downloads locked state

Observed:

- The locked Downloads page is visually polished, but copy such as `stabilization boundary`, `resumable native engine`, `simulated job` and `file integrity pass` reads like internal engineering documentation.
- Internal implementation details weaken trust when the user only needs an honest capability status.

Recommended:

- Lead with `Mobile downloads are coming soon` or equivalent premium product language.
- Explain briefly that Orion is preparing reliable offline playback and will enable it only when downloads can be completed and verified safely.
- Keep the page visible and honest, but remove architecture, simulation and internal validation terminology from user-facing copy.
- Never show simulated progress, fake completion or actions that imply an unavailable download has started.

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

Orion Mobile production updates now use one accepted application-update boundary: the native permanently signed GitHub/APK updater. Expo runtime updates/recovery are retired from production by the P9-F6 architectural amendment, and Google Play Core is not part of the current direct-GitHub distribution plan.

### Release discovery and eligibility

- Resolve Stable/Preview release truth through Orion's canonical release model.
- Enforce channel, semantic version, Android minimum, staged rollout/eligibility and release-note truth before offering an update.
- For Mobile-only Preview releases, publish exactly the APK plus the strict integrity manifest.
- Treat release notes as consumer product content; raw Markdown leakage is a defect.

### Integrity and installation

- Validate the strict integrity manifest and artifact `name`, `size`, `sha256` and `signerSha256` values.
- Verify package identity, newer `versionName`/`versionCode`, permanent signing lineage and APK signature before installer handoff.
- Download and verify the APK inside Orion, then hand the verified artifact to Android Package Installer.
- Perform an in-place package replacement so application data and install history are preserved.
- `adb install` is not accepted as updater-lifecycle evidence.

### Post-install settlement and recovery

- Reconcile foreground return, relaunch and true cold relaunch into Current/Up-to-date state.
- Preserve truthful action-required, retry/failure and recovery/rollback semantics rather than hiding failures.
- If Android installer completion races an immediate Package Manager query, re-query read-only and compare `versionName`, `versionCode`, `lastUpdateTime` and preserved `firstInstallTime`; do not uninstall, clear data or substitute `adb install`.

### Accepted Phase 9 physical boundary

- P9-F9 proved the full native lifecycle from `2.1.7/code9 -> 2.1.8/code10` and later `2.1.8/code10 -> 2.1.9/code11` through Orion.
- The last explicitly proven installed Mobile package is `2.1.9/code11`.
- `v2.1.10/code12` is an identity-only real Preview trigger target whose banner/updater source is unchanged from 2.1.9; it was used to make installed 2.1.9 render the real update offer.
- The post-F9 full-width red Mobile update banner is physically accepted in portrait and landscape with safe-area/Menu clearance, actionable `View Update`, explicit dismiss and Desktop-consistent visual grammar.

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
- Music Planet data remains Desktop-local in Orion v3; cross-platform Music synchronization is deferred.
- Mobile does not create or consume a Music Planet synchronization domain in the current Orion v3 scope.
- Portable title/episode identity may support synchronized user data without claiming that media exists on another device; download preferences remain device-local.
- Appearance, accessibility and other application preferences remain local to each Orion platform.
- Tombstones.
- Per-device revision and timestamp.

Preserve unknown namespaces so an older client does not erase newer feature data.

Exclude:

- OAuth tokens.
- Provider cookies and credentials.
- Signed stream URLs.
- Smart Connect pairing secrets.
- Downloaded media bytes, partial fragments and device-bound job state.
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
    ├── downloads/
    │   ├── contracts.ts
    │   ├── candidateCapture.ts
    │   ├── candidatePreflight.ts
    │   ├── downloadRepository.ts
    │   ├── downloadPolicy.ts
    │   ├── integrityVerifier.ts
    │   ├── OfflineLibrary.tsx
    │   └── DownloadJobCard.tsx
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

Android-native download boundary:

```text
apps/mobile/android/app/src/main/java/com/orion/mobile/downloads/
├── OrionDownloadService.kt
├── OrionDownloadWorker.kt
├── OrionDownloadStore.kt
├── OrionRequestContextBroker.kt
└── OrionMedia3DownloadBridge.kt
```

The Mobile download pipeline is deliberately split across trust boundaries:

```text
active playback session
  -> scoped opaque candidate capture
  -> reachability / expiry / DRM / storage preflight
  -> durable Android download job
  -> range or fragment store
  -> integrity verification and atomic finalization
  -> Offline Library
  -> Orion native player
```

The renderer may display redacted job state and issue user actions, but it must
never receive captured cookies, signed media URLs, provider credentials or raw
machine paths. Desktop's downloader is the behavioral reference for scoped
capture, request-context preservation, fragment accounting and recovery. Mobile
recreates those contracts with Android foreground services, WorkManager and
Media3-compatible components rather than importing Electron session code or
silently bundling unrestricted Desktop command-line tooling.

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

### Phase 4: Secure Orion Connect foundation

- Preserve the physically accepted secure pairing, matching-phrase trust and encrypted WSS transport.
- Preserve device-bound identity, reconnection, expiry, lockout, rename and revoke.
- Preserve acknowledged commands, continuous touchpad movement and the unified remote foundation.
- Transfer failed startup Play, stale context, cursor quality, pointer latency, source selection and player-surface cursor outcomes to Phase 11.

### Phase 5: Streaming safety and source reliability — complete

- Add native Android request interception and provider-specific ad, tracker, popup and unsafe-navigation rules.
- Allow required media, manifest, image, CDN and subtitle dependencies.
- Validate every selectable source and add evidence-backed health and failover.
- Complete embedded subtitle discovery and Orion fallback; carry safe captured-VTT presentation into Phase 6.
- Investigate VidKing continuity and playback-relevant WebView/cache/GPU diagnostics.
- Report only shield states supported by observed evidence.
- Preserve the accepted native blocker unchanged; deliver its numeric evidence directly to the Phase 6 HUD rather than through provider-page JavaScript.

### Phase 6: Unified Mobile player experience

- Add one HUD state machine for native and embedded playback.
- Own touch/reveal behavior outside cross-origin provider frames.
- Add Fit, Fill, Stretch and Provider/Original presentation modes.
- Make every player sheet and state responsive across phone, landscape, tablet, foldable and fullscreen layouts.
- Prevent overlapping controls, unreachable actions, duplicated surfaces and fabricated state.

### Phase 7: Complete Mobile UX and performance

- Finish adaptive Discover, Library, Settings, episodes and Media Detail layouts.
- Complete six-theme contrast, watched actions/badges and organized navigation groups.
- Move themes into an Appearance section, add preset descriptions and close supported Custom-theme parity gaps using Desktop Settings as a reference.
- Complete accessibility ordering, labels and touch targets.
- Add list virtualization, image-memory controls and background-work throttling.
- Validate automatic Efficiency, Balanced and Quality profiles on representative low-end Android hardware.

### Phase 8: Google identity and portable profiles

- Add Orion-owned Android and Desktop OAuth clients; users never supply cloud credentials.
- Add account-namespaced Portable Profile v3 storage and anonymous-profile import.
- Synchronize supported Cinema user-data records with revisions, merge rules and tombstones; application settings remain local and Music Planet synchronization is deferred.
- Preserve offline-first behavior, unknown namespaces and secure token storage.

### Phase 9: Distribution, updates, availability and notifications

- Provide a separate Desktop Get Orion Mobile area with signed direct APK/install QR flow and shared Stable/Preview release truth.
- Use the accepted production update paths: signed Desktop Preview self-update and Mobile native permanently signed GitHub/APK update with staged rollout, integrity/signer/package/version verification, rollback/recovery semantics, retry/failure handling and relaunch settlement.
- Keep Expo runtime updates/recovery retired from Mobile production and keep Play Core outside the current direct-GitHub distribution scope.
- Expose installer, version, compatibility, update-state and provider-availability status clearly and consistently on both platforms.
- Provide local-first notification categories, quiet hours, deduplication, whitelisted deep links and contextual permission prompts.

### Phase 10: Mobile downloads and Offline Library

- Replace the locked engineering copy with a premium six-theme Downloads experience, while keeping unavailable actions honest until the engine passes.
- Capture active-session direct, HLS, DASH and extensionless media as opaque, scoped candidates and preflight reachability, expiry, request context, storage and protection status.
- Recreate Desktop's proven scoped capture, fragment accounting and restricted request-context boundaries through Android-native foreground services, WorkManager recovery and Media3-compatible components.
- Add resumable range and fragment jobs, bounded concurrency, pause/resume/retry, battery/network/storage policy and atomic integrity-checked finalization.
- Preserve supported artwork, metadata, audio tracks and subtitles and expose completed media through a responsive six-theme Offline Library.
- Play completed assets through Orion's unified native player and integrate offline Resume, History, Continue Watching and watched state without requiring network access.
- Use scoped storage, portable metadata-only backup and explicit unsupported/DRM diagnostics; never expose credentials or report false completion.

### Phase 11: Deferred Orion Connect expansion

- Repair provider-ready startup Play and stale Desktop context.
- Replace the cursor presentation and reduce remaining pointer latency.
- Add Mobile source selection from Desktop's live healthy-source catalog.
- Add safe player-surface cursor ownership across default, fullscreen, mini, pop-out and local playback.
- Complete the Mobile Companion Center and advanced device/status presentation.

### Phase 12: Release validation

- Clean-device installation.
- Existing-profile upgrade.
- Network interruption and offline tests.
- Complete provider, shield, subtitle, player fitting and orientation matrices.
- Low-end performance and memory validation.
- Profile migration, conflicts and offline recovery.
- Signed installation, update and rollback testing.
- Notification permission, quiet-hours and deep-link testing.
- Complete download candidate, fragment recovery, interruption, integrity, scoped-storage and offline-playback matrices.
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

### Downloads and offline playback

- Direct-file range download, pause/resume and server-without-range fallback.
- HLS master/media playlist selection, AES-128 where authorized, fragment accounting and restart recovery.
- DASH manifest selection, separate audio/video fragments and deterministic finalization.
- Extensionless media and MIME-derived candidate detection.
- Expired candidate, unreachable host, missing request context and unsupported/DRM diagnostics.
- Provider-required headers, cookies, referer and user-agent remain job-scoped and never enter renderer state or logs.
- App kill, process death, device reboot, Wi-Fi loss, metered-network policy, battery restriction and low-storage recovery.
- Integrity verification, atomic completion, partial-file cleanup and honest failed/cancelled states.
- Multiple audio tracks, embedded/captured/external subtitles, artwork and episode metadata where the source exposes them.
- Offline movie and exact TV-episode playback, seeking, Resume, History, Continue Watching and watched state without network access.
- Delete media, retain/remove metadata, repair missing files and reconcile externally removed storage.
- Scoped-storage behavior on supported Android versions without broad legacy storage permission.
- Queue and Offline Library layouts across compact phone, standard phone, tablet, landscape, 200% text, Reduced Motion and all six themes.

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
- Google profile restoration preserves supported synchronized Cinema user data without exposing credentials; Desktop-local Music Planet state is not represented as cross-platform Cloud data.
- OTA updates cannot cross an incompatible native runtime.
- Native updates verify signatures/checksums.
- Mobile downloads resume honestly across interruption, verify integrity before completion and never expose captured request context.
- Completed Mobile downloads play, seek and update Resume, History and Continue Watching while fully offline.
- Downloaded media, partial fragments and machine-bound job state are excluded from portable cloud backups while portable metadata remains compatible.
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

<!-- V3-P8-COUNT-SEMANTICS-DATA-TRUTH-CLOSURE-2026-08-21 -->

## Historical Phase 8 Count Semantics and Data Truth closure - 2026-08-21

> **Superseded checkpoint status:** Phase 8 was not yet locked when this audit was written. The final implementation lock `5b9cb7ad8824b24cecccc83f5cee52614c72a8ee` and P8.7 audit now define the current status.

**Historical status at this checkpoint:** COMPLETE at functional/data-truth scope; Phase 8 overall was not yet locked.

The required Phase 8 Count Semantics and Data Truth audit is complete.

Accepted count semantics:

- My List Library count represents saved titles.
- My List Account/Orion Cloud count represents the portable My List population.
- Watched Library count represents watched titles inside My List.
- Watched Account/Orion Cloud count represents portable watched movies and exact episodes.
- Library History represents local displayable History identities.
- Account Viewing Activity History represents portable verified exact-identity History.
- Account playback-position count represents portable verified playback positions.
- Continue Watching is derived locally from verified playback truth and is not a Cloud namespace.

The audit did not force unrelated populations to display the same number.

Functional repairs recovered by the audit:

- Mobile title-level TV playback now persists the effective S1E1 fallback identity instead of creating new title-level TV History/Progress with null episode coordinates.
- Continue Watching uses one shared 30-second minimum / below-90-percent completion policy.
- Desktop Continue Watching now derives from verified portable playback truth.
- Desktop Home and Library now share one Continue Watching owner.
- Desktop keeps only the latest resumable episode per TV series.

Physical acceptance:

- Mobile-to-Desktop Michael playback synchronization was observed.
- Desktop Viewing Activity showed 39 History / 9 Progress at that checkpoint.
- Final Mobile title-level TV validation used Outer Banks and produced exact S1E1 identity.
- Final Mobile/Orion Cloud portable Viewing Activity truth reached 40 History / 10 Progress with readback verification.
- Desktop Home Continue Watching and My Library Continue both physically showed 6 canonical cards.
- Reacher appeared only as the latest resumable episode, S1E2.
- the previously above-90-percent Supergirl position remained excluded.

Historical TV records that already lack an exact episode identity are not guessed or rewritten. They remain local and are excluded from portable exact-episode synchronization.

Canonical audit:

`docs/audits/ORION-V3-P8-COUNT-SEMANTICS-DATA-TRUTH-AUDIT.md`

Immediate next work is the coherent Phase 8 production-polish pass before overall Phase 8 lock:

- unify Mobile Settings -> Account,
- clarify user-facing count language,
- normalize Account / Orion Cloud / sync presentation,
- make manual Sync now visibly show busy/Syncing even while Auto Sync is paused,
- complete consistency, responsive and accessibility polish,
- then perform the P8.7 full cross-platform audit.

At this checkpoint, Phase 8 remained not locked. That status was superseded by the final Phase 8 implementation lock and P8.7 acceptance recorded above.


<!-- V3-P8-PRE-P8.7-CHECKPOINT-AUDIT-2026-08-21 -->

## Historical Phase 8 pre-P8.7 checkpoint audit - 2026-08-21

> **Superseded checkpoint status:** This section records the state before P8.7. Phase 8 subsequently completed and locked at `5b9cb7ad8824b24cecccc83f5cee52614c72a8ee`.

**Checkpoint parent:** `c18162cacac69499fc30d073e125f330b009de27`
**Classification:** PRE-P8.7 CHECKPOINT CANDIDATE
**Historical Phase 8 status at this checkpoint:** NOT LOCKED (superseded by final lock)

The completed-work audit found 55 current code/test candidate paths before this documentation amendment: 42 Desktop, 12 Mobile and 1 Shared, with an empty staged index.

Accepted post-count-audit work includes Mobile Account productization; Desktop global My List/Watched indicators; Desktop Account/Settings/title-detail polish; TV `Watch Now`; accessibility repairs; a bounded staggered Desktop Orion Cloud heartbeat; and checkpointed Viewing Activity stale-cache recovery only when newer verified Orion Cloud truth strictly dominates older local playback truth.

Physical acceptance recorded before this checkpoint includes the Desktop product-polish pass, TV `Watch Now` / `In My List` presentation, Viewing Activity recovery from `Needs review` to `Synced`, and passive Mobile -> Desktop My List pickup while Desktop remained open with Auto sync ON.

The accepted live Desktop snapshot showed 39 History entries / 8 playback positions. This later operational state does not rewrite the historical 40/10 portable proof in the Count Semantics audit.

Locked scope remains My List, Watched, History and verified playback positions. Continue Watching remains locally derived with no Cloud namespace. Preferences remain local. Music Planet remains Desktop-only for current v3 scope. Downloads, storage configuration, Smart Connect state and device-local presentation settings are not portable profile domains.

Before checkpoint commit: pass one grouped Shared + Mobile + standalone Android + Desktop gate, complete a short S24 Ultra account/sync sanity check, then create and push one exact-path checkpoint commit with local/remote SHA equality.

The checkpoint does not lock Phase 8. P8.7 begins only after this checkpoint is sealed.
