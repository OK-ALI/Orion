# WAVEN V8.5 R8 — B/C controlled results and revised D installation checkpoint

**2026-10-19 PKT · B and C approved/installed/tested · C navigation repair FAIL · D built/verified, NOT INSTALLED · R8 remains active · Phase8 NOT ACCEPTED · overall60%.**

The approved B→C experiment is complete. C's graph-lifetime correction does **not** demonstrate repeatable physical stopped-navigation improvement, so it is not presented as the successful R8 repair. Work continued with a bounded revision that windows existing horizontal media rails instead of eagerly constructing every offscreen card. D passes the automated/build gates below, but requires its own exact-artifact installation approval and physical trials. Neither passing tests nor reduced deterministic render windows establishes D's navigation performance.

## Authority, approved artifacts and preservation

The [master plan](../plans/WAVEN-V1-MASTER-PLAN.md) remains authoritative: Phases0–7 accepted,60%; Phase8 fixed8%, earns0%; no Phase9+/HIKARI. The R8 directive is preserved in `release/waven-v85-r8-20261018/owner-directive.txt`. It explicitly requires continued correction after an unsuccessful candidate and approval for each exact new APK. The [original R8 checkpoint](WAVEN-V8.5-R8-NAVIGATION-PERFORMANCE-REPAIR-2026-10-18.md) and its sealed archive remain unchanged historical evidence.

The owner approved **“B control, then C candidate and physical trials”** for Samsung **SM-S928B / R5CWC2RYXZF**, **Personal user0**, **com.okali.waven.phase8validation**. B SHA-256 **C675E9B1610F440BADB11977827CB1BCA3353FFE3627FA1A5E1C47BFD376398B** was installed first, then C **00DBE4685FD16F32C9E82E83A3A51C4FF33CE048CEC93FD13EE6BB376C0DF275**. Both on-device and pulled hashes match; UID **10719** remains unchanged. The package is absent from Work user10. Updates used only `install -r --user 0`; no uninstall/data clear/session operation.

**C remains installed.** Normal-network cold restart restores **1 favorite /1 playlist /12 history**, and **V8.5 Offline Smoke → MOON MUSiC by Coldplay**. Normal Hymn replay updates existing history time/order only. No raw private-MMKV extraction is claimed for this nondebuggable package. Protected package code hashes/user states, all three animation settings, network settings and prior APKs/seals pass the final readback. No target CRASH/CRASH_NATIVE/ANR appears in exit-info; no memory-leak conclusion follows from PSS snapshots.

Current device authority differs from the older accepted launcher audit: canonical/development/sourcevalidation packages are presently installed in Work user10 and absent from Personal user0. Their current preflight state and code hashes are preserved exactly; no profile cleanup or cross-package migration occurred. Do not infer old Personal installation state from the historical launcher report.

The initial B attempt stopped **before installation** because Android16 package dumps report `appId`, while the helper expected `userId`. The corrected helper resolves the exact package UID from `pm list packages -U --user 0` before/after updating. Old helper bytes and the failure note remain preserved; approved APKs were unchanged. The misnamed `b-cold-home` capture belongs to R7 after that aborted preflight and is excluded from B results. Actual B evidence begins at `b-installed-cold-home`. No failed preflight is relabeled a successful install.

## Controlled frame results

Each window is15s, recording OFF, same Samsung/user, eight alternating Home/Search taps where applicable, same native Hymn identity, PID/foreground/reset-epoch guards and baseline-to-end counter deltas. Screens, UI hierarchy, thermal/display/memory diagnostics and APK checks occur outside quiet windows. Separate12s Perfetto traces are not pooled with untraced benchmarks. Refresh settings were untouched; retained frame intervals are approximately8.32ms/120Hz. No network/Reduced Motion settings changed in this round.

| Stopped navigation | Frames /janky | Jank | Thermal before/after | Recent-tail p95 latency |
|---|---:|---:|---|---:|
| A/R7 fresh1 |257/104|40.47%|0/0|50.45ms|
| A/R7 fresh2 |231/138|59.74%|0/0|48.94ms|
| B control1 |293/82|27.99%|0/0|43.80ms|
| B control2 |277/98|35.38%|0/0|47.74ms|
| B control3 |288/109|37.85%|0/0|49.56ms|
| B control4 |283/119|42.05%|0/0|46.84ms|
| C1 |257/101|39.30%|0/0|44.01ms|
| C2 |227/150|66.08%|0/0|51.69ms|
| C3 |236/155|65.68%|0/0|50.43ms|
| C4 |250/122|48.80%|0/0|49.74ms|
| C settled-screen repeat |244/169|69.26%|0/0|48.83ms|

Pooled descriptive totals: **A242/488=49.59%; B408/1141=35.76%; C697/1214=57.41%**. These are unequal sample counts and sequential live-provider conditions, not randomized causal estimates. All unfavorable results are retained. **C fails the repeatable improvement requirement.** B provides useful rollback isolation but deliberately restores JS/layout-driven labels and is not the final production proposal; its functional control gates are not represented as the C/D performance assertions passing.

| Native PLAYING workload | A/R7 fresh frames/janky, rate | C frames/janky, rate | Conditions |
|---|---|---|---|
| Home1/2 |1579/234 (14.82%);1615/220 (13.62%)|1531/258 (16.85%);1501/321 (21.39%)|Thermal0 both variants.|
| Search1/2 |1391/414 (29.76%);1452/373 (25.69%)|1317/349 (26.50%);1320/493 (37.35%)|Thermal0 both variants.|
| Playing navigation1/2 |1435/365 (25.44%);1467/341 (23.25%)|1526/259 (16.97%);1167/464 (39.76%)|A0→1 and1/1; C0/0 and0→1.|

R7's large improvement over historical R6 playback remains broadly visible, but C's samples are variable and some are worse than the fresh R7 baseline. No universal playback non-regression or complete performance PASS is claimed. Fresh C Hymn reaches native PLAYING, advances through the windows and explicitly pauses at253727ms. Cold restart restores its retained253732ms source context without autoplay. No fresh C human audibility, track-switch/background or full motion/Reduced Motion sequence was completed after its navigation gate failed; those remain required for the revised candidate.

Detailed rows contain only the latest roughly118–120 frames; tail percentiles are not whole-window distributions. Android frame deadlines and buffering classifications vary. GPU-from-issue, UI and RenderThread intervals overlap and cannot be summed into component costs. The old42.02%/15.35% cumulative counters remain historical mixed windows and are not comparisons here.

## What is established, and what remains uncertain

The original R8 source isolation remains valid: exact R7 Mini Player bytes are retained in A/B/C/D. The installed RN AnimatedProps memo-hook fixture establishes redundant label/icon/selection graph recreation in A and its removal in C. Four new regressions fail against A; C/D retain all seven R7 and seven R8 graph cases. Those are mounted/mocked-native characterization, not phone allocation or React commit telemetry.

Physical B/C traces show why that correction is insufficient:

| Five-action12s trace | B | C |
|---|---:|---:|
| Fabric batch mounts |312|83|
| TextView measures |379|934|
| RCTView creations |567|1325|
| RCTText creations |279|996|
| Gradient view creations |29|29|
| JS scheduled CPU |4992.1ms|4340.9ms|
| UI scheduled CPU |1475.1ms|1520.2ms|
| RenderThread scheduled CPU |788.5ms|690.9ms|
| Drawing slices /total |170/989.5ms|129/842.5ms|
| Largest pre-mount dispatch slice |19.37ms|67.41ms|

C includes a **1,933-instruction layout batch** and changing provider content. Thus fewer batch mounts do not mean fewer views or cheaper navigation. C's lower total drawing duration also includes fewer emitted frames; mean drawing slice5.82→6.53ms does not establish a GPU improvement. FrameTimeline retains application-deadline, buffer-stuffing and SurfaceFlinger/display categories separately. No isolated shader timings, release React commit counts or JS sampling callstacks are available.

Source inspection connects the large mount cost to eager horizontal `ScrollView` children: Home constructs every card in its complete Trending/New Releases rails; Search constructs every Artist/focused-discovery rail card, including offscreen content, when routes mount or data recovers. The traces establish expensive route mounting; they do **not** uniquely assign all aggregate jank to those rails or prove BottomNav caused the full R7 regression. Provider payload/readiness differs across variants. The global scheduler, native Media3 owner, routing/Back ownership and atmosphere remain unchanged.

## Revised D source correction

D retains C's stable BottomNav graph and exact R7 Mini Player. It changes only existing horizontal media rails to native RN **FlatList** windows. Full provider data, ordering, provider-keyed identity, all cards and existing open/reveal actions remain. There is no catalog truncation or delayed provider admission. The viewport fills immediately, with one extra initial card and a three-viewport render window; batches scale with viewport/card width. Horizontal fixed-width metrics preserve Home10px/Search14px separators, Home snap/padding and Search's exact restored offset. Native clipped-subview detachment is disabled to protect artwork/reveal lifecycle. Typography, card dimensions, circular Artists, artwork leases, accessibility labels, navigation gestures, Reduced Motion and the single native playback owner remain.

Additional D application paths relative to C:

- `apps/waven/app/index.tsx`: window existing Home media rails; preserve card body and navigation/reveal handlers.
- `apps/waven/app/search.tsx`: window existing media rails; use FlatList offset restoration, preserving Artists to Explore origin state. Genre grid, Mood rail, search results and destination logic stay as before.
- `apps/waven/src/components/shell/wavenMediaRailWindow.ts`: shared viewport/card geometry and render-window policy.
- `apps/waven/tests/p85R8MediaRailWindow.test.cjs`: five cases execute the installed RN window algorithm with metric/feature-flag doubles, verifying viewport coverage, full forward/reverse reachability, exact geometry/deep offsets, changing/empty data and actual screen bindings. No physical FPS claim.
- `apps/waven/tests/p85DiscoveryRecovery.test.cjs` and `p85Smoke.test.cjs`: add a FlatList native-render double to the existing fixtures; all existing behavioral assertions remain.
- `apps/waven/tests/p54gResponsiveViewportMatrix.test.cjs`, `p63HomeDiscovery.test.cjs`, `p65OriginHomeCatalogIntegrity.test.cjs`: update three source-shape checks from ScrollView gap/map/scrollTo to equivalent explicit separator/full-data renderItem/scrollToOffset contracts, adding binding/offset assertions. Assertions about geometry, persistence boundaries and Back restoration are retained. The first full run's two obsolete shape failures are preserved, not hidden.

This is a bounded render/mount correction, not a Stack retention redesign, scheduler rewrite, animation removal, dependency upgrade or new theme. Physical tests must check fast scrolling for blank cells, all rail items, large text, restored offsets and artwork/reveal/Back; deterministic algorithm tests do not close those risks.

## D automated/build identity checkpoint

**TypeScript PASS;221/221 focused PASS;522/522 full PASS.** Every existing R7/R8 graph case remains green. Android release-derived build PASS48s,622 tasks/30 executed. Source-provenance, generated Kotlin/Java/Gradle/manifest restoration, dependency/lockfile integrity and source boundaries pass.

Candidate: `release/waven-v85-r8d-20261018/WAVEN-V8.5-PHYSICAL-CANDIDATE-r8-d.apk`, **67,449,019 bytes**.

**SHA-256: 0C385051E088E667F70A10D3E1442AFF09BB59213607DD44C1361852B050E000**

Package **com.okali.waven.phase8validation**, version **0.1.0(1)**, arm64-v8a, release-derived/nondebuggable, one launcher. Validation signer **FAC61745DC0903786FB9EDE62A962B399F7348F0BB6F899B8332667591033B9C** verified. Signature,16KiB alignment and Media3/streaming/MMKV/NativeAnimated/diagnostic components PASS. All **31 DEX/native-library payloads are byte-identical to R7**; JS differs. No canonical permanently signed release claim. **D NOT INSTALLED.**

Exact source accounting from R7: **14 paths =12 implementation/tests +2 reports**, including the unchanged original R8 checkpoint. Additional D delta from C:9 application/test paths +this report. Original V8.5A.1-relative **46=34 implementation/tests +12 documents**; R5-relative **28=21 implementation/tests +7 documents**;143 porcelain entries versus137 before R8. No commit/HEAD change. All137 original dirty byte preimages and seven additional C-stage existing-file preimages verify. Seventeen prior APK/seal identities verify, including B/C and the immutable original R8 seal. Accepted master/Phase6/Phase7 ACKs remain unchanged. The owner-accepted historical missing ten Phase7 preimages/live-Google-switch limitations are preserved and not fabricated away.

## Acceptance reconciliation and next physical gate

The25-case matrix in `release/waven-v85-r8-physical-20261018/acceptance-matrix.json` distinguishes **3 PASS,12 PARTIAL,5 UNAVAILABLE FIXTURE,3 MANUAL REQUIRED,1 FAIL,1 OWNER EXCEPTION REQUIRED** for the stated installed-C/historical scopes. These counts are evidence categories, not completion percentages. D has **no** physical PASS. Installation approval is neither owner acceptance nor a waiver; no exception is inferred or solicited to bypass the failed repair objective.

Remaining requirements include current-build genuine403 then unrelated PLAYING; truthful failed-row/retry; human audible output; initially-empty live releases without remount; usable cellular; broad outage/CHECK, loss/flapping/offline restart/mutations; conditional supported queue/local media; Cloud scope reconciliation; physical TalkBack/large text; motion/background/switching; signed distribution; and the open rendering gate. Historical R4/R6/R7 evidence and mocks remain explicitly separate. No forbidden URL/source bypass, artificial ONLINE or future-phase fixture was introduced.

After **separate D exact-hash approval**, update only the existing Personaluser0 validation package and verify hash/UID/protected state/Library. Record discovery payload readiness before comparisons; retain transitions/recovery windows separately. Repeat stopped navigation at least four times with the same15s/eight-action workload and comparable natural thermal/native/refresh conditions. Collect equivalent separate traces. Repeat Home/Search/playing navigation pairs, Mini progress, fresh track switch, pause/resume, background, active/static Wave and restored Reduced Motion. Check Home/Search rail scrolling through later items, Artists restored horizontal origin, artwork/detail/Back, cold Library/playlist persistence and final settings/packages. No network/refresh-rate changes needed.

The repair succeeds only with repeatable navigation improvement over R7 while preserving playback gains and functional/visual behavior. If D fails, retain the evidence and continue supported correction with new approval for any further APK. Do not call this milestone repaired merely because D's render windows/tests are bounded.

Review archive: `release/waven-v85-r8d-20261018/WAVEN-V8.5-R8-BCD-REVIEW-20261019-SEALED.zip`; adjacent `seal-verification.json` verifies every entry size/SHA-256 and manifest. Includes D candidate, exact source/diff/preimages, gates/native restoration, B/C physical/raw frames/screens/traces, scoped matrix, approval/install/readbacks and prior artifact references. The original R8 preinstall seal remains **73D6FC15C93221C8EAF6CFD0ED06E65987D8C1EA7EB2A8A5F17ABED2C90DCE95**.

**Await exact D installation approval. C stays installed and its data is preserved. R8 continues; Phase8 remains NOT ACCEPTED; overall60%. No Completion ACK, commit, push, merge, tag, release, data clear, protected-profile change, Phase9+ or HIKARI.**
