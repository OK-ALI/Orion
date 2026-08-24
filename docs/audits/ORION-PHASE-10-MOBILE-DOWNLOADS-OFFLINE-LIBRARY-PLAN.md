# PROJECT ORION PHASE 10 - MOBILE DOWNLOADS & OFFLINE LIBRARY PLAN

**Canonical name:** `ORION-PHASE-10-MOBILE-DOWNLOADS-OFFLINE-LIBRARY-PLAN.md`
**Status:** CANONICAL PHASE 10 EXECUTION AUTHORITY
**Date established:** August 24, 2026
**Product/UX amendment:** August 24, 2026 - theme-aware responsive Downloads UX, hierarchical offline library, subtitle parity, offline-state handling and settings ownership
**Notification ownership amendment:** August 24, 2026 - Downloads extends the locked Phase 9 notification architecture; optional download alerts are controlled from Settings -> Notifications, while required active foreground-transfer visibility remains native/system-owned
**Phase 9 locked floor:** `e24edf23a119d44a95e98579a9aea793a02f5d5b`
**Phase 10 roadmap weight:** `8%`
**Canonical starting completion:** `10%`
**Canonical starting weighted contribution:** `0.8%`
**Master Audit contracts:** `V3-P10-001` through `V3-P10-016`

---

# 0. Canonical relationship

For Project Orion Phase 10, the following four files are canonical together:

1. `ORION-ENGINEERING-OPERATING-CONTRACT.md`
   - Governs workflow, evidence discipline, Git, local-source truth, physical validation, packaging and lock rules.

2. `ORION-PHASE-9-FINALIZATION-TRACK.md`
   - Preserves the final Phase 9 closure history and the locked updater/UX evidence that Phase 10 must not reopen without a real regression.

3. `ORION-V3-PRODUCTION-BUILD-IN-APP-UPDATE-VALIDATION-PLAN.md`
   - Governs recurring production-build, signing, versioning, Preview publication, in-app update and post-update validation for Phase 10 and later phases.

4. `ORION-PHASE-10-MOBILE-DOWNLOADS-OFFLINE-LIBRARY-PLAN.md`
   - Governs Phase 10 product scope, architecture, sequencing, acceptance, dual-storage behavior, Desktop reference mapping and final Phase 10 lock.

The Master v3 Audit remains authoritative for:
- the `V3-P10-*` checklist IDs,
- roadmap weighting,
- percentage calculation,
- historical Progress Log,
- final consolidation.

## Conflict rule

If any statement appears to conflict:

1. The Engineering Operating Contract wins for workflow and evidence.
2. The Production Build & In-App Update Validation Plan wins for signing, versioning, publication and updater-lifecycle proof.
3. This Phase 10 Plan wins for Phase 10 scope, architecture and stage order.
4. The Master Audit wins for checklist IDs, weighting and final percentage.
5. Current local workspace truth wins for present code ownership and implementation state.

No historical GitHub snapshot, old ZIP or remembered source may substitute for current local code.

---

# 1. Locked floor and Phase 10 starting boundary

Phase 9 is COMPLETE & LOCKED at:

`e24edf23a119d44a95e98579a9aea793a02f5d5b`

Phase 10 begins from that exact floor.

Phase 9 production truths that Phase 10 inherits:

- Orion Mobile production application updates use the permanently signed native GitHub/APK path.
- Expo runtime update/recovery is retired from production.
- Google Play Core is outside the current direct-GitHub distribution plan.
- The last explicitly proven installed Mobile package is `2.1.9/code11`.
- `v2.1.10/code12` is an identity-only published trigger target and is not claimed physically installed.
- A later Phase 10 candidate may be offered directly to an older installed eligible build; Orion does not need to install every intermediate Preview version.
- Debug APKs do not count as release-facing or physical acceptance evidence.

Phase 10 does not reopen Phase 9 unless new Phase 10 work proves a real updater regression.

---

# 2. Phase 10 product definition

Phase 10 is not merely "add a download button."

It delivers one coherent Mobile download system with:

- active-playback candidate discovery,
- safe preflight and capability classification,
- Android-owned resilient downloading,
- direct/HLS/DASH support where legitimately obtainable,
- integrity verification and repair,
- a premium Orion Downloads experience,
- an Orion Offline Library,
- user-visible device-storage output,
- Play in Orion,
- offline Resume/History/Continue Watching/watched-state integration,
- production distribution and real in-app upgrade validation.

The intended user experience combines:

**YouTube-like managed offline-library convenience**
+
**Desktop Orion Downloader flexibility**
+
**the existing Mobile Phase 10 roadmap contracts**
+
**the Phase 9 production updater.**

Phase 10 is explicitly both a backend and frontend milestone. A technically correct downloader with an inconsistent, developer-facing or cramped product surface does not satisfy the phase.

---

# 3. Canonical dual-storage model

Orion Mobile must support two explicit storage modes through one download engine.

## 3.1 Orion Library storage

This is the YouTube-like managed model.

Characteristics:

- Media uses real device storage.
- Orion owns the library record and storage lifecycle.
- Media does not need to appear as a normal file to arbitrary external applications.
- Completed content appears in Orion's Offline Library.
- It can be played fully offline through Orion.
- Orion preserves metadata, artwork, episode identity and supported tracks/subtitles.
- Deletion is managed by Orion.
- Missing/corrupt assets are reconciled honestly.

This mode is optimized for:
- reliability,
- offline playback,
- Orion metadata,
- Resume,
- History,
- Continue Watching,
- watched state,
- storage management.

## 3.2 Device Storage

This is the Desktop-like user-visible file model.

Characteristics:

- The user selects or approves a scoped Android destination.
- The final media is stored as an ordinary user-visible file when the candidate can safely produce one.
- Android scoped storage / Storage Access Framework rules are respected.
- Broad legacy storage permission is forbidden.
- The file can be used outside Orion where Android and the target application support the media format.
- Orion should still index the completed result in Downloads when appropriate.
- `Play in Orion` remains available for Orion-supported formats.
- If the external file is moved or deleted, Orion reconciles the record rather than pretending it still exists.

## 3.3 Shared engine, not two downloader implementations

Both storage modes use the same pipeline:

`candidate -> preflight -> job -> fragments/ranges -> verification -> finalization -> destination`

The destination choice affects final storage/finalization, not candidate security or network truth.

## 3.4 Honest portability rule

Some HLS/DASH/provider candidates may be valid for Orion-managed offline playback but may not safely finalize into a portable ordinary file without unsupported remuxing, unavailable tracks, protected content or invalid request context.

In that case Orion must:

- allow Orion Library storage if the managed path is valid,
- disable Device Storage for that candidate,
- show a clear reason,
- never fake a portable file,
- never silently drop required audio/subtitle/video components.

## 3.5 Play in Orion

`Play in Orion` is a first-class Phase 10 action.

It must be available for:
- Orion Library assets,
- supported Device Storage assets,
- existing completed Desktop-like output semantics adapted to Mobile.

This is a deliberate difference from a sealed YouTube-style download model.

---

# 4. Desktop Orion reference rule

Desktop Orion is the behavioral and product reference for Mobile Phase 10.

It is not reusable Mobile implementation.

Before parity claims are made, current local Desktop source must be audited.

The P10.0 audit must create a Desktop-to-Mobile option map covering every current user-facing Desktop downloader option, including where present:

- download entry points,
- candidate/source handling,
- media/quality selection,
- audio selection,
- subtitle handling,
- destination/folder selection,
- naming behavior,
- queue actions,
- pause/resume/retry/cancel,
- completed-item actions,
- local playback / Play in Orion,
- deletion,
- diagnostics,
- storage/settings behavior.

Every current Desktop option must end with one classification:

- `PARITY`
- `MOBILE-ADAPTED`
- `NOT APPLICABLE`
- `BLOCKED BY PLATFORM/CANDIDATE`
- `DEFERRED WITH EXPLICIT OWNER`

No Desktop option may silently disappear from the Phase 10 decision record.

Implementation rule:

- reuse concepts and product behavior,
- do not run Electron session code on Mobile,
- do not silently bundle unrestricted Desktop downloader tooling,
- recreate the required ownership through Android-native and React Native boundaries.

---

# 5. Product UX, theme, hierarchy and offline-state authority

The Phase 10 user experience is a first-class acceptance boundary, not polish deferred until after the backend.

## 5.1 Theme awareness

Every Phase 10 surface must use Orion's established theme system.

Required:
- all six Orion themes,
- correct semantic surfaces, borders, text hierarchy and accent usage,
- readable success/warning/error/offline states in every theme,
- no hard-coded visual language that only looks correct in one dark/red configuration,
- no separate "downloader theme" that breaks Orion consistency.

The Desktop Download modal is a product reference for information hierarchy and option density, not a mandate to copy Desktop dimensions or exact styling.

## 5.2 Responsive production UI

All Phase 10 screens, drawers, sheets and modals must remain usable across:
- compact phones,
- standard phones,
- landscape,
- larger Android layouts/tablets where practical,
- large text,
- Reduced Motion.

Hard rules:
- no overlapping controls,
- no clipped actions,
- no oversized headings or status copy,
- no horizontally crushed option rows,
- no inaccessible tap targets,
- no layout that assumes Desktop width,
- no technical/developer-themed wording in user-facing copy.

User-facing descriptions must be as short as practical.

Prefer concise product language such as:
- `Waiting for video`
- `Offline`
- `Retry`
- `Storage full`
- `Subtitles unavailable`

instead of long implementation explanations.

Diagnostics may expose deeper technical detail only behind an intentional troubleshooting surface.

## 5.3 Downloads page layout consistency

The Mobile Downloads page must follow Orion's established page grammar:
- normal Orion page title placement,
- spacing consistent with other top-level pages,
- familiar search/filter/sort patterns,
- responsive sections/cards,
- no isolated utility-app visual language.

Backend work must not be allowed to leave the Downloads page as a placeholder or engineering console.

## 5.4 Hierarchical downloaded-media organization

Downloads must be organized by canonical Orion title identity rather than as a flat list of file/job names.

### Movies

A downloaded movie appears as the same canonical Orion movie title/artwork identity used online.

Opening the title reveals its downloaded asset/content details and actions.

### TV and Anime

A downloaded TV or Anime title appears once at the top level using the same canonical Orion title/artwork identity used online.

Opening it reveals the downloaded content hierarchy for that title, including:
- seasons where applicable,
- exact downloaded episodes,
- episode number/title,
- download state,
- offline availability,
- relevant subtitle/audio information.

Downloading additional episodes of the same title must enrich that existing title entry rather than creating duplicate top-level rows.

This hierarchy is mandatory for usability and identification.

## 5.5 Offline-state handling

Phase 10 surfaces must understand that downloaded content exists specifically to work without a network.

Required offline behavior:
- Offline Library remains usable with no internet,
- downloaded titles remain browsable,
- valid artwork/metadata required for the offline experience is locally available,
- playback actions clearly distinguish local availability from online-only actions,
- unavailable network-dependent actions degrade cleanly,
- concise `Offline` state messaging appears where useful,
- retry/reconnect prompts appear only for actions that actually require network access,
- Orion must never make valid local playback look broken merely because discovery/provider services are offline.

Offline state must be tested as a product state, not merely by turning Wi-Fi off after playback begins.

## 5.6 Desktop Download modal reference

The current Desktop Orion Download modal is a required behavioral reference during the P10.0 parity audit.

Its relevant concepts include, where present:
- detected playback/candidate state,
- refresh/re-detect action,
- quality selection,
- destination selection,
- subtitle selection,
- selected-count feedback,
- select-all / none behavior,
- subtitle source/provider identification,
- preferred/best-match indication,
- Settings entry point,
- Cancel,
- Start download.

Mobile must adapt these concepts to touch/responsive patterns instead of copying Desktop geometry.

The parity audit must explicitly record each current Desktop option as:
- `PARITY`
- `MOBILE-ADAPTED`
- `NOT APPLICABLE`
- `BLOCKED BY PLATFORM/CANDIDATE`
- `DEFERRED WITH EXPLICIT OWNER`

## 5.7 Subtitle acquisition and offline playback

Subtitle support is a first-class Phase 10 capability.

The current Desktop downloader demonstrates downloadable subtitle selection, including provider-backed subtitle discovery such as SubDL and Wyzie where configured by Orion.

Mobile Phase 10 must audit the current local Desktop implementation and reproduce the user capability safely where applicable.

Required product behavior:
- discover supported subtitle choices for the selected title/candidate,
- identify language clearly,
- support selecting one or multiple subtitle tracks where the source allows,
- support preferred/best-match selection,
- allow All/None or equivalent efficient selection,
- persist selected subtitles with the downloaded media,
- make saved subtitles available to the Orion Offline Player,
- support subtitle enable/disable and track switching fully offline,
- reconcile missing/corrupt subtitle sidecars honestly.

Security rule:
- provider/API credentials remain in their proper protected service/configuration ownership,
- API keys are never exposed in presentation state or user-visible diagnostics.

The exact SubDL/Wyzie integration ownership must be established from current local source during P10.0; this plan does not invent undocumented credential placement.

## 5.8 Orion Offline Player

Phase 10 requires an explicit offline-capable Orion player mode/surface built on the existing unified Orion player architecture.

It is not a second competing playback stack.

The Orion Offline Player experience must support, where contained by the downloaded asset:
- play/pause,
- seek,
- duration/progress,
- Resume,
- playback speed,
- subtitle enable/disable,
- downloaded subtitle selection,
- embedded subtitle selection,
- audio track selection,
- orientation/presentation behavior,
- watched state,
- History,
- Continue Watching,
- exact TV/Anime episode identity,
- offline-specific error handling.

It must not attempt provider discovery or other network-only playback logic when a valid local asset is already available.

## 5.9 Device Storage parity with Desktop

Desktop Orion's local-device output behavior is part of the Mobile reference.

Mobile must support user-visible local storage where Android permits it, while respecting scoped storage / Storage Access Framework.

This includes:
- destination selection,
- safe naming,
- completed-file actions,
- `Play in Orion`,
- external move/delete reconciliation,
- clear distinction between Orion-managed Offline Library storage and user-visible Device Storage.

The two destinations must feel like options of one Orion downloader, not two unrelated products.

## 5.10 Downloads settings drawer

Phase 10 must deliver a theme-aware, responsive Downloads settings surface integrated into Orion Settings.

Its exact final options must be based on current Desktop settings plus Mobile-specific needs, but expected essential categories include:
- default destination mode: Orion Library / Device Storage,
- Device Storage folder or destination selection,
- preferred quality,
- subtitle preference / preferred languages where applicable,
- automatic preferred/best-match subtitle selection where supported,
- Wi-Fi / metered-network policy,
- battery/background behavior where user-controllable,
- storage management,
- partial-download cleanup/recovery policy where appropriate.

Notification ownership is intentionally outside the Downloads settings drawer.

Download notification preferences belong to the existing Phase 9 notification architecture under `Settings -> Notifications`, through a `Downloads` category/toggle for optional completion, failure and action-needed alerts. Phase 10 must not duplicate that preference in Downloads settings.

The native foreground-service progress notification is operational transfer visibility. It is fed by the same durable native job truth as the in-app Downloads UI and remains present whenever Android requires it for an active foreground service, regardless of optional alert preference or quiet-hours policy.

Rules:
- settings copy is concise and consumer-facing,
- no raw implementation toggles,
- no developer jargon,
- no duplicate settings already owned elsewhere in Orion,
- settings must remain usable in all six themes and responsive layouts.

---

# 6. Canonical Phase 10 data contracts

The Master Audit requires versioned contracts:

- `MobileDownloadCandidateV1`
- `MobileDownloadJobV1`
- `MobileDownloadAssetV1`
- `OfflineMediaEntryV1`

Their final field definitions come from the P10.1 ownership audit, but the following boundaries are fixed.

## 6.1 MobileDownloadCandidateV1

Represents an opaque scoped candidate.

May contain:
- candidate ID,
- playback/session identity,
- media type,
- source/provider classification,
- manifest/file class,
- capability flags,
- expiry classification,
- protection status,
- non-sensitive descriptive metadata.

Must not expose to presentation code:
- raw provider credentials,
- generic cookies,
- authorization secrets,
- reusable signed URLs,
- unrestricted request headers.

## 6.2 MobileDownloadJobV1

Represents durable job truth.

Must include:
- stable job ID,
- candidate reference,
- destination mode,
- desired output,
- state,
- byte/fragment accounting,
- timestamps,
- retry/recovery truth,
- failure classification,
- storage target identity in a safe Android-compatible form.

Canonical job states must cover at least:

`queued -> preflighting -> downloading -> paused/recovering -> verifying -> finalizing -> completed`

plus truthful:
- failed,
- unsupported,
- protected,
- expired,
- cancelled,
- storage blocked,
- action required.

No UI-only state machine may disagree with native durable job truth.

## 6.3 MobileDownloadAssetV1

Represents a verified completed asset.

Must distinguish:
- Orion-managed asset,
- user-visible Device Storage asset,
- container/format,
- verified size/integrity,
- supported audio/subtitle tracks,
- source attribution,
- file/content URI ownership,
- whether the asset can be played in Orion,
- whether it is expected to exist outside Orion.

## 6.4 OfflineMediaEntryV1

Represents Orion's offline-library projection.

It may contain portable media metadata and Orion playback identity.

It must not contain:
- provider credentials,
- reusable signed request context,
- raw download fragments,
- secrets,
- machine-specific unsafe paths,
- media bytes in Portable Profile backup.

---

# 7. Security and provider boundary

Phase 10 must not turn Orion Mobile into a generic authenticated proxy.

The request-context broker must be:

- candidate-scoped,
- job-scoped,
- provider-scoped,
- time-bounded,
- restricted to the selected manifest/file and legitimately discovered descendants,
- inaccessible as an arbitrary URL fetcher.

Presentation code receives opaque capability/state, not transferable credentials.

Protected/DRM media:

- is detected where possible,
- remains unavailable when Orion lacks authorized support,
- gets an honest explanation,
- is never bypassed by Phase 10.

Provider compatibility is evidence-driven. Playback success alone does not prove downloadability.

---

# 8. Android ownership architecture

Phase 10 must be Android-owned for long-running download execution.

Expected ownership shape, subject to P10.0 current-source audit:

- foreground service for active transfers and user-visible progress, including the system-required active-transfer notification,
- WorkManager for durable recovery/restart/reboot continuation,
- native durable job store,
- narrow request-context broker,
- Media3-compatible components where appropriate,
- React Native service/UI adapter,
- existing Orion player integration for final playback,
- Phase 9 notification-domain integration for optional download completion, failure and action-needed events.

The exact class/file names are not canonical until the current local ownership audit confirms the safest placement.

JavaScript must not be the sole owner of long-running transfer truth.

---

# 9. Media acquisition and finalization

## 9.1 Direct media

Support where valid:

- direct file downloads,
- range resume,
- deterministic byte accounting,
- safe fallback when range is unavailable,
- MIME-detected extensionless media.

## 9.2 HLS

Support where valid and authorized:

- master/media playlist selection,
- child playlist handling,
- fragment enumeration,
- bounded concurrency,
- playlist refresh where required,
- deterministic fragment accounting,
- required audio/subtitle/video components,
- authorized AES-128 handling only where legitimately accessible.

## 9.3 DASH

Support where valid and authorized:

- manifest parsing,
- representation selection,
- video/audio fragment ownership,
- deterministic fragment accounting,
- restart-safe recovery.

## 9.4 Integrity rule

Network completion is not final completion.

A job becomes `completed` only after:

- all required pieces exist,
- accounting is consistent,
- finalization succeeds,
- output/media sanity passes,
- metadata is valid,
- the final asset is atomically committed to its destination.

Missing fragments, truncated outputs, invalid containers and corrupt metadata remain failed or repairable. They never become false completion.

---

# 10. Storage policy

Phase 10 uses Android scoped storage.

Forbidden:
- broad legacy storage permission,
- undocumented filesystem escape paths,
- syncing media bytes into Portable Profile,
- storing credentials beside media.

Required:
- free-space check before start,
- free-space check before expensive finalization,
- storage-pressure handling,
- clear size estimates when available,
- safe cleanup after cancel,
- repairable partial retention when useful,
- explicit user control over Device Storage destination.

Orion Library storage and Device Storage must have separate lifecycle semantics even when powered by the same engine.

---

# 11. Offline playback integration

Completed supported assets route through Orion's unified player.

Offline playback must support, where the media contains the capability:

- play/pause,
- seeking,
- subtitles,
- audio selection,
- playback speed,
- orientation/presentation behavior,
- honest unsupported-format diagnostics.

Internet must not be required for playback of a valid completed offline asset.

Offline playback must integrate with:

- History,
- Resume dialog,
- watched state,
- verified playback position,
- Continue Watching.

Continue Watching remains a derived view under the locked Phase 8 architecture.

Phase 10 must not create a competing cloud/download state model.

---

# 12. Portable Profile boundary

Portable Profile may back up safe download metadata only.

Allowed examples:
- media identity,
- title/episode metadata,
- artwork identifiers,
- safe completion metadata,
- safe user-facing preferences if owned by Portable Profile.

Explicitly excluded:
- media bytes,
- fragments,
- provider cookies,
- authorization headers,
- signing secrets,
- signed media URLs,
- request-context tokens,
- machine/device-specific unsafe paths,
- WorkManager/native job internals.

Restoring a profile does not magically restore media that is absent from the device.

---

# 13. Phase 10 execution sequence

Phase 10 follows grouped stages. Do not explode the work into excessive micro-gates.

## P10.0 - Canonical setup and current-source ownership audit

**Checklist credit:** none by documentation/audit alone.

Goals:

- apply and review this Phase 10 canonical plan,
- confirm clean Phase 9 lock floor,
- create the dedicated Phase 10 branch from `e24edf23a119d44a95e98579a9aea793a02f5d5b`,
- inspect current local Mobile and Desktop source,
- identify true UI/native/storage/player owners,
- inventory current Mobile download foundations,
- create the Desktop-to-Mobile option parity map,
- identify dependency/build implications,
- identify the narrow first implementation slice,
- record any conflict between current source and the Master Audit.

Output:

- P10.0 ownership/audit result,
- exact implementation owner list,
- exact files for P10.1,
- no speculative code changes.

## P10.1 - Product, contracts and destination ownership

**Primary contracts:** `V3-P10-001`, `V3-P10-002`, foundations for `V3-P10-014`.

Implement:

- versioned contracts,
- durable storage schema/migrations,
- canonical job state model,
- dual-storage destination model,
- premium Downloads surface foundation,
- honest disabled/unavailable actions,
- Desktop option parity decisions,
- settings/default destination ownership,
- Downloads notification category/preference ownership under the existing `Settings -> Notifications` architecture,
- no duplicate notification preference in the Downloads settings drawer,
- testable capability presentation.

Acceptance:

- focused contract/state/storage tests,
- migration/restart tests,
- six-theme UI contract checks,
- notification-setting ownership tests proving the Downloads alert preference lives only under Notifications,
- no real download claim yet unless engine path is proven.

## P10.2 - Candidate capture, preflight and request-context security

**Primary contracts:** `V3-P10-003`, `V3-P10-004`, `V3-P10-007`.

Implement:

- active-playback scoped capture,
- direct/HLS/DASH/extensionless classification,
- opaque candidate delivery,
- preflight reachability/expiry/manifest/storage/protection checks,
- narrow request-context broker,
- provider descendant allowlisting,
- honest protected/unsupported reasons.

Acceptance:

- focused security/candidate tests,
- provider/session isolation tests,
- no raw credential leakage,
- physical candidate observation on representative real playback sources where required.

## P10.3 - Android native download engine and resilience

**Primary contracts:** `V3-P10-005`, `V3-P10-006`, `V3-P10-008`, `V3-P10-009`, `V3-P10-014`.

Implement:

- foreground download ownership,
- foreground-service progress notification backed by the same durable native job truth as in-app progress,
- Phase 9 notification-domain bridge for optional download completion, failure and action-needed events,
- WorkManager recovery,
- durable queue,
- direct range jobs,
- HLS/DASH fragment jobs,
- bounded concurrency,
- pause/resume/retry/retry-all/cancel,
- network/battery/storage policy,
- reboot/process-death recovery,
- integrity verification,
- atomic finalization,
- partial-job repair.

Acceptance:

- focused native/bridge tests,
- in-app / foreground-notification progress parity and background-continuity proof,
- proof that Android-required active-transfer notification visibility survives optional download-alert disablement,
- full relevant Mobile gates,
- signed distribution APK for physical native validation when needed,
- ADB may install/replace a signed same-signer distribution build for stage-level feature validation,
- such ADB installation is not updater-lifecycle evidence,
- no debug APK acceptance.

## P10.4 - Downloads product experience and Desktop parity

**Primary contracts:** `V3-P10-001`, `V3-P10-010`, `V3-P10-011`, `V3-P10-014`.

Implement:

- Queue / Active / Completed / Failed views,
- Orion-consistent page title/spacing/layout,
- theme-aware responsive UI in all six themes,
- concise consumer-facing status copy,
- search/filter/sort,
- storage usage,
- per-job progress and diagnostics,
- recovery actions,
- dual destination selection,
- Device Storage folder selection,
- Orion Library management,
- canonical title-level grouping for Movies, TV and Anime,
- season/episode drill-down for downloaded episodic content,
- Play in Orion,
- external-file reconciliation,
- supported metadata/artwork/audio/subtitle preservation,
- Desktop-style subtitle selection capability adapted to Mobile,
- Downloads settings drawer with essential user-facing controls but no notification preference,
- `Downloads` notification category/toggle in the existing `Settings -> Notifications` surface for optional completion/failure/action-needed alerts,
- all applicable Desktop downloader options mapped to Mobile.

Acceptance:

- compact phone,
- standard phone,
- landscape,
- tablet where practical,
- large text,
- Reduced Motion,
- all six Orion themes,
- no overlapping/clipped controls,
- no oversized or developer-facing copy,
- Movie / TV / Anime title hierarchy is physically usable,
- Download modal/sheet options remain readable and touch-safe,
- Downloads settings drawer is physically usable,
- Notifications surface exposes the Downloads alert preference without duplicating it in Downloads settings,
- no new visual language.

## P10.5 - Offline Library and unified Orion playback

**Primary contracts:** `V3-P10-012`, `V3-P10-013`, `V3-P10-015`.

Implement:

- Offline Library,
- canonical Movie / TV / Anime title hierarchy,
- locally available metadata/artwork needed for true offline browsing,
- Orion-managed asset indexing,
- Device Storage asset indexing where appropriate,
- unified-player routing through the Orion Offline Player experience,
- offline seek/subtitles/audio/speed,
- downloaded SubDL/Wyzie/provider-backed subtitle sidecars where safely supported by current source ownership,
- subtitle enable/disable and track switching with no network,
- explicit Offline state handling,
- clean degradation of network-only actions,
- History,
- Resume,
- watched state,
- Continue Watching,
- Portable Profile metadata-only rules,
- deletion/missing-file reconciliation.

Acceptance:

- airplane/offline browsing and playback,
- movie,
- exact TV/Anime episode,
- title -> downloaded-content drill-down,
- seek,
- downloaded subtitle discovery/use,
- subtitle switching with no network,
- audio where available,
- Resume,
- History,
- Continue Watching,
- watched state,
- restart,
- offline state messaging,
- network-only action degradation,
- missing/deleted asset behavior.

## P10.6 - Full resilience, integrity and production polish matrix

**Primary contract:** `V3-P10-016`, plus final acceptance for `001-015`.

Matrix includes:

Media:
- direct file,
- range resume,
- no-range behavior,
- HLS,
- DASH,
- extensionless/MIME,
- supported authorized encrypted HLS where applicable.

Interruption:
- network loss,
- reconnect,
- app termination,
- process death,
- reboot,
- battery restriction,
- metered policy,
- storage pressure.

Truth/integrity:
- expired candidate,
- dead host,
- missing request context,
- protected/DRM source,
- missing fragment,
- corrupt fragment,
- truncated output,
- invalid container,
- corrupt metadata,
- finalization failure.

Storage:
- Orion Library,
- Device Storage,
- destination unavailable,
- externally moved file,
- externally deleted file,
- delete/cleanup,
- repairable partial job.

Offline playback:
- movie,
- TV episode,
- subtitles,
- audio,
- seek,
- Resume,
- History,
- Continue Watching,
- watched state,
- true no-network operation.

Notifications:
- in-app and foreground-notification progress parity,
- optional Downloads alert preference on/off,
- completion/failure/action-needed event behavior,
- Android-required foreground notification remains visible during active foreground transfer,
- no duplicate Downloads notification preference outside `Settings -> Notifications`.

UX:
- portrait,
- landscape,
- compact,
- normal phone,
- representative larger layout,
- large text,
- Reduced Motion,
- all six themes.

## P10.7 - Production distribution build and Phase 9 in-app update validation

This stage is mandatory for Phase 10 closure even though it does not add a new `V3-P10-*` ID.

It reuses the Phase 9 production updater as a recurring production regression.

### Candidate identity

Do not mint a Phase 10 production version until implementation and relevant gates justify a real distributable candidate.

Canonical version rule:

- current published sequence has reached `2.1.10/code12`,
- default next different APK is `2.1.11/code13`,
- a deliberate meaningful minor version such as `2.2.0` may be selected only explicitly,
- `3.0.0` remains forbidden until final Orion v3 release validation.

### Build

Use the real direct-distribution production APK:

- permanent signer,
- correct `versionName`,
- strictly increasing `versionCode`,
- expected signature scheme,
- SHA-256 recorded,
- integrity manifest generated,
- no debug APK acceptance.

### Stage-level ADB role

ADB may be used for:

- read-only package inspection,
- `versionName` / `versionCode`,
- `firstInstallTime` / `lastUpdateTime`,
- logcat,
- service/WorkManager diagnostics,
- storage verification,
- process inspection,
- same-signer merge/install for stage-level feature validation when explicitly required.

ADB installation does not prove the final updater lifecycle.

### Final updater proof

Preserve the previous installed production-distributed build.

Do not manually install the new Phase 10 candidate before updater validation.

The installed eligible build must:

1. discover the real newer Preview release,
2. render the Phase 9 update banner/state correctly,
3. start the update from Orion,
4. download the signed APK inside Orion,
5. verify integrity/signer/package/version,
6. hand off to Android Package Installer,
7. perform in-place package replacement,
8. preserve application data/state,
9. relaunch,
10. settle to Current / Up to date,
11. clear stale update UI,
12. cold relaunch successfully.

If the device still has `2.1.9/code11`, it may update directly to the newest eligible Phase 10 candidate. Installing `2.1.10` first is not required merely for sequence ceremony.

Do not:
- uninstall,
- clear data,
- substitute `adb install -r` for final updater proof,
- claim a debug build as physical acceptance.

### Post-update Phase 10 regression

After the in-app upgrade, physically re-check:

- Downloads data/schema survives,
- existing/partial jobs are truthful,
- Offline Library entries survive,
- user-selected destination settings survive,
- completed media remains playable,
- Resume/History/Continue Watching remain correct,
- update banner disappears when current,
- no retired Expo update UI returns.

## P10-F - True Master Phase 10 audit and lock

Only after P10.1 through P10.7 are evidenced.

Reconcile all:

`V3-P10-001` through `V3-P10-016`

Evidence chain:

`implementation -> focused proof -> full relevant gates -> signed production artifact -> physical validation -> production in-app upgrade -> Master Audit -> exact lock`

Final tasks:

- update Master v3 Audit,
- add dated Progress Log evidence,
- calculate evidence-backed Phase 10 percentage,
- update overall Orion v3 percentage,
- reconcile remaining blockers,
- preserve Phase 11/12 boundaries,
- final diff review,
- exact staging only,
- staged manifest,
- staged whitespace gate,
- staged diff,
- commit,
- committed manifest,
- push,
- local/remote SHA equality,
- clean worktree.

Only then:

**PROJECT ORION PHASE 10 = COMPLETE & LOCKED**

---

# 14. Percentage rule

Phase 10 starts at the Master Audit's existing:

- `10%` completion,
- `0.8%` weighted contribution.

Do not increase the percentage because:
- the plan exists,
- contracts are drafted,
- UI is visible,
- a download starts,
- an APK builds.

Increase only when implementation and required evidence support the claimed checklist coverage.

The Master Audit remains the final percentage authority.

---

# 15. Non-goals and hard boundaries

Phase 10 must not:

- reopen locked Phase 5/6 player architecture without evidence,
- alter Phase 8 Portable Profile ownership to sync media bytes,
- begin Phase 11 Orion Connect expansion,
- bundle Electron downloader code into Mobile,
- create a generic authenticated HTTP proxy,
- expose provider secrets to presentation state/logs,
- bypass DRM/protected media,
- imply that playback capability guarantees download capability,
- report network completion as verified final completion,
- use broad legacy Android storage permission,
- invent a separate competing player for Offline Library,
- redesign Orion with a new visual language,
- use debug APKs as physical acceptance evidence,
- use ADB installation as the final in-app updater proof,
- mark Phase 10 locked before the production upgrade and Master Audit are complete.

---

# 16. Required physical validation philosophy

Physical validation should occur promptly after the relevant focused/full gates are green.

Do not postpone all physical truth until the final day.

Representative checkpoints:

- P10.2: real candidate/preflight behavior,
- P10.3: background/resume/reboot/storage engine behavior,
- P10.4: dual-storage and Downloads UX,
- P10.5: true offline playback,
- P10.6: complete resilience matrix,
- P10.7: final production in-app upgrade and post-upgrade regression.

The Samsung S24 Ultra remains the primary production Android validation device.

Because Phase 10 is sensitive to:
- background execution,
- scoped storage,
- OEM restrictions,
- battery management,

final acceptance should include at least one meaningfully different Android environment where practical.

---

# 17. Test and evidence expectations

Each stage uses:

**ONE STEP -> RESULT -> INSPECT -> NEXT STEP**

When a gate fails:

**STOP -> CLASSIFY -> SURGICAL REPAIR -> REPEAT THE FAILED LINK**

Do not continue through an unexplained relevant red gate.

Evidence types may include:

- focused unit/contract/native tests,
- full Mobile gates,
- source-size checks,
- typecheck,
- production export/build checks,
- signed distribution APK inspection,
- signer/hash proof,
- ADB read-only diagnostics,
- physical screenshots/video where visual proof matters,
- actual offline playback,
- actual reboot/process recovery,
- real GitHub Preview publication,
- real Orion in-app update,
- post-update package/state proof,
- final Master Audit reconciliation.

A wrapper `PASS` is never stronger than the underlying evidence.

---

# 18. Immediate next action

The next action after establishing this file is:

**P10.0 current-source ownership audit.**

Do not implement from GitHub or from this plan alone.

Request and inspect current local source from the Phase 9 locked workspace.

The first audit must cover:

### Mobile
- current Downloads route/surface,
- Mobile player/playback-session owners,
- Mobile History/Resume/Continue Watching integration owners,
- storage/persistence owners,
- current Android native plugin/module pattern,
- package/build dependencies,
- existing tests relevant to downloads/player/storage,
- Phase 9 updater/build owners only as needed for the final recurring validation boundary.

### Desktop behavioral reference
- current Desktop downloader engine ownership,
- current Desktop Download modal and its option hierarchy,
- quality/destination behavior,
- subtitle discovery/selection behavior,
- SubDL/Wyzie ownership and protected key/configuration boundary,
- Downloads page/UX,
- download settings,
- local playback / Play in Orion behavior,
- candidate/capture/preflight/request-context behavior,
- current user-facing downloader options.

### Mobile product/UX owners
- current theme tokens and all six theme owners,
- responsive page/sheet/drawer patterns,
- top-level page title/layout conventions,
- existing offline/connectivity-state ownership,
- Settings drawer/group patterns,
- canonical Movie / TV / Anime metadata/card/detail owners,
- exact episode/season identity owners.

P10.0 must produce the exact current owner/file map before P10.1 implementation begins.

---

# 19. New-chat continuation instruction

When this file is supplied in a future Orion chat:

1. Treat it as the fourth canonical file together with the three earlier canonical authorities.
2. Confirm Phase 9 remains locked at `e24edf23a119d44a95e98579a9aea793a02f5d5b` unless later canonical evidence supersedes it.
3. Read the Master Audit for `V3-P10-*` checklist and percentage context.
4. Use current local workspace as present code truth.
5. Continue from the exact incomplete P10 stage.
6. Preserve the dual-storage model:
   - Orion Library,
   - Device Storage,
   - Play in Orion for supported completed assets.
7. Preserve Desktop Orion as the behavioral/product reference, not reusable Mobile code.
8. Preserve Android-native download ownership.
9. Preserve the Phase 9 production in-app updater as the required final Phase 10 upgrade-validation path.
10. Do not declare Phase 10 complete until `V3-P10-001` through `V3-P10-016`, production upgrade validation, Master Audit reconciliation and Git lock proof are complete.
