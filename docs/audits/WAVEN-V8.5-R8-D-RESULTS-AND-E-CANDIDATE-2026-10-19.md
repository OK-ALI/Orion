# WAVEN V8.5 R8 — D physical findings and revised E checkpoint

**2026-10-19 PKT · D remains installed · D performance/Back gates FAIL · E built/verified, NOT INSTALLED · R8 repair remains active/unverified · Phase8 NOT ACCEPTED · overall60%.**

The owner approved exact D SHA-256 **0C385051E088E667F70A10D3E1442AFF09BB59213607DD44C1361852B050E000**. Its controlled trials did not establish the required navigation improvement and exposed a Search vertical-origin regression. Both are preserved as failures. E restores Search's accepted implementation byte-for-byte and adds a bounded Android cache around the unchanged static atmospheric paint subtree. E passes the gates below but has no physical performance, pixel, memory or restored-origin PASS. Separate approval is required before installing it.

## Authority and preserved state

The [master plan](../plans/WAVEN-V1-MASTER-PLAN.md) remains unchanged: accepted Phases0–7 contribute60%; Phase8 fixed8%, earns0%; no Completion ACK or Phase9+/HIKARI. The R8 owner directive requires continued correction after failed candidates and exact-artifact approval for each new APK. The [original R8 checkpoint](WAVEN-V8.5-R8-NAVIGATION-PERFORMANCE-REPAIR-2026-10-18.md), [B/C results and D checkpoint](WAVEN-V8.5-R8-CONTROLLED-TRIALS-AND-D-CANDIDATE-2026-10-19.md), original APKs and seals remain unchanged historical evidence.

D is installed only in **Personal user0**, **com.okali.waven.phase8validation**, Samsung **SM-S928B / R5CWC2RYXZF**. On-device/pulled hashes match; UID **10719** is preserved. D is absent from Work user10. Final readback verifies protected package code hashes/user states, network and all three animation settings unchanged. No data clear, uninstall, Google-session operation or Orion Cloud write occurred. The current protected packages are in Work and absent from Personal, as recorded at preflight; no historical launcher-state assumption was applied.

Cold D restart retains **1 favorite /1 playlist /12 history**, and **V8.5 Offline Smoke → MOON MUSiC by Coldplay**. Native restored context remains NONE, Hymn253732ms; no autoplay. No D playback collection mutation or raw private-MMKV extraction is claimed. Target exit-info contains no observed CRASH/CRASH_NATIVE/ANR. D data, C pulled preimage and every earlier artifact remain preserved. E is not installed.

## D controlled performance results

Four15s stopped-navigation windows each use eight alternating Home/Search taps, recording OFF, native NONE endpoints, same PID/reset epoch and foreground guards. Thermal status is **0/0** in all four. Refresh settings stay unchanged; recent intervals remain about8.32ms/120Hz. APK/conditions/screens and diagnostic readbacks occur outside quiet windows. No network or animation settings changed. Live provider work remains observable and payload readiness is a comparison limitation.

| Trial | Frames /janky | Jank | Recent-tail p95 latency |
|---|---:|---:|---:|
| D1, cold session |248/113|45.56%|51.79ms|
| D2 |236/127|53.81%|47.14ms|
| D3 |232/136|58.62%|47.77ms|
| D4 |246/136|55.28%|46.79ms|

Pooled D **512/962=53.22%**, versus fresh A/R7 **242/488=49.59%** and C **697/1214=57.41%**. B control remains **408/1141=35.76%**. Unequal sequential sample sets are descriptive, not randomized causal estimates. D's smaller mount workload is not a repeatable navigation win over R7. **Performance gate FAIL/open.** No arbitrary acceptance threshold or lucky-sample selection.

The separate five-action12s D Perfetto trace shows **48 Fabric batch mounts,432 RCTView creations,180 RCTText creations,154 TextView measures**, compared with C83/1325/996/934. Largest pre-mount dispatch falls67.41→19.16ms. Scheduled JS CPU is3257.1ms, UI1177.6ms and RenderThread777.9ms. These reductions occur with differing live payloads and do not uniquely assign causality. Drawing still consumes151 slices/949.4ms, mean6.29ms; GPU-completion wait slices reach16.73ms. Android's expected app deadlines in this trace are8.33ms. Buffer stuffing, app deadlines and display/SurfaceFlinger categories remain separate.

Detailed frame rows are recent119-frame tails, not whole-window timing distributions. UI/render/GPU intervals overlap and are not component CPU/shader totals. No release React commit profiler or isolated gradient GPU timing is available. PSS snapshots are retained; no memory-leak claim. D did not proceed to a full playing/motion battery after the stopped gate failed, so those requirements are not fabricated as PASS.

## D Search origin regression and corrective rollback

The first rail check reached later Artists, opened ASHE artwork/detail and returned with the same horizontal offset but a shifted vertical page. A repeat unexpectedly showed Library instead of the intended Artist route; it was excluded and further taps stopped. The owner then confirmed **“WAVEN is ready and untouched”**, enabling a fresh controlled check.

In that controlled sequence, ASHE opens its populated Artist detail and one Go back returns Search. The Artist's horizontal bounds remain **x695–1045**, but its row moves **y1579→2174**. The earlier Genre card Electronic moves **y235→830**, an equal **595px** vertical displacement. The Finding-artists notice is present at both initial endpoints; its later disappearance does not restore the Genre offset. Raw before/detail/after/settled screenshots and XML are retained under `d-ready-*`.

Thus D fails vertical-origin preservation, despite the horizontal offset surviving. Asynchronous initial FlatList height and the parent scroll view's one-shot restoration/clamping are a source-supported mechanism; internal scroll-metric causation was not instrumented. E restores **the entire Search source and its original origin test to exact R7/C bytes**, avoiding a new restoration owner or AppShell rewrite. Search's synchronous ScrollView rail,14px gap, detail/reveal handlers and `scrollTo({x:initialScrollX,animated:false})` are restored. Physical E Back/origin proof remains mandatory. Home's bounded rail window is retained; Home/detail/rail scrolling still needs its own physical checks.

## E static-render correction and evidence limits

Removing avoidable graph/mount work has not removed the measured drawing/deadline problem. The existing default atmosphere paints five full-surface gradients under a0.74 opacity boundary; root and primary-route canvases participate in animated frames. E targets that static rendering path with the **installed RN Android hardware-layer facility**, without changing any gradient, geometry, opacity, motion, provider, route or playback ownership.

`WavenAtmosphericCanvas.tsx` now places the original complete canvas inside an inert absolute-fill View with `renderToHardwareTextureAndroid` and `collapsable={false}`, **only for Android/default**. The wrapper is outside the original opacity boundary and adds no opacity/transform/color of its own. Entry/quiet and web/iOS retain their original trees. No animation is disabled, no new bitmap/artwork cache is introduced and no native source changes. The installed `BaseViewManager` records the flag and `LayerEffectsHelper` sets `View.LAYER_TYPE_HARDWARE`; `ReactViewGroup`'s alpha behavior explains why the existing paint/opacity boundary is retained inside the wrapper.

Nine symbolic native View/gradient cases compare every default/entry/quiet paint tree across Android/web/iOS with a frozen pre-E fixture: colors, order, locations, positions, opacity and geometry match. These prove declaration identity and cache eligibility, **not Android pixel identity or faster frames**. The original canvas bytes and generated fixture are preserved. The first new-test run exposed an undefined-leaf versus JSON-omitted-key serializer mismatch; it is preserved and corrected without changing fixture paint values. An early build command refused at its passing-gates guard before any APK/native mutation.

Hardware layers consume GPU memory. One1440×3120 RGBA surface is approximately17.14MiB before overhead; several retained default canvases could retain several such textures. This is an estimate, not measured allocation or a leak. Physical E must compare settled atmosphere pixels, target memory/graphics snapshots, cold/warm navigation and background/re-entry. Android owns layer invalidation on content/layout changes and view destruction; no custom scheduler/lifecycle/cache manager was added. If pixels, memory or navigation regress, the candidate must be revised rather than accepted on symbolic tests.

E combines the Search rollback with this rendering correction and retained Home windowing/C graph reuse. A physical E result cannot uniquely attribute the whole outcome to one of those changes. The aggregate R7 regression is not claimed to have one fully proven cause.

## Exact source and validation boundary

Relative to D, seven paths change: Search and its origin test return to accepted bytes; the existing rail regression now protects Home windowing plus synchronous Search restoration; the atmosphere component adds the cache wrapper; one nine-case atmosphere test and frozen paint fixture are added; this separate report is added. The original D and R8 reports are untouched.

Current R7-relative source boundary is **16 paths =13 implementation/tests +3 reports**:

- Home screen; BottomNav; media-rail window policy; atmospheric canvas.
- Navigation memo-hook fixture; frozen atmosphere fixture; R8 graph, rail and atmosphere regression files.
- Existing discovery-recovery/smoke fixture additions and Home geometry/discovery source-shape assertions introduced for D.
- The three dated R8 reports. Search and its origin test are exact R7 and are absent from this net delta.

**TypeScript PASS;230/230 focused PASS;531/531 full PASS**, including every prior R7/R8 presentation, playback, motion, connectivity, discovery and persistence case. Android release-derived build PASS1m,622 tasks/30 executed. Mini Player remains exact R7; BottomNav remains exact C. Search rollback, frozen paint fixture, source provenance, generated Kotlin/Java/Gradle/manifest restoration, dependencies and lockfiles verify.

Original V8.5A.1-relative accounting: **49=36 implementation/tests +13 documents**. R5-relative **31=23 implementation/tests +8 documents**. **147 porcelain entries**, versus137 before R8. Branch `waven/v1`, HEAD `d5299eb672df6d3396247cf15935b6de2ba7e7f1` unchanged. All137 original dirty preimages, additional existing-file preimages and D Search/rail-test rollback evidence verify. Nineteen prior APK/seal identities verify. Accepted master and Phase6/Phase7 ACKs remain unchanged; previously accepted Phase7 missing historical preimages/live-Google-switch limitations remain transparently preserved.

## E exact candidate — approval required

`release/waven-v85-r8e-20261019/WAVEN-V8.5-PHYSICAL-CANDIDATE-r8-e.apk`

**SHA-256: 980A942ED7BE53A88C75BF052477F48BA8DBB4C9754B4C7997FEC433A6085F81**

**67,448,579 bytes**, package **com.okali.waven.phase8validation**, version **0.1.0(1)**, arm64-v8a, release-derived/nondebuggable, one launcher. Validation signer **FAC61745DC0903786FB9EDE62A962B399F7348F0BB6F899B8332667591033B9C** verified. Signature,16KiB alignment and Media3/streaming/MMKV/NativeAnimated/diagnostic components PASS. All **31 DEX/native-library payloads are identical to R7**; JS differs. No canonical production-signing/distribution claim. **E NOT INSTALLED; D approval does not cover E.**

After separate E approval: update only Personaluser0's existing validation package; verify hash, UID, protected state and Library; compare settled Home/Search atmosphere with D's pixel reference; collect bounded cold and repeated stopped navigation with equivalent actions/native/thermal/refresh conditions; keep recovery/payload changes visible and separate. Collect matching traces and memory/graphics readbacks. Repeat playing Home/Search/navigation, fresh track switch, authoritative progress, pause/resume/background, Wave/Reduced Motion with restoration, Home rails through later cards, artwork/detail/Back and Search horizontal/vertical origin. Finish cold Library/named-playlist and protected-package/settings checks. No network/refresh-rate changes.

## Readiness, remaining gaps and evidence

The scoped matrix records D's rendering and origin **FAIL** separately from historical/partial/unavailable/manual evidence. No D native PLAYING/audibility/motion battery is claimed; E has no physical results. Remaining Phase8 requirements still include genuine current-build403→unrelated playback, truthful failed-row/retry, audible output, initially-empty live releases, usable cellular, broader loss/CHECK/flapping/offline mutation/restart, conditional queue/local media/Cloud, assistive-tech and signed distribution. Mocks and R4/R6/R7 historical evidence are not promoted to current physical PASS. No owner exception is inferred or requested to bypass R8's repair objective.

Separate review archive: `release/waven-v85-r8e-20261019/WAVEN-V8.5-R8-DE-REVIEW-20261019-SEALED.zip`; adjacent seal-verification checks every entry size/SHA-256 and manifest. It includes E candidate/source/diff/paint fixture/gates/restoration, raw D frames/traces/origin captures, approval/install/Library/protected readbacks and earlier artifact references. The unchanged prior B/C/D checkpoint seal is **337080AE4FDB0479727448E1BD8CC76E156EE063186129F7AAAB79416ACBFECC**.

**Await exact E installation approval. D stays installed and its data is preserved. R8 remains active; Phase8 NOT ACCEPTED; overall60%. No Completion ACK, commit, push, merge, tag, release, data clear, uninstall, protected-profile change, Phase9+ or HIKARI.**
