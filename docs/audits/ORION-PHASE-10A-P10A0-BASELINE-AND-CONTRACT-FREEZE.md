# ORION PHASE 10A - P10A.0 BASELINE AND CONTRACT FREEZE

**Status:** COMPLETE / FROZEN
**Date:** September 2, 2026
**Phase:** Phase 10A Connection
**Stage:** P10A.0 - Canonical setup, baseline and contract freeze
**Parent implementation checkpoint:** `ebb0f1809af980f8d8d1cff0fa7f75725a7ab8bb`

---

# 1. Purpose

P10A.0 establishes the pre-implementation truth for Phase 10A.

It does not implement the new offline product state or performance adaptation.

It freezes:

- current live source ownership,
- current offline/reconnect behavior,
- current Desktop Download Modal functional contract,
- the existing Desktop and Mobile performance ownership,
- the Phase 10A performance-capability strategy,
- the boundaries that later P10A stages must preserve.

---

# 2. Source inspection authority

The current-local Phase 10A source inspection was produced from the post-Phase-10 completion-audit workspace.

Inspection package:

`orion-phase10a-local-source-inspection-v3-20260901-132926.zip`

ZIP SHA256:

`46AA59744DD578005855241A0FA7E8C72C989A0A4AD7378735E26ADFDA9F4091`

The package contained:

- 946 packaged files,
- 945 manifest-controlled members,
- 0 manifest mismatches.

The later P10A.0-A live-owner baseline was captured from the frozen Phase 10A plan checkpoint.

Baseline package:

`orion-p10a0-baseline-20260901-173648.zip`

ZIP bytes:

`189255`

ZIP SHA256:

`4A8D29F34D16B65424388C7F41842FE6FB1F936FBFDFDA75D7A27362E66F665B`

---

# 3. Frozen Mobile ownership

The inspected Mobile ownership includes:

- `apps/mobile/src/context/NetworkContext.tsx`
- `apps/mobile/src/components/OfflineBanner.tsx`
- `apps/mobile/app/_layout.tsx`
- `apps/mobile/app/(tabs)/index.tsx`
- `apps/mobile/app/(tabs)/downloads.tsx`
- `apps/mobile/src/features/discover/DiscoverScreen.tsx`
- `apps/mobile/src/context/PerformanceContext.tsx`

The current Mobile connection owner already observes:

- native connection state,
- internet reachability,
- connection type,
- latency,
- periodic probing.

However, Home, Discover, Downloads and Media Detail do not currently share a complete product-state/reconnect contract.

---

# 4. Frozen Desktop ownership

The inspected Desktop ownership includes:

- `apps/desktop/src/renderer/services/networkStatus.js`
- `apps/desktop/src/renderer/shared/hooks/useNetworkStatus.js`
- Desktop application shell/routes,
- Desktop Home,
- Desktop Discover,
- Desktop Downloads/Library,
- Music Planet,
- Desktop Download Modal,
- Desktop main-process performance coordinator and policy.

Desktop already distinguishes:

- `checking`,
- `online`,
- `degraded`,
- `offline`.

Desktop also already performs bounded network probing and recovery observation.

Phase 10A extends this product behavior rather than replacing the network owner.

---

# 5. Physical offline baseline

Physical validation was performed using cold offline launches on Mobile and Desktop.

## 5.1 Mobile

### B1 - Cold start offline

Observed:

- Orion detects offline state.
- Offline indicator is visible.
- locally derived / cached Continue Watching information can remain visible.
- normal Home does not become a deliberate Offline Home.
- remote Home content does not form a coherent offline product surface.

Classification:

**PRODUCT GAP**

### B2 - Discover/search offline

Observed:

- a remote search can present `No results found` while the real cause is lack of connectivity.

Classification:

**FAIL**

Reason:

A network-unavailable result must not be represented as a genuine empty search result.

### B3 - Downloads / Offline Library

Observed:

- downloaded content remains visible,
- finalized Offline Library media remains playable,
- native Offline Player remains functional without internet.

Classification:

**PASS**

This is Phase 10 capability and remains frozen.

### B4/B5 - Reconnect

Observed:

- Mobile detects restored connectivity,
- Offline indicator disappears,
- online/restored notification is emitted,
- Home and other remote product surfaces do not reliably rehydrate,
- a cold online relaunch may be required to restore normal application state.

Classification:

**FAIL**

This establishes reconnect/requery coordination as a confirmed P10A defect.

---

# 6. Desktop physical offline baseline

## 6.1 Cold-start authentication/bootstrap

Observed:

- Desktop cold offline launch may request Google sign-in even on a previously used Orion installation.

Classification:

**PRODUCT GAP**

Phase 10A must support safe offline bootstrap using trusted local identity/session state where architecture permits.

This must not weaken account isolation or authentication security.

## 6.2 Home

Observed:

- Desktop presents an offline Home state,
- global TMDB/network presentation can duplicate local page messaging,
- local pathways are not prominent enough,
- Retry behavior is not sufficient as the main offline action.

Classification:

**PARTIAL / NEEDS PRODUCT HARDENING**

## 6.3 Search

Observed:

Desktop Search already gives substantially more truthful offline messaging than Mobile Search.

Classification:

**GOOD REFERENCE BEHAVIOR**

## 6.4 Discover

Observed:

- Discover acknowledges offline state,
- remote cards/states may still present unavailable information as if it were current,
- empty-filter/provider presentation can be misleading while remote data is inaccessible.

Classification:

**PARTIAL FAIL**

## 6.5 Library

Observed:

- locally owned Library state remains useful offline,
- Continue Watching / My List / History can remain accessible,
- some artwork can disappear because presentation still depends on remote image retrieval.

Classification:

**FUNCTIONALLY GOOD / PRESENTATION GAP**

Phase 10A may add bounded disposable artwork/metadata caching for locally meaningful records.

It must not create another Offline Library or media-byte authority.

## 6.6 Smart Connect

Observed:

Smart Connect can remain locally available while general internet connectivity is unavailable.

Classification:

**PRESERVE**

Internet-offline must not be treated as LAN-offline.

Phase 10A must not disable local-network capability merely because remote internet services are unavailable.

Phase 11 Smart Connect expansion remains deferred.

## 6.7 Music Planet

Observed:

- local Music capability can coexist with global offline state,
- Cinema/TMDB offline messaging can leak into Music Planet,
- remote provider failures can expose raw backend/network diagnostics,
- local and remote Music capability are not yet presented as separate product states.

Classification:

**FAIL / P10A TARGET**

Music Planet must become explicitly local-first when internet services are unavailable.

---

# 7. Reconnect contract established by physical evidence

The required application transition is:

`OFFLINE -> RECONNECTING -> ONLINE`

On restoration Orion must:

1. detect restored transport/reachability,
2. validate appropriate remote capability,
3. invalidate/requery affected remote data owners,
4. preserve current local playback and local state,
5. suppress duplicate recovery events,
6. return the application to normal online behavior without a restart.

A connectivity notification alone is not sufficient recovery.

---

# 8. Desktop Download Modal contract freeze

P10A.0-C added and froze:

`apps/desktop/tests/unit/renderer/DownloadModalContract.test.jsx`

Frozen test SHA256:

`F50A13766E86A0CC3C2E2F11ADD47636BC20753215A3CCC3F3E0C474C929F5DB`

Frozen test bytes:

`5823`

Freeze commit:

`ebb0f1809af980f8d8d1cff0fa7f75725a7ab8bb`

The contract protects:

- candidate discovery,
- selected candidate preflight,
- destination ownership,
- downloader payload key set,
- downloader payload values,
- quality/concurrency values,
- subtitle payload preservation,
- successful start callback,
- close-after-start behavior.

The Desktop downloader backend remains outside the later visual redesign unless a reproducible defect requires backend work.

---

# 9. Performance architecture baseline

## 9.1 Existing Desktop owner

Desktop already owns a main-process performance coordinator and performance policy.

The existing runtime system measures signals including:

- Orion CPU pressure,
- logical CPU count,
- free system memory,
- event-loop lag,
- playback buffering,
- dropped frames,
- battery status,
- CPU speed-limit events.

Existing user-facing/runtime tiers are:

- `Efficiency`,
- `Balanced`,
- `Quality`.

This system remains authoritative.

Phase 10A must extend it rather than create a second Desktop performance subsystem.

## 9.2 Current limitation

The current automatic Desktop decision primarily reacts to runtime/resource pressure and broad CPU/RAM capability.

It does not yet provide a sufficiently rich startup classification for the enormous range of Desktop graphics hardware.

A high-end development laptop cannot be treated as representative evidence for machines using:

- Intel UHD-class integrated graphics,
- Iris Xe-class integrated graphics,
- Ryzen integrated graphics,
- low-memory systems,
- battery-throttled systems,
- systems without a dedicated GPU.

---

# 10. Frozen Phase 10A Desktop performance strategy

Phase 10A performance work adopts two layers:

## Layer A - base capability profile

At startup, Orion derives a conservative recommended baseline from available system capability.

Relevant signals may include:

- CPU capability,
- logical CPU count,
- total system memory,
- graphics capability exposed safely by Electron/Chromium,
- integrated versus dedicated graphics where reliably determinable,
- display/rendering characteristics where useful,
- power/battery context.

The result resolves to the existing Orion vocabulary:

- `Efficiency`
- `Balanced`
- `Quality`

## Layer B - live pressure override

The existing runtime performance coordinator continues monitoring:

- CPU pressure,
- free memory,
- event-loop lag,
- buffering,
- dropped-frame pressure where applicable,
- battery state,
- CPU throttling.

It may temporarily reduce the resolved tier when the current machine is under pressure.

Recovery to a richer tier must remain stability-gated.

---

# 11. User performance controls

Desktop should mirror the proven Mobile philosophy:

- `Automatic`
- `Efficiency`
- `Balanced`
- `Quality`

`Automatic` is the recommended/default mode.

When Automatic is selected, Settings should be capable of showing the currently resolved tier.

Example:

`Automatic - Currently using Balanced`

Manual profile selection remains explicit user intent.

Safety/resource protections may still reduce nonessential presentation under severe pressure where existing policy requires it.

---

# 12. Performance priority hierarchy

When resources are constrained, Orion protects capability in this order:

1. video decoding and playback,
2. audio,
3. controls and subtitles,
4. core application responsiveness,
5. content artwork and transitions,
6. ambient effects,
7. particles, shaders and decorative animation.

The first optimization target is nonessential presentation cost.

Video quality or media correctness must not be the first resource sacrificed.

---

# 13. Cinema performance direction

During streaming, especially fullscreen:

- video/WebView composition receives priority,
- subtitles and player controls remain fully functional,
- telemetry stays lightweight,
- ambient capture may reduce or stop,
- global animated backgrounds may pause,
- hidden/inactive surfaces should not continue unnecessary visual work,
- expensive blur/shadow/effect layers may reduce by tier.

No player-engine migration is authorized by P10A.0.

Performance changes require later before/after evidence.

---

# 14. Music Planet performance direction

Music Planet is an explicit P10A performance target.

The existing visual architecture includes expensive continuously rendered work.

Phase 10A later connects it to the existing performance profile.

Controlled visual budgets may include:

- Canvas render cadence,
- device-pixel ratio,
- geometry detail,
- particle count,
- shader/reactivity intensity,
- inactive/background scene suspension.

`Reduced Motion` must reduce meaningful visual workload.

`Battery Saver Visuals` must affect the actual visual renderer if product copy promises a visual frame-rate reduction.

The current user-facing particle setting and engine behavior must describe the same concept.

Exact numeric budgets are not frozen by P10A.0.

They are selected during measured P10A.5 implementation.

---

# 15. Validation philosophy for low-end performance

The Alienware development system is useful for:

- regression testing,
- relative before/after resource cost,
- verifying that Quality remains intact,
- measuring whether Balanced/Efficiency actually reduce work.

It is not sufficient proof of low-end hardware performance.

Phase 10A final performance validation should therefore combine:

1. relative resource reduction on available development hardware,
2. explicit profile/budget contract tests,
3. constrained-profile testing,
4. physical iGPU/low-resource validation when representative hardware becomes available.

Do not claim universal low-end performance solely because Orion is smooth on a dedicated-GPU development laptop.

---

# 16. P10A.0 acceptance status

P10A.0 establishes:

- canonical Phase 10A plan: FROZEN,
- live source ownership: FROZEN,
- physical offline baseline: CAPTURED,
- reconnect defect: CONFIRMED,
- Desktop Download Modal behavior: CONTRACT-FROZEN,
- Desktop performance ownership: CONFIRMED,
- performance-profile architecture direction: FROZEN,
- Phase 10 downloader/Offline Player/update/signing floor: PRESERVED,
- Master Audit reconciliation: DEFERRED.

No production connection-state or performance implementation is claimed by this record.

---

# 17. Next implementation stage

The next authorized production stage is:

**P10A.1 - Connection-State Foundation**

Initial priority:

1. truthful product connection-state contract,
2. stable offline/reconnecting/online transitions,
3. stale async probe fencing,
4. service-degraded versus transport-offline distinction,
5. reconnect recovery event/coordination,
6. no route thrashing,
7. no interruption of local playback.

P10A.2 then consumes that foundation for the Mobile Offline Experience.

P10A.3 consumes it for Desktop Offline Experience and Music local-first behavior.

P10A.5 later implements the capability-aware Desktop performance profiles and adaptive rendering budgets defined above.

---

# FINAL P10A.0 STATEMENT

**P10A.0 is COMPLETE.**

Phase 10A now has sufficient architectural, source, contract and physical baseline evidence to begin production implementation.

The first production mutation is P10A.1 Connection-State Foundation.

The completed Phase 10 architecture remains locked.