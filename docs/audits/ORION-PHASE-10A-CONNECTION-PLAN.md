# PROJECT ORION PHASE 10A - CONNECTION PLAN

**Canonical name:** `ORION-PHASE-10A-CONNECTION-PLAN.md`
**Status:** CANONICAL PHASE 10A EXECUTION AUTHORITY
**Date established:** September 1, 2026
**Phase identity:** Phase 10A - Connection: Offline Experience, Cross-Platform Product Hardening & Performance
**Phase classification:** Post-Phase-10 bridge tranche; not Phase 10 reopening and not Phase 11
**Master Audit status:** Not yet represented as a weighted Master Audit phase; later reconciliation only after Phase 10A completion evidence is frozen
**Phase 10 implementation checkpoint:** `66f647af1a5f77d4792fe82ea2d4662fc3f05351`
**Phase 10 implementation lock:** `50987dc2492f02ba7aa3dd9e235ba08a589a6b1c`
**Phase 10 completion audit commit / Phase 10A floor:** `bd046de312de8edd0abe62d41d75b1c50eb2a9e2`
**Published Phase 10 candidate:** `v2.2.11 / Android code45`
**Published v2.2.11 tag target:** `66f647af1a5f77d4792fe82ea2d4662fc3f05351`
**Local inspection package:** `orion-phase10a-local-source-inspection-v3-20260901-132926.zip`
**Inspection ZIP SHA256:** `46AA59744DD578005855241A0FA7E8C72C989A0A4AD7378735E26ADFDA9F4091`
**Inspection manifest SHA256:** `CBEBB8342BADC7211B81BEA90AB2E859BE7A6E6054E081AC1A0B66B57909E6C4`
**Inspection package integrity:** 946 packaged files, 945 manifest entries, 0 manifest mismatches

---

# 0. Canonical relationship

Phase 10A begins only after Phase 10 is COMPLETE & LOCKED.

The following authorities apply together:

1. `ORION-ENGINEERING-OPERATING-CONTRACT.md`
   - Governs local-source authority, evidence, Git discipline, validation, packaging, freeze and lock rules.

2. `ORION-PHASE-10-MOBILE-DOWNLOADS-OFFLINE-LIBRARY-PLAN.md`
   - Preserves the architecture and accepted scope of the completed Phase 10 Mobile download system.

3. `ORION-V3-P10-F-PHASE-10-COMPLETION-AUDIT.md`
   - Is the canonical consolidated evidence that Phase 10 is complete and locked.

4. `ORION-PHASE-10A-CONNECTION-PLAN.md`
   - Governs the new post-Phase-10 Connection tranche: offline product behavior, Desktop return/polish, Desktop Download Modal redesign, cross-platform performance hardening and inspection-driven production polish.

5. The Orion V3 Master Audit
   - Remains authoritative for its existing weighted roadmap, existing checklist IDs and historical progress.
   - Is not modified merely because Phase 10A begins.
   - Will be reconciled later using frozen Phase 10 and Phase 10A completion evidence.

## 0.1 Conflict rule

If two documents appear to conflict:

1. The Engineering Operating Contract wins for workflow and evidence discipline.
2. The Phase 10 Completion Audit wins for what Phase 10 already completed and locked.
3. This Phase 10A Plan wins for Phase 10A scope, architecture, stage order and acceptance.
4. The Master Audit wins for its existing weighted checklist and percentage accounting.
5. Current local workspace truth wins for present implementation ownership and current code state.

Historical GitHub snapshots, old ZIPs, remembered source and earlier planning notes are supporting evidence only.

## 0.2 Local source authority

The current local workspace is the primary source of truth.

The Phase 10A source inspection was created from the post-Phase-10 completion-audit floor:

`bd046de312de8edd0abe62d41d75b1c50eb2a9e2`

The inspection package verified the relevant Mobile and Desktop source landscape before this plan was frozen.

---

# 1. Frozen Phase 10 floor

Phase 10A inherits Phase 10 as a locked production floor.

Phase 10A must not reopen the following accepted Mobile Phase 10 architecture without a new reproducible defect:

- Android-owned download execution,
- finalized artifact ownership,
- SAF publication policy,
- exact integrity verification,
- HLS/DASH finite transfer architecture,
- download pause/resume/retry/cancel ownership,
- WorkManager recovery policy,
- durable native download state,
- Offline Library ownership,
- finalized Offline Player architecture,
- MediaPlayer + TextureView playback core,
- seek convergence architecture,
- audio/subtitle/lock/player geometry acceptance,
- production updater architecture,
- permanent signing identity,
- published `v2.2.11` artifacts,
- published `v2.2.11` tag or release.

The Phase 10A rule is:

**connect and polish proven capability; do not rewrite proven capability merely because a neighboring product surface changes.**

---

# 2. Why Phase 10A exists

Phase 10 delivered major functionality, but Orion still has product seams between its systems.

The central Phase 10A problem is not "add more features."

It is:

**make Orion understand and present its existing capabilities as one coherent product when connectivity, performance conditions or platform context changes.**

The word **Connection** has two meanings in this phase:

1. network connection state,
2. the connection between Orion subsystems that already work independently.

Phase 10A therefore covers:

- proper offline product handling,
- reconnect behavior,
- local-versus-network capability truth,
- Mobile Offline Home behavior,
- connection-aware navigation and product language,
- Desktop offline product hardening,
- Music Planet local-first offline behavior,
- Desktop Download Modal visual redesign with backend behavior frozen,
- cross-platform performance optimization,
- Desktop streaming/fullscreen performance analysis,
- Music Planet rendering optimization,
- Mobile performance hardening,
- theme/accessibility correctness,
- physical low-end and offline validation.

---

# 3. Inspection findings that define the phase

The September 1, 2026 current-local inspection established the following.

## 3.1 Mobile connectivity exists but is not yet a complete product state

Mobile already has a global `NetworkContext` backed by NetInfo.

It exposes transport/reachability information and a latency probe.

Mobile also has an `OfflineBanner` and Sidebar network presentation.

However, core product surfaces do not consistently consume one connection-state contract.

The result is that Orion can technically know it is offline while Home, Discover, Detail or remote actions still behave as ordinary network requests.

Phase 10A must turn connectivity knowledge into application behavior.

## 3.2 Mobile Downloads is already the strongest offline product surface

The completed Phase 10 Offline Library and Downloads stack already provides:

- local completed media records,
- local media playback,
- local metadata required for Offline Library presentation,
- download management,
- Resume/History/Continue Watching integration,
- Offline Player operation without internet.

Phase 10A must use that strength.

It must not create a second offline-media repository.

## 3.3 Desktop connectivity is more mature than Mobile

Desktop already owns:

- `checking`,
- `online`,
- `degraded`,
- `offline`,
- bounded network probing,
- latency classification,
- reconnect events,
- visibility-triggered rechecks.

This implementation is an architectural reference, not a mandate to share Desktop code with Mobile.

Desktop itself still needs stronger product behavior around those states.

## 3.4 Desktop Download Modal is separable from downloader execution

The Desktop Download Modal communicates with the existing downloader through defined Electron/preload bridge calls.

The working downloader backend does not need to be redesigned for Phase 10A visual work.

## 3.5 Existing performance systems must be extended, not replaced

Desktop already has a performance coordinator and tier policy.

Current Desktop automatic pressure inputs include:

- battery state,
- free memory,
- CPU usage,
- event-loop lag,
- playback buffering,
- CPU speed limiting.

Current Desktop tiers are:

- `Efficiency`,
- `Balanced`,
- `Quality`.

Mobile also already owns a Performance Context/profile system.

Phase 10A must not introduce parallel performance-mode architecture.

## 3.6 Music Planet contains specific optimization opportunities

The inspection identified real candidates including:

- continuously rendered React Three Fiber scenes,
- high-detail orb geometry,
- render work not fully tied to Orion performance tier,
- audio-analyser rates that adapt while visual rendering can remain expensive,
- particle-setting language that does not cleanly match engine behavior,
- Battery Saver Visuals copy promising a frame cap that is not fully represented by the visual render loop,
- Reduced Motion reducing reactivity without necessarily eliminating continuous scene work.

These are evidence-backed Phase 10A targets.

## 3.7 Desktop streaming performance requires measurement before mutation

Desktop streaming already contains:

- WebView lifecycle logic,
- ambient frame sampling,
- buffering and dropped-frame reporting,
- fullscreen behavior,
- performance coordinator feedback.

Phase 10A must profile the real bottleneck before changing player architecture.

No player-engine migration is authorized by this plan.

---

# 4. Internal Phase 10A execution contracts

These are Phase 10A internal acceptance IDs.

They are **not** Master Audit `V3-*` checklist IDs and do not change Master Audit weighting.

- `P10A-C01` One truthful connection-state product contract per platform.
- `P10A-C02` Transport-offline and service-degraded states are not falsely conflated.
- `P10A-C03` Mobile cold-start offline experience is deliberate and useful.
- `P10A-C04` Mobile mid-session connection loss never destroys valid local capability.
- `P10A-C05` Mobile navigation and network-required actions become connection-aware.
- `P10A-C06` Mobile reconnect restores remote capability without requiring an app restart.
- `P10A-C07` Desktop offline Home/Discover behavior becomes production-grade.
- `P10A-C08` Desktop local Downloads/Library capability remains usable offline.
- `P10A-C09` Music Planet becomes explicitly local-first where local capability exists.
- `P10A-C10` Desktop Download Modal visual redesign preserves its downloader contract.
- `P10A-C11` Desktop streaming performance is measured and hardened without player-engine replacement.
- `P10A-C12` Music Planet rendering adapts meaningfully to Orion performance policy.
- `P10A-C13` Mobile performance improvements extend the existing performance owner.
- `P10A-C14` Every new offline/performance visual is theme-aware and accessibility-aware.
- `P10A-C15` Automated and physical offline/reconnect/performance matrices pass.
- `P10A-C16` Phase 10A receives its own completion evidence and lock before later Master Audit reconciliation.

---

# 5. Connection-state product contract

## 5.1 Canonical product states

The product-level connection vocabulary is:

- `CHECKING`
- `ONLINE`
- `DEGRADED`
- `OFFLINE`
- `RECONNECTING`

`RESTORED` is a transient event/acknowledgement, not a permanent resting state.

Exact internal implementation may remain platform-specific.

## 5.2 State meaning

### CHECKING

Orion has not yet established trustworthy current connection state.

The UI may retain locally usable content while remote actions remain pending or conservatively unavailable.

### ONLINE

Transport and internet reachability are available and Orion's normal remote services are usable.

### DEGRADED

General connectivity exists, but a required Orion remote path is unhealthy, slow, unavailable or partially failing.

A single provider failure must not automatically mean "device offline."

### OFFLINE

Internet-required capability is unavailable.

Local capability remains usable.

### RECONNECTING

A previously offline Orion instance has regained transport/reachability and is reconciling remote capability.

## 5.3 Hard truth rule

Orion must distinguish:

- no device/network connection,
- internet unreachable,
- internet reachable but a catalog/provider/service failed,
- one provider failed while others remain usable,
- local content available despite remote failure.

No single provider error may globally declare Orion offline unless it is actually the authoritative connectivity probe.

## 5.4 Transition stability

The connection owner must avoid UX flicker from short network blips.

Requirements:

- deduplicate identical state emissions,
- use bounded probe/recheck behavior,
- fence stale async probe results,
- avoid repeated banners for the same uninterrupted outage,
- avoid route thrashing,
- avoid permanent "reconnecting" states,
- emit one restored acknowledgement per real outage/recovery cycle.

---

# 6. Product language and theme authority

Offline behavior is a product state, not a debug status.

User-facing copy must be short and useful.

Preferred vocabulary includes:

- `You're offline`
- `Your downloads are ready to watch`
- `Available offline`
- `Connection restored`
- `Trying to reconnect`
- `This action needs a connection`
- `Service unavailable`
- `Try again`

Avoid:

- raw native/network errors,
- provider implementation jargon,
- stack/HTTP terminology,
- "verified artifact" language,
- static developer-facing status codes.

All presentation must use Orion semantic theme tokens.

Requirements:

- all six Orion themes,
- no hard-coded red/green/black styling that bypasses the theme system,
- Reduced Motion support,
- large-text/readability safety,
- accessible status announcements where appropriate,
- no animation that is required to understand state.

---

# 7. Mobile Offline Experience

## 7.1 Cold start while offline

Cold-starting Mobile Orion with no internet must not look like a failed online Home.

Home becomes an intentional offline product surface.

At minimum it must provide:

- clear offline acknowledgement,
- a primary path into Downloads / Offline Library,
- downloaded titles that can be rendered from local Phase 10 records,
- locally available Continue Watching/Resume state where safely derivable,
- no remote-only loading skeleton that waits forever,
- no false empty-catalog message.

Recommended product language:

`You're offline`

`Your downloads are ready to watch.`

The exact visual design remains implementation work.

## 7.2 Cold start with no downloaded content

If Orion is offline and no offline media exists:

- acknowledge offline truth,
- explain that downloads will appear here when available,
- keep Settings/local-safe areas usable,
- offer connection retry,
- do not fabricate content.

## 7.3 Mid-session connection loss

When connectivity is lost while Orion is already open:

- do not forcibly redirect the user away from their current route,
- show one bounded offline acknowledgement,
- preserve valid local state,
- preserve downloaded playback,
- preserve local navigation,
- disable or explain only actions that truly require network access.

A transient outage must not yank the user to Downloads.

## 7.4 Downloads navigation treatment

Downloads remains a first-class navigation destination.

While offline it may become more prominent through:

- an offline/local-availability indicator,
- secondary text,
- badge/state decoration,
- contextual Offline Home action.

The main navigation label should remain recognizable as Downloads unless later UX testing proves a better stable label.

## 7.5 Discover and Search

When offline:

- do not present a network failure as "No results found",
- distinguish unavailable remote discovery from a genuine empty result,
- preserve any local/offline search capability that already exists,
- provide a concise path to Downloads or retry.

## 7.6 Media Detail

When offline:

- preserve local/downloaded actions,
- disable or explain network-only actions,
- do not let a provider failure make an already-downloaded title appear broken,
- never require discovery/provider connectivity to launch a valid local asset.

## 7.7 Home request resilience

Current Home network fan-out must not remain all-or-nothing where one failed catalog row can collapse unrelated successful rows.

Phase 10A must:

- partition independent remote sections,
- preserve successful data when another remote request fails,
- avoid unnecessary request duplication,
- cancel stale route/session work,
- avoid retry storms after reconnect.

The exact use of settled promises, per-row owners, cache, scheduling or request coordination is decided from current source during implementation.

## 7.8 Reconnect behavior

After connectivity returns:

- Orion enters bounded `RECONNECTING`,
- remote capability is re-probed/reconciled,
- stale offline banners leave,
- remote surfaces refresh only as needed,
- current local playback is not interrupted,
- a short `Connection restored` acknowledgement may appear,
- no full app restart is required.

## 7.9 Offline artwork and metadata

The Phase 10 Offline Library remains authoritative for offline media identity.

Use already persisted local metadata/artwork where available.

If Phase 10A introduces additional cache behavior, it must be:

- bounded,
- non-secret,
- versioned where needed,
- safe to clear,
- non-authoritative for media bytes,
- incapable of creating a competing Offline Library.

---

# 8. Desktop Offline Experience

## 8.1 Preserve existing network owner

Desktop's current network-status service/hook is the starting owner.

Do not replace it merely to match Mobile implementation style.

Phase 10A may:

- improve product events,
- normalize state semantics,
- strengthen consumers,
- add tests,
- improve service-vs-transport distinction.

## 8.2 Desktop Home

Current offline Home behavior must become actionable.

Offline Home should provide useful local pathways such as:

- Open Downloads,
- Open Library,
- local Continue Watching where available,
- Retry / Check connection.

A Retry button that cannot perform meaningful work while offline is not sufficient production UX.

## 8.3 Desktop Discover/Search

Remote discovery/search should acknowledge offline or degraded truth rather than presenting false empty states.

Local areas remain available.

## 8.4 Desktop Downloads and Library

Existing working functionality stays frozen unless a real defect is found.

Offline behavior must preserve:

- completed downloads,
- local playback,
- download history/metadata that is local,
- local Library access.

Network-required download acquisition may be disabled/explained without changing downloader architecture.

## 8.5 Desktop reconnect

On restored connectivity:

- re-probe once,
- restore remote actions,
- refresh stale remote views only when appropriate,
- do not interrupt local media,
- avoid duplicate restored notifications.

---

# 9. Music Planet offline product behavior

Music Planet is not simply an online feature.

Its local capability must remain first-class.

When Desktop Orion is offline:

### Must remain available where already local

- local music library,
- local folders,
- local playlists,
- local playback,
- locally stored artwork,
- locally stored/embedded lyrics,
- favorites/history that do not require a remote provider.

### Network-dependent capability may become unavailable/degraded

- online provider search,
- remote catalog browsing,
- radio/remote streams,
- remote lyrics/artwork lookup when not cached,
- provider authentication or remote plugin actions.

Requirements:

- local Music Planet must not be hidden behind a global "offline" dead end,
- unavailable remote actions must explain themselves concisely,
- provider-specific failure must not disable local playback,
- reconnect must restore remote capability without reloading the entire application.

---

# 10. Desktop Download Modal redesign

## 10.1 Goal

Bring Desktop Download Modal visual quality closer to the newer Mobile Download experience while keeping Desktop-specific power and density.

## 10.2 Backend freeze

The following are out of scope unless a reproducible defect is found:

- downloader transfer engine,
- candidate acquisition logic,
- request-context ownership,
- finalization logic,
- existing successful destination behavior,
- downloader helper semantics.

## 10.3 Contract-first redesign

Before JSX/CSS restructuring, freeze automated coverage around the current bridge contract, including where present:

- candidate listing,
- preflight,
- folder/destination selection,
- subtitle search/selection,
- quality/source/audio selections,
- `runDownload()` payload,
- cancel/start behavior.

The redesign must not silently change the payload or omit an existing functional option.

## 10.4 Visual direction

Use Mobile's newer hierarchy as a product-language reference, not a pixel copy.

Recommended information hierarchy:

1. media identity,
2. destination,
3. source / quality / method,
4. audio/subtitle readiness,
5. preferences,
6. concise validation/error state,
7. Cancel / Start Download.

Requirements:

- theme-aware,
- keyboard accessible,
- responsive to Desktop window sizing,
- no excessive card nesting,
- no developer-facing wording,
- primary action obvious,
- advanced options remain available without dominating the default path.

---

# 11. Cross-platform performance hardening

Performance work is evidence-driven.

The rule is:

**measure first, mutate narrowly, verify the affected link, then freeze.**

No broad "optimization cleanup" is authorized.

## 11.1 Existing performance ownership

Desktop's existing performance coordinator/policy remains authoritative.

Mobile's existing Performance Context/profile remains authoritative.

Do not add another competing profile system.

## 11.2 Desktop current tier thresholds

Current Desktop policy already classifies pressure using signals including:

- battery <= 20% while on battery,
- free memory below approximately 1400 MB,
- Orion CPU approximately >= 78%,
- event-loop lag approximately >= 120 ms,
- repeated buffering events,
- CPU speed limit below approximately 70%.

Quality currently requires a substantially healthier AC-powered state.

These existing thresholds are the baseline.

Do not retune them without measurement proving the threshold itself is wrong.

## 11.3 Desktop streaming/player performance

Benchmark at least:

- normal windowed playback,
- fullscreen playback,
- provider-controlled fullscreen paths,
- Orion-intercepted fullscreen paths,
- playback while downloads are active,
- playback under Efficiency mode.

Inspect:

- buffering events,
- dropped frames,
- event-loop lag,
- CPU use,
- memory pressure,
- capture/ambient work,
- background animation ownership,
- WebView lifecycle,
- provider fullscreen behavior,
- unnecessary React re-renders.

Hard boundaries:

- no player-engine migration,
- no provider rewrite merely for Phase 10A,
- no disabling working playback features without evidence,
- no permanent quality degradation disguised as optimization.

## 11.4 Ambient rendering

Ambient sampling/glow is already bounded in important paths.

Do not assume it is the sole cause of fullscreen lag.

Verify whether every fullscreen/provider path correctly disables or reduces competing rendering work.

Any ambient optimization must preserve:

- theme identity,
- playback ownership,
- safe fallback,
- existing performance tier behavior.

## 11.5 Music Planet performance

Music Planet receives explicit Phase 10A optimization.

Required work includes measuring and then addressing:

- React Three Fiber render cadence,
- Canvas device-pixel ratio,
- geometry complexity,
- continuous `useFrame()` work,
- particle counts,
- visualizer update cadence,
- inactive/background rendering,
- Reduced Motion behavior,
- Battery Saver Visuals behavior,
- performance-tier integration.

### Battery Saver contract

If Settings says Battery Saver Visuals caps visual frame rate, the actual visual renderer must obey that contract.

Pausing only the audio analyser is not sufficient.

### Reduced Motion contract

Reduced Motion must reduce meaningful visual animation workload, not merely disable one audio-reactive input while expensive continuous animation keeps running.

### Particle-setting contract

Settings labels and actual engine behavior must describe the same user-visible concept.

Large hidden multipliers that make "Low" materially unlike the presented setting must be reconciled.

### Tier adaptation

Efficiency / Balanced / Quality should be able to influence expensive Music Planet visual work without changing playback correctness.

Possible controlled knobs include:

- render frame cadence,
- DPR,
- geometry resolution,
- particle budget,
- shader/reactivity intensity,
- inactive-scene suspension.

Exact values are set by benchmark evidence, not by this planning document.

## 11.6 Mobile performance

Mobile already has a performance profile system.

Phase 10A should focus on:

- network request fan-out,
- avoidable duplicate remote requests,
- heavy non-list animations,
- route transition cost,
- connection-state rerender scope,
- offline surfaces,
- reconnection refresh behavior.

Do not rewrite already-good list virtualization/profile budgets simply because performance is in scope.

---

# 12. Diagnostics and measurement discipline

Phase 10A performance and connection changes need measurable evidence.

Use existing local diagnostics where possible.

New diagnostics must be:

- bounded,
- privacy-safe,
- disabled or lightweight outside diagnostics where appropriate,
- free of secrets,
- free of provider credentials,
- useful for before/after comparison.

Performance evidence should capture comparable sessions rather than isolated screenshots.

Recommended comparison windows:

- idle surface,
- active scrolling,
- 60-90 seconds of video playback,
- 60-90 seconds of fullscreen playback,
- 60-90 seconds of Music Planet idle animation,
- 60-90 seconds of Music Planet during active playback/visualization.

Do not claim performance improvement from subjective smoothness alone when instrumentation is available.

---

# 13. Automated validation requirements

Exact command lists are resolved from current local package scripts at execution time.

Phase 10A requires focused and broad gates appropriate to each platform.

## 13.1 Connection-state tests

Cover:

- state normalization,
- offline detection,
- service degradation,
- reconnect,
- stale probe fencing,
- duplicate-event suppression,
- restored-event one-shot behavior,
- transient-blip stability,
- local-capability preservation.

## 13.2 Mobile product tests

Cover:

- offline cold-start Home,
- no-download offline state,
- downloaded-content offline state,
- Downloads navigation emphasis,
- Discover/Search offline truth,
- Media Detail local action preservation,
- network-required action messaging,
- reconnect refresh,
- six-theme contract,
- Reduced Motion/accessibility behavior.

## 13.3 Desktop product tests

Cover:

- Home offline actions,
- Discover/Search offline truth,
- Downloads/Library local behavior,
- reconnect behavior,
- network status tests,
- Music local-first offline behavior.

## 13.4 Download Modal tests

Cover the existing downloader bridge/payload before and after redesign.

## 13.5 Performance tests

Where deterministic automation is possible, cover:

- tier propagation,
- battery saver render policy,
- Reduced Motion render policy,
- Music visual budgets,
- fullscreen state propagation,
- no accidental background render loop while a surface is inactive.

Physical performance evidence remains required for real frame pacing.

---

# 14. Physical acceptance matrix

Automated tests do not replace physical validation.

## F10A-M1 - Mobile cold start offline with downloads

PASS requires:

- offline acknowledgement,
- downloaded/local content remains browsable,
- Offline Library opens,
- valid downloaded media plays,
- no false remote loading state.

## F10A-M2 - Mobile cold start offline without downloads

PASS requires:

- truthful offline empty/local state,
- connection retry available,
- no false "no catalog results" message,
- no broken layout.

## F10A-M3 - Mobile live connection loss

Validate from representative:

- Home,
- Discover,
- Media Detail,
- Downloads,
- local Offline Player.

PASS requires local capability remains stable and Orion does not forcibly redirect the user.

## F10A-M4 - Mobile reconnect

PASS requires:

- bounded reconnect state,
- restored acknowledgement,
- remote capability returns,
- no app restart,
- no interruption to local playback.

## F10A-M5 - Mobile themes/accessibility

Validate offline/reconnect states across all six Orion themes plus Reduced Motion.

## F10A-D1 - Desktop cold start offline

PASS requires Home presents useful local pathways rather than a dead-end network error.

## F10A-D2 - Desktop local media offline

PASS requires Downloads/Library/local playback remain usable.

## F10A-D3 - Music Planet offline

PASS requires local music remains usable while remote provider actions degrade honestly.

## F10A-D4 - Desktop reconnect

PASS requires remote capability returns without restarting Orion or disturbing local playback.

## F10A-D5 - Desktop Download Modal

Validate visual redesign against real working download preparation/start behavior.

The downloader payload and working backend outcome must remain correct.

## F10A-P1 - Desktop streaming baseline

Collect comparable windowed and fullscreen measurements before and after optimization.

## F10A-P2 - Desktop low-resource / Efficiency behavior

Validate that expensive presentation reduces appropriately without breaking playback.

## F10A-P3 - Music Planet baseline

Measure idle and playing/visualizer states.

## F10A-P4 - Music Planet low-resource / Reduced Motion / Battery Saver

Validate that the visual renderer actually reduces workload according to the selected policy.

---

# 15. Phase 10A execution sequence

Phase 10A follows grouped stages.

Do not explode the phase into arbitrary micro-commits or rerun unrelated green gates.

## P10A.0 - Canonical setup, baseline and contract freeze

Goals:

- preserve this plan,
- establish a dedicated Phase 10A execution boundary/branch if workflow calls for it,
- capture current connection behavior,
- capture Mobile and Desktop offline screenshots/behavior,
- capture Desktop streaming baseline,
- capture Music Planet performance baseline,
- enumerate exact source owners,
- freeze Desktop Download Modal functional contract,
- create focused tests before visual restructuring where needed.

No broad product mutation belongs here.

Acceptance:

- plan frozen,
- source ownership list exact,
- baseline evidence recorded,
- affected test commands known,
- no Phase 10 locked architecture changed.

## P10A.1 - Connection-state foundation

Primary contracts:

`P10A-C01`, `P10A-C02`, foundations for `P10A-C05`, `P10A-C06`, `P10A-C07`.

Implement:

- product-state normalization,
- stable transition/reconnect behavior,
- service-degraded vs transport-offline distinction,
- product event/copy contract,
- theme-aware state presentation primitives,
- stale-probe fencing and duplicate-event suppression.

Platform owners may remain separate.

Acceptance:

- focused connection-state tests,
- no false provider-to-global-offline mapping,
- no product route changes yet beyond minimal integration needed to prove the owner.

## P10A.2 - Mobile Offline Experience

Primary contracts:

`P10A-C03`, `P10A-C04`, `P10A-C05`, `P10A-C06`, `P10A-C14`.

Implement:

- Offline Home,
- cold-start behavior,
- Downloads prominence,
- route-aware offline UX,
- Discover/Search truth,
- Media Detail local/network action separation,
- Home request resilience,
- reconnect recovery,
- all-theme/accessibility polish.

Acceptance:

- focused Mobile tests,
- Mobile broad gates affected by changed code,
- F10A-M1 through F10A-M5 physical validation.

## P10A.3 - Desktop Offline Experience + Music local-first behavior

Primary contracts:

`P10A-C07`, `P10A-C08`, `P10A-C09`, `P10A-C14`.

Implement:

- actionable Desktop Offline Home,
- Discover/Search offline truth,
- local Downloads/Library preservation,
- reconnect behavior,
- Music Planet local/remote capability separation,
- concise theme-aware product messaging.

Acceptance:

- focused Desktop unit/electron tests,
- F10A-D1 through F10A-D4 physical validation.

## P10A.4 - Desktop Download Modal redesign

Primary contract:

`P10A-C10`.

Implement:

- preserve contract tests first,
- restructure modal hierarchy,
- align with modern Orion/Mobile product language,
- maintain Desktop-specific controls,
- theme/accessibility polish,
- no backend downloader rewrite.

Acceptance:

- bridge/payload parity tests,
- Desktop UI tests,
- real physical start/preflight proof,
- F10A-D5 PASS.

## P10A.5 - Performance hardening

Primary contracts:

`P10A-C11`, `P10A-C12`, `P10A-C13`, `P10A-C14`.

Implement only evidence-backed optimizations.

Workstreams:

1. Desktop streaming/windowed/fullscreen.
2. Music Planet rendering and visual budgets.
3. Mobile connection/request/render overhead.
4. Cross-surface background/inactive work.
5. low-resource tier behavior.

Acceptance:

- before/after comparable measurements,
- relevant automated gates,
- no playback correctness regression,
- F10A-P1 through F10A-P4 physical validation.

## P10A.6 - Final regression, production proof and lock

Primary contracts:

`P10A-C15`, `P10A-C16`.

Goals:

- run only required broad final gates,
- complete cross-platform physical matrix,
- resolve only evidence-backed blockers,
- assign/freeze any release identity required by the final implementation,
- create production artifacts only if required by Orion's existing release workflow,
- preserve immutable prior releases,
- create Phase 10A completion audit,
- create Phase 10A lock boundary,
- push/verify according to normal Git discipline.

Master Audit reconciliation does not automatically occur inside P10A.6.

It occurs later when explicitly scheduled using frozen Phase 10 and Phase 10A completion evidence.

---

# 16. Git and mutation discipline

Phase 10A follows:

`INSPECT -> CLASSIFY -> MUTATE NARROWLY -> VERIFY -> FREEZE -> NEXT`

Failure path:

`STOP -> CLASSIFY -> SURGICAL REPAIR -> REPEAT ONLY FAILED LINK`

Rules:

- current local workspace first,
- never `git add .`,
- exact staging only,
- no broad cleanup,
- no force push,
- no protected-file mutation,
- no release retagging,
- no rewriting accepted Phase 10 history,
- no rerunning giant green gates because an unrelated Markdown/CSS-only link failed,
- Source Review/Build-Proof evidence is append-only where used.

---

# 17. Protected unrelated local work

The Phase 10A starting workspace contains two user-owned modified files that are outside this phase boundary:

1. `apps/mobile/src/features/playback/ResumePlaybackPrompt.tsx`
   - SHA256: `35C79AD3B301BE4D0F0B29AB01AC9544DD35B681DEB0AF89B9AC0815A100348E`

2. `apps/mobile/tests/prePhase3UiPolish.test.cjs`
   - SHA256: `9B2B5048A85A1811EB72F42128B8D80ED1D268B3FB469FE8226013FAEB662652`

Unless the user explicitly changes their ownership status, Phase 10A must not:

- edit,
- stage,
- revert,
- reformat,
- normalize line endings,
- clean,
- include them in unrelated commits.

---

# 18. Explicit non-goals

Phase 10A does not include:

- Phase 11 Orion Connect feature expansion,
- Smart Connect protocol redesign,
- cloud relay work,
- new social/Orbit work,
- a new Mobile downloader backend,
- Desktop downloader backend rewrite,
- Media3/ExoPlayer migration for the locked Mobile Offline Player,
- replacing Desktop's player engine,
- replacing Mobile's performance profile system,
- replacing Desktop's performance coordinator,
- Master Audit percentage changes before completion evidence exists,
- rebuilding or replacing published `v2.2.11`,
- moving the published `v2.2.11` tag.

If inspection uncovers an unrelated defect, classify it as:

- Phase 10A blocker,
- later Phase 11 item,
- later Phase 12 release item,
- separate maintenance,
- no action.

Do not allow scope drift silently.

---

# 19. Release/versioning boundary

This planning document assigns no new Mobile or Desktop release number.

A Phase 10A version is assigned only when implementation maturity and release need justify it.

If a Mobile production candidate is built:

- use the existing permanent signing identity,
- follow Orion's existing production-build/update validation authority,
- never mutate `v2.2.11`,
- prove upgrade behavior only when a new candidate actually exists.

If a Desktop production artifact is built:

- follow the current Desktop packaging/signing/update workflow,
- do not treat a development build as production evidence.

---

# 20. Definition of done

Phase 10A is COMPLETE only when all of the following are true:

1. Orion Mobile has deliberate offline, degraded and reconnect product behavior.
2. Mobile cold start offline is useful rather than a failed online Home.
3. Mobile downloaded/local playback remains independent of internet availability.
4. Mobile navigation/actions tell the truth about network requirements.
5. Desktop offline Home/Discover behavior is production-grade.
6. Desktop Downloads/Library/local playback remain useful offline.
7. Music Planet clearly separates local capability from remote-provider capability.
8. Desktop Download Modal has the new visual hierarchy without downloader contract regression.
9. Desktop streaming performance work is backed by before/after evidence.
10. Music Planet visual workload responds meaningfully to performance, Battery Saver and Reduced Motion policy.
11. Mobile performance work extends rather than duplicates existing performance ownership.
12. New UX is correct across all Orion themes and accessibility modes.
13. Required automated gates are green.
14. Required physical offline/reconnect/performance matrix is green or explicitly deferred only with user-approved non-blocking evidence.
15. Phase 10 remains locked and published `v2.2.11` remains immutable.
16. Phase 10A receives its own completion audit and lock.
17. Master Audit reconciliation remains a later explicit step.

---

# 21. Immediate execution boundary

After this plan is preserved and reviewed, the next allowed implementation step is:

**P10A.0 - Canonical setup, baseline and contract freeze.**

Do not begin P10A.1 or later implementation until P10A.0 has established:

- exact live owners,
- current baseline behavior,
- focused gate commands,
- Desktop Download Modal contract protection,
- performance benchmark procedure,
- physical offline baseline.

---

# FINAL PHASE 10A STATEMENT

**Phase 10 is COMPLETE & LOCKED.**

**Phase 10A Connection is a new post-Phase-10 product-hardening tranche.**

Its purpose is to connect Orion's proven systems into one production-grade cross-platform experience across:

**Online -> Degraded -> Offline -> Reconnecting -> Online**

while preserving local capability, modernizing Desktop download presentation and making Orion scale more intelligently across high-end and low-end hardware.

Phase 10A does not replace what Phase 10 proved.

It makes the rest of Orion behave like it knows that capability exists.
