# WAVEN V8.5 R5 — seamless Living Wave cycle correction

**2026-10-18 · R5 INSTALLED WITH OWNER APPROVAL · MOTION FIX PHYSICALLY CONFIRMED · PHASE 8 NOT ACCEPTED · overall 60%**

During authorized R4 physical review the owner confirmed that all four active bars move, but reported a glitch at cycle completion/restart. R4 remains rejected for smooth-loop acceptance. Its APK, original review ZIP, source preimages, physical recordings, successful tests and negative evidence are preserved. [The R4 physical report](WAVEN-V8.5-R4-PHYSICAL-VALIDATION-2026-10-18.md) separates actual physical results from mocks and remaining manual requirements.

## Cause and bounded correction

Android's installed React Native `FrameBasedAnimationDriver` captures the animated node's starting value and returns to that same value on every repeat. R4 paused at a fractional phase, then restarted a timing loop toward fixed phase 1. A restart from 0.375 therefore repeated only 0.375→1 before jumping back to 0.375. Closed 0→1 interpolation endpoints alone did not make this partial cycle continuous. R4's straight-line height segments also changed velocity sharply at their joins.

R5 reads the retained native phase once when motion starts, normalizes it without changing the visible pose, and animates a **full turn** from that phase to `start + 1`. `Animated.modulo` gives all bars a periodic 0–1 phase, so both ends of every native repeat describe the same pose. Bounded precomputed smoothstep samples join the token-defined heights with matching value/zero velocity. The interpolation nodes are memoized across playback/preference renders. No per-frame JavaScript callback, React state tick, audio analysis, extra player or scheduler change was added.

Pause still freezes the current pose. Reduced Motion and backgrounding still stop the loop. A disposed-effect guard prevents a delayed native phase callback from starting an animation after pause, unmount or a newer state transition. Existing authoritative Media3 identity filtering, current WAVEN tokens, single native owner and four-bar layout remain intact. No HIKARI or Phase 9+ implementation was introduced.

Three regressions were executed against R4 **before** the correction and failed: fractional-phase full-cycle restart; cycle-boundary velocity; delayed native phase callback disposal. Exact failing output is retained as `r4-cycle-regression-before-fix-v2.log` (an earlier test-harness attempt is also retained). All three pass on R5. The first post-fix run still failed the finite-sample velocity tolerance; increasing the bounded smoothstep sampling density resolved that issue, and both runs are preserved.

## Validation and candidate

| Gate | Result |
|---|---|
| TypeScript | **PASS**, exit 0 |
| Focused regressions | **152/152 PASS** |
| Complete WAVEN suite | **483/483 PASS**, zero skipped/failed |
| Targeted motion + V8.5 smoke/repair tests | **47/47 PASS**, native/provider test doubles |
| Android build | **PASS**, 2m7s; 622 tasks, 30 executed |
| APK identity / signer / 16 KiB alignment | **PASS** |
| Media3, streaming, MMKV, NativeAnimated and P08 diagnostics | **Verified**; 31 native payloads identical to R4 |
| Physical R5 motion and restart seam | **PASS for checked intervals**, including owner feedback “Cycles look smooth now”; not Phase 8 acceptance |
| Physical Reduced Motion / pause / background return | **PASS**, native state samples, recordings and lossless crop comparisons |
| Cold restart / saved Library / protected package readback | **PASS**, unchanged counts and protected code/state hashes |

Evidence root: `release/waven-v85-r5-20261018/`. Exact invocations and output are in `gates.json`, `typecheck.log`, `focused.log`, `full-suite.log`, `android-build.log` and `artifact-identity.json`.

Candidate: `release/waven-v85-r5-20261018/WAVEN-V8.5-PHYSICAL-CANDIDATE-r5.apk`.

SHA-256: **`86C9B7B3FEE8DEC0F9B05BF70179F18D475A544826D8396E16C5729B2F9B8330`**.

Size 67,441,611 bytes. Package `com.okali.waven.phase8validation`; version 0.1.0 (1); isolated release-derived arm64 validation build, debuggable false. Signer SHA-256: `FAC61745DC0903786FB9EDE62A962B399F7348F0BB6F899B8332667591033B9C` (existing validation Android Debug signer, not the canonical permanent signer). Exactly one launcher. This is development-device evidence, not signed-distribution acceptance.

The owner explicitly replied **“Approve R5 isolated update and motion checks”** for this exact hash. R5 then replaced only the existing validation package on Samsung SM-S928B `R5CWC2RYXZF`, Personal user 0, without uninstalling or clearing data. Installed APK bytes were pulled and matched the candidate. Evidence: `release/waven-v85-r5-physical-20261018/owner-approval.json`, `r5-installation.json`, `final-device-audit.json`. The build-time `artifact-identity.json` retains its historical `Installed=false` checkpoint; the later physical installation/readback records establish current installed status.

## Exact source accounting and preservation

Product/test changes from the R4 pre-change snapshot are limited to `WavenLivingWave.tsx`, `p85R4LivingWave.test.cjs` and `p85Smoke.test.cjs`. Four document paths record the R4/R5 findings and master-plan checkpoint. SHA-based reconciliation is **7 files = 3 implementation/tests + 4 documents** versus R4; cumulatively **27 = 21 implementation/tests + 6 documents** versus the exact original V8.5A.1 baseline. The three R5 product/test edits overlap existing cumulative paths; the two newly counted cumulative paths are the R4 physical and R5 reports. Final porcelain count is **131**, compared with 129 at R4 and 121 at original A.1; inherited dirty files are not counted as new milestone edits.

Exact paths/hashes, generated-source restoration, preserved prior APK/ZIP hashes and accepted Phase 6/7 ACK integrity are in `source-integrity.json`. The 129 dirty R4 baseline files have verified exact preimages. Branch `waven/v1` and HEAD `d5299eb672df6d3396247cf15935b6de2ba7e7f1` remain unchanged; unrelated source, lockfile, generated native source/Gradle/manifest and accepted ACKs retain their hashes. The earlier Phase 7 historical limitation remains: ten older dirty files have hashes but no recoverable exact pre-change byte copies; new snapshots do not fabricate those bytes. The accepted lack of a live two-real-Google-account switch also remains unchanged.

## Physical R5 motion evidence

The owner watched multiple cycles after pause/resume and replied **“Cycles look smooth now”**, preserved in `owner-motion-confirmation.json`. Native pause held position 46523 ms; resume began near 46532 ms. Sequential decoding of the actual resume recording (seconds 8–26) measured **1595 adjacent pairs**, maximum bar-height step **4 video pixels**, with no step ≥10 pixels. By comparison, preserved R4 footage has nine 25–26-pixel reset jumps in its checked 8–20-second interval. This supports the correction without claiming formal frame-perfect proof.

The live retest in `live-checks-result.json` confirmed fresh PLAYING before each lifecycle sequence. Four lossless Reduced Motion screenshots while native PLAYING advanced and four paused screenshots at 52740 ms each have **zero bar-region pixel difference**. After restoring the original preference, `restored-live.mp4` has six native PLAYING samples and 901 measured adjacent bar pairs, maximum 3-pixel step, no comparable reset. Background/foreground maintained native PLAYING at 26641→29651→32652 ms; `background-live.mp4` then has six PLAYING samples and 877 measured pairs, maximum 3-pixel step, no comparable reset. Animation settings were restored to 1/1/1 in finally blocks and checked again at completion.

The first R5 restored/background captures coincided with normal track END/STOPPED and do **not** count as active-playback evidence; those attempts remain preserved and are superseded by the verified live retest. Earlier video analysis attempts are also retained. Variable-frame-rate footage is finally decoded sequentially; comparisons include actual 3–70 ms adjacent pairs and exclude larger capture gaps. Lossy recording analysis does not replace lossless static comparisons or establish physical React commit counts.

## Physical navigation, persistence and final device state

R5 physically loaded Search → Coldplay artist (5 songs, 20 releases) → Moon Music album (10 tracks), with artwork and track rows. Back restored the Coldplay query/results. Rock, Hip-Hop and Classical routes populated metadata/artwork; no unsupported claim distinguishes every fresh network fetch from valid cached metadata.

After earlier timeouts, diagnostics recorded `ONLINE:ready`, then `new_releases ready` with two entries (11668 ms). Home visibly showed **SPIN / Kroi** and **Mírame Ahora Sin Ti / FireVolk**, plus Trending cards. The fetch completed while another route was open; this proves visible releases after return, while the stricter initially-empty same-screen physical fixture remains unexercised.

Update and final cold restart preserved **1 liked song, 1 playlist and 11 history entries**. The favorite remains **MOON MUSiC / Coldplay**; **V8.5 Offline Smoke** remains a one-song playlist containing that track. Final Library was ONLINE with no connectivity banner. Restart restored the last media metadata/position (52750 ms) without inventing active PLAYING. This is the isolated validation package's data; no cross-package migration or claim about canonical/development MMKV equivalence is made.

Final readback verified the exact installed R5 SHA, one target MediaSession, target absent Work, unchanged protected package code/state hashes and no observed target crash/ANR exit. `com.okali.waven`, `.development` and `.sourcevalidation` were present only in Work user 10 at this session's preflight; their observed state stayed unchanged. This current observation does not rewrite the earlier accepted launcher audit. No protected app was launched, cleared, updated, disabled or inspected for private data. Network settings remained airplane 0, Wi-Fi 1, mobile data 1; no network toggles were made.

## Latency and performance observations

R4's review of the original **7738 ms** queue wait remains valid: an already-active optional discovery operation finished immediately before the stream entered the serialized worker. Discovery attribution is an inference from adjacent sanitized events, which lack request IDs. Reordering queued future work cannot eliminate an already-running operation. Preemption/concurrent lanes remain unproven against cancellation, connectivity epochs and serialization; no scheduler rewrite was implemented.

Captured R5 stream queue waits (3) were 281–4953 ms, median 2513; native extraction (3) 4174–4631 ms, median 4181; native source resolution (3) 4341–6625 ms, median 4993; completed handoff (3) 4644–9963 ms, median 9156. R4's 18 captured queue waits ranged 0–10080 ms. These unequal live samples do **not** establish a speedup. Optional discovery timeouts/recovery and streaming latency remain documented limitations.

R5 pre-restart gfxinfo: 27870 rendered frames, 8469 janky (**30.39%**), CPU percentiles 11/16/17/23 ms. PSS rose from 350305 KiB initially to 650648 KiB after artwork/navigation (RSS 760432 KiB), then was 285436 KiB after restart. Post-restart PID 29180 has a separate 70-frame window, 7 janky frames (10%); it must not be subtracted from pre-restart PID 18972. These cumulative mixed-workload/screen-recording snapshots are neither a controlled Living Wave benchmark, zero-jank certification nor a leak proof. No observed crash/ANR does not erase the performance limitations. Raw framestats and process-tagged summaries are retained.

## Reconciled matrix, remaining gates and review package

The 18-case machine-readable matrix is `release/waven-v85-r5-physical-20261018/physical-smoke-matrix.json`; it distinguishes R4 physical, R5 physical, controlled test doubles and unavailable fixtures. R4 provides real forbidden-source→unrelated Yellow success→same-route Hymn retry success, visible Buffering/Retry and owner-confirmed audible output. Those are **R4** results; R5's identical native payload is supporting regression evidence, not a new R5 403/audio test. Preparing has automated distinction coverage; its brief physical visual label was not separately isolated.

Still **MANUAL REQUIRED**: initially-empty Home recovering releases on the same screen; multi-item skip when a supported real product queue exists (row Play starts one item); usable cellular fallback when a working fixture is available. Enabled mobile data alone does not prove cellular connectivity. Physical per-row React commit telemetry was unavailable in this production-derived candidate; the mounted 100-row/200-native-position-tick regression passes with controlled native/provider inputs. No unavailable scenario is fabricated as PASS.

The final package is `release/waven-v85-r5-20261018/WAVEN-V8.5-R5-FINAL-PHYSICAL-REVIEW-20261018-SEALED.zip`. It contains the R5 candidate, current source/docs, exact preimages, all gate outputs including failed attempts, both physical evidence trees, reconciled matrix, recorded authorizations and final readbacks. Duplicate pulled APKs are recorded by hash rather than embedded repeatedly. Every ZIP entry size/SHA and the embedded manifest are checked; archive identity is in adjacent `seal-verification.json`. Original R3/R4 sealed packages remain separate and unchanged.

No Phase 8 Completion ACK, no acceptance/progress increase, no commit/push/merge/tag/publication, no data clearing and no protected Work-profile changes. Overall remains **60%**.
