# PROJECT ORION PHASE 10 - P10.0 CURRENT-SOURCE OWNERSHIP AUDIT

**Status:** P10.0 COMPLETE - SOURCE/OWNERSHIP AUDIT ONLY
**Date:** August 24, 2026
**Phase 10 branch floor:** `a568957b49d7369ca663fc53393166bd83b80859`
**Phase 10 completion remains:** `10%`
**Checklist credit:** none by P10.0 audit alone
**Notification ownership decision:** Downloads extends the locked Phase 9 notification architecture; optional download alerts live under Settings -> Notifications, while active foreground-transfer visibility remains native/system-owned

---

# 1. Evidence inspected

Current-local source bundle:

- `orion-p10.0-current-source-audit.zip`
- SHA-256: `7EB50772A3EA8BCBCFDD31F31E5FAA22CDC4D5C84EEC15E5B56568A8F83C4A06`
- 870 files

Shared-contract supplement:

- `orion-p10.0-shared-contract-source.zip`
- SHA-256: `439DB1F1F6BFA46B6D34A21B304DD9227A4E67B9016C2E306EB3031BA2188705`
- 39 files

The supplied source was collected from:

- branch `codex/orion-v3-p10-mobile-downloads-offline-library`
- HEAD `a568957b49d7369ca663fc53393166bd83b80859`
- clean worktree at collection time

This audit uses the supplied current-local source as implementation truth.

---

# 2. Executive finding

Phase 10 is not starting from zero, but the real Mobile downloader does not exist yet.

Strong reusable foundations already exist for:

- unified native Mobile playback,
- verified playback telemetry,
- History / Resume / Continue Watching / watched-state integration,
- offline route support through `offlineUri`,
- six-theme Mobile styling,
- responsive layout ownership,
- offline/connectivity state,
- SubDL/Wyzie subtitle discovery,
- renderer-safe opaque subtitle references,
- Mobile notification permission/settings infrastructure,
- custom Android native plugin/module registration patterns,
- source capability and request-manifest contracts.

Still absent:

- real Mobile candidate capture for downloads,
- Phase 10 versioned Mobile download contracts,
- durable Mobile download repository,
- Android foreground download service,
- WorkManager recovery owner,
- native download job store,
- request-context broker for download jobs,
- direct/HLS/DASH transfer engine,
- integrity/finalization pipeline,
- real Downloads queue/library,
- Orion-managed Offline Library,
- Device Storage finalization path,
- downloaded subtitle persistence,
- offline subtitle/audio/speed player integration,
- Downloads settings implementation,
- production download-progress foreground notification.

---

# 3. Mobile current ownership map

## Downloads route and product surface

Current owner:

`apps/mobile/app/(tabs)/downloads.tsx`

Current condition:

- uses `MobilePageHeader`,
- uses Orion theme values,
- currently shows engineering/stabilization copy,
- currently exposes no real queue/library.

Phase 10 action:

- replace the locked engineering surface with production Downloads UX,
- preserve established Orion page grammar,
- add title-based Offline Library hierarchy and queue states.

## Download modal

Current owner:

`apps/mobile/src/components/DownloadModal.tsx`

Current condition:

- placeholder/locked UI,
- props already anticipate:
  - title,
  - TMDB id,
  - movie/tv,
  - poster,
  - season,
  - episode,
  - stream URL,
- implementation currently uses only title.

Phase 10 action:

- replace with real responsive download sheet/modal,
- preserve exact Movie / TV / Anime target identity,
- add quality, destination and subtitle selection,
- keep unavailable choices honest.

## Download service boundary

Current owner:

`apps/mobile/src/services/downloadManager.ts`

Current condition:

- explicitly unavailable,
- creates no jobs,
- stores no downloaded items,
- intentionally refuses simulated progress.

Phase 10 action:

- do not stretch this placeholder into the Android engine,
- convert it into a presentation/service adapter over the native/durable Phase 10 owners.

## Unified native playback

Current owners:

- `apps/mobile/src/features/playback/PlayerScreen.tsx`
- `apps/mobile/src/features/playback/NativePlayerSurface.tsx`
- existing playback telemetry/repository/resume owners under `apps/mobile/src/features/playback/`

Current condition:

- `PlayerScreen` already accepts `offlineUri` and `isOffline`,
- offline routes already select the native player surface,
- `NativePlayerSurface` already drives verified playback telemetry,
- current native capability advertises `canSubtitles: false`.

Phase 10 action:

- Orion Offline Player is an offline-capable mode of the existing unified player,
- do not create a competing playback stack,
- extend native playback with downloaded/embedded subtitle selection, supported audio selection and speed where the underlying player supports them,
- preserve existing History / Resume / watched / Continue Watching truth.

## Subtitle discovery

Current owners:

- `apps/mobile/src/services/subtitles.ts`
- `apps/mobile/src/features/playback/subtitleDiscovery.ts`

Current condition:

- Mobile already supports SubDL and Wyzie discovery,
- SubDL key ownership uses protected Mobile storage,
- external subtitle results are converted into session-scoped opaque IDs,
- presentation-facing subtitle tracks omit raw provider URL state.

Phase 10 action:

- preserve the opaque-reference security model,
- introduce downloaded subtitle assets/sidecars,
- persist only safe subtitle metadata into presentation/library records,
- make selected subtitles available fully offline.

## Offline/connectivity

Current owners:

- `apps/mobile/src/context/NetworkContext.tsx`
- `apps/mobile/src/components/OfflineBanner.tsx`

Phase 10 action:

- reuse this connectivity owner,
- do not invent a second offline-state system,
- valid local media must remain browseable/playable while network-dependent actions degrade cleanly.

## Theme and responsive layout

Current owners:

- `apps/mobile/src/context/ThemeContext.tsx`
- `apps/mobile/src/services/responsive.ts`
- shared theme/responsive types in `@orion/shared`

Current supported themes:

- Midnight Premiere
- AMOLED
- Mocha
- Slate
- Projector Silver
- Custom

Responsive classifications already include:

- compact phone
- phone
- tablet
- large tablet

Phase 10 action:

- every Downloads/Offline/Settings/player-download surface must use these existing owners.

## Settings

Current owners:

- `apps/mobile/app/(tabs)/settings.tsx`
- `apps/mobile/src/features/settings/settingsArchitecture.ts`
- existing Settings components under `apps/mobile/src/features/settings/`

Current condition:

- `downloads` already exists as a reserved Settings section,
- it is intentionally hidden until its real owner lands.

Phase 10 action:

- activate the Downloads section only with real settings,
- keep settings device-local unless an existing portable-profile contract explicitly owns a portable value.

## Mobile notifications

Current owner:

`apps/mobile/src/services/mobileNotifications.ts`

Current condition:

- `expo-notifications` already owns permission/settings/event-style local notifications,
- current categories are app updates, sync failures, offline recovery, provider health and watchlist,
- no Downloads category/channel exists yet.

Phase 10 action:

- extend the existing Phase 9 notification architecture rather than creating a parallel Downloads notification subsystem,
- add `Downloads` as a notification category/preference under `Settings -> Notifications`,
- let that preference control optional completion, failure and action-needed alerts,
- keep the Downloads settings drawer free of a duplicate notification toggle,
- keep active foreground-transfer progress native and backed by the durable job store,
- do not use ordinary scheduled JS notifications as the owner of active transfer progress,
- preserve Android-required foreground-service notification visibility even when optional Downloads alerts are disabled or quiet hours apply.

---

# 4. Shared contract ownership finding

Current shared package:

`packages/shared/`

Relevant current owners:

- `packages/shared/src/types/media.ts`
- `packages/shared/src/types/index.ts`
- `packages/shared/src/sources/contracts.ts`
- `packages/shared/src/sources/registry.ts`
- `packages/shared/src/types/portableProfile.ts`

## Existing legacy download types

`media.ts` already contains generic legacy shapes:

- `DownloadStatus`
- `DownloadProgress`
- `DownloadRecord`

They are not sufficient for the canonical Phase 10 contracts.

They lack the required explicit boundaries for:

- candidate security,
- destination mode,
- preflight/protection truth,
- durable native recovery,
- integrity/finalization,
- verified asset ownership,
- Offline Library projection.

Decision:

**Do not mutate the legacy generic download types into Phase 10 contracts.**

Create a focused new shared type module:

`packages/shared/src/types/mobileDownloads.ts`

and export it through:

`packages/shared/src/types/index.ts`

This avoids destabilizing Desktop compatibility while giving Mobile Phase 10 explicit versioned contracts.

Canonical new contracts:

- `MobileDownloadCandidateV1`
- `MobileDownloadJobV1`
- `MobileDownloadAssetV1`
- `OfflineMediaEntryV1`

## Source capability ownership

`packages/shared/src/sources/contracts.ts` already includes:

- `supportsDownloads`,
- request manifests,
- media origins,
- subtitle origins,
- source/resume/subtitle strategies.

Decision:

`supportsDownloads` is an eligibility hint, not proof that the currently observed playback can be downloaded.

Runtime candidate capture and Phase 10 preflight remain mandatory.

## Portable Profile

Current known Portable Profile namespaces are:

- myList
- history
- watched
- progress
- preferences

Decision:

Phase 10 must not put media bytes, fragments, credentials, signed URLs, device paths or native job internals into Portable Profile.

Any future portable download metadata must be introduced only through the established Portable Profile boundary and cannot imply media exists on another device.

---

# 5. Desktop behavioral reference map

Current Desktop downloader owners include:

- `apps/desktop/src/main/downloader/`
- `apps/desktop/src/main/subtitles/`
- `apps/desktop/src/preload/api/downloads.js`
- `apps/desktop/src/renderer/components/DownloadModal.jsx`
- `apps/desktop/src/renderer/components/SubtitleDownloaderModal.jsx`
- `apps/desktop/src/renderer/features/downloads/`
- `apps/desktop/src/renderer/app/hooks/useDownloads.js`
- Desktop download/settings owners under `apps/desktop/src/renderer/features/settings/`

## Desktop -> Mobile classifications

| Desktop capability | Phase 10 Mobile decision |
|---|---|
| Active playback detection | MOBILE-ADAPTED |
| Refresh/re-detect candidate | PARITY |
| Candidate/source choice | MOBILE-ADAPTED |
| Best / quality selection | PARITY where candidate supports it |
| Destination folder | MOBILE-ADAPTED to Android SAF/scoped storage |
| SubDL/Wyzie subtitle discovery | PARITY using current Mobile subtitle owners |
| Preferred/best-match subtitle | PARITY |
| Multi-subtitle selection | PARITY |
| All / None subtitle selection | PARITY |
| Stream/captured subtitle handling | MOBILE-ADAPTED |
| Preflight before start | PARITY, Android-native ownership |
| Queue | PARITY |
| Pause/resume/retry/cancel | PARITY |
| Pause all / retry failed | PARITY where product surface remains clean |
| All / Active / Completed / Failed views | PARITY |
| Movies / Series organization | MOBILE-ADAPTED to canonical title hierarchy |
| Search/filter/sort | PARITY |
| Progress / size / speed / ETA | PARITY |
| Diagnostics | MOBILE-ADAPTED, concise UI with deeper troubleshooting surface |
| Delete/cancel | PARITY |
| Play in Orion | PARITY |
| Open externally | PARITY for Device Storage assets where Android supports it |
| Show in folder | MOBILE-ADAPTED to Android document/folder destination |
| Subtitle management | PARITY |
| Desktop flat completed-file list | NOT APPLICABLE; Mobile title hierarchy wins |
| Desktop cloud media backup/offload | NOT APPLICABLE to Phase 10 Mobile |
| Desktop unrestricted tooling/Electron session implementation | NOT APPLICABLE; behavioral reference only |

Device Storage organization should preserve Desktop's useful conceptual structure while adapting to Android scoped storage, for example:

- Movies -> title
- Series/Anime -> title -> season -> episode

The exact physical SAF layout remains implementation-owned and must not require broad legacy storage permission.

---

# 6. Canonical download-progress model

This clarification is part of the P10.0 ownership result.

**Downloading progress must appear both in Orion and in Android notifications.**

Both surfaces must consume the same native durable job truth.

## Single source of truth

Canonical flow:

`native job store -> redacted progress snapshot -> in-app Downloads UI`

and

`native job store -> foreground service notification`

There must not be:

- one JS timer for the app,
- a different native estimate for the notification,
- fabricated progress when the app is backgrounded,
- progress reset merely because React Native reloads.

## In-app progress

The Downloads experience should show concise per-job truth such as:

- status,
- progress bar,
- percentage where deterministic,
- downloaded / total size where known,
- fragment count where useful,
- speed,
- ETA,
- pause/resume/retry/cancel state,
- Verifying / Finalizing state,
- failure/recovery state.

Queue/Active/Completed/Failed surfaces derive from the same durable repository.

## Android foreground notification

While active background transfer ownership requires a foreground service, Orion must expose a persistent Android download notification.

For one active transfer, it should show:

- title,
- progress,
- percentage where deterministic,
- downloaded/total size where useful,
- concise state,
- Pause/Resume and Cancel where safe,
- tap -> Orion Downloads.

For multiple active/queued jobs, use a compact summary rather than notification spam.

The notification may summarize:

- active count,
- queued count,
- current transfer,
- aggregate or current deterministic progress,
- Pause all where appropriate,
- tap -> Downloads for per-job control.

## Completion, failure and notification preference ownership

Completion/failure/action-needed events extend the existing Phase 9 notification architecture:

- `Download complete`
- `Download failed`
- `Action needed`

The user-facing preference is owned by `Settings -> Notifications -> Downloads`.

That preference controls optional download event alerts. It is not duplicated in the Downloads settings drawer.

The ongoing foreground-service notification is operational Android transfer visibility, not an optional event alert. It must remain present whenever Android requires it for the active service, even when the optional Downloads alert preference is disabled or quiet hours apply.

## Integrity rule

`100%` means verified final completion.

A transfer that has received all network bytes but is still:

- verifying,
- merging,
- remuxing,
- validating,
- atomically finalizing,

must not be presented as completed.

Use truthful states such as:

- `99% · Verifying`
- `Finalizing`
- indeterminate final-processing state where exact percentage is not defensible.

This applies identically in-app and in the notification.

---

# 7. Android native ownership decision

Existing Mobile native plugins establish the project pattern:

- config plugin,
- generated/native Kotlin source,
- custom ReactPackage registration,
- React Native bridge/module.

Phase 10 should follow that pattern.

P10.0 does not freeze final Kotlin filenames, but freezes ownership:

- native Android service owns active transfer execution,
- WorkManager owns durable recovery scheduling,
- native store owns job truth,
- request-context broker owns scoped sensitive request context,
- JS receives redacted contract snapshots/actions,
- notification progress is generated from native job truth,
- optional completion/failure/action-needed alerts route through the existing Phase 9 notification architecture,
- the Downloads alert preference is owned only by `Settings -> Notifications`,
- React Native is not the sole owner of a long-running transfer.

---

# 8. Exact P10.1 implementation slice

P10.1 should remain narrow.

## Shared contracts

Create:

`packages/shared/src/types/mobileDownloads.ts`

Modify:

`packages/shared/src/types/index.ts`

Do not rewrite the existing legacy `DownloadRecord` types yet.

## Mobile local contract/repository boundary

Create a focused Mobile Downloads feature boundary under:

`apps/mobile/src/features/downloads/`

Initial P10.1 owners should cover:

- local contract adapters,
- durable repository schema/migration,
- destination preference contract,
- title/episode identity projection,
- presentation-safe progress snapshot,
- Phase 9 notification-domain Downloads category/preference ownership,
- tests.

Do not implement direct/HLS/DASH transfer mechanics in P10.1.

## Existing Mobile files expected to change in P10.1

- `apps/mobile/app/(tabs)/downloads.tsx`
- `apps/mobile/src/components/DownloadModal.tsx`
- `apps/mobile/src/services/downloadManager.ts`
- `apps/mobile/src/services/mobileNotifications.ts`
- `apps/mobile/src/features/settings/settingsArchitecture.ts`
- `apps/mobile/app/(tabs)/settings.tsx`

Potential new files, finalized during implementation:

- `apps/mobile/src/features/downloads/contracts.ts`
- `apps/mobile/src/features/downloads/downloadRepository.ts`
- `apps/mobile/src/features/downloads/downloadPreferences.ts`
- `apps/mobile/src/features/downloads/downloadIdentity.ts`
- `apps/mobile/src/features/downloads/DownloadSettingsContent.tsx`

Tests should be added under:

`apps/mobile/tests/`

with focused P10.1 coverage for:

- contract/version normalization,
- no sensitive fields in presentation snapshots,
- restart-safe persistence,
- destination-mode persistence,
- Movie / TV / Anime identity grouping,
- exact episode identity,
- theme/responsive Downloads surface contracts,
- Downloads Settings visibility only when real implementation exists,
- Downloads alert preference exists only under `Settings -> Notifications`,
- Downloads settings contains no duplicate notification toggle.

## Progress-notification implementation timing

P10.1 defines progress contracts, in-app UI truth and the `Settings -> Notifications -> Downloads` optional-alert preference ownership.

The real persistent Android foreground notification lands with the native engine in P10.3 and consumes the same durable job truth as the in-app Downloads UI.

P10.4 completes production copy, responsive/settings presentation and event-alert UX integration without moving the notification preference into the Downloads drawer.

This avoids pretending a notification progress engine exists before the Android job owner exists and preserves the locked Phase 9 notification architecture as the single notification system.

---

# 9. P10.0 conclusion

P10.0 is complete.

It has established:

- current local ownership,
- Desktop behavioral parity decisions,
- shared contract placement,
- player/offline integration direction,
- subtitle ownership,
- settings ownership,
- Phase 9 notification-domain extension and foreground progress ownership,
- Android/native trust boundary,
- exact P10.1 implementation slice.

No Phase 10 roadmap percentage is earned by this audit alone.

Phase 10 remains:

**10% complete / 0.8% weighted contribution**

Next stage:

**P10.1 - Product, contracts and destination ownership**
