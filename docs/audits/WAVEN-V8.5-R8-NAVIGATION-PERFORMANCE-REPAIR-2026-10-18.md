# WAVEN V8.5 R8 — navigation repair, controlled-install checkpoint

**2026-10-18 · C implementation and automated/build gates complete · B/C NOT INSTALLED · physical repair NOT YET VERIFIED · Phase8 NOT ACCEPTED · overall60%**

R8 is active implementation work, not a completed diagnostic review. A bounded correction now preserves the BottomNav native animation graph across tab changes instead of rebuilding it. The exact R6 BottomNav rollback is prepared separately as the requested control. **Neither automated results nor the source-level improvement establishes the physical navigation success condition.** Continue with the exact-artifact-approved B/C trials below; if C does not improve navigation while protecting playback, investigate/revise/retest and obtain a new approval before installing another artifact. No R8 success or Phase8 acceptance is claimed at this checkpoint.

## Authority and preserved baseline

The owner directive is preserved at `release/waven-v85-r8-20261018/owner-directive.txt`. The [authoritative master plan](../plans/WAVEN-V1-MASTER-PLAN.md), accepted Phases0–7, [R7 investigation](WAVEN-V8.5-R7-PERFORMANCE-REPAIR-2026-10-18.md) and [R7 physical review](WAVEN-V8.5-R7-PHYSICAL-VALIDATION-2026-10-18.md) remain unchanged. Phase8 remains Offline awareness and connectivity resilience, fixed8%, earns0%; overall60%. No Completion ACK or Phase9+/HIKARI work.

Branch `waven/v1`, HEAD `d5299eb672df6d3396247cf15935b6de2ba7e7f1`. R8 snapshots2634 source files and preserves exact byte preimages for all137 already-dirty files. Fourteen earlier APK/seal identities are hash-verified, including the R7 candidate and physical/pre-install seals. This does not invent the missing historical preimages or live-account-switch evidence previously accepted for Phase7.

Samsung SM-S928B / S24 Ultra, serial **R5CWC2RYXZF**, Personal user0. Still installed: **com.okali.waven.phase8validation**, R7 SHA-256 **D8377EE10FD456B26E237839DB8F4B24DD9D34375A7A69F08B7C7DA73AF666F3**. Its APK was pulled and hash-verified before the new trials. Protected packages, Work user10, network and animation settings match preflight. Current Library remains **1 favorite /1 playlist /12 history**. Normal replay updates existing history time/order only; playback is paused at249686ms. No installation, uninstall, data clear, cross-package migration, Google-session operation or Orion Cloud write occurred during preparation.

## R6/R7 isolation and demonstrated code defect

Reversible variants are preserved byte-for-byte under `release/waven-v85-r8-20261018/variants/`:

| Variant | Mini Player | BottomNav | Role |
|---|---|---|---|
| A | Exact R7 | Exact R7 | Existing installed baseline; no new A install needed. |
| B | Exact R7 | Exact pre-R7/R6 implementation | Diagnostic rollback control; restores only the earlier label animation. |
| C | Exact R7 | R7 geometry/native motion with stable memoized presentation | Proposed repair; retains the R7 native-driver/measurement constraints. |

The Mini Player's exact SHA-256 remains **6361996d9c6fd42524180cdc6b319903ca77618216c6d621476f00a6d902c2e2** in all three. There is no source change to native Media3, subscriptions, progress interpolation, Living Wave, provider scheduling, route/Back ownership, atmospheric rendering, tokens or dependencies.

**Established source defect:** R7 creates new interpolation objects and new visual React elements during each BottomNav render. Inspection of the installed React Native0.86.3 `createAnimatedPropsMemoHook` shows that its memo key compares animated-node identity and, with the default allowlist, object/array prop identity. New label/icon/selection inputs therefore create new AnimatedProps objects. The installed `createAnimatedPropsHook` lifecycle attaches a replacement and schedules restoration/detachment of the old props. This creates avoidable graph work during an existing tab transition. R7's native-driver conversion increased the affected presentation graph compared with R6; timing correlation alone does not establish its contribution to the phone's jank.

The new mounted fixture executes that **installed RN memo hook**, compiled with the already-installed Babel preset. Animated values, native bridge and Pressable are doubles. Counts concern the label/icon/selection presentation in this fixture; they are **not whole-app native allocation, real React commit or phone frame measurements**.

| Mounted comparison | A: R7 | B: R6 Nav +R7 Mini | C: proposed |
|---|---:|---:|---:|
| Additional AnimatedProps factory calls over5 route changes |65|35|0|
| Additional interpolation expressions over5 route changes |50|35|0|
| Additional props factory calls over8 parent refreshes |104|56|0|
| Animated layout bindings observed |no|yes|no|
| JS-driven label transitions |no|yes|no|

Four of seven new regression cases fail against unchanged A; all seven pass with C. The original seven R7 presentation cases also remain green. This establishes removal of a concrete redundant path without weakening the R7 native-layout assertions. **Its causal significance for the physical regression is pending the controlled installs.**

## Existing trace evidence and remaining costs

The existing R6/R7 stopped-navigation traces are reprocessed with the preserved official Perfetto58.2 tool. R7 has fewer Fabric mount batches424→48 and text measures408→212. It still creates526 RCTViews,238 RCTText views and29 ExpoLinearGradient views across five route actions; route creation remains material. RenderThread drawing slices total962.0→918.6ms, with per-slice averages5.63→6.47ms. GPU-completion wait slices remain present. These overlapping trace durations are not isolated component GPU execution or CPU totals.

R7 UI traversal600.98→534.55ms and draw-VRI586.65→515.34ms are lower than R6 in these separate traces, despite worse untraced stopped-navigation deadline rates. UI animation slices remain about806.64→816.31ms. Dynamic frame budgets, rendering/composition, route creation and provider activity prevent assigning the aggregate rate to BottomNav alone. The prior Search playback Fabric978→27 result remains intact and is protected by leaving the entire R7 Mini Player unchanged.

The candidate therefore corrects the demonstrated graph lifecycle problem, retaining the existing Stack/router.navigate/Back semantics and visual formulas. It does not add a speculative scheduler rewrite, hardware-layer cache, route retention scheme, atmosphere change or fixed-refresh override. Native Animated bridge operations are not individually attributed by these older traces; the physical C trace must determine the actual effect.

## Exact bounded source correction

1. `apps/waven/src/components/shell/WavenBottomNav.tsx`: memoize the existing label/icon visual subtree by animated value, identity and label geometry; memoize the selection-pill interpolation by value/slot step. Active selection, accessible state and callbacks still update outside the memo. Font/layout changes recreate only necessary geometry. Animation durations, clipping/counter-translations, opacity, press feedback, gesture handling, touch targets and Reduced Motion semantics remain.
2. `apps/waven/tests/helpers/navigationAnimatedFixture.cjs`: mounted fixture using the installed RN AnimatedProps memo hook, with explicit native/Pressable doubles.
3. `apps/waven/tests/p85R8NavigationGraphs.test.cjs`: seven regressions for stable graph lifetime, parent refresh, layout/font changes, continuous geometry, route/Back selection, Reduced Motion and frame updates without fixture React commits.
4. This report. Existing tests/assertions are unchanged.

No other existing implementation source changes from R7. Exact no-index R7-preimage→C diffs, before hashes, generated-native restoration, lockfile integrity and prior artifact preservation are checked in source-integrity.json. The transient B build restores C bytes in finally; B is not silently left in the workspace. Current accounting:4 R7-relative paths; original V8.5A.1-relative40 =29 implementation/tests +11 documents; R5-relative21 =15 implementation/tests +6 documents;140 porcelain entries versus137 initially.

## Automated and Android gates

**C: TypeScript PASS;216/216 focused PASS;517/517 full PASS**, including every R7 case. Android release-derived build PASS,58s,622 tasks/30 executed. **B: TypeScript PASS;202 focused functional cases PASS;503 pre-R7 baseline cases PASS**; Android build PASS,2m3s,622 tasks/30 executed.

B deliberately restores the old JS-driven/animated-layout implementation, so it is not a proposed production repair and is not claimed to pass the R7/R8 native-graph performance requirements. Those assertions remain unchanged and apply to C. Its reduced control-gate scope is explicit in B-control/control-gates.json; it must not be reported as517/517 PASS. B only isolates the earlier implementation on the same R7 Mini Player.

Both candidates retain package **com.okali.waven.phase8validation**, version **0.1.0(1)**, arm64-v8a, debuggable false, one launcher, existing validation signer **FAC61745DC0903786FB9EDE62A962B399F7348F0BB6F899B8332667591033B9C**. Signature and16KiB alignment PASS. All **31 DEX/native-library payloads are identical to R7**; B/C JS payloads differ from R7 and one another. Generated Kotlin/Java, Gradle and manifest are restored and hash-verified. No dependency/lockfile drift or canonical production signer claim.

| Artifact | Bytes | SHA-256 | Installed |
|---|---:|---|---|
| B diagnostic control: `B-control/WAVEN-V8.5-R8-B-CONTROL.apk` |67447131|**C675E9B1610F440BADB11977827CB1BCA3353FFE3627FA1A5E1C47BFD376398B**|NO|
| C proposed candidate: `C-candidate/WAVEN-V8.5-PHYSICAL-CANDIDATE-r8-c.apk` |67447639|**00DBE4685FD16F32C9E82E83A3A51C4FF33CE048CEC93FD13EE6BB376C0DF275**|NO|

Paths in this table are relative to `release/waven-v85-r8-20261018/`. Individual source-provenance, artifact-identity, build and restoration JSON records accompany each APK.

## Fresh installed-R7 comparison baseline

Eight new15s untraced windows use same-PID/same-reset-epoch gfxinfo deltas, recording OFF and guarded native endpoints. Screens, thermal/display/memory snapshots and logs remain outside quiet intervals. No global refresh/network/settings changes. Same Hymn identity, normal network; peak/vsync approximately120Hz, detailed frame rows only the recent tail. All eight windows are valid. The older R6/R7 results remain preserved rather than replaced.

| R7 workload | Frames/janky | Jank | Thermal before/after | Tail p95 latency |
|---|---|---|---|---|
| Stopped navigation1 |257/104|40.47%|0/0|50.45ms|
| Stopped navigation2 |231/138|59.74%|0/0|48.94ms|
| Home playing1 |1579/234|14.82%|0/0|13.53ms|
| Home playing2 |1615/220|13.62%|0/0|13.68ms|
| Search playing1 |1391/414|29.76%|0/0|19.12ms|
| Search playing2 |1452/373|25.69%|0/0|14.78ms|
| Navigation playing1 |1435/365|25.44%|0/1|20.03ms|
| Navigation playing2 |1467/341|23.25%|1/1|15.16ms|

The stopped-nav variability40.47–59.74% is preserved; no lucky sample is selected. Thermal0 differs from earlier R7 thermal1/2, so compare the new B/C controls to genuinely comparable samples and retain all mismatches. Percentiles are recent-tail distributions, not entire-window distributions or arbitrary pass thresholds. A separate fresh R7 navigation Perfetto trace is also retained. No B/C physical numbers exist yet.

## Required next physical stage, after exact-hash approval

Update **only Personal user0** of the existing validation package, without uninstall/data clear. First B as a temporary control: verify installed hash/signer and preserved Library, cold launch, repeat stopped navigation at least twice and collect equivalent trace. Then install C, verify its exact identity and repeat stopped/playing navigation, Home/Search playback, Mini Player progress, pause/resume, background/foreground, track switching, active/static Wave, Reduced Motion and genuine discovery recovery. Any approved temporary Reduced Motion check must restore its exact preimage; no network or refresh-rate changes are needed.

Use equivalent15s windows/actions, normal application state, native endpoint/foreground/PID/epoch guards, recording OFF, recorded thermal/display conditions, multiple valid samples and separate12s Perfetto trials. Preserve unfavorable/invalid samples. Compare frame counts, deadlines, timing distributions, mount/layout, UI/JS/RenderThread and provider/lifecycle work separately; do not sum overlapping slices or call mock results physical PASS. Pass only if C demonstrates repeated navigation improvement versus R7 without losing R7 playback gains or introducing functional/visual defects. Prefer improvement versus R6, without inventing a numeric project threshold.

If C fails, keep the evidence, investigate the next supported cause, revise within R8 and get a new exact-artifact approval before another installation. This checkpoint authorizes neither automatic installation nor closing R8 on a speculative result.

## Readiness and evidence

**Ready for approval of the controlled B→C installation trial. Navigation performance repair remains UNVERIFIED pending that stage.** Existing Phase8 missing current-build403/failed-row, cellular, initially-empty releases, broad connectivity/offline, queue and assistive-tech/distribution fixtures remain as classified in the R7 physical matrix; no inheritance or exception is inferred. No performance win, memory leak, all-ONLINE state, release readiness or accepted Phase8 claim.

Separate pre-install review archive: `release/waven-v85-r8-20261018/WAVEN-V8.5-R8-PREINSTALL-REVIEW-20261018-SEALED.zip`, with every entry size/SHA-256 and manifest verified by adjacent seal-verification.json. It contains the candidate/control, source variants/diff/exact preimages, gates/build/restoration evidence, actual RN memo-hook isolation, trace queries/results, fresh R7 raw frames/screens/conditions, preservation readbacks and physical plan. Prior large artifacts remain preserved locally and SHA-referenced.

**STOP before any new APK install and request approval for the exact artifacts above. R8 work must continue after approval.** No Completion ACK; overall60%; no commit, push, merge, tag, release, data clear, protected-profile change, Phase9+ or HIKARI work.
