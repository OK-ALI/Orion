# WAVEN V8.5 R8 — F physical results and adjacent-control checkpoint

**2026-10-19 PKT. Exact approved F installed. R8 repair NOT VERIFIED; playback comparison unresolved. Phase 8 NOT ACCEPTED, overall 60%, no Completion ACK.**

F improves stopped navigation and physically corrects the observed Search return-position defect. It removes E's repeated route cache builds, preserves selected background pixels and the low playback Fabric mount workload. However, current Search and playing-navigation jank counters are worse than the earlier R7 measurements. Lower latency and differing Android frame deadlines make a source-regression conclusion premature. A nearby exact R7→F control trial is proposed, requiring separate installation approval. No additional implementation change is justified yet.

## Installed identity and protections

Owner reply: **“Approve F isolated update and physical trials.”** Only Personal user 0's existing `com.okali.waven.phase8validation` on Samsung SM-S928B/R5CWC2RYXZF was updated. Installed and pulled APK match **`6D777C09C5F2F7531FA761D78C9A9C7DF40F54EA8E8BB021C604164A76E4C47C`**, version 0.1.0(1), UID 10719. Existing validation signer, one launcher, 16 KiB alignment and all 31 unchanged R7 DEX/native payloads verify. E's pulled exact preimage is retained. F remains installed.

Final cold readback: **1 favorite / 1 playlist / 12 history**; **V8.5 Offline Smoke contains MOON MUSiC by Coldplay**. Existing history order/time changes through normal replay/track switch only; no favorite/playlist edit or private-MMKV extraction. Cold source context restores NONE at Something Just Like This 135343 ms, no autoplay. Protected package code hashes/user states, target absence from Work user 10, network settings and all three animation scales verify unchanged/restored. Current protected installations are in Work and absent from Personal, per preflight; no historical launcher assumptions applied. No observed CRASH/CRASH_NATIVE/ANR in target exit-info. No data clear, uninstall, Google-session operation, Orion Cloud write or refresh-rate change.

Master plan and accepted Phase 6/7 ACKs remain unchanged. Phases 0–7 earn 60%; Phase 8 fixed 8% earns 0%. Accepted Phase 7 residual limitations remain preserved; no missing historical preimages or live Google-account switch are fabricated. No Phase 9+/HIKARI work.

## Controlled performance

All quiet windows are 15 seconds, recording OFF, same PID/reset epoch and native endpoints, foreground guarded, about 120 Hz/8.32 ms intervals, thermal status 0/0. Navigation uses eight equivalent alternating Home/Search taps; endpoint screenshots/diagnostics are outside the interval. Traces are separate workloads. Live payload readiness, provider work, OS frame deadlines and sequential timing remain limitations. Every unfavorable window is retained.

| Workload | F frames / janky | F trial jank | F pooled | Earlier fresh R7 pooled |
|---|---:|---|---:|---:|
| Stopped navigation | 1020 / 366 | 20.00%, 52.30%, 36.22%, 36.33% | 35.88% | 49.59% |
| Home playing | 3193 / 461 | 9.78%, 19.52% | 14.44% | 14.21% |
| Search top playing | 2464 / 1088 | 51.81%, 37.64% | 44.16% | 27.68% |
| Playing navigation | 2757 / 881 | 21.58%, 44.61% | 31.96% | 24.33% |

Two initial Search windows actually use the previously restored Artist/Moods scroll position: 50.13%, 38.94%, pooled 44.18%. They remain separate from the matched top-Genre comparison. Their initial scene PNG was captured before tab transition completed and still showed Home; end screenshots establish actual scrolled Search. Fresh inspected top-Search screenshots ground the matched repeats. No invalid route claim is hidden or converted into a favorable exclusion.

Stopped-navigation recent-tail p95 latency is **29.88–31.55 ms**, versus E **142.11–154.94 ms**. The separate F stopped trace has **zero `buildDrawingCache` slices**, compared with E five/604.97 ms. F traversal maximum 14.86 ms; 151 draw slices/763.57 ms, mean 5.06 ms. Trace JS CPU 4466.56 ms, UI 1507.95 ms, RenderThread 727.99 ms; 83 Fabric batches, 923 View/594 Text creations, 532 text measures. Payload differences prevent treating mount totals as isolated component causality. C graph reuse and Home windowing remain bounded correctness/work reductions, not sole proof of physical speed.

F's 12-second Search-playing trace has **22 Fabric batches**, versus historical R7 27 and R6 978; no View/Text creation events in that query. JS scheduled CPU 444.59 ms, UI 3208.15 ms, RenderThread 5840.58 ms. Draw 1019 slices/5020.32 ms, mean 4.93 ms. Native PLAYING advances 240306→252324 ms throughout. Thus the R7 mount improvement remains observed, while full rendering protection remains unresolved.

Matched Search tail p95 latency is ~13.87–13.90 ms versus earlier R7 14.78–19.12 ms; UI/GPU intervals are similar or slightly lower. Yet F has more jank and fewer frames. F first Search tail median deadline budget is 8.33 ms, second 16.65 ms; earlier R7 medians 24.98/16.65 ms, despite similar refresh intervals. The traced expected app deadline is 8.33 ms. These are distinct timing concepts; stage intervals overlap, recent rows are not full-window distributions, and buffer stuffing/display/SurfaceFlinger categories are separate. **Neither dismiss the unfavorable counters nor declare a proven source regression from them. R8's combined success gate is NOT VERIFIED.** No arbitrary threshold, scheduler rewrite or animation suppression.

## Pixels, memory and origin

Four selected settled D/F Home background regions compare **211200 pixels, zero differences/max delta 0**. This covers primary gutter, root gap, hero background and top gutter, not whole-screen/all-route identity. Original lossless PNGs and comparison code remain.

F first-window after-snapshot: PSS 474883 KB, RSS 593604 KB, Graphics 163640 KB, versus E 711199/838488/292036 KB. F Graphics remains ~163128–163640 KB across four windows; GPU cache around 80–85 MB versus E 203.53 MB. PSS grows to 663818 KB with ongoing provider/view allocations during the four windows. These bounded snapshots establish reduced graphics pressure, **not a memory-leak or lifetime memory-stability conclusion**.

Fresh Search later-Artist checks open populated Ashe detail and return through both on-screen Go back and Android Back. Settled anchors match exactly: Jazz `[70,512][697,928]`; ASHE `[620,1250][970,1688]`; Focus `[651,1965][1197,2329]`. Immediately after the first return a truthful Finding-artists notice adds 140 px below Genre; after it clears, all anchors return exactly. Horizontal and page vertical restoration therefore have **scoped physical PASS** on this payload/device. This corrects E's 724 px jump without a second navigation/scroll owner. Raw before/detail/transient/settled/native-Back captures remain.

Home horizontal rail reaches Earrings/Stop The Wedding!/stupid song beyond the initial window, with artwork rendered. Available New Releases are noninteractive track summaries, not album detail targets. An attempted named-card guarded tap refused because the node was not clickable; no tap executed. Subsequent Home layout/order changed during live refresh; attribution to user input versus refresh lifecycle was not instrumented. No Home album-detail/Back or rail-origin PASS is claimed; that live fixture is unavailable in this run. Source retains accepted artwork leases/reveal ownership and automated coverage; deterministic tests do not replace the missing physical sequence.

## Playback, motion and discovery

- Fresh Hymn replay reaches native PLAYING; owner confirms **“Yes, audio is audible.”** This is F human audibility evidence, not milestone acceptance.
- Native playback/position continues through all playing windows and a separate 12-second background interval (65691→77708 ms), then returns to WAVEN.
- Five lossless row samples per phase: active/restored bars change; paused and Reduced Motion crops have zero changed pixels. Temporary transition animation scale restores to 1. These samples prove scoped state/motion behavior, not frame cadence or a new human seamless-cycle observation.
- Fresh switch to Something Just Like This reaches native PLAYING. The first resume observation remains PAUSED after two seconds and was interrupted by the track switch; it is not a definitive resume failure. A fresh observed enabled Mini Player Play control subsequently reaches PLAYING at retained position 19764→19770 ms after about five seconds. Diagnostics show existing stream re-resolution/handoff (~4447 ms), not an invented instant native resume. Both observations remain.
- Focus populates while Something Just Like This continues PLAYING. Earlier discovery timeouts/successes occur before the Focus tap; this is normal/cached category population, **not a mounted failed-Focus automatic-recovery PASS**. No CHECK or network change. Home shows a truthful New Releases retry notice; healthy Search/Focus has no stale global warning.

Current genuine HTTP403→unrelated playback and failed-row/retry fixtures were not reproduced. Historical R6 forbidden-source evidence remains separate. Initially-empty live Home releases, usable cellular, broader loss/CHECK/flapping/offline mutations, conditional multi-item/local media/Cloud, physical TalkBack/large text and canonical signed distribution remain partial/unavailable/manual as the matrix states. No mock is promoted to physical PASS or owner exception inferred.

## Source and automated gates

Product source remains exact F as built: **TypeScript PASS, 237 focused PASS, 538 full PASS**, with 5 restoration mechanism tests (4 fail against pre-F source) and 11 symbolic atmosphere/cache cases. Native/generated/Gradle/manifest restoration, dependencies and lockfiles verify; Mini Player exact R7, BottomNav exact C, Search/origin test exact R7, frozen paint unchanged. No implementation change occurred during physical validation; no redundant suite rerun is presented as new physical evidence.

Including this separate report, R7-relative **23 paths = 18 implementation/tests + 5 reports**; exact V8.5A.1-relative **56 = 41 implementation/tests + 15 documents**; R5-relative **38 = 28 implementation/tests + 10 documents**; **150 porcelain entries**. Branch/HEAD unchanged. All 137 original dirty preimages, additional prior-file preimages, 21 earlier artifact identities and the separate F preinstall seal verify. Exact inventory/diff accompanies the report. All earlier source reports/seals retain historical wording and boundaries.

## Proposed adjacent exact-artifact control — approval required

To resolve playback protection, use the original R7 A artifact and then restore the exact current F artifact; no new source or APK:

1. **R7 control:** `release/waven-v85-r7-20261018/WAVEN-V8.5-PHYSICAL-CANDIDATE-r7.apk`; SHA-256 **`D8377EE10FD456B26E237839DB8F4B24DD9D34375A7A69F08B7C7DA73AF666F3`**.
2. **Restore F:** `release/waven-v85-r8f-20261019/WAVEN-V8.5-PHYSICAL-CANDIDATE-r8-f.apk`; SHA-256 **`6D777C09C5F2F7531FA761D78C9A9C7DF40F54EA8E8BB021C604164A76E4C47C`**.

Both exact byte identities, package/version, same validation signer and all 31 native payload identities verify. The Library runtime/repository/history sources are unchanged from R7; no migration/schema rollback is introduced. R7's 209 focused/510 full results are historical R7 gates, not tests rerun against current F source. F's current gates remain 237/538.

After separate approval only: preserve pulled F preimage; update same existing Personal validation package to R7; verify hash/UID/protected state/Library; run two each stopped navigation, Home/top-Search playing and playing navigation, same fresh Hymn and matched screenshots/native endpoints, recording OFF, comparable thermal/refresh conditions. Separate Search trace. Restore exact F and repeat the same bounded protocol, then cold Library/named-playlist/protected/settings readback. No network/refresh changes; no source change, data clear, uninstall or protected-profile operation. Preserve every result; revise implementation only if evidence supports a defect.

The R8 directive requires separate exact-APK installation approval. Current F approval covered its isolated installation and trials; no R7 control reinstall is inferred. This is a request for a concrete two-artifact experiment, **not a request to waive performance requirements**. Do not install either transition until approved.

## Evidence and status

Postinstall/control-review archive: `release/waven-v85-r8f-results-20261019/WAVEN-V8.5-R8-F-PHYSICAL-CONTROL-REVIEW-20261019-SEALED.zip`, with entry-size/hash manifest verification. It preserves 13 raw controlled windows, separate traces, pixel/memory/origin/motion/native observations, unfavorable/mislabeled/interrupted attempts, owner approval/audibility, cold data/protected readback, final source inventory and proposed exact control identities. The immutable F preinstall seal remains **`8C9E9D3A6F69489E8D3E5D8F91B3BB4A54116959209A0E42B931567C36D1BC6D`**. Existing APKs and all previous evidence remain local and hash-referenced.

**F remains installed, data preserved. R8 active/unverified; next dependency is exact R7-control→F-restoration approval. Phase 8 NOT ACCEPTED; overall 60%; no Completion ACK, commit, push, merge, tag, release, data clear, uninstall, protected Work change, Phase 9+ or HIKARI.**
