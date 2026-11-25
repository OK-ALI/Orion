# WAVEN V8.5 R6 — Phase 8 acceptance readiness review

**2026-10-18 (Asia/Karachi) · R6 r2 preserved · owner acceptance PENDING · overall 60%**

The review is complete. **Unconditional Phase 8 acceptance is not established.** Normal-operation playback and navigation reproduce native frame-deadline misses without screen recording. The known forbidden-source fixture did not repeat today. Physical evidence gaps and historical build boundaries remain explicit below. No implementation correction was made: this review found a performance concern, but did not establish a new reproducible Phase 8 functional correctness defect authorizing a source change. The scheduler, source validator, single Media3 owner, accepted Mini Player and theme remain unchanged.

## Authority and exact baseline

The existing [master plan](../plans/WAVEN-V1-MASTER-PLAN.md), sections13.8/14/16, still governs scope and validation tiers. Phase8 is **Offline awareness and connectivity resilience**, fixed8%, earns0%; Phases0–7 total60%. No Completion ACK or release is issued. The prior [R6 implementation/physical report](WAVEN-V8.5-R6-DISCOVERY-RECOVERY-2026-10-18.md), pre-install seal and final physical seal remain unchanged.

Samsung SM-S928B / S24 Ultra, serial R5CWC2RYXZF, Personal user0, package **com.okali.waven.phase8validation**, version0.1.0(1). Installed candidate SHA-256 **13E192C878213EA822BB69E0CD695598CB1F591152F9D5F213217361604C095C**. Existing validation signer **FAC61745DC0903786FB9EDE62A962B399F7348F0BB6F899B8332667591033B9C**. No APK rebuilt or installed. The frozen artifact proof establishes one launcher,16KiB alignment and31 native/DEX payloads identical toR5; source/native template hashes are checked again in this review.

Evidence root: release/waven-v85-r6-review-20261018/. Every current physical result is from this exact installed R6r2 unless explicitly labeled historical. Host action timestamps are UTC; captured Android log timestamps are device-local. No cross-clock latency subtraction is used as an exact metric.

## Bounded performance investigation

Each window uses the same target PID and a new target-only **gfxinfo diagnostic counter reset**, followed by a baseline/end delta in that reset epoch. App data and global logs were not cleared. No screenshot, UI hierarchy dump, or media polling runs inside quiet measurement intervals. Specified input gestures and endpoint ADB diagnostics remain instrumentation. Only the paired recording window adds Android screenrecord,1080×2340/6Mbps. All ordinary windows have recording off.

This follows Android's [gfxinfo/framestats guidance](https://developer.android.com/tools/dumpsys) and the [AOSP isolated reset/measurement precedent](https://android.googlesource.com/platform/platform_testing/+/996f5b7/libraries/aupt-lib/src/android/support/test/aupt/GraphicsStatsMonitor.java). Frame-stage interpretation follows [Android slow-rendering guidance](https://developer.android.com/topic/performance/vitals/render). Detailed frame rows are only the retained recent tail (typically118–120), not all window frames. Their stage intervals overlap; no component-level React trace is inferred. Display frame intervals in these tails are about8.32ms; no fixed16.67ms threshold was substituted for Android's own deadline/jank classification. Empty histograms print4950ms sentinels; these are not real slow frames or valid idle percentiles.

| Controlled window | Duration | Recording | Delta frames | Delta janky | Jank |
|---|---:|---|---:|---:|---:|
| Home idle | 15s | off | 0 | 0 | N/A: no frames |
| Home paused control | 15s | off | 0 | 0 | N/A: no frames |
| Home scroll1 | 15s | off | 1809 | 4 | 0.22% |
| Home scroll2 | 15s | off | 1860 | 1 | 0.05% |
| Home scroll, route-verified retake | 15s | off | 1823 | 2 | 0.11% |
| Home + Hymn, playing | 15s | off | 1365 | 426 | 31.21% |
| Home/Search navigation1 | 15s | off | 251 | 89 | 35.46% |
| Home/Search navigation2 | 15s | off | 269 | 96 | 35.69% |
| Home paused, natural recovery (route verified) | 30s | off | 191 | 5 | 2.62% |
| Search idle | 15s | off | 0 | 0 | N/A: no frames |
| Search + Hymn, playing2 | 15s | off | 940 | 756 | 80.43% |
| Search + Hymn, playing1 | 15s | off | 908 | 776 | 85.46% |
| Search paused, natural recovery | 30s | off | 1 | 1 | 100.00% |
| Search scroll1 | 15s | off | 1832 | 3 | 0.16% |
| Search scroll2 | 15s | off | 1843 | 1 | 0.05% |
| Search scroll, route-verified retake | 15s | off | 1829 | 4 | 0.22% |
| Home + Something, playing1 | 15s | off | 1423 | 393 | 27.62% |
| Home + Something, playing2 | 15s | off | 1297 | 502 | 38.70% |
| Same Home playback, recorded between1/2 | 15s | ON | 1362 | 465 | 34.14% |

The earlier **42.02%** and **15.35%** remain historical cumulative process observations. They are not compared as matched trials to these bounded windows. Zero-frame idle windows establish no idle redraw workload during those samples; they do not establish an idle frame-rate or a0%-jank benchmark. Search paused recovery emitted only **one late frame** in30s: its mathematical100% is a one-frame sample, not sustained100% jank.

The unrecorded/recorded/unrecorded Home playback sequence measured27.62% /34.14% /38.70%. Recording is **not sufficient to explain** the deadline misses. One pair with workload/thermal variation cannot quantify a recording penalty; the recorded rate lies within the two unrecorded rates. Repeated navigation measured35.46% /35.69% without recording. Search with native playback measured85.46% /80.43% without a visible track-row Living Wave. Native PLAYING and advancing position persisted across these playback windows.

**Attribution:** reproducible late frames occur in WAVEN's playback-visual and navigation rendering workloads during normal unrecorded operation. Navigation tails show approximately47.7–48.1ms p95 intended-vsync-to-completion latency,10.85–10.94ms p95 UI-until-sync interval and29.36–29.73ms p95 issue-to-GPU-completion interval. Search-playing tails show16.66–17.11ms p95 issue-to-GPU-completion. These measurements support rendering/presentation cost, not a precise React component diagnosis. Existing Mini Player progress interpolation uses a JS-driven value and its pulse uses native animation; Living Wave itself uses a native driver. Those are code-inspected candidate costs, **not proven individual causes**. Search playing still includes Mini Player visuals and potentially retained routes, so it is not a pure-audio or isolated-bar experiment.

Real metadata recovery/timeouts overlap both high-jank playing windows and low-redraw paused windows. Provider work can delay admission and deliver rendering updates, but the evidence does not establish it as the sole cause of continuous playback jank. No scheduler rewrite, animation rewrite, refresh-rate override, dependency change or unproven optimization was attempted. There is no located project-wide numeric jank pass threshold; **FAIL in the matrix means observed missed frame deadlines**, with acceptability left for explicit owner review.

Thermal status was0 initially and reached1 (mild) in later samples; no thermal override, refresh-rate, power or animation setting was changed. Memory PSS snapshots range **436207–756957KiB**, across differing workloads in the same process. These are not controlled heap-retention measurements. **No memory leak is established.** Raw memory/thermal snapshots and frame tails remain available.

Measurement limits are preserved: the first attempt failed before sampling because Android date formatting needed a quoted-free timestamp; a first playing attempt rejected a nonzero baseline caused by animation frames between reset/read. Later same-epoch delta accounting subtracts those frames correctly. home-scroll-verified failed its foreground guard and is excluded. An earlier home-natural-recovery had uncertain end-route identity and is excluded in favor of recovery-home-controlled, with Home hierarchies before/after. After the owner confirmed the phone would remain untouched, final Home/Search scrolling was repeated with route captures. Invalid attempts are retained, not relabeled as PASS. Endpoint guards cannot prove absence of every external interaction inside earlier windows.

## Genuine forbidden source and isolation

Original R6 log event at device14:05:03.754 is **failure_source-forbidden**,4099ms; play failed4119ms. The unchanged native template maps source-http-403 to this category. The sanitized event supports genuine HTTP403 rejection, not cancellation or an invented provider response body. Validation and access protections remain intact.

Two bounded safe reproduction attempts on the current APK both succeeded: Something Just Like This reached native PLAYING (stream queue3866ms, native resolved4980ms, handoff8890ms); Hymn for the Weekend reached native PLAYING (queue69ms, native resolved4733ms, handoff4832ms). Both use existing Library identities. A different playable track therefore works on R6, but **there was no new403 immediately before it today**. No denied URL was injected, access control bypassed, or network fault manufactured. Further repeated source attempts were unnecessary once the fixture proved unavailable.

R4's preserved physical sequence remains **historical PASS**: real forbidden Hymn → failed row “Playback failed. Retry” → unrelated Yellow PLAYING → actual same-route Hymn Retry → PLAYING. It is not promoted to current-build physical PASS. R6's original failed fresh resolution of an already-native track retained the authoritative prior PAUSED session; that is distinct from displaying a newly failed unrelated row. Current failed-row/retry rendering has deterministic coverage, but a new R6 physical failed-row retry remains an **UNAVAILABLE FIXTURE / MANUAL REQUIRED** gate unless the owner explicitly accepts historical inheritance. New audible output is not inferred from native PLAYING; R4's owner confirmation remains historical.

## Discovery and the reported Focus wait

Current resting Home/Search captures show usable normal destinations without a stale global banner. Optional New Releases still genuinely times out while other provider work succeeds; absence of a global warning does **not** assert aggregate ONLINE. The final controlled Home recovery window observes real retries/timeouts with the same Home before/after route. Valid cached cards are retained. No strict initially-empty physical Home fixture was manufactured; mounted controlled-provider tests remain automated evidence.

The previous approximately41s tap-to-ready estimate mixes host/device clocks and is not an exact latency. The exact captured **first category begin→ready interval is35.227s**. The reviewed timeline is in focus-timeline-review.json, with a SHA-referenced original log excerpt:

| Device interval | Established meaning |
|---|---|
| Before13:58:04.349 | Earlier metadata pass still running; the selection occurred partway through. Exact selected-screen admission wait cannot be recovered. |
|13:58:04.366→12.470 (8.104s)|First category attempt waits in FIFO, then cancels; matching remote command has0ms execution. This is not8.104s category provider latency. Sanitized capability labels limit exact request-ID attribution. |
|13:58:04.349→12.380 (8.031s)|Automatic coordinator backoff overlaps that queue wait. Revalidation publishes remoteReady=false; Search's effect cleanup aborts its caller. Do not add this overlap twice. |
|13:58:12.470→13.057 (0.587s)|Remainder of internet/provider revalidation after cancellation. No paused-stage or physical background event is established in this interval. |
|13:58:13.057→39.005 (25.948s)|Ordered recovery work before retried category: a12.003s New Releases timeout, charts and optional metadata fanout. This is not all a category queue-wait event. |
|13:58:39.005→39.593 (0.588s)|Successful category: recorded queue0ms, provider execution568ms, ready140items588ms. Provider execution includes client work, not server-only/network latency. |
|13:58:39.593→40.526 (0.933s)|Mounted category is usable before unrelated metadata pass fails with remaining pending work. No false global ONLINE. |

Most delay is admission/order/FIFO, overlapping backoff and a cancelled attempt, rather than the successful provider execution. No evidence attributes this specific Focus delay to screen recording or an app lifecycle background transition. Automatic recovery works; optional discovery latency remains a documented concern. Global scheduling and cancellation protections remain unchanged.

## Phase 8 acceptance reconciliation

acceptance-matrix.json contains25 entries with separate **current physical / historical physical / automated / disposition** fields. Status definitions are exact: PASS for the stated observed scope; PARTIAL for incomplete coverage; UNAVAILABLE FIXTURE for a setup not safely available; MANUAL REQUIRED for remaining human/physical work; OWNER EXCEPTION REQUIRED for an explicit waiver/inheritance decision; FAIL for observed failure. Counts are **6 PASS; 9 PARTIAL; 5 UNAVAILABLE FIXTURE; 3 MANUAL REQUIRED; 1 FAIL; 1 OWNER EXCEPTION REQUIRED**. These counts are not completion percentages.

| ID | Requirement | Status | Remaining disposition |
|---|---|---|---|
| P01 | Exact installed candidate / protected state / Library | **PASS** | No new release candidate. |
| P02 | Normal Wi-Fi / streaming | **PASS** | Current physical PLAYING, not audible assertion. |
| P03 | Home/Search free of stale global warnings | **PASS** | Do not equate absence of global warning with aggregate ONLINE. No live all-capabilities-healthy state established this session. |
| P04 | Mounted category automatic recovery | **PASS** | Exact earlier owner Jazz HTTP trigger remains unavailable. |
| P05 | Global CHECK after broad real outage | **PARTIAL** | Exact-R6 broad physical CHECK gate remains manual; controlled test is not physical PASS. |
| P06 | Initially-empty Home recovers live releases without remount | **UNAVAILABLE FIXTURE** | Manual physical fixture required, or explicit owner exception; no deterministic promotion. |
| P07 | Genuine forbidden-source isolation on current candidate | **PARTIAL** | Fresh R6 forbidden fixture unavailable; R4 inheritance needs owner decision if current-build physical sequence waived. |
| P08 | Truthful failed row / accessible retry | **UNAVAILABLE FIXTURE** | Current-R6 failed-row physical retry remains manual or explicit inherited-evidence exception. |
| P09 | Audible output | **MANUAL REQUIRED** | Owner may confirm exact current candidate in a later live playback scope or explicitly accept historical R4 audio evidence. |
| P10 | Wi-Fi disabled with usable cellular | **UNAVAILABLE FIXTURE** | Manual usable-SIM/network fixture or explicit owner exception. Enabled mobile_data is not cellular PASS. |
| P11 | No alternate network / airplane mode | **PARTIAL** | Historical physical evidence retained; current-candidate inheritance or rerun is owner decision. |
| P12 | Loss during browsing/Search/Artist/Album loading | **PARTIAL** | R6 exact-build outage path not physical PASS. |
| P13 | Loss during playback/new source; reconnect; flapping | **PARTIAL** | Exact-R6 flapping regression remains inherited historical evidence unless separately rerun. |
| P14 | Offline background/process restart and reconnect | **PARTIAL** | Current-candidate offline restart may be rerun later or explicitly inherited. |
| P15 | Offline favorite/playlist mutations; cached metadata/artwork | **PARTIAL** | No clear/migration. Normal playback only updates existing history ordering/timestamps. |
| P16 | Cloud pause/reconnect and pending work | **PARTIAL** | Do not enable Phase9 or make live writes for a fixture. Owner must reconcile scope/conditional physical coverage. |
| P17 | Offline next-item resolution / multi-item skip | **UNAVAILABLE FIXTURE** | Manual supported fixture required; no new queue feature or next-phase implementation. |
| P18 | Local/downloaded playback if supported | **UNAVAILABLE FIXTURE** | Conditional requirement; downloads remain Phase11. No waiver for implementing future scope is requested. |
| P19 | ONLINE->OFFLINE->RECOVERING->ONLINE | **PARTIAL** | No fake ONLINE or cached-success health reset. Current exact-build full cycle not newly established. |
| P20 | Living Wave behavior / pause / Reduced Motion | **PASS** | Behavioral motion PASS does not imply frame-performance PASS. |
| P21 | TalkBack / large text / physical React commit telemetry | **MANUAL REQUIRED** | Do not equate mounted/mock accessibility coverage with Samsung assistive-tech proof. |
| P22 | Rendering deadlines during playback and navigation | **FAIL** | FAIL refers to measured frame deadlines, not a proven new Phase8 functional correctness defect or a numeric master-plan threshold. No implementation patch made. |
| P23 | No observed crash/ANR and no unsupported memory-leak claim | **PASS** | No leak or crash-free lifetime guarantee; no heap-retention proof. |
| P24 | Accept unresolved performance and physical gaps | **OWNER EXCEPTION REQUIRED** | If owner elects acceptance without remediation/rerun, record explicit accepted residuals and cross-build inheritance. No ACK/percentage award now. |
| P25 | Signed distribution regression | **MANUAL REQUIRED** | Later signed-distribution regression under master-plan tier; this task authorizes no release or Phase9+ work. |

R3's real airplane/offline, Search/detail interruption, playback/flapping, offline mutations, process restart and final ONLINE remain valuable historical evidence. R6 changes connectivity/discovery behavior, so neither unchanged native payloads nor deterministic tests silently upgrade those to new R6 physical passes. The owner must choose rerun versus explicit historical inheritance for any required unresolved gate. Phase7's accepted preimage/account-switch limitations remain frozen and do not waive Phase8 gaps. Signed-distribution regressions remain a distinct later tier; this review is not a canonical release.

## Validation, source preservation and final state

Fresh gates: **TypeScript PASS;172/172 focused PASS;503/503 complete suite PASS**. No implementation or test source was changed. The only new tracked-scope artifact is this separate readiness report; helpers/measurements are under ignored release evidence. Current-round existing-source delta0, new document1. Including this report, cumulative R5-relative accounting is **12paths =9implementation/tests +3documents**, and original V8.5A.1-relative accounting is **32paths =24implementation/tests +8documents**. The sealed earlier R6 report's11/31 accounting remains true for its historical checkpoint. Branch/HEAD, lockfile, accepted ACKs, native templates and all earlier reports/archives remain hash-protected.

Final readback verifies the unchanged installed SHA, Personal user0, protected package state/code hashes, original network/animation settings, validation absent Work, no observed crash/ANR exit, and **1favorite /1playlist /12history**. Normal test playback reorders/updates existing history timestamps; no identity was deleted or collection edited. The retained Phase7 development-package MMKV was not opened, cleared, transferred or migrated. Playback is left paused. Full app-private MMKV byte extraction is not claimed for this non-debuggable package.

Evidence archive: release/waven-v85-r6-review-20261018/WAVEN-V8.5-R6-ACCEPTANCE-REVIEW-20261018-SEALED.zip; its adjacent seal-verification.json verifies every entry size/hash and manifest. The unchanged APK and prior large seals are referenced by verified SHA rather than rebuilt/repackaged candidates. Read source-integrity.json, final-device-audit.json, frame-analysis.json, acceptance-matrix.json and gates.json for machine-readable checkpoints.

**Decision: review delivered; owner acceptance remains pending.** Known normal-operation frame misses and the enumerated physical gaps are not newly accepted residuals. No Completion ACK, commit, push, merge, tag or release; no data clearing, protected-profile changes, Phase9+ or HIKARI work. Overall WAVEN completion remains **60%**.
