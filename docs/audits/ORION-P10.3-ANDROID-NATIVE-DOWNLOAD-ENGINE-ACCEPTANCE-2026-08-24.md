# Orion P10.3 Android Native Download Engine Acceptance Audit

**Date:** 2026-08-24
**Branch:** `codex/orion-v3-p10-mobile-downloads-offline-library`
**Pre-checkpoint base HEAD:** `a65ec8e077daacd57a3ce6879e3058dcd04e5f0c`
**Accepted signed physical identity:** Orion Mobile `2.1.16`, Android `versionCode 18`

## Verdict

**P10.3 is accepted at its Android native-engine boundary.**

Complete in this stage:

- `V3-P10-005`
- `V3-P10-006` under the evidence-backed fragment-only Mobile production amendment
- `V3-P10-008`
- `V3-P10-009`

`V3-P10-014` remains open because the complete Device Storage fragment-finalization and dual-destination product UX continue in P10.4.

This audit is a stage checkpoint, not a Phase 10 lock. P10.4 through P10.7 and P10-F remain required.

## Accepted architecture

`active playback -> scoped candidate capture -> opaque request context -> native durable job -> HLS/DASH fragment planner -> bounded native transfers -> Android foreground service -> WorkManager recovery -> verification -> atomic Orion Library fragmented bundle -> sanitized snapshot projection`

Production Mobile transfer policy:

- `Auto` ranks valid HLS before DASH.
- Direct production execution is retired.
- No Direct fallback exists.
- Finite/VOD HLS and DASH are supported.
- Live, changing or open-ended manifests fail closed.
- Raw media URLs, cookies, Authorization headers and signed request material stay native and are never persisted merely to force restart/reboot recovery.
- If ephemeral request context is gone or expired, the durable job becomes action-required and asks the user to refresh playback source truth.

## Automated evidence

Candidate 6 closeout gate:

- focused P10.2/P10.3: `52/52`
- complete Mobile tests: `384/384`
- TypeScript typecheck: pass
- Mobile source-size: `169` files
- Expo Doctor: `20/20`
- production web export: pass
- Android native compile: `BUILD SUCCESSFUL`
- Android compile task count: `373` actionable
- application identity remained `2.1.16/code18`
- final `git diff --check`: green apart from informational LF/CRLF notices

Candidate 6 specifically closes:

- native Retry All without moving transfer ownership into JavaScript,
- WorkManager recovery constraints for connected network, battery-not-low and storage-not-low,
- optional completion, failure and action-needed events through the existing Phase 9 `Downloads` notification category,
- continued independence of the Android-required foreground progress notification from optional alert preferences.

## Physical signed-distribution evidence

The signed `2.1.16/code18` Preview was installed through Orion's own Phase 9 updater. It was not substituted with a debug APK or ADB installation.

### Capture breadth

Ready HLS candidates were physically produced from:

- VidSrc
- Videasy
- VidKing
- VixSrc
- VSEmbed

This closed the earlier narrow-capture defect where only VidSrc reliably returned a ready Mobile HLS candidate.

### Real transfer behavior

Physical evidence includes:

- real VidSrc fragmented download,
- real Videasy fragmented download,
- real Movie job (`Mutiny`),
- real TV episode job (`House of the Dragon · S1 E1`, `The Heirs of the Dragon`),
- active foreground-service notification,
- real native title/progress/fragment count/bytes/network speed/ETA,
- pause and resume,
- paused jobs remaining Active,
- network interruption followed by retained-fragment recovery,
- background continuation,
- final `Verified · Stored in Orion Library`,
- Active returning to zero after completion,
- Offline count increasing only for legitimate verified entries.

`Verifying` / `Finalizing` was physically observed during the run; the final verified state is screenshot-backed.

## Contract reconciliation

### V3-P10-005 — complete

Android owns the foreground transfer lifecycle, durable job store, progress truth and WorkManager recovery. Durable job/fragment truth survives process loss and can be rescheduled after restart/reboot.

Automatic continuation is intentionally not guaranteed when the provider's ephemeral authenticated playback context no longer exists. Orion does not persist secrets to manufacture continuity; it becomes action-required and requests a fresh playback source.

Full reboot-device matrix remains part of `V3-P10-016`.

### V3-P10-006 — complete under production amendment

The earlier roadmap wording included resumable Direct and generic playlist refresh. Physical provider evidence showed Direct is not a reliable Mobile production method while usable providers expose viable fragment streams.

Accepted Mobile production behavior is therefore:

- finite HLS/DASH fragments,
- bounded concurrency,
- deterministic fragment accounting,
- verified fragment retention and retry,
- exact manifest-descendant authorization,
- no Direct execution/fallback,
- fail closed for live/changing/open-ended manifests.

Historical Direct code can remain dormant for regression/history, but it is unreachable from the production start path.

### V3-P10-008 — complete at implementation boundary

Implemented:

- pause
- resume
- retry
- Retry All
- cancel
- network recovery
- process/reboot rescheduling
- battery-not-low recovery constraint
- storage-not-low recovery constraint
- runtime low-free-space blocking
- repairable verified-fragment retention

Network interruption is physically proven. Full reboot/low-battery/low-storage representative matrix remains `V3-P10-016`.

### V3-P10-009 — complete for fragmented Orion Library assets

Before completion Orion:

- limits progress to <=99% before verified finalization,
- rejects empty/missing fragments,
- checks expected byte-range size where applicable,
- verifies every planned fragment exists and is non-empty,
- transitions through Verifying and Finalizing,
- atomically moves the verified fragment set into Orion Library,
- writes the fragment-bundle index,
- records verified byte size and verified timestamp,
- keeps failed finalization repairable,
- never reports false completion.

The current production artifact is an Orion fragmented bundle, not a monolithic MP4/MKV container. Monolithic-container validation becomes applicable only if a later finalizer emits such a container.

### V3-P10-014 — remains open

Accepted P10.3 foundation:

- app-scoped Orion Library storage,
- free-space checks in the native transfer path,
- Android SAF `ACTION_OPEN_DOCUMENT_TREE`,
- opaque persisted SAF target IDs,
- no broad legacy storage permission.

Still open for P10.4:

- safe portable HLS/DASH fragment finalization into Device Storage,
- complete user-facing dual-destination flow,
- Device Storage reconciliation and product UX.

No fragments are dumped into a fake MP4 merely to claim destination parity.

## Known presentation work deliberately deferred to P10.4

The physically accepted P10.3 UI is functional but not the final Downloads product surface.

P10.4 owns:

- Desktop-derived Queue / Active / Completed / Failed organization,
- artwork,
- Movie year and TV season/episode identity,
- downloaded / total size,
- speed,
- ETA,
- elapsed time where useful,
- denser title-first cards,
- search/filter/sort,
- storage usage,
- completed/failed actions,
- notification identity polish such as Movie year and TV episode context,
- supported metadata/audio/subtitle preservation,
- Device Storage product completion,
- all six-theme responsive validation.

## Percentage

No roadmap percentage is increased by this checkpoint alone.

The Phase 10 plan explicitly forbids awarding percentage merely because code, UI, a starting download or an APK build exists. The Master Audit remains the percentage authority. Until the Master Audit assigns evidence-backed Phase 10 internal weighting, the existing overall `87.28%` exact / `87%` rounded figure is retained.

## Next

`P10.3 docs reconciliation -> exact diff review -> exact-path checkpoint -> push -> local/remote SHA equality -> P10.4 Desktop-parity Downloads product experience`
