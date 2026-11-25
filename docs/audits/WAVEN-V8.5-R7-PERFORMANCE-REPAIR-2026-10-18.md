# WAVEN V8.5 R7 — playback and navigation performance repair

**2026-10-18 · R7 candidate built, NOT INSTALLED · physical improvement UNPROVEN · Phase 8 NOT ACCEPTED · overall 60%**

The focused investigation identified avoidable per-frame layout-property traffic in two presentation components. A bounded correction now uses native transform masks while preserving progress, waveform anchoring, navigation geometry and accessibility. TypeScript, **209 focused tests** and **510 full tests** pass. The separate R7 APK is verified and ready for an explicitly approved physical trial. **No device-level improvement or Phase 8 performance PASS is claimed before that trial.**

## Authority and protection

Owner authorization is preserved in release/waven-v85-r7-20261018/owner-directive.txt. [The authoritative master plan](../plans/WAVEN-V1-MASTER-PLAN.md) remains unchanged: Phase 8, Offline awareness and connectivity resilience, fixed 8%, earns 0%; accepted Phases 0–7 total 60%. Branch waven/v1, HEAD d5299eb672df6d3396247cf15935b6de2ba7e7f1. Current source is the accepted uncommitted R6 baseline plus only the five paths listed below. No Completion ACK, Phase 9+, HIKARI, dependency upgrade or distribution release.

R6 r2 remains installed on Samsung SM-S928B / S24 Ultra, serial R5CWC2RYXZF, Personal user 0, package com.okali.waven.phase8validation, SHA-256 **13E192C878213EA822BB69E0CD695598CB1F591152F9D5F213217361604C095C**. No installation, uninstall, data clear, network/animation/refresh-rate setting change, Orion Cloud mutation or protected Work application operation occurred. Final protected package/code/settings hashes and Library readback pass. Normal test replays update existing history time/order; counts remain **1 favorite, 1 playlist, 12 history entries**. The separate Phase 7 development-package data was not transferred or cleared.

All **134 dirty baseline files have exact byte preimages** in release/waven-v85-r7-20261018/preimages/. Eleven prior APK/archive identities are checked, including R3/R4/R5/R6 and the R6 acceptance-review seal. Accepted ACKs and earlier reports remain byte-identical. The earlier Phase 7 missing historical preimages/account-switch limitations remain accepted historical facts, not newly fabricated evidence.

## Stage A — evidence and attribution

Perfetto tracing is supported on this phone. Separate bounded 12-second traces collect target-app view/graphics instrumentation, scheduling/frequency and Android SurfaceFlinger FrameTimeline metadata. Official Perfetto 58.2 Windows trace processor was downloaded into the evidence tools directory and verified against its official manifest SHA-256 **ADFA6BAD3D72BE3BA9B83FA2B17B69FA13B3AB1CAD0F42E52B86188BD5F0F997**. It does not change project dependencies or phone software. [Perfetto's Android tracing guidance](https://perfetto.dev/docs/getting-started/atrace) and [CPU-profiling restrictions](https://perfetto.dev/docs/getting-started/cpu-profiling) govern the interpretation.

| Evidence | Established observation |
|---|---|
| Search PLAYING trace, 12s | **978 Fabric mount batches**, including **959 UPDATE_PROPS batches with two instructions**, **60 UPDATE_LAYOUT batches**, **667 traversal slices**. CPU running time: JS thread **6464.2ms**, UI thread **2881.8ms**, RenderThread **3926.7ms**. Media3/native decode continues. |
| Verified Search PAUSED trace, 12s | No mount/traversal batches in captured app trace; RenderThread about **0.1ms** CPU. This is a state/workload comparison, not an isolated component GPU experiment. |
| Navigation without playback trace | **424 mount batches**, **408 ReactTextView.onMeasure**, **623 StaticLayout constructions** during five tab actions. UI CPU **1280.6ms**, JS **1047.6ms**, RenderThread **797.7ms**. Route creation and label animation both contribute to this trace; counts are not assigned exclusively to labels. |
| Background while native PLAYING | Native position **99122→111188ms** during the trace. RenderThread **226.3ms**, JS **1400.9ms**, UI **631.9ms** CPU, versus higher foreground playback workload. First ~0.8s is foreground transition. No other-app screenshot was captured. This does not prove every hidden animation stopped. |
| Actual mounted components, R6 source | Mini Player binds visualProgress to animated width using the JS driver. Navigation binds each label's width and margin to a JS-driven animated value. Three tests fail against unchanged R6 for these paths. |

**Defensible contributing cause:** ordinary progress frames pass a layout property through JS/Fabric, and nav label animation repeatedly changes text-layout constraints. The steady Search UI has no visible four-bar track-row Wave, while Mini Player progress remains active. The trace's frequent mount/property work, source ownership and actual-component instrumentation establish an avoidable layout-update path. R7 removes this specific path. The release APK lacks React DevTools commit telemetry and is not profileable for JS callstack sampling; Perfetto mount batches are **not React commits**, and frame/GPU counters do not identify an individual component. No claim is made that these are the sole cause of the high jank or that every recorded mount came from one component.

Mini Player still receives authoritative native state and position events and performs its existing 1-second presentation refresh. Mounted tests verify native position updates reach progress and manual animated frames cause no React commits. Those are controlled test-double results, not physical commit counts. Position subscriptions, Media3 queue/audio ownership and source access checks are unchanged. Connectivity updates may rerender presentation, but neither duplicate polling nor a new observer defect was established as the dominant measured cost, so observers were not rewritten.

Living Wave uses the native driver; its source and tokens are frozen. AppState handling and static pause/Reduced Motion have existing R6 physical and automated evidence. Visibility trials compare Home's visible row indicator with Search where that row is not visible; retained routes and Mini Player visuals remain possible work. They do not isolate the four bars. No useful Wave/pulse/marquee animation was removed. Background tracing shows reduced visual work while native audio advances; no speculative offscreen lifecycle patch was added.

Navigation still uses the existing Stack, router.navigate semantics, selection pill, gestures and route lifetime. Search may mount again after navigation returns through the stack. Static atmospheric gradients, transparency/clipping and textured artwork remain GPU costs visible in draw operations; neither per-component shader timing nor an overdraw heatmap was available. FrameTimeline includes App Deadline Missed, SurfaceFlinger CPU Deadline Missed, buffer stuffing and display/scheduling classifications. These surface-scoped counts are not summed into gfxinfo totals or presented as isolated GPU duration. No Android refresh-rate override or rendering-layer redesign was made.

Concurrent provider work is recorded separately in target-PID diagnostics. Real recovery events overlap some playback/navigation windows and paused windows with few/no redraws. This does not prove provider work is harmless, or that it alone causes rendering stalls. The global FIFO, deadlines, cancellation, health, caching and recovery scheduler remain unchanged.

## Stage B — controlled R6 baseline

Existing R6 measurement infrastructure was reused. Each ordinary window lasts 15s, recording OFF; only target gfxinfo diagnostic counters reset. Baseline/end deltas require the same PID and reset epoch. Endpoint screenshots verify the actual screen; display and thermal state are recorded outside the quiet interval. No screenshot/UIA/media polling is performed inside it. [Android gfxinfo guidance](https://developer.android.com/tools/dumpsys) explains frame stats; detailed retained frame rows cover only the recent tail, not every window frame.

Active display mode reports **1440×3120, peak/vsync ~120Hz**. Actual tail frame intervals are recorded; no invented fixed 16.67ms deadline or project pass threshold was imposed. Thermal state codes **1 and 2** occurred. Compare only matched thermal/workload conditions after approval; Home-versus-Search rates alone do not isolate component cost across these thermal states. Zero-frame windows have no rate or meaningful percentile. Two late frames must not be read as sustained 100% jank. Tail frame timing and every display/thermal/memory snapshot are in baseline-frame-summary.json and the physical windows directory.

| R6 trial | Frames | Janky | Rate | Thermal code | Real recovery event |
|---|---:|---:|---:|---|---|
| r6-home-idle-1 | 2 | 2 | 100.00% | 1 | yes |
| r6-home-idle-2 | 0 | 0 | N/A | 1 | no |
| r6-home-paused-1 | 2 | 2 | 100.00% | 1 | yes |
| r6-home-paused-2 | 0 | 0 | N/A | 1 | no |
| r6-home-playing-1 | 1293 | 508 | 39.29% | 1 | no |
| r6-home-playing-2 | 1378 | 434 | 31.50% | 1 | no |
| r6-home-scroll-1 | 1863 | 2 | 0.11% | 1 | no |
| r6-home-scroll-2 | 1821 | 9 | 0.49% | 1 | yes |
| r6-nav-playing-1 | 1140 | 600 | 52.63% | 2 | yes |
| r6-nav-playing-2 | 1052 | 587 | 55.80% | 2 | no |
| r6-nav-stopped-1 | 236 | 86 | 36.44% | 1 | yes |
| r6-nav-stopped-2 | 251 | 99 | 39.44% | 1 | yes |
| r6-recovery-active-1 | 807 | 643 | 79.68% | 1 | yes |
| r6-search-paused-verified-1 | 0 | 0 | N/A | 2 | yes |
| r6-search-paused-verified-2 | 0 | 0 | N/A | 2 | no |
| r6-search-playing-1 | 798 | 653 | 81.83% | 2 | yes |
| r6-search-playing-2 | 886 | 776 | 87.58% | 2 | no |
| r6-search-recovery-paused-1 | 0 | 0 | N/A | 1 | yes |
| r6-search-recovery-paused-2 | 0 | 0 | N/A | 1 | no |
| r6-search-scroll-1 | 1851 | 2 | 0.11% | 1 | no |
| r6-search-scroll-2 | 1862 | 11 | 0.59% | 1 | yes |

The 14 requested conditions are mapped explicitly: Home idle = home-idle pair; Search idle = verified paused Search idle pair (not an empty queue); Home/Search scroll = their pairs; navigation without/during playback = nav-stopped/nav-playing pairs; Home/Search PLAYING = corresponding pairs; Home/Search PAUSED = their verified pairs; visible/not-visible row Wave = Home/Search playing; paused recovery = recovery-paused first trial plus following quiet repeat; active recovery = dedicated active1 plus other playing trials with actual coordinator events. There is only one valid dedicated active-recovery trial: active2 changed to PAUSED and is excluded, not promoted to a repeated uninterrupted sample.

Fresh scrolling ranges **0.11–0.49% Home /0.11–0.59% Search**, stopped navigation **36.44–39.44%**, playing navigation **52.63–55.80%**, Home playing **31.49–39.29%**, Search playing **81.83–87.59%**. Earlier R6 results remain historical bounded samples, not overwritten or averaged into cumulative process rates. Variability and thermal codes are preserved, not cherry-picked. PSS snapshots range **360652–772858KiB** across different workloads; there is no retained-heap/GC-controlled memory-leak proof.

Invalid/limited attempts remain in harness-limitations.json and raw evidence: first Perfetto config path denied, then official stdin config succeeded; first Home-playing ring lost process-name metadata (numeric PID attribution retained, not a full quantitative comparison); a trace named paused-search was actually PLAYING and is reclassified; an end-of-track control tap initiated fresh preparation rather than pause; mixed-state trials are excluded and verified PAUSED blocks repeated. A later native PAUSED transition during active recovery has no established cause; no product defect or user action is inferred. A missing fresh UI hierarchy prevented a tap; a later fresh hierarchy completed Library readback. An early geometry-test fixture selected a discarded useRef constructor value; following the actual interpolation parent corrected the fixture, with its failure retained. No failed attempt is relabeled as PASS.

## Stage C — exact bounded correction

1. **apps/waven/src/components/player/WavenMiniPlayer.tsx:** progress interpolation uses the native driver. A fixed-width clipping view translates while its contents counter-translate, keeping waveform bars anchored and revealing precisely the original played extent. Width changes only when the real viewport layout changes. Native snapshot re-anchoring, progress updates, source re-resolution, buffering, active pulse, title marquee, Reduced Motion and controls remain intact.
2. **apps/waven/src/components/shell/WavenBottomNav.tsx:** fixed label width, native clipping/counter-translation and native icon translation reproduce the prior expanding-label geometry without animated width/margin or repeated text measurement. Full button targets, labels, font clamps, selection pill, gestures and route ownership remain intact.
3. **apps/waven/tests/p53MiniPlayerShell.test.cjs:** the former structural requirement for a JS-driven animation is strengthened to forbid one; its behavioral/ownership/reduced-motion checks remain. This is an implementation-assumption update, not removal of an acceptance assertion.
4. **apps/waven/tests/p85R7PresentationPerformance.test.cjs:** seven mounted component/graph regressions verify no animated layout bindings, native interpolation, progress ticks, no per-frame React commit in the fixture, Reduced Motion/static pause, full progress range/anchoring at 300px and 630px, and nav geometry/button targets. Native Animated is a deterministic test double; these do not establish device FPS.
5. **This new report.** Earlier R6/master/accepted ACK documents remain unchanged. Exact deltas and source/preimage hashes are in source-integrity.json and source-diff.patch.

No observer redesign, provider scheduling change, Media3/source validator change, dependency/theme/native-payload change, second playback owner or speculative hardware-layer optimization. R7 corrects measured software-work contributors; device impact and unchanged visual fidelity still require the approved APK trial.

## Stage D / F — regression and candidate identity

Fresh **TypeScript PASS**, **209/209 focused PASS**, **510/510 full PASS** (baseline 172/503 remains covered; focused set also includes shell/navigation/responsive/marquee checks). Three of the first four new cases failed against R6; seven now pass, including later geometry cases. Android release-derived build PASS, **4m35s**, 622 tasks /30 executed; Metro cache rebuilt. Generated sources/Gradle/manifest are restored and hash-verified.

| Candidate field | Verified value |
|---|---|
| APK | release/waven-v85-r7-20261018/WAVEN-V8.5-PHYSICAL-CANDIDATE-r7.apk |
| SHA-256 | **D8377EE10FD456B26E237839DB8F4B24DD9D34375A7A69F08B7C7DA73AF666F3** |
| Bytes | 67447379 |
| Package/version | com.okali.waven.phase8validation ·0.1.0(1) ·arm64-v8a |
| Build | Existing isolated release-derived phase8Validation, Hermes, debuggable false |
| Signer SHA-256 | FAC61745DC0903786FB9EDE62A962B399F7348F0BB6F899B8332667591033B9C — existing validation signer, not canonical permanent signer |
| Signature /16KiB alignment /launcher | PASS /PASS /one |
| Native payload | **31 DEX/native library payloads byte-identical to R6 r2** |
| JS | Changed from R6; preserved R6 playback/recovery markers verified |
| Installed | **NO — exact-hash owner approval required** |

## Stage E — before/after boundary

The R7 column remains pending because the owner explicitly prohibits installation before exact identity approval. A native-transform graph is not a physical improvement result. The repair has not yet met the required meaningful, repeatable device-improvement gate; no zero-jank or acceptance claim is made.

| Workload | Actual R6 frames/janky (rate) | Baseline conditions | Actual R7 |
|---|---|---|---|
| Home scrolling | 1863/2 (0.11%);1821/9 (0.49%) | state1 | **NOT RUN — owner-approved installation required** |
| Search scrolling | 1851/2 (0.11%);1862/11 (0.59%) | state1 | **NOT RUN — owner-approved installation required** |
| Home/Search navigation, stopped | 236/86 (36.44%);251/99 (39.44%) | state1 | **NOT RUN — owner-approved installation required** |
| Home/Search navigation, playing | 1140/600 (52.63%);1052/587 (55.80%) | state2 | **NOT RUN — owner-approved installation required** |
| Home playing / visible row Wave | 1293/508 (39.29%);1378/434 (31.49%) | state1 | **NOT RUN — owner-approved installation required** |
| Search playing / row Wave not visible | 798/653 (81.83%);886/776 (87.59%) | state2 | **NOT RUN — owner-approved installation required** |
| Home paused / static row Wave | 2/2 late frames;0 frames | state1; no meaningful rate | **NOT RUN — owner-approved installation required** |
| Search paused / idle | 0frames in two verified trials | state2 | **NOT RUN — owner-approved installation required** |
| Discovery/lifecycle recovery, active | 807/643 (79.68%) + recovered-stage events; second dedicated trial invalidated by native PAUSED transition | state1; repeatability limited for this exact dedicated workload | **NOT RUN — owner-approved installation required** |
| Discovery recovery, paused | 0frames in observed retry window and following quiet window | state1; provider event present in first window | **NOT RUN — owner-approved installation required** |

## Physical plan after separate approval

Verify exact package/signer/hash and Personal user0, back up/preserve the installed R6 APK identity, record current Library/protected state, then update only com.okali.waven.phase8validation without uninstall/data clear. Retain Work and unrelated packages. R7 will be the same isolated package; no canonical/development data transfer.

With the phone untouched, recording disabled and thermal/refresh conditions matched, repeat all14 baseline conditions at least twice. Guard native PLAYING/PAUSED at both ends and record the actual screen; invalidate unexpected state/foreground/PID/epoch changes. Repeat recovery trials only with genuine coordinator/provider events, not a name or mock. Keep the invalid trials. Use separate matched Perfetto traces to verify mount/layout traffic falls; do not compare traced and untraced jank as identical instrumentation. If phone thermal state differs, wait passively or report the mismatch rather than forcing global display/power settings.

Check smooth full-range progress, native identity/pause/resume/source validation, active and static Wave cycles, title marquee, buffering/failed-row/retry behavior where real fixtures exist, Reduced Motion, large text/navigation gesture/selection geometry, Home/Search state, discovery recovery, Library and cold restart. Verify final installed identity, protected packages, settings, Library counts/content and no observed crash/ANR. Significant physical regression or failure to improve requires investigation; functional tests alone cannot accept the repair.

## Readiness and evidence

**Ready for owner review of a separate R7 trial; not accepted for performance or Phase8 completion.** Known R6 timing failures, unavailable real403/failed-row fixture, initially-empty live Home recovery, usable cellular, supported multi-item queue, live accessibility/audio confirmation and cross-build offline evidence reconciliation remain governed by [the R6 readiness report](WAVEN-V8.5-R6-ACCEPTANCE-READINESS-2026-10-18.md) and its25-case matrix. This correction grants no exceptions or historical-to-current physical promotion. Later signed-distribution acceptance remains separate.

Verified handoff archive: release/waven-v85-r7-20261018/WAVEN-V8.5-R7-PREINSTALL-REVIEW-20261018-SEALED.zip, with adjacent seal-verification.json checking every entry size/hash and manifest. It contains the candidate, source deltas/exact preimages, regression/build logs, traces/queries/results, frame/raw condition snapshots, failed attempts, current protected-state/Library readbacks and the post-approval test plan. Prior large artifacts are preserved locally and referenced by verified hashes.

**STOP before installation.** No commit, push, merge, tag or release. Phase8 remains IN PROGRESS /NOT ACCEPTED, earns0%, overall **60%**. No Completion ACK or Phase9+/HIKARI work.
