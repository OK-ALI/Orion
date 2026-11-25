# WAVEN V8.5 R8 — E physical findings and revised F checkpoint

**2026-10-19 PKT. E remains installed. F built/verified, NOT INSTALLED. R8 repair unverified; Phase 8 NOT ACCEPTED; overall 60%. No Completion ACK.**

The owner approved exact E SHA-256 `980A942ED7BE53A88C75BF052477F48BA8DBB4C9754B4C7997FEC433A6085F81`. E lowers average stopped-navigation jank but introduces repeated long UI stalls and does not fix Search's vertical return position. Those unfavorable results are preserved. F narrows atmospheric caching to the persistent root and makes the existing AppShell restoration survive later layout clamps. Separate exact-artifact approval is required before F installation.

## Authority and data preservation

The authoritative [master plan](../plans/WAVEN-V1-MASTER-PLAN.md) is unchanged: Phases 0–7 accepted, 60%; Phase 8 fixed 8%, earns 0%; no Phase 9+/HIKARI authorization. The R8 directive requires continued correction after failed candidates and separate installation approval for each exact APK. All earlier reports, APKs, seals, master-plan bytes and Phase 6/7 ACKs remain preserved. Installation approval is not milestone acceptance.

E is installed only in Personal user 0's existing `com.okali.waven.phase8validation`, Samsung SM-S928B/R5CWC2RYXZF. Hash and UID 10719 verify; target absent from Work user 10. Current protected packages reside in Work and are absent from Personal, as recorded at preflight; their code hashes and user state remain unchanged. Network settings remain airplane 0/Wi-Fi 1/mobile data 1; all three animation scales remain 1. No network/refresh setting changes, data clear, uninstall, Google-session operation or Orion Cloud write occurred.

E's cold restart retains **1 favorite, 1 playlist, 12 history**, and **V8.5 Offline Smoke → MOON MUSiC by Coldplay**. Native restored context is NONE, Hymn 253732 ms; no autoplay. The first final-readback filter attempt did not select the filter; the subsequent guarded named-playlist tap refused because its label was absent. Those captures remain, and a fresh card-based readback successfully opened the playlist. No collection edit or private-MMKV extraction is claimed. Final exit-info contains no observed CRASH/CRASH_NATIVE/ANR; this is not a lifetime crash-free guarantee. D's pulled preimage is preserved. F is not installed.

## E controlled results and trace-supported defect

Four equivalent 15-second stopped-navigation windows use eight alternating Home/Search taps, recording OFF, native NONE endpoints, same PID/reset epoch and foreground guards. Thermal status is 0/0, recent intervals approximately 8.32 ms/120 Hz; no refresh setting changes. Diagnostic readbacks and screenshots occur outside quiet windows. Live provider/payload variation limits causal comparisons.

| Trial | Frames / janky | Jank | Recent-tail p95 latency |
|---|---:|---:|---:|
| E1 | 191 / 37 | 19.37% | 154.94 ms |
| E2 | 181 / 33 | 18.23% | 142.11 ms |
| E3 | 161 / 42 | 26.09% | 146.54 ms |
| E4 | 175 / 44 | 25.14% | 149.67 ms |

Pooled E **156/708 = 22.03%**, versus fresh A/R7 **242/488 = 49.59%**, B control **408/1141 = 35.76%**, C **697/1214 = 57.41%**, D **512/962 = 53.22%**. Sequential unequal samples are descriptive, not randomized estimates. E improves average jank but its repeated ~142–155 ms p95 tails are materially worse than D's ~47–52 ms. **E is not a successful final repair.** All raw windows remain available; no arbitrary threshold or favorable-trial selection.

The separate 12-second/five-action Perfetto trace shows JS scheduled CPU 601.9 ms, UI 1879.5 ms and RenderThread 460.75 ms; draw 98 slices/351.74 ms (mean 3.59 ms). Critically, **five `buildDrawingCache/SW Layer for ReactViewGroup` slices consume 604.97 ms, max 125.57 ms**. Long traversals reach 146.10 ms. Thus reduced drawing cost coexists with expensive cache builds at tab changes. These are real native trace observations, not isolated gradient shader timing or React commit counts. Frame-stage intervals overlap; detailed rows are recent tails, not entire-window distributions.

E's first-window after-snapshot records total PSS 711199 KB, RSS 838488 KB, Graphics 292036 KB; GPU cache 203.53 MB (161.8 MB purgeable), textures 132.38 MB, versus D GPU cache 57.57 MB/textures 30.35 MB. This is cache-pool pressure, **not evidence of a memory leak**. F's memory and cache-build behavior must be measured physically.

Selected settled Home pixel comparison against D passes: four regions, **211200 pixels, zero differences/max delta 0**. Regions cover left primary gutter, root gap, hero background and top gutter. Original 1440×3120 PNGs and comparison code/results remain. This does not establish whole-screen/all-route pixel identity or F physical pixels.

## Search origin: revised causality and bounded F correction

E restored the whole Search source and original origin test to exact R7/C bytes. Nevertheless, a fresh physical ASHE detail/Back sequence retains horizontal bounds **x463–813** but shifts Artist top **y1250→1974**, a 724 px vertical displacement. The Genre section also shifts. No Finding-artists notice is present at those endpoints. Therefore D's asynchronous rail was **not proven to be the sole cause**; the earlier D/E hypothesis is corrected here without rewriting sealed historical reports.

The existing AppShell restores once with requestAnimationFrame. Conditional Mini Player/navigation/safe-area layout can settle after that scroll and clamp the requested offset. F retains the desired offset in refs and re-applies it through coalesced layout/content-size callbacks. Any touch or drag ends restoration immediately; unmount cancels the pending callback. New explicit restoration tokens establish a new target. No React state loop, second scroll owner, route/Back rewrite, provider or scheduler change is introduced. Home with no requested offset gains no automatic reset.

Five new mounted-hook tests use the actual AppShell with explicit native ScrollView/layout/clamp/rAF doubles. They cover early clamp followed by viewport shrink, burst coalescing, touch/drag cancellation, later token ownership and unmount cleanup. Running those same tests against exact pre-F AppShell reproduces **4 failures/1 pass**; F passes all 5. The transient regression-proof source swap is restored and hashed. These are deterministic mechanism tests, **not physical F origin or FPS proof**.

F also makes Android/default atmosphere caching opt-in, default false. Only the persistent root opts in; route-owned AppShell canvases keep original paint without extra cache wrappers. Cache wrapper remains outside unchanged opacity/paint; all gradient values, geometry and ordering remain unchanged. Entry/quiet/web/iOS remain unchanged. Installed RN native layer implementation and frozen paint fixture are retained. Eleven symbolic atmosphere cases protect exact paint and eligibility/root ownership. No animation is disabled; no new native code, dependency, theme, playback owner, discovery scheduler or artwork cache.

## Validation and source boundary

**TypeScript PASS; 237/237 focused PASS; 538/538 full PASS.** All prior presentation, playback, Living Wave, lifecycle, connectivity, discovery and persistence tests remain green. Android release-derived build PASS; generated native files, Gradle and manifest restored. Mini Player exact R7, BottomNav exact C, Search/origin test exact R7, frozen paint fixture unchanged. Source provenance and dependency/lockfile boundary verify.

R7-relative accounting: **22 paths = 18 implementation/tests + 4 reports**. V8.5A.1-relative: **55 = 41 implementation/tests + 14 documents**. R5-relative: **37 = 28 implementation/tests + 9 documents**. Porcelain **149 entries**; exact machine inventory/diff accompanies this report. Compared with E, F changes Root, atmospheric cache eligibility, AppShell restoration, atmosphere test, two existing source-shape assertions, new restoration test and this report. Source-shape updates require the explicit root opt-in while retaining prior conditional ownership assertions; valid behavioral requirements remain.

Branch `waven/v1` and HEAD `d5299eb672df6d3396247cf15935b6de2ba7e7f1` unchanged. All 137 initial dirty preimages plus additional existing-file and E preimages verify. Twenty-one prior APK/seal identities verify. Accepted Phase 7 historical missing-preimage/live-Google-switch limitations remain transparently documented; no historical bytes are fabricated. Exact generated/native restoration and unchanged protected authority files are guarded.

## F exact artifact — approval required

`release/waven-v85-r8f-20261019/WAVEN-V8.5-PHYSICAL-CANDIDATE-r8-f.apk`

**SHA-256 `6D777C09C5F2F7531FA761D78C9A9C7DF40F54EA8E8BB021C604164A76E4C47C`**

67,449,319 bytes; `com.okali.waven.phase8validation`; version 0.1.0(1); arm64; release-derived/nondebuggable; one launcher. Existing validation signer `FAC61745DC0903786FB9EDE62A962B399F7348F0BB6F899B8332667591033B9C` verifies. Signature, 16 KiB alignment, native Media3/streaming/MMKV/NativeAnimated/diagnostic presence PASS. All **31 DEX/native-library payloads identical to R7**; JS differs. No production distribution claim. **NOT INSTALLED. E approval does not cover F.**

After exact approval: update only existing Personal user 0 validation package, preserving Library/UID/Work state. Run equivalent repeated stopped-navigation windows and trace, inspect cache builds/long tails/memory, selected atmosphere pixels, Search Artist/Back horizontal AND vertical origin, Home later-rail/detail/restoration; then playing Home/Search/navigation, native progress, fresh track switch, pause/resume/background, Living Wave and Reduced Motion restoration, discovery recovery during playback. Finish cold Library/named-playlist and package/settings readback. No network/refresh changes. Revise if the fix is not physically demonstrated.

## Acceptance reconciliation and evidence

The accompanying matrix separates physical E results, historical evidence, deterministic tests and F NOT RUN. Current E performance quality and vertical-origin gates remain FAIL; selected Home pixels and preservation have scoped PASS. E's complete playing/motion battery was not run after these failures; no E audibility claim. Human R7 audible output and R5 smooth-cycle feedback remain historical. Genuine current-candidate 403/unrelated playback and truthful retry, initially-empty live releases, usable cellular, supported multi-item/local media fixtures, broader loss/CHECK/flapping/offline mutation/restart, conditional Cloud, assistive-tech and signed-distribution requirements remain unresolved as detailed in the matrix. No mocks are promoted to physical PASS; no waiver is inferred.

Separate archive: `release/waven-v85-r8f-20261019/WAVEN-V8.5-R8-EF-REVIEW-20261019-SEALED.zip`, verified entry-by-entry against its manifest. Includes F APK/source/diff/gates/regression proof/native restoration, raw E frames/trace/memory/pixels/origin failures/approval/install and final readback, exact preimages, authority snapshots and earlier artifact references. Prior E seal remains `2CD0F8C01CE1094E2E63E1ED872142858AFD60FA72AE7A40CD60DA3922B86027`.

**Await exact F installation approval. E remains installed with data preserved. R8 continues; Phase 8 NOT ACCEPTED; overall 60%. No Completion ACK, commit, push, merge, tag, release, data clear, uninstall, protected-profile change, Phase 9+ or HIKARI.**
