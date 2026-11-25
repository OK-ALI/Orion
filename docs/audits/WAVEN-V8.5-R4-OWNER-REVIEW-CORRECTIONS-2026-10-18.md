# WAVEN V8.5 R4 — owner-review corrections and candidate checkpoint

> **Post-install update:** the owner subsequently approved and installed this exact R4 candidate. Real physical review found a cycle-restart glitch, so R4 remains unaccepted. This document below preserves the pre-install checkpoint; current physical results are in [the R4 physical report](WAVEN-V8.5-R4-PHYSICAL-VALIDATION-2026-10-18.md), and the separately hashed correction is [R5](WAVEN-V8.5-R5-LIVING-WAVE-CYCLE-2026-10-18.md). The original report bytes remain in the R4 review ZIP and captured document preimages.

**2026-10-18 · OWNER REVIEW REQUIRED · NOT INSTALLED · NOT ACCEPTED**

R3 was explicitly rejected for owner acceptance. This report supersedes its current review conclusions without rewriting its historical evidence. Phase 8 remains **AUTHORIZED / IN PROGRESS**, earns **0%** of its fixed 8%, and overall WAVEN remains **60%**. This is not a Completion ACK. R3's report, pending ACK, APK and verified sealed ZIP retain their original bytes. The authoritative master plan and UI/UX contract remain the scope authorities; the owner's explicit animated Living Wave requirement corrects the insufficient static R3 interpretation of the contract's living indicator.

Workspace: `C:\Projects\WAVEN-v1`; branch `waven/v1`; HEAD `d5299eb672df6d3396247cf15935b6de2ba7e7f1`. Evidence root: `release/waven-v85-r4-20261018/`. All paths below are relative to this workspace or that evidence root as indicated. No APK installation or other device-changing operation was performed in R4.

## Implemented correction

The shared track Play target now renders **four WAVEN-blue bars** with a 1320 ms continuous native-driver loop while the identity-matched Media3 snapshot reports playing. A single `Animated.Value` drives staggered scale curves. Animation has no audio input, frequency analysis, JavaScript frame timer or React frame-state updates, and does not hold an interaction handle that would obstruct list work. It stops and preserves the pose on pause. Backgrounding stops it; foreground restarts it only if the authoritative state still says playing.

**Preparing**, **Buffering**, and **Retry / Playback failed** are separate, static visible and accessibility states. Preparing reflects the selected source-resolution handoff; buffering reflects the authoritative native buffer state. A completed JavaScript handoff alone never invents playing. Provider/track keys and restored native queue IDs continue to determine identity. No player, queue, source resolver, MediaSession or native audio owner was added.

System Reduced Motion is read before starting decorative motion, remains static if the initial read fails, and responds to preference changes. A late initial preference read cannot override a newer system event. Paused bars remain visible with a Paused label. Current WAVEN colors, spacing and Manrope caption tokens are retained. `LivingWaveMotionTokens` provides a semantic rhythm/geometry boundary for a future theme. No HIKARI or second theme implementation was added; the current dark WAVEN visual identity remains the future NOIR basis.

Rows now select a primitive state **before** React compares external-store snapshots. Overflow handoff subscriptions are also filtered to the row's track identity. One shared read-only native observer still subscribes to Media3. A mounted 100-row test verifies that 200 native position ticks cause no row renders, a pause updates only the matching row, and a native queue-identity change transfers presentation to the matching track. Animation cleanup and system-preference behavior are tested with a native Animated test double, not represented as a physical motion recording.

## Latency review and bounded decision

The preserved R3 trace at `r3-diagnostics-merged.log:458` records **7738 ms** of stream queue wait. Its extracted context is in `r3-latency-window.log`, and the structured review is `latency-review.json`.

| Recorded R3 event | Time / duration |
|---|---:|
| User playback request began | 02:39:50.116 |
| Already-active `other` remote work finished | 02:39:57.863; 10617 ms of work |
| Stream entered the global FIFO | 02:39:57.864; 7738 ms wait |
| Native executor wait / warmed initialization | 0 ms / 0 ms |
| Extraction / prefix / later-range checks | 4043 / 120 / 67 ms |
| Native source resolution | 4233 ms |
| Request to handoff | 11992 ms |

The stream starts immediately after the active remote operation finishes. Adjacent discovery success and New Releases ready events with six entries associate the active work with New Releases. This attribution is an **inference**: the sanitized log does not include request IDs. The observed active-operation residual wait, rather than native-executor contention, explains this outlier. It does not establish an artist-fanout backlog as the cause.

Healthy playback is already eligible while optional metadata recovery remains incomplete. Changing admission order of future artist lookups would not remove a request that is already running. Bypassing that operation concurrently would weaken the current global serialization contract. Cancelling it to prioritize playback would require a deliberate capability-specific policy for aborted partial discovery, generation acceptance, recovery retries and starvation. This single sample does not prove such a policy safe.

**R4 therefore changes no scheduler, priority, timeout, connectivity protection or source validation.** The existing FIFO, epoch cancellation, account/lifecycle cancellation, operation deadlines, fresh leases and serialized native handoffs remain intact and pass regression tests. A bounded priority scheme is a possible later investigation, not an implemented optimization. R4 has no new physical timing sample and claims no speedup. Playback can still wait behind active metadata; New Releases timeouts/backoff and roughly 3.6–5-second R3 extraction remain documented latency limitations.

## Executed gates

| Gate | R4 result | Evidence |
|---|---|---|
| Complete TypeScript check | **PASS**, exit 0 | `typecheck.log`, exact invocation in `gates.json` |
| Focused Phase 6 handoff, Phase 7 Library, Phase 8 connectivity/cache/smoke and R4 motion regressions | **149/149 PASS** | `focused.log` |
| Complete available WAVEN regression suite | **480/480 PASS**, no failures/skips | `full-suite.log` |
| New mounted Living Wave/row regressions | **10/10 PASS**, included above | `tests/p85R4LivingWave.test.cjs` output in the gate logs |
| Existing deterministic V8.5 smoke/repair harness | **34/34 PASS**, included above | `tests/p85Smoke.test.cjs` output in the gate logs |
| Android native build and package | **PASS**, 1m31s; 622 tasks, 30 executed | `android-build.log` |
| APK package, launcher, signer and 16 KiB alignment | **PASS** | `artifact-identity.json`, `apk-badging.txt`, `apk-signing.txt`, `zipalign.txt` |
| Native components / source restoration | **PASS** | Manifest and DEX inspection, 31 native payload hashes identical to R3; `generated-restoration.json` |
| R3, accepted ACKs, unrelated source and branch/HEAD integrity | **PASS** | `source-integrity.json`, `status-after.txt`, `r3-preserved.json` |
| R4 physical install / smoke / audible output | **NOT RUN — owner approval required before installation** | No R4 physical PASS claimed |

The focused gate's exact seven-file invocation is recorded in `gates.json`; its count is not treated as a like-for-like delta against R3's differently selected focused run. The complete suite increases from 470 to 480 through ten additional tests. Native Android artifacts use the existing isolated validation build configuration; compilation is incremental, with unchanged native payloads verified byte-for-byte rather than presented as new native application logic.

## Physical, mocked and unavailable acceptance evidence

The full machine-readable matrix is `review-test-matrix.json`. Its 18 smoke entries explicitly retain the original **R3** status/evidence and mark every **R4 physical** result NOT RUN. R3 passes are historical evidence, not R4 passes.

| Required case | Real physical evidence retained from R3 / prior baseline | R4 automated basis and remaining gate |
|---|---|---|
| Living Wave, pause, buffering, failure, Reduced Motion | R3 playing/paused/preparing presentation was observed; its static bars were rejected | Mounted component/native-animation test-double PASS. **Physical R4 animation and state transitions required.** |
| Genuine HTTP 403 then unrelated playback | Earlier V8.5A.1 diagnostics contain real forbidden sources. The required R3 rejection-followed-by-unrelated-success sequence was not reproduced | Actual adapter isolation passes with an **injected** 403-shaped rejection. It is not a real HTTP response. **Live provider fixture/manual test required.** Cancellations are not relabeled 403s. |
| Failed row and retry without reopening | R3 network-interrupted preparation successfully retried on the same route; genuine provider-failed-row presentation was not proven | New mounted real Play target + actual handoff uses mocked source/bridge: failed A exposes Retry, B remains playable, A retries without navigation. **Physical genuine rejection/retry remains required.** |
| Audible output | R3 native PLAYING and advancing position were observed | Neither state events nor mocks establish sound. **Owner must hear output.** |
| Initially empty Home recovers New Releases | R3 live/cached release cards and recovery were observed; not an initially-empty physical shelf | Actual mounted Home with controlled provider completion/generation passes, including stale-result protection. **Initially-empty physical recovery remains required.** |
| Multi-item skip | R3 pause/resume/navigation passed; a genuine supported multi-item skip was not exercised | Native contracts/state-event presentation have regression coverage, not physical skip proof. Product row Play intentionally starts a one-item queue. **Exercise when a supported multi-item queue fixture exists; no later-phase queue feature was added.** |
| Usable cellular fallback | Mobile data was enabled but no usable validated cellular route was available; Wi-Fi-off correctly became offline | Simulated validated cellular transition passes. **Physical fixture unavailable in prior session; retry when usable cellular is available.** |

Other preserved R3 physical evidence includes exact installed APK identity, three sequential real songs, repeated rapid A→B→C selection with final C position advancing, offline buffered playback, offline process restart and Library persistence, interrupted preparation retry, Artist/Album/Search recovery, genre routes and final ONLINE. R3's final package readback found one target MediaSession, no observed target crash/ANR exit, unchanged protected package fields and restored network settings. None of these observations is upgraded into a new R4 device test.

No device operations were performed in this correction run. The protected Work profile and all application data/session state were untouched. The accepted distinction remains: Phase 7 validated data is retained in the development package's native MMKV, separate from canonical app storage. No data transfer or clearing was introduced. The accepted historical limitations about the two-real-Google-account switch and ten missing exact pre-change byte copies remain unchanged; R4 does not fabricate retroactive evidence.

## Exact edited-file reconciliation

Counts compare SHA-256 for every non-ignored source file against the original **V8.5A.1** manifest and, separately, the preserved **R3** manifest. They are not counts of all inherited dirty files.

| Baseline comparison | Implementation/tests | Documents | Total changed/added files |
|---|---:|---:|---:|
| R3 versus original V8.5A.1, preserved historical count | 17 | 3 | 20 |
| R4 correction versus R3 | 9 | 2 | **11** |
| Final R4 workspace versus original V8.5A.1 | **21** | **4** | **25** |

Six R4 paths overlap the previous R3 change set, so `20 + 11 - 6 = 25`. The five newly counted paths relative to the R3 change set are the Living Wave component, Reduced Motion hook, theme tokens, R4 test file and this report. The exact cumulative 25-file list and before/after hashes are in `source-integrity.json`.

R4's eleven edited/added source-document paths are:

- `apps/waven/src/components/library/WavenLibraryControls.tsx`
- `apps/waven/src/components/player/WavenLivingWave.tsx`
- `apps/waven/src/features/playback/trackPlaybackRuntime.ts`
- `apps/waven/src/features/playback/trackPresentation.ts`
- `apps/waven/src/hooks/useWavenReducedMotion.ts`
- `apps/waven/src/theme/tokens.ts`
- `apps/waven/tests/p6SearchToPlayHandoff.test.cjs`
- `apps/waven/tests/p85Smoke.test.cjs`
- `apps/waven/tests/p85R4LivingWave.test.cjs`
- `docs/plans/WAVEN-V1-MASTER-PLAN.md`
- `docs/audits/WAVEN-V8.5-R4-OWNER-REVIEW-CORRECTIONS-2026-10-18.md`

Original V8.5A.1 porcelain count was 121; R3/current-run baseline was 125; final R4 count is **129**. The four additional status entries are the newly modified Reduced Motion hook and the three new component/test/report files. All 125 dirty R3 preimages were captured with verified exact bytes before changes. Clean baseline files remain recoverable from the unchanged HEAD. Native build templates were temporarily materialized into ignored generated files and restored byte-for-byte, including the existing R3 diagnostic service template; Gradle and manifest inputs were restored/unchanged. Dependency lockfile, Phase 6 and Phase 7 accepted ACKs, R3 report and R3 pending ACK retain their captured hashes. No unrelated source path changed in R4. Ignored build/evidence helpers and generated artifacts are excluded from source-file counts and are included in the review package manifest.

## Final candidate checkpoint

| Field | Verified value |
|---|---|
| APK | `release/waven-v85-r4-20261018/WAVEN-V8.5-PHYSICAL-CANDIDATE-r4.apk` |
| SHA-256 | `F93A6B167451D73E024B3FC3DA4F48EF6C3E70011417BFB078F32A27553F626D` |
| Bytes | 67,441,015 |
| Application ID | `com.okali.waven.phase8validation` |
| Version | `0.1.0` / code `1` |
| Build | Isolated `phase8Validation`, release-derived JS/Hermes, arm64-v8a, debuggable false |
| Signer SHA-256 | `FAC61745DC0903786FB9EDE62A962B399F7348F0BB6F899B8332667591033B9C` (existing Android Debug signer) |
| Launcher activities | 1 |
| Payload | New R4 JS with Living Wave/state markers; all 31 DEX/native-library payloads identical to preserved R3 |
| Native components | Media3 service/bridge, streaming extractor bridge, MMKV, NativeAnimatedModule, package-gated P08 diagnostics verified |
| Install target if later approved | Samsung `R5CWC2RYXZF`, Personal user 0 only, existing isolated validation package |
| Installed / owner accepted | **NO / NO** |

The R4 label, new APK hash and changed JS hash are the new artifact checkpoint. Keeping the existing isolated application ID and version avoids creating another launcher package or inventing a distribution/versioning phase. R2/R3 approvals do not approve R4 installation. The canonical permanent-signer package and Work applications must remain untouched.

The review ZIP contains the candidate, this report/master-plan checkpoint, exact source deltas and R3 dirty preimages, gate logs, native verification and the reconciled test matrix. Its portable entry names, sizes and SHA-256 hashes are verified against its embedded manifest; external archive identity is in `seal-verification.json`. The old R3 sealed ZIP remains at SHA-256 `6F0A7C9C6959821334560E2ADC1FF0E8A515AF1E16E08E7B5EA7E261FFE85F61`; old R3 APK remains `860A0ACBF7BD8DA271CAB7ADB4C0601351FA5940E54947468CC79928207BB9CA`.

**Review disposition:** the requested Living Wave implementation and local gates are complete; physical confirmation and the explicitly listed manual fixtures remain pending. Phase 8 is not accepted and overall remains 60%. **COMMIT NO · PUSH NO · MERGE NO · TAG NO · NO DATA CLEARING · NO WORK-PROFILE CHANGES · NO PHASE 9+.**
