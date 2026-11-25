# WAVEN V8.5 R4 physical validation — cycle defect found

**2026-10-18 · R4 installed with explicit owner authorization · NOT ACCEPTED · overall 60%**

The owner authorized the exact R4 APK, Personal user 0 on Samsung SM-S928B `R5CWC2RYXZF`, and physical smoke/evidence collection. Authorization is preserved in `release/waven-v85-r4-physical-20261018/owner-authorization.txt`. Installation replaced only `com.okali.waven.phase8validation`, with no uninstall or data clearing. Installed SHA-256 is `F93A6B167451D73E024B3FC3DA4F48EF6C3E70011417BFB078F32A27553F626D`; the existing validation signer was verified against both the R3 preimage and R4 candidate. The R3 APK was pulled and hash-verified before replacement; prior R3/R4 review ZIPs remain intact.

## Completed physical record

| Case | Classification | Actual evidence and limits |
|---|---|---|
| R4 install, readback, cold launch | **PHYSICAL PASS** | Exact installed APK hash, expected serial/model/user/package, one intended package updated; `r4-installation.json` |
| Library survives update and restart | **PHYSICAL PASS** | Before/after and `r4-restart-library.png/xml` show 1 liked song, 1 playlist, 11 history entries. |
| Real provider playback | **PHYSICAL PASS** | Native PLAYING and advancing positions for Something Just Like This, Yellow, and later Hymn for the Weekend; recordings and target-only diagnostics |
| Audible output | **PHYSICAL PASS — owner confirmed** | Owner directly replied “Yes, I can hear it” while Something Just Like This was playing; `owner-audible-confirmation.json`. No inference from native state alone. |
| Four bars actually move | **PHYSICAL PASS** | `first-play.mp4`: eleven measured four-bar samples, height ranges 18/17/17/16 video pixels; resume recording also changes all four bars. These are real recorded frames. |
| Seamless cycle after restart | **FAIL** | Owner observed a completed cycle glitching and restarting. R4's fractional restart plus Android's repeat-from-start behavior explains a discontinuous partial cycle; preserved R4 regressions fail before the R5 correction. Moving bars do not establish a seamless loop. |
| Pause / resume | **PHYSICAL PASS for native state and position** | PAUSED held 108585 ms through the 8-second recording; resume continued from 108593 ms. Motion-seam quality remains FAIL. |
| System Reduced Motion | **PHYSICAL PASS** | Temporary `transition_animation_scale=0` yielded static bars while native PLAYING advanced. Four lossless bar crops are pixel-identical (`static-raw/comparison.json`). Both scopes restored original value 1 in finally blocks; no network setting changed. |
| Rapid A→B→C | **PHYSICAL PASS** | Four rounds, 12 taps; final C Something Just Like This reached PLAYING with fresh near-zero position, then remained C with advancing position; `rapid-result.json` and later native capture |
| Foreground/background | **PHYSICAL PASS** | Native same-track position 56707→59704→62711 ms across Home/return; foreground restored. No other-app screenshot captured. |
| Genuine HTTP403 then unrelated play | **PHYSICAL PASS** | At device 12:13:47.839 the native validator emitted `failure_source-forbidden`; the exact template maps `source-http-403` to this code. This followed prefix/later-range validation, not cancellation. The real Hymn row exposed Retry; subsequent Yellow reached native PLAYING and advanced. |
| Failed row and retry on same route | **PHYSICAL PASS** | `failed-hymn-row.png/xml` shows “Playback failed. Retry”. `hymn-retry.mp4` records the actual Retry tap, fresh source resolution, BUFFERING then PLAYING and advancing Hymn position without reopening Library. |
| Preparation / buffering | **PHYSICAL PASS for native transitions and visual Buffering** | Sequentially decoded real frames at 16.108/16.257 seconds show “Buffering”, then four playing bars (`state-frames-final/first-play-preparing-buffering.png`). Preparing's brief visual duration was not separately isolated; its distinct presentation has automated coverage. |
| Scroll with active playback | **PHYSICAL OBSERVATION** | History scroll operated while native playback continued. Raw gfx/framestats are retained; this is not a zero-jank claim. |
| Physical React commit counts | **MANUAL REQUIRED / instrumentation unavailable** | Production-derived APK does not expose per-row React commit telemetry. Separate mounted 100-row regression passes; it is an automated/mock result. |
| Home / releases / Artist / Album | **PARTIAL R4; separate R5 coverage** | R4 Trending populated; New Releases timed out. R5 later physically populated New Releases, Coldplay artist, Moon Music album, restored Search and three genre routes. These are R5 results, not retroactive R4 passes. |
| Final device state | **PHYSICAL PASS** | `final-device-audit.json`: exact R4 installed hash; protected package code/state hashes unchanged; target absent Work; original network and animation settings retained/restored; one target MediaSession; no observed crash/ANR exit. |
| Initially-empty Home recovery / supported multi-item skip / cellular fallback | **MANUAL REQUIRED** | No data was cleared to create a fixture; no new queue feature or network-setting change is authorized here. Unavailable scenarios are not counted as passes. |

## Performance observations

Final pre-restart Android gfxinfo reported 79056 rendered frames, 23599 janky frames (**29.85%**), CPU frame percentiles 12/16/17/21 ms (50th/90th/95th/99th). This cumulative process window includes startup, source extraction, metadata recovery, screenshots and screen recording. It does not isolate Living Wave cost and does not establish acceptable smoothness; the owner's loop defect is independently a FAIL. Exact framestats remain in `performance/`; no global logs or counters were cleared.

PSS was 403048 KiB initially and 407838 KiB at final pre-restart capture; RSS 523428→469448 KiB. Other snapshots varied. These are observations, not a leak proof. Final protected-package and crash/ANR readback passed as described above.

The real stream path remains serialized. Deduplicated target diagnostics (`physical-summary.json`, 3950 unique lines) contain 18 stream queue waits: median 0 ms, maximum **10080 ms**. Seven extraction samples have median 3826 ms (3615–5023); six resolved samples median 4162.5 ms (3847–5602); six completed handoffs median 6330 ms (3872–15695). The genuine forbidden-source operation failed after 3687 ms. These are captured operation samples, not a controlled benchmark or every request. No scheduler or source-verification weakening was introduced; optional metadata can still delay playback.

## Evidence and disposition

All R4 physical evidence is under `release/waven-v85-r4-physical-20261018/`: screenshots/hierarchies, recordings, sampled Media3 states, scoped diagnostics, performance data, authorization, signer checks and preserved APKs. The reconciled 18-case cross-build matrix is `release/waven-v85-r5-physical-20261018/physical-smoke-matrix.json`. R3 offline observations remain historical; no new network toggles were performed here.

Final sequential decoding of R4's resume recording, seconds 8–20, yields 1077 adjacent four-bar pairs and **nine 25–26 video-pixel jumps** at approximately 1.323-second intervals. This corroborates the owner's visible reset report. Early analyses are retained: timestamp seeking on variable-frame-rate video selected wrong frames; an initial 10 ms minimum pair interval omitted ~8 ms frames; the static paused video had only two encoded frames, so a ten-frame requirement could not classify it. Final cycle analysis decodes from the beginning and checks real timestamps (3–70 ms pairs); lossless screenshots establish static pause/Reduced Motion separately. Compressed-video measurements aid visual review and do not prove frame-perfect behavior or React render counts.

R4 is not owner-accepted. Its bounded cycle correction was built separately as **R5**, then installed only after artifact-specific owner approval. [The R5 report](WAVEN-V8.5-R5-LIVING-WAVE-CYCLE-2026-10-18.md) records corrected physical motion and the owner's “Cycles look smooth now” feedback. That feedback is not Phase 8 acceptance. Original R3/R4 APKs, sealed ZIPs and historical checkpoints remain unchanged. No Phase 8 Completion ACK is issued; Phase 8 earns 0%, overall remains 60%. No commit/push/merge/tag/release, no data clearing, no protected Work-package changes and no Phase 9+ work.
