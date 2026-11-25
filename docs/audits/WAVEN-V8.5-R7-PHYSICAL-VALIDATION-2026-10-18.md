# WAVEN V8.5 R7 — approved physical performance trial

**2026-10-18 · R7 installed and verified · performance repair PARTIAL · Phase 8 NOT ACCEPTED · overall 60%**

R7 meaningfully reduces repeated playback presentation work and improves playback frame results in matched trials. **It does not close the complete performance gate. Stopped Home/Search navigation has a higher janky-frame rate than R6 in all four R7 trials.** The physical trial is delivered with that failure retained. No second speculative patch or replacement APK was introduced to hide it.

This report supersedes the installation-pending status of the frozen [R7 pre-install investigation](WAVEN-V8.5-R7-PERFORMANCE-REPAIR-2026-10-18.md). That report and its verified ZIP remain unchanged as historical checkpoints. Installation approval is not Phase 8 owner acceptance. The [authoritative master plan](../plans/WAVEN-V1-MASTER-PLAN.md) remains unchanged: Phase 8, Offline awareness and connectivity resilience, fixed 8%, earns 0%; overall 60%. No Completion ACK.

## Exact installed identity and protection

The owner explicitly approved this exact R7 artifact for an isolated update and controlled physical validation. Samsung SM-S928B / S24 Ultra, serial **R5CWC2RYXZF**, Personal user **0**, package **com.okali.waven.phase8validation**, version **0.1.0(1)**, arm64-v8a, existing release-derived validation build, debuggable false.

APK: `release/waven-v85-r7-20261018/WAVEN-V8.5-PHYSICAL-CANDIDATE-r7.apk`, 67,447,379 bytes.

**SHA-256: D8377EE10FD456B26E237839DB8F4B24DD9D34375A7A69F08B7C7DA73AF666F3**

Existing validation signer SHA-256: **FAC61745DC0903786FB9EDE62A962B399F7348F0BB6F899B8332667591033B9C**. This is not the canonical distribution signer. Signature, alignment, one launcher and **31 DEX/native-library payloads byte-identical to R6 r2** passed at the sealed build checkpoint. Preflight verifies both old/new signer identities; remote SHA and the pulled installed R7 APK match the approved candidate.

Only `install -r --user 0` updated the validation package. R6 r2 was pulled and hash-verified before installation: **13E192C878213EA822BB69E0CD695598CB1F591152F9D5F213217361604C095C**. Its original APK, pulled preimage, earlier R3–R6 evidence and R7 pre-install seal remain preserved. Final protected-package state/code hashes match preflight, including canonical/development/sourcevalidation Work installations. Validation remains absent from Work user 10. Current real profile inventory, rather than older launcher-audit assumptions, is recorded in device-before.json.

No uninstall, app-data clearing, cross-package transfer, Google-session change, Orion Cloud write, network mutation or refresh-rate override. The only settings mutation was the approved temporary Reduced Motion check; all three animation settings read back at their original value 1. Airplane/Wi-Fi/mobile-data settings remain 0/1/1. No protected Work mutation.

## Method and actual results

Evidence root: `release/waven-v85-r7-postinstall-20261018/`. All R7 measurements use the approved installed SHA above. R6 comparisons come from the frozen R7 investigation baseline, not unrelated cumulative process counters. The earlier 42.02% /15.35% process observations remain historical and are not used as paired benchmarks.

Each untraced window lasts 15 seconds, recording OFF. Only target gfxinfo diagnostic counters reset; baseline/end deltas require the same PID and counter epoch. Native PLAYING/PAUSED/NONE prerequisites and end states are guarded. Endpoint screenshots, display, memory and thermal captures occur outside quiet intervals; specified scroll/tab gestures remain instrumentation. Actual route captures are retained. Thirty-three complete windows were captured: **31 eligible, 2 excluded**. Earlier precondition failures emitted no complete measurement and are not added as samples.

Display reports 1440×3120, peak/vsync about 120Hz; recent-tail intervals remain about 8.32ms. Thermal status 1/2 and dynamic frame deadlines vary naturally and are recorded. No settings were forced to manufacture matching conditions. Match track, screen, action sequence and thermal status where indicated; additional mismatched trials are retained separately. Endpoint guards cannot prove every instant of a window was free of external interaction.

| Workload | R6 frames/janky (rate) | R7 frames/janky (rate) | Conditions / assessment |
|---|---|---|---|
| Home idle | 2/2; 0/0 | 2/2; 0/0 | Thermal 1 both. Sparse recovery redraws, no sustained idle animation. Zero frames = N/A. |
| Home playback, visible row Wave | 1293/508 (39.29%); 1378/434 (31.49%) | 1548/268 (17.31%); 1596/215 (13.47%) | Same Hymn identity, thermal 1 both. Repeated improvement, residual misses remain. |
| Search playback, no visible row Wave | 798/653 (81.83%); 886/776 (87.59%) | 1411/368 (26.08%); 1297/512 (39.48%) | Same Hymn identity, thermal 2 both. Repeated improvement; retained routes/Mini Player remain present. |
| Navigation during playback | 1140/600 (52.63%); 1052/587 (55.80%) | 1406/411 (29.23%); 1259/453 (35.98%) | Same Hymn, thermal 2 both, equivalent tab actions. Improved, not deadline-clean. |
| Navigation without playback | 236/86 (36.44%); 251/99 (39.44%) | 242/133 (54.96%); 246/122 (49.59%) | Thermal 1 both. **Worse jank rate; improvement gate FAIL.** |
| Navigation stopped, cold-process repeat | Same frozen R6 pair | 259/114 (44.02%); 236/127 (53.81%) | Thermal 1; worsening rate persists after restart. Not discarded as warm-up. |
| Home scrolling | 1863/2 (0.11%); 1821/9 (0.49%) | 1833/4 (0.22%); 1826/2 (0.11%) | R6 thermal 1, R7 2. Similar observed range; thermal mismatch disclosed. |
| Search scrolling | 1851/2 (0.11%); 1862/11 (0.59%) | 1813/11 (0.61%); 1839/2 (0.11%) | R6 thermal 1, R7 2. No general scrolling improvement claim. |
| Home paused / static indicator | 2/2; 0/0 | 0/0; 0/0 | R6 thermal 1, R7 2. No meaningful idle jank rate. |
| Search paused / idle | 0/0; 0/0 | 0/0; 1/1 | Thermal 2 both. One recovery redraw is not sustained 100% jank. |
| Natural recovery with playback | 807/643 (79.68%), one valid dedicated R6 window | 1500/321 (21.40%); quiet repeat 1566/256 (16.35%); recovery repeat 1616/208 (12.87%) | R6 thermal 1, R7 2. Genuine recovery events in first and third R7 windows; middle repeat has none. Not a strictly matched recovery benchmark. |
| Natural recovery paused | R6 Search 0/0 with genuine recovery event | R7 Search 1/1 in verified-paused2 and 1/1 in recovery-paused-repeat1; following repeat 1/1 | Thermal 2 for these R7 windows; last repeat has no recovery event. Sparse events, not continuous animation. |

The 14 requested conditions are covered by the named windows: Home idle, Search idle (queue paused), two scrolling destinations, navigation stopped/playing, Home/Search PLAYING and PAUSED, visible/nonvisible row Wave through Home/Search, and natural recovery active/paused. This is not a no-queue Search fixture. The machine-readable comparison preserves every raw trial, thermal pair, native endpoint and recovery event, including additional Search thermal-1 trials (35.03% /43.68%), Something thermal-2 trials (40.67% /39.35%) and early playing-navigation trials (25.05% /29.90%, thermal 1 /1→2). Those extra trials do not replace the matched Hymn pairs.

Detailed frame rows are a recent tail of about 118–120 frames, not every window frame. Representative tail p95 intended-vsync-to-completion: matched R7 Home playback **20.69/14.82ms** versus R6 **21.79/22.70ms**; matched R7 Search **15.72/24.12ms** versus R6 **22.17/19.67ms**. Search tail p95 does not uniformly improve despite its better whole-window jank rate. Stopped navigation R7 **48.13/50.90ms**, repeats **49.68/49.00ms**, versus R6 **49.96/53.93ms**: higher jank percentage is not equivalent to a larger p95 latency. Tail deadline budgets vary (for example, R7 stopped-nav1 median 8.33ms versus R6 33.31ms), so the percentage increase cannot alone identify a slower source component. Whole-window Android deadline misses remain real; no invented fixed 16.67ms threshold or new acceptance limit is used.

## Trace comparison and bounded attribution

Separate 12-second Perfetto trials are kept outside untraced benchmarks. Official Perfetto 58.2 trace processor identity remains verified at the pre-install checkpoint. See trace-analysis-summary.json, per-trace SQL/CSV and raw traces.

| Separate trace | R6 | R7 | Interpretation |
|---|---|---|---|
| Search PLAYING Fabric batches | 978 | 27 | Intended repeated JS/Fabric layout-property path is substantially reduced. |
| Search PLAYING UPDATE_PROPS numInstructions=2 | 959 | 13 | Not a claim that every batch belonged exclusively to progress. |
| Search PLAYING UPDATE_LAYOUT batches | 60 | 14 | Residual real position/state updates remain. |
| Search PLAYING CPU JS /UI /RenderThread | 6464.2 /2881.8 /3926.7ms | 4403.3 /2824.3 /5265.5ms | JS work falls; RenderThread work rises with more native-driven rendering. Not a universal CPU/GPU win. |
| Stopped navigation batches | 424 | 48 | Five tab actions in each trace; provider/lifecycle work differs. |
| Navigation TextView measure /StaticLayout | 408 /623 | 212 /180 | Less repeated text/layout work, but no corresponding jank-rate improvement. Route creation remains. |
| Navigation CPU JS /UI /RenderThread | 1047.6 /1280.6 /797.7ms | 2031.0 /1302.3 /749.9ms | Broad provider/routing work remains; no exclusive component attribution. |

Paused Search R7 trace contains no mount/layout/traversal output and no FrameTimeline frames; JS still performs provider work. Background PLAYING advances native position **207322→219342ms**, with RenderThread about 506.2ms versus foreground Search 5265.5ms; first ~0.8 seconds is foreground transition. This is neither proof every hidden animation stopped nor an isolated bars/GPU experiment. FrameTimeline includes app deadlines, buffer stuffing, SurfaceFlinger and display/scheduling classifications; these are not summed into gfxinfo totals.

The pre-install correction removes an evidence-backed avoidable path: native progress masks replace per-frame animated width, and native nav transforms replace animated label width/margin. The source and mounted tests justify that correction; actual traces now confirm lower Fabric traffic. **The remaining stopped-navigation deadline problem is not established as a single component defect.** Tail latency is similar, dynamic deadlines differ, navigation still mounts routes, and provider JS work varies. No scheduler rewrite, hardware-layer guess, theme redesign or second playback owner is justified by this evidence. Further profiling is required before claiming the entire performance mission repaired.

No actual release-build React commit counts, JS callstack samples or isolated GPU-shader durations are available. Mounted NativeAnimated doubles remain deterministic evidence. Memory PSS/RSS snapshots are recorded across differing workloads, without controlled retained-heap/GC proof; **no memory leak is established**.

## Functional and acceptance evidence

Fresh Hymn and Something reach native PLAYING, with source handoffs **5081ms /4252ms**. A later fresh Hymn takes **3798ms**; recovery replay takes **8811ms**, including **3686ms FIFO admission** and 5063ms stream work. Other stream admission samples are 0ms. These are observed command/queue intervals, not server-only latency. The historical 7738ms wait and Focus category timeline remain in earlier reports; no scheduling protection is weakened or timeline rewritten.

Cold process restart restores the current Library and source-resume position: native Hymn resumes at **42549ms**, then pauses at **43728ms** and resumes at **43734ms**, preserving identity/position. Final pause reads **45300ms**. Home progress is visible at early, middle and end-of-track states without an observed anchoring defect; full normalized geometry is also tested deterministically, not claimed as a complete physical viewport matrix. Home/Search labels and selection settle correctly; transient captures during transition are not treated as resting geometry.

Five lossless screenshots per motion phase show changing active/restored four-bar pixels, identical paused/reduced row pixels, and matching authoritative native states. The Reduced Motion row crop differs by **0 pixels** between all adjacent samples; normal/restored samples differ. All settings are restored. Screenshot sampling proves state-dependent motion, not seamless cycle timing or human frame smoothness. The R5 owner's smooth-cycle feedback remains historical. **The owner directly confirmed audible output on this exact R7 build.**

Settled Home/Search are usable without a stale global warning. A transient recovery notice is visible in the verified-paused Search captures and clears by the second window's end; not every capture is banner-free. Pop shows actual featured/community playlists. The 30-second diagnostic probe did not capture a new category-ready event, so it is not a fresh category recovery PASS. Actual optional New Releases failures and natural recovery retries persist; no all-capabilities-healthy ONLINE, initially-empty Home recovery or broad-outage CHECK was manufactured. No new genuine403 occurred: failed-row/retry and forbidden-then-unrelated isolation remain unresolved current-build physical fixtures. Historical R4/R6 events are preserved with their build boundaries.

Normal-network restart readback: **1 favorite /1 playlist /12 history**; named playlist **V8.5 Offline Smoke** still contains **MOON MUSiC by Coldplay**. Normal playback only updates existing history order/time. No collection edit or app-private MMKV byte extraction is claimed. A final optional return to the All filter was refused when foreground changed after the captured playlist detail; no other-app tap/screenshot was performed. This does not invalidate the completed cold Library and playlist readbacks.

The updated 25-case acceptance matrix has **6 PASS, 10 PARTIAL, 5 UNAVAILABLE FIXTURE, 2 MANUAL REQUIRED, 1 FAIL, 1 OWNER EXCEPTION REQUIRED**. These are evidence statuses, not completion percentages. PASS applies only to its stated scope. Remaining gates include fresh forbidden isolation/failed-row retry; initially-empty live releases; usable cellular; current-build broad CHECK, loss/flapping/offline restart/mutations; supported multi-item queue/local playback if applicable; TalkBack/large-text physical coverage; conditional Cloud scope; signed distribution; and the unresolved rendering deadline gate. Historical support and deterministic tests do not silently close them. No exceptions have been granted for R7.

## Validation, source accounting and retained failures

Exact approved product source is unchanged throughout this physical round. Sealed gates remain applicable: **TypeScript PASS, 209/209 focused PASS, 510/510 full PASS, Android release-derived build PASS**. No need to rebuild or install a different candidate. All playback, Living Wave, navigation, discovery, connectivity and persistence regressions remain included. Generated source/native restoration and dependency locks remain protected.

R7 implementation boundary remains two presentation components and two test paths, plus the pre-install report. This physical round adds **only this separate report** to tracked scope. Total R6-relative delta **6 paths =4 implementation/tests +2 documents**; original V8.5A.1-relative **37 =27 implementation/tests +10 documents**; R5-relative **18 =13 implementation/tests +5 documents**. Exact 134 dirty preimages, approved source hashes, unchanged accepted ACK/master and twelve prior APK/seal identities are checked in source-integrity.json. The earlier Phase7 missing-preimage and live-account-switch limitations remain accepted historical facts; no rollback evidence is fabricated.

All failed attempts remain explicit: initial PAUSED guards rejected restored native NONE before sampling; one recovery-active trial naturally ended at258288ms and is excluded; the pause guard then refused to toggle. One paused-recovery window lost foreground and is excluded; its next attempt refused before sampling. Verified repeats succeeded. A Pop diagnostic probe timed out despite usable visible content. Later playlist/All navigation attempts refused when WAVEN lacked foreground; owner restored foreground for the successful playlist readback. An initial host quoting parse error ran no device action. No failed or invalid attempt is promoted to PASS; see harness-limitations.json and raw evidence.

## Handoff

Physical trial report, full matrix, before/after summaries, trace queries/results, raw frame/condition snapshots, motion images, owner approval/audio confirmation, installation/readbacks and candidate are sealed separately in:

`release/waven-v85-r7-postinstall-20261018/WAVEN-V8.5-R7-PHYSICAL-REVIEW-20261018-SEALED.zip`

Adjacent seal-verification.json checks every entry size/SHA-256 and manifest. The original R7 pre-install seal is referenced by **B228E3B7C4B08040D781EB4FC7EB19FE5A6780853BE67E4967EB26D3DECE14D1**, unchanged. Large earlier artifacts remain preserved locally and SHA-referenced, not replaced.

**Decision: approved R7 physical trial complete; playback improvement demonstrated; complete performance gate still open. Phase8 remains IN PROGRESS /NOT ACCEPTED; overall60%.** No Completion ACK, commit, push, merge, tag or release. No Phase9+, HIKARI, data clearing or protected-profile change.
