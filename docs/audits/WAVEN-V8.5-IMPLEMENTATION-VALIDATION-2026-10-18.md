# WAVEN V8.5 implementation and validation — 2026-10-18

Status: **implementation and automated gates complete; r3 installed and physically exercised; manual/owner gates remain**. This is not an accepted Phase 8 Completion ACK. WAVEN remains **60%**; Phase 8's fixed **8% is unearned**. Phase 9 onward remains unauthorized. COMMIT NO; PUSH NO; no merge, tag, publication, uninstall or data clearing.

## Authority and starting evidence

The real workspace, authoritative [master plan](../plans/WAVEN-V1-MASTER-PLAN.md), section 13 and Phase 8, and [UI/UX contract](../design/WAVEN-UIUX-REFERENCE-DESIGN-CONTRACT.md) govern this change. The owner's V8.5 authorization is attachment `e92928b5-a20e-48ad-a1df-7457d23d2537/Pasted text.txt`. The contract's active-playing row requirement is implemented within this bounded reliability repair; immersive player/lyrics/downloads/Cloud sync/distribution are deferred.

Branch `waven/v1`; HEAD `d5299eb672df6d3396247cf15935b6de2ba7e7f1`. The actual V8.5A.1 boundary had **121** porcelain entries. Exact dirty file preimages and hashes were captured before edits in `release/waven-v85-20261018/preimages/`, `status-before.txt`, and `source-before.json`. Existing dirty work was retained. ZIPs were reference evidence, never the source of truth.

Read-only Samsung inspection confirmed SM-S928B, serial `R5CWC2RYXZF`, Android API 36. The installed Personal validation APK matches V8.5A.1 SHA-256 `89C39B6BEF45A89C22EF3B50C2BA7510ABAC773F3913944D1648E3ECC6BEC804`, with signer `FAC61745DC0903786FB9EDE62A962B399F7348F0BB6F899B8332667591033B9C`. Its exact APK was copied to `installed-v85a1-preimage.apk` before any update. Current Personal contains only `com.okali.waven.phase8validation`; protected `com.okali.waven`, `.development`, and `.sourcevalidation` are installed in Work user 10. This differs from the historical October 2 launcher state; current device evidence takes precedence. No protected package is enabled, installed, updated, uninstalled, cleared, or moved by this work.

## Root causes and repairs

1. **Track failure contaminated global availability.** `youtubeMusicStreaming` reported every source exception as a provider-wide failure. A forbidden individual URL could mark streaming down and initiate connectivity recovery. Source exceptions now remain track-local; the internet service and source's actual access verification still gate every attempt. Metadata suggestions no longer claim to prove native streaming, categories or New Releases.
2. **Discovery recovery was used as a playback prerequisite.** Rows and the Library sheet used `remoteReady`, and runtime cancelled preparation whenever that flag fell. A pending optional shelf could therefore disable otherwise healthy playback. The same connectivity owner now exposes independently validated `internetReady`; streaming remains usable while optional recovery runs. Genuine transport loss, backgrounding and account changes revoke it and cancel stale work. Capability health/backoff scopes separate New Releases and individual category destinations. The existing global serialization contract is retained; no speculative queue rewrite was introduced.
3. **Preparation could lack a terminal JS state.** A provider ignoring cancellation could leave a row busy indefinitely. A bounded 45-second handoff deadline now cancels preparation and reports a retryable track error. Generation checks still prevent cancelled/older requests from publishing or reaching a later native handoff. Track-local error receipts remain bounded and clear on retry, independently of other songs.
4. **Native cancellation did not release an active validation socket.** Killing the extractor did not stop an in-progress prefix/later-range probe on the single source executor. Requests now own their active connection; cancellation disconnects it and cancels the process, while finished-request checks prevent later validation/handoff. Socket/process cleanup runs on a dedicated cancellation executor, including main-looper deadlines. Both access probes, identity/host/expiry checks, pinned extractor, and fresh-per-play leases remain required. No signed URL is persisted or source restriction bypassed.
5. **Accepted background releases had no path into mounted Home state.** The cache changed without a presentation notification. Accepted runtime cache updates now publish keyed events; mounted Home fills a missing shelf without navigation/remount. Existing visible rail ordering remains stable until its accepted refresh boundary. Real mounted React tests prove this behavior.
6. **Stale generations and broad filtering could erase data.** Old releases/charts/category completions now return cancelled and cannot replace newer accepted snapshots or persisted metadata. Failed requests remain failures and do not write successful cache entries. Valid prior metadata survives transient failures within cache policy. Verified empty results are terminal rather than permanent failed refresh intent. Home prefers distinct releases, but if all verified releases overlap Trending it preserves a deduplicated New Releases shelf instead of silently erasing it. A missing shelf has explanatory retry copy.
7. **Rows lacked authoritative active-track feedback.** One shared, read-only Media3 observer drives playing/paused/preparing/failed/retry presentation, keyed by canonical track/queue identity. Playing titles use WAVEN blue and a quiet three-bar indicator. Static bars add no animation load and respect Reduced Motion. Position ticks do not rerender every row. Late restored queue identity cannot overwrite the currently selected item. This observer never owns audio or queue mutation.

The historical seven-entry provider result does not identify which Home request or overlap filter lost the presentation. Source inspection and mounted tests repair those loss paths. R3 physical captures now show actual New Releases cards on Home, including retained artwork and metadata after offline restart; provider success alone was not counted as a rendering pass.

## Executed gates and final artifact

| Gate | Actual result | Evidence |
|---|---|---|
| TypeScript | PASS | typecheck.log |
| Focused Phase 6–8/Library/native-range/V8.5 | 140/140 PASS | focused.log |
| Complete WAVEN suite | 470/470 PASS | full-suite.log |
| Deterministic V8.5 smoke/repair suite | 34/34 PASS | p85Smoke.test.cjs; included in focused/full runs |
| Mounted Home recovery/generation presentation | PASS | actual React DOM effects, with mocked native/network |
| Android Kotlin/Java/JS compilation and packaging | PASS — r3, 38 seconds, 622 tasks | android-build.log |
| Package/signature/16 KiB alignment/payload | PASS | artifact-identity.json, apk-badging.txt, apk-signing.txt, zipalign.txt |
| Installed r3 SHA-256 and final device safety readback | PASS | r3-installation.json, final-device-audit.json |
| Scoped source integrity | PASS — 20 changed/new files; no unexpected changes/removals | source-integrity.json |

Final APK: **C:\Projects\WAVEN-v1\release\waven-v85-20261018\WAVEN-V8.5-PHYSICAL-CANDIDATE-r3.apk**, 67,438,399 bytes. SHA-256 **860A0ACBF7BD8DA271CAB7ADB4C0601351FA5940E54947468CC79928207BB9CA**. Package **com.okali.waven.phase8validation**, version **0.1.0 (1)**; signer SHA-256 **FAC61745DC0903786FB9EDE62A962B399F7348F0BB6F899B8332667591033B9C**. Embedded JS SHA-256 **E7726ACD9B01F99908451EF39D9DD7E15CCA726122D97AC2D450D74EE89876AA**.

The owner explicitly approved r2 and then r3 separately. Both were installed in place in Personal user 0 after exact preimage checks; original APKs remain preserved. R3 corrects the build helper to synchronize every authoritative playback template, including the pre-existing 19 Media3 diagnostic lines omitted from r2's generated input. Its application logic/JS is identical to r2. The streaming cancellation repair is packaged; all temporary generated Kotlin/Java and Gradle bytes were restored and hash-verified. No source, dependency or lockfile changed after the final automated gates. This is isolated development-tier evidence, not a permanently signed distributed release.

All evidence paths below are relative to **C:\Projects\WAVEN-v1\release\waven-v85-20261018** unless stated otherwise. Scripts and original/intermediate APKs remain there. The evidence seal manifest identifies the packaged review subset and its exact hashes; it does not replace the local workspace.

## Repeatable smoke matrix

Run deterministic smoke with `node --test apps/waven/tests/p85Smoke.test.cjs`. All 18 scenarios have deterministic PASS coverage within the 34-test file. Simulated native/network behavior is **not** physical evidence.

| Smoke | r3 physical status | Observation / remaining boundary |
|---|---|---|
| 01 | PASS | Cold launch, installed r3 hash verified. |
| 02 | PASS | Home, history and real shelves rendered without crash. |
| 03 | PASS | BOTZ, SPIN and Housewife provider-backed New Releases cards visible; also retained offline. |
| 04 | PASS | Coldplay/Moon Music and Adele/30 details; uncached interruption and automatic recovery. |
| 05 | PASS | Yellow reached native PLAYING; blue title and quiet indicator visible. |
| 06 | PASS | Hymn for the Weekend reached native PLAYING. |
| 07 | PASS | Something Just Like This reached native PLAYING. |
| 08 | PASS | Two eight-round bursts; corrected assertion requires fresh final C position, then stable C 12 seconds later. |
| 09 | MANUAL REQUIRED | Real HTTP403 followed by unrelated success was not reproduced on r3. Actual adapter mocked-403 regression passes; cancellations are not relabeled HTTP403. |
| 10 | MANUAL REQUIRED | Network-interrupted preparation retried successfully on the same Home screen. Genuine provider-rejected-song retry still needs a live rejection. |
| 11 | MANUAL REQUIRED | Preparing, playing and paused states observed. Genuine failed/retry row presentation remains physical manual review. |
| 12 | MANUAL REQUIRED | Pause, fresh-source resume with position continuity, navigation and background passed. No genuine multi-item product queue was available to establish physical skip. |
| 13 | PASS | Healthy native playback remained usable during recovery; metadata/charts probes stayed up during real release-specific degradation. |
| 14 | MANUAL REQUIRED | Mounted empty-to-new shelf passes automated tests. Physical valid/cached shelf and recovery were observed; an initially empty physical shelf was not forced by clearing data. |
| 15 | PASS | Hip-Hop/Classical live collections; Rock persisted cache after offline process kill and later recovery. |
| 16 | PASS | No observed crash/ANR, stale final handoff or stuck preparation in the exercised stress/loss paths. Scope is this run. |
| 17 | PASS | Single target MediaSession, ordered handoffs, repeated playback and fresh final C. |
| 18 | PASS | Protected packages unchanged; target absent from Work; Library persisted across update and offline process kill. |

Machine-readable results: **physical-smoke-matrix.json**. Corresponding PNG/XML/native-session JSON evidence is under **manual-physical/**; structured scoped trace/timing/restoration evidence is **physical-summary.json** and **r3-diagnostics-merged.log**. No simulated result was promoted to a physical PASS.

The initial r2 UI script sometimes reused an older hierarchy when Android could not become idle during Mini Player animation. Its affected hierarchy assertions are not acceptance evidence. Capture helpers now require a newly written unique path and explicit dump success; otherwise they save a foreground WAVEN screenshot and mark the hierarchy unavailable. PNG and XML captures occur sequentially and can straddle a transition. An initial rapid-test title assertion could also match the pre-existing C; the corrected rerun requires a post-burst position reset and later stable state. The corrected r3 result and trace, not that early assertion, establish PASS. The first release-card interruption attempt did not open a detail route and is not counted as the Album loading test; the later observed **Open 30 album details** test is the evidence.

## Master-plan section 13.8 physical reconciliation

| Required condition | Result and evidence |
|---|---|
| Normal Wi-Fi | PASS — live Search, categories, detail, playback, Home cards |
| Wi-Fi off while usable cellular remains | MANUAL REQUIRED — mobile-data setting remained enabled, but this device provided no usable alternate connection; WAVEN correctly observed OFFLINE |
| No alternate network / airplane | PASS — explicit OFFLINE, retained cached/Library presentation |
| Loss while browsing / Search | PASS — current route/query retained; Laufey search recovered automatically without another query submission |
| Loss during Artist/Album load | PASS — uncached Adele/30 routes showed connection copy, then automatically populated 5 songs/14 releases and 12 tracks on the same intended routes |
| Loss during playback / new source resolution | PASS — buffered Rung Do continued; Dhoom preparation terminated after loss; same-screen retry later played Dhoom |
| Reconnect during playback / repeated flapping | PASS — native identity/position continued; no automatic queue replacement |
| Background / relaunch / process kill offline | PASS — native buffered playback in background; cold restore paused/stopped with queue intent intact |
| Reconnect after process restart | PASS — no auto-play; later fresh validated source played successfully |
| Offline favorites / playlist mutations | PASS — MOON MUSiC favorite and V8.5 Offline Smoke playlist persisted after process kill |
| Provider degradation with internet available | PASS — release timeouts/scoped health down while metadata/charts probes succeeded; cached/local UI and usable playback remained |
| Cached metadata/artwork | PASS — Home cards, Rock and Library artwork persisted offline/restart |
| Cloud music reconnect | N/A — Phase 9 music enrollment/sync remains unauthorized; no Cloud music transaction was attempted. Guard/no-op tests passed |
| Local/downloaded audio | N/A — no supported downloaded audio fixture; Phase 11 remains unauthorized. Buffered remote continuation is reported separately |
| ONLINE → OFFLINE → RECOVERING → ONLINE | PASS — scoped trace plus final online Library and automatically recovered Search |

Final device readback passed: exact r3 APK; one target native MediaSession; protected packages byte-for-byte identical at the audited package-state fields; target absent from Work; no crash/ANR exit observed in target exit-info. The USB device disconnected briefly after a Library capture, then the owner reconnected it and the readback completed. Incremental logs were retained through the disconnect. Final Wi-Fi **1**, mobile data **1**, airplane **0**, matching the original settings. Every temporary network scope recorded successful restoration. No global logs were cleared. Work data and Google sessions were not inspected or changed.

Before r3, Library had **8 history entries** and no saved collections. Final Library has **11 deduplicated history entries**, **1 favorite**, and **1 validation playlist**; the three added histories are the real successfully played Artist songs. Two rapid-switch bursts and later replay did not inflate the distinct-song count. The offline test additions are intentional data in the isolated validation package. No original Library entry was deleted, and no cross-package data transfer occurred. The accepted Phase 7 development/canonical data distinction and all historical evidence limitations remain unchanged.

## Measured performance and limitations

Baseline: the preserved V8.5A.1 diagnostic log in Downloads, aggregated in **baseline-timings.json**. Nine stream queue waits were 0 ms; extraction median 3715 ms (3142–5065), prefix 687 ms (13–1908), later-range 115 ms (31–719), native resolution median 4466 ms (3314–6414, seven successes), and JS invocation-to-handoff median 4591 ms (3413–6476, seven). Warmup was 934 ms once. Two real baseline forbidden sources were correctly rejected.

R3 captured timing samples:

| Stage | Samples | Median | Range |
|---|---:|---:|---:|
| Streaming queue wait | 54 | 1 ms | 0–7738 ms |
| Native executor wait | 54 | 17 ms | 0–38 ms |
| Extractor initialization after warmup | 54 | 0 ms | 0–0 ms |
| Extraction | 7 | 3887 ms | 3608–5010 ms |
| Prefix validation | 7 | 108 ms | 10–260 ms |
| Later-range validation | 7 | 70 ms | 40–91 ms |
| Native source resolution | 7 | 4031 ms | 3788–5195 ms |
| JS playback invocation to handoff | 7 | 4045 ms | 3806–11992 ms |
| Media3 buffering → playing | 7 | 82 ms | 62–316 ms |
| Handoff event → Media3 playing | 7 | 85 ms | 65–322 ms |

These are different songs/network conditions and are not a controlled speedup benchmark. The global serial remote queue remains intact. One stream waited **7738 ms** behind metadata recovery and its handoff took **11992 ms**. Successful native extraction remains about 3.6–5 seconds. Two rapid bursts produced **46 cancelled attempts**, followed by correct final C handoffs; one subsequent network interruption accounts for the other early source-unavailable diagnostic. Those cancellation diagnostics are not HTTP403 counts. Cancellation/executor waits stayed bounded in that captured stress window. Native playing and advancing position do not establish audible output.

New Releases still genuinely approaches the 12-second provider deadline and can time out. Later physical trace contains release-specific degradation and backoff, followed by recovery to ONLINE. End-to-end release times can exceed 12 seconds because queue wait is separate from the unchanged operation deadline. Recovery metadata work reached about **42 seconds**, and multiple backoff cycles can make optional discovery recovery take minutes. This latency remains a documented limitation; no false healthy status or extraction-speedup claim is made. Existing valid shelves remain available. The oldest rotated device log interval was preserved through earlier incremental captures; timing statistics only use actual captured events.

Outstanding manual review: real r3 HTTP403 failure isolation/retry, physical failed-row presentation, genuine multi-item skip, physical initially-empty Home → newly recovered shelf, usable cellular fallback, audible output and final owner acceptance. These are neither fabricated passes nor accepted new residuals. The owner decides acceptance after reviewing this boundary. No release distribution, Cloud music synchronization, downloads, immersive player or later-phase work was introduced.

## Exact changed files and integrity

Relative to this mission's captured baseline, **20** files changed or were added (17 implementation/tests and 3 documents). Final porcelain count **125**, versus **121** initially. The exact list is:

- apps/waven/plugins/waven-streaming-native/WavenStreamingSourceModule.kt
- apps/waven/src/components/connectivity/WavenConnectionStatus.tsx
- apps/waven/src/components/library/WavenLibraryControls.tsx
- apps/waven/src/features/playback/trackPlayback.ts
- apps/waven/src/features/playback/trackPlaybackRuntime.ts
- apps/waven/src/features/playback/trackPresentation.ts
- apps/waven/src/infrastructure/connectivity/connectivityRuntime.ts
- apps/waven/src/infrastructure/connectivity/connectivityService.ts
- apps/waven/src/infrastructure/music/providers/youtubeMusicStreaming.ts
- apps/waven/tests/p6SearchToPlayHandoff.test.cjs
- apps/waven/tests/p7LibraryPresentation.test.cjs
- apps/waven/tests/p85Smoke.test.cjs
- docs/audits/WAVEN-PHASE-8-COMPLETION-ACK-CANDIDATE-2026-10-18.md
- docs/audits/WAVEN-V8.5-IMPLEMENTATION-VALIDATION-2026-10-18.md
- apps/waven/app/index.tsx
- apps/waven/src/components/detail/WavenMusicDetailFoundation.tsx
- apps/waven/src/components/player/WavenMiniPlayer.tsx
- apps/waven/src/features/discovery/providerRequestBroker.ts
- apps/waven/src/features/discovery/wavenDiscoveryRuntime.ts
- docs/plans/WAVEN-V1-MASTER-PLAN.md

Before/after SHA-256 values are in **source-integrity.json**; exact dirty preimages in **preimages/**; final Git status in **status-after.txt**. Branch and HEAD are unchanged. All unrelated visible files, dependency lockfile, and accepted Phase 6/7 ACK hashes were preserved. Every generated playback/streaming file and Gradle source was restored to its captured bytes. The historical ten missing Phase 7 preimages remain transparently documented; current V8.5 preimages do not retroactively fill that gap.

## Release readiness and decision

**Not release-ready and not an accepted Phase 8 Completion ACK.** Implementation, local gates, isolated native packaging and substantial final-candidate physical validation are complete. The manual cases above and owner acceptance remain. The pending ACK candidate records this boundary; Phase 8 earns **0%**, overall WAVEN stays **60%**, and Phase 9 onward is not authorized. **COMMIT NO; PUSH NO.**
