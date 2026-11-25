# WAVEN V8.5 R6 — discovery recovery repair

**2026-10-18 · R6 r2 INSTALLED WITH OWNER APPROVAL · FINAL REVIEW · PHASE 8 NOT ACCEPTED · overall 60%**

Workspace `C:\Projects\WAVEN-v1`, branch `waven/v1`, HEAD `d5299eb672df6d3396247cf15935b6de2ba7e7f1`. The owner's bounded investigation/repair directive is preserved in `release/waven-v85-r6-20261018/owner-directive.txt`. The local master plan remains authoritative. This is a Phase 8 correction and review checkpoint, not a Completion ACK, distribution release, theme rollout or Phase 9 authorization.

## Evidence-backed findings

The original R5 physical trace has **10 discovery provider timeouts**, **33 failed New Releases result events**, and **11 incomplete metadata recovery passes**. Result events include immediate cooldown/blocked reads and must not be counted as 33 separate HTTP failures. Its later `ONLINE:ready` and accepted New Releases events prove that recovery was already occurring. The immutable trace SHA, extracted lines and timing summaries are in `investigation.json`.

The owner's exact earlier Jazz failure followed by CHECK was outside those scoped captures. No raw Jazz HTTP response or request ID survives to identify its precise provider-side trigger. The evidence supports transient discovery failures, but **does not prove Jazz received a particular timeout/HTTP code**. A fresh observation of still-installed R5 on 2026-10-18 showed Jazz populated without CHECK while the large global warning remained visible during optional discovery recovery. This is a normal-loading observation, not a recreated failure/recovery PASS.

| Owner question | Established finding |
|---|---|
| A. Why initially failed? | Exact owner Jazz trigger is unavailable. R5 does have genuine discovery timeouts, capability cooldowns and serial metadata queues. No invented HTTP diagnosis. |
| B. Why CHECK helped? | CHECK refreshes NetInfo and starts/coalesces a full recovery pass. A later check can occur after the capability cooldown, retry pending reads and advance `recoveryEpoch`, which reruns Search's effects. This does not establish that no automatic retry existed. |
| C. Was automatic retry scheduled? | Yes. `reportProvider(false)` schedules a 4-second attempt; revalidation has a 2-second minimum admission interval and capped exponential backoff up to 60 seconds. Durable pending reads are capped at 32. Lifecycle/transport cancellation remains authoritative. |
| D. Why mounted UI could stay stale? | R5 publishes accepted category notifications, but Search did not subscribe. Its category effect depended on `remoteReady/recoveryEpoch`; a slow unrelated recovery tail delayed the screen update. A real mounted React regression reproduces this with an accepted category and a still-pending unrelated tail. |
| E. Can unrelated failures hold DEGRADED? | Yes, correctly when a different capability/read is still unresolved. Incorrectly, a failed recovery-pass latch also survived after all its pending reads healed outside the pass. A separate regression reproduces that stale DEGRADED state. |
| F. Are warnings always current? | No. Home's accepted-release subscription filled cards and cleared `releaseNotice`, but left its separate degradation flag true. Also, R5 recovery could acknowledge a fresh cached pending category without making a new request, leaving unhealthy capability health unresolved. Both are reproduced before repair. |
| G. Are requests serialized? | Yes. Existing global FIFO remains unchanged. New scoped R5 observations include metadata queue waits up to 14799 ms and a 27973 ms incomplete metadata pass. Exact owner Jazz queue attribution remains unavailable. No scheduler rewrite or latency speedup is claimed. |

The three initial regressions failed against unchanged R5 (`regressions-before-fix-v3.log`). Earlier harness attempts are retained; one initially lacked a chart fixture with the canonical chart section ID. An additional stale-coordinator regression failed against the first R6 candidate (`stale-recovery-latch-before-fix.log`), prompting the final r2 candidate before any installation request. Nothing is relabeled as physical evidence.

## Bounded implementation

Search subscribes to accepted category results for its currently selected canonical browse handle and parameter pair. A destination change/background removes the listener. Accepted results update the mounted path immediately, including an honest verified-empty state, without waiting for unrelated recovery work, remounting or global CHECK. Explicit retry nonces are consumed once, so a subsequent recovery epoch does not become another forced refresh.

The resilient runtime shares overlapping signal-owned reads per cache key. Each consumer has its own cancellation; only the last departed reader cancels underlying work. Twelve overlapping category readers make one provider request in the regression. Explicit unsignalled forced refreshes retain the existing generation-supersession contract. The broker checks category/release generation currency before recording health as well as before accepting data. Late/cancelled results cannot write cache, notify the route or poison current health.

Pending recovery always performs real provider validation, even when an older valid cache remains fresh. A successful cache read alone never clears unhealthy provider state. A bounded persisted category handle can be retried even without the cached index; provider handle validation is unchanged and no music/result is fabricated. Valid cache data and artwork remain visible during failure.

The same connectivity coordinator now tracks which registered jobs failed. A job may register a read-only `hasPending` predicate. After accepted reads settle durable catalogue intent, the coordinator can clear that job's incomplete status immediately. It cannot clear another capability, an unrelated failed job, or a job whose completion cannot be established. Probe/Cloud/pending/metadata ordering, epoch cancellation, single Media3 owner, FIFO, deadlines and cooldowns remain intact. No new recovery timer, provider lane, network bypass or Cloud mutation was introduced.

Warnings use existing WAVEN tokens and typography. One failed destination/shelf owns its restrained local retry state; widespread capability/provider degradation retains a compact, wrapping global status with accessible announcements and Check. The large bordered global panel is removed. Home tracks failures by shelf and clears only a genuinely recovered shelf's warning. Normal healthy state has no status. No fixed text-height clipping, decorative warning animation, HIKARI, or Home/Search redesign was added. Physical large-text/accessibility verification remains separate from mounted/static coverage.

## Automated validation

| Gate | Final result |
|---|---|
| TypeScript | **PASS**, exit 0 |
| Focused playback/Library/connectivity/discovery/motion tests | **172/172 PASS** |
| Complete WAVEN regression suite | **503/503 PASS**, zero failed/skipped |
| New discovery recovery regressions | **20/20 PASS**, included above |
| R5 Living Wave regression suite | **PASS**, included in full/focused gates; component, tokens and existing wave tests unchanged |
| Android build | **PASS**, separate r2 candidate; exact output in `android-build.log` |
| Package / signer / 16 KiB alignment / launcher | **PASS** |
| Native payload | **31 DEX/native-library payloads byte-identical to R5** |

Exact commands and timings: `release/waven-v85-r6-20261018/gates.json`. Preserved first-candidate gates passed 501 tests before the two additional coordinator regressions; those are historical outputs, not the final 503-test gate. The first R6 APK at SHA `AF54472FD5F9C3A375E0A1D02C7AAE1BCE7E220EAE74141A358B220BCCA8F738` is superseded, retained and never installed.

| Required scenario | Final automated basis |
|---|---|
| A / B: category failure → automatic recovery while mounted | Fake-clock backoff plus actual mounted Search and real recovery runtime/coordinator; provider results controlled |
| C: global CHECK updates mounted category | Actual mounted Check control and Search; NetInfo/native transport boundary substituted |
| D / E: mixed health; resolved warnings disappear | Actual capability outcomes, mounted global status and Home; direct-healing stale-latch regression |
| F / M: rapid attempts; no duplicate/storm | 12 consumers / one provider call; 20 repeated checks, minimum interval and backoff assertions |
| G / H: navigation and stale generations | Actual Search Back control; cancellation, cache and health assertions after late completion |
| I: background / foreground | Connectivity lifecycle with mounted Search, durable intent and fresh validation |
| J: cached category survives outage | Real cache projection and runtime with controlled provider outage; title/artwork retained |
| K: New Releases without Home remount | Actual mounted Home receives accepted coordinated retry result and clears warning |
| L: playback during optional degradation | Real connectivity admission/serialized worker; native playback/provider output mocked |
| N: Living Wave unchanged | Existing R5 motion regressions in full suite and exact source hash preservation |

These are deterministic automated results, not Samsung/provider/audio PASS claims. `review-test-matrix.json` is the preserved pre-install checkpoint. Current physical outcomes are separately recorded in `release/waven-v85-r6-physical-20261018/physical-smoke-matrix.json`.

## Source accounting and preserved baseline

The SHA-based R5-relative change set contains **11 paths: 8 implementation files, 1 test file and 2 documents**. Cumulatively against exact original V8.5A.1, **31 paths = 24 implementation/tests + 7 documents** differ. Final porcelain count is **133**, versus 131 at this R5 baseline. Exact paths/hashes are in `source-integrity.json`; inherited dirty files are not counted as new edits.

- `apps/waven/app/search.tsx`: accepted-category subscription, preserved cached state, one-shot explicit refresh, localized retry presentation.
- `apps/waven/app/index.tsx`: shelf-specific failure bookkeeping and accepted-recovery warning removal.
- `apps/waven/src/components/connectivity/WavenConnectionStatus.tsx`: compact truthful global status and localized single-path handling.
- `apps/waven/src/features/discovery/wavenDiscoveryRuntime.ts`: shared reads, accepted empty notifications, real pending revalidation and recovery progress.
- `apps/waven/src/features/discovery/providerRequestBroker.ts`: generation-aware health acceptance.
- `apps/waven/src/infrastructure/connectivity/connectivityService.ts`: job-specific incomplete recovery accounting and predicate-proven completion.
- `apps/waven/src/infrastructure/connectivity/connectivityRuntime.ts`: register the catalogue job's pending predicate.
- `apps/waven/src/infrastructure/connectivity/phase8ValidationTrace.ts`: sanitize discovery capability timing labels to the existing `discovery` enum, without logging browse parameters/identifiers.
- `apps/waven/tests/p85DiscoveryRecovery.test.cjs`: 20 meaningful recovery regressions.
- This report and the existing master-plan checkpoint.

All **131 already-dirty R5 baseline files** have exact captured preimages under `release/waven-v85-r6-20261018/preimages/`. Accepted Phase 6/7 ACKs, R3/R4/R5 reports/APKs/sealed packages, lockfile, Living Wave, wave tests, theme tokens, branch/HEAD and unrelated source are protected by hash checks. The prior Phase 7 ten missing historical preimages and lack of a live two-real-Google-account switch remain accepted residual evidence; this snapshot does not retroactively repair them. Generated native/Gradle/manifest files are restored exactly after each build.

## Final candidate identity / installation gate

| Field | Value |
|---|---|
| Candidate | `release/waven-v85-r6-20261018/WAVEN-V8.5-PHYSICAL-CANDIDATE-r6-r2.apk` |
| SHA-256 | `13E192C878213EA822BB69E0CD695598CB1F591152F9D5F213217361604C095C` |
| Bytes | 67,447,051 |
| Package | `com.okali.waven.phase8validation` |
| Version / architecture | 0.1.0 (1), arm64-v8a |
| Build | Existing isolated release-derived `phase8Validation`, Hermes, debuggable false |
| Signer SHA-256 | `FAC61745DC0903786FB9EDE62A962B399F7348F0BB6F899B8332667591033B9C` — existing validation Debug signer, not canonical permanent signer |
| Native / launcher | Media3, streaming extractor, MMKV, NativeAnimated and P08 diagnostics verified; one launcher |
| Intended target | Samsung SM-S928B `R5CWC2RYXZF`, Personal user 0, existing isolated validation package only |
| Installed / Phase 8 accepted | **YES, exact owner-approved hash / NO** |

The owner separately approved this exact hash: **“Approve R6 r2 isolated update and smoke checks”**. The approval, guarded installation, pulled APK identity and protected-package readbacks are preserved under `release/waven-v85-r6-physical-20261018/`. R6 r2 updated only the existing Personal user 0 validation package. No uninstall, data clearing, cross-package transfer, network change or protected Work application operation occurred. Build-time `artifact-identity.json` retains its historical `Installed: false` checkpoint; `r6-installation.json` and final device audits establish the later installed state.

## Physical evidence and remaining work

R6 r2 was installed on Samsung SM-S928B `R5CWC2RYXZF`, Personal user 0, and its device APK hash matches the candidate. The final matrix distinguishes physical observations, deterministic fixtures and remaining manual cases. No further APK installation was needed after the interruption.

Before installation, R5 was read back at its exact prior hash and observed on Samsung, with scoped screenshots, a Jazz recording and target-PID diagnostics under `release/waven-v85-r6-physical-20261018/`. R5 Jazz loaded without CHECK; no deliberate provider outage or network change was injected. Its large warning was captured on Search/Library. The pre-update Library baseline was **1 liked song, 1 playlist, 12 history songs**; this differs from the earlier R5 report's 11 history songs and is preserved as the current observed state, not treated as data loss or rewritten historical evidence. No favorites/playlist edits were performed; ordinary playback used the existing history identity.

| Physical check | Result and scope |
|---|---|
| Normal category reads | Jazz **820 ms / 72 items**, Rock **1033 ms / 72 items**, actual category begin-to-ready events. No CHECK. |
| Automatic same-screen recovery | **Observed on Focus**: local unavailable message → opening → populated Flowstate/Lofi/Classical sections, with no CHECK, Retry, Back or remount during the wait. The recording shows the unavailable message at 4.261 s. A category attempt was cancelled during a recovery epoch; the later attempt accepted **140 items in 588 ms**, before unrelated metadata recovery ended unsuccessfully. Approximately **41 seconds** elapsed from selection including recovery/queueing; host/device timestamp skew prevents a precise tap-to-ready metric. This is genuine recovery gating/cancellation, **not an injected category HTTP failure**. |
| Warnings and mixed health | Recovered category content becomes usable while unrelated discovery remains degraded; large global panel absent. Normal Search/Library has no warning at final resting capture. Broad failure/global CHECK recovery is covered by mounted deterministic tests; no broad physical outage was forced. Cold-start transient compact reconnect status is retained as a real screenshot, not relabeled as CHECK validation. |
| Home | New Releases SPIN / Kroi and Mírame Ahora Sin Ti / Fire Volk and Trending cards are visible in the R6 shelf capture. These may be retained cache. **Strict initially-empty live-provider Home recovery is not physically established**; actual mounted controlled-provider retry passes automatically. |
| Playback during optional degradation | Something Just Like This reached Media3 **PLAYING** with advancing positions while optional discovery remained DEGRADED. Stream queue wait **0 ms**, native resolved **6516 ms**, JS handoff **6543 ms**. These are one physical operation, not a general latency improvement. |
| Navigation/background | Category/root, Home → Search → Library and saved playlist detail work. Playback position **207321 → 213330 → 216322 ms** across background/return, same native owner. Typed-query retention was not separately rerun in this R6 pass. |
| Persistence | After update and explicit final cold launch: **1 favorite, 1 playlist, 12 history entries**. Saved V8.5 Offline Smoke opens with MOON MUSiC intact. Final resting Library PNG/XML retained. |
| Final safety readback | Exact installed hash; protected packages unchanged; original network and animation settings restored; validation absent from Work; at most one target media session; no crash/ANR exit observed. |

Before screenshots: `manual-physical/r5-before-search.png`, `r5-jazz-observed.png`, `r5-before-library.png`. After: `r6-jazz.png`, `r6-rock.png`, `r6-focus-result.png`, `r6-home-shelves.png`, `r6-final-playlist-detail.png`, `r6-final-library-resting.png`. The Focus transition is additionally visible in `focus-frame-review/focus-recovery-contact.png` and `recordings/r6-focus-auto-1.mp4`. Before/after screens show different actual states, not a matched network benchmark.

The first fresh-source motion attempt genuinely failed with native **`failure_source-forbidden`** (the frozen native mapping for HTTP 403). Its failure log and raw `motion-checks-result.json` remain preserved. Motion checks then resumed the previously validated native media rather than weakening source validation. Unrelated fresh playback after this R6 rejection and failed-row retry were **not re-exercised**; R4's accepted historical observations remain separate. R6 audible output has no new owner confirmation and is not inferred from PLAYING.

The motion retake's strict helper also retains **`pass: false`**: the first resume snapshot was PAUSED, followed by eight PLAYING snapshots with advancing positions. It required every snapshot to be PLAYING and rejected that transition. `motion-reconciled.json` preserves this result and assesses the settled intervals separately. Four visible blue bars remain pixel-identical across four lossless screenshots while Reduced Motion is enabled and across four paused screenshots. Restored-live (1–11 s) and resumed settled-PLAYING (6–17 s) recordings contain **900 / 1004 measured adjacent pairs**, maximum bar-height step **4 pixels**, and no ≥10-pixel reset. These support smooth observed cycles; they are not frame-perfect or React rerender profiling. Reduced Motion was restored to its original setting.

Scoped cumulative gfx snapshots include **42.02% janky frames (3682/8762)** during the recording-heavy motion/source attempt, and **15.35% (31/202)** in the final cold process after navigation. Memory reached **662051 KiB PSS** in the earlier process and **574614 KiB** after final navigation. Counters are cumulative per PID, not independent trials. Startup/recording/workload differ, so no leak, zero-jank, speedup or production performance PASS is claimed. Responsiveness and no observed crash/ANR are bounded smoke results. Global FIFO latency and optional metadata fanout remain limitations; no speculative scheduler rewrite was added.

Remaining manual/unavailable fixtures: exact owner Jazz HTTP trigger; broad physical CHECK recovery; strict initially-empty Home recovery; R6 unrelated-source playback/row retry after the real forbidden event; fresh audible confirmation; supported multi-item skip; usable cellular fallback; physical large-text/screen-reader and broader performance profiling. Deterministic provider/transport fixtures are labeled in the matrix and do not fill these physical gaps. The initial diagnostics retry hit automatic approval-review usage limits and did not execute; later approved readbacks succeeded after reconnect/unlock. No bypass was used.

The immutable pre-install review archive is `release/waven-v85-r6-20261018/WAVEN-V8.5-R6-R2-PREINSTALL-REVIEW-20261018-SEALED.zip`, SHA-256 `9276C6540464AADBA7C22CDD685C122C027079FCC5DD5F1BC6AE57235CE0355F`. Its historical report/approval-pending state remains sealed. The separate final archive is `WAVEN-V8.5-R6-R2-FINAL-PHYSICAL-REVIEW-20261018-SEALED.zip` in that directory, with every entry size/hash and manifest verified by adjacent `final-seal-verification.json`. It includes current report/source, candidate, exact preimages, automated gates/failures, installation approval, physical recordings/screens/diagnostics, raw helper failures and their reconciliation. Prior archives are referenced by verified hashes and remain unchanged.

Phase 8 remains **AUTHORIZED / IN PROGRESS**, earns **0%**, and overall completion remains **60%**. No Completion ACK, commit, push, merge, tag, release, protected Work-profile change, Orion Cloud write, HIKARI/V8.6 or Phase 9+ work.
