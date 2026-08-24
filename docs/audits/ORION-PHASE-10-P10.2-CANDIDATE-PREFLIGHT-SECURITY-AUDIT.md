# PROJECT ORION PHASE 10 - P10.2 CANDIDATE / PREFLIGHT / SECURITY AUDIT

**Status:** P10.2 COMPLETE AT THE CANDIDATE CAPTURE / PREFLIGHT / REQUEST-CONTEXT SECURITY BOUNDARY
**Phase 10 overall:** IN PROGRESS, NOT LOCKED
**Branch:** `codex/orion-v3-p10-mobile-downloads-offline-library`
**Initial P10.2 source checkpoint:** `3a84de3e7383551e5f86d16be6c48c9cddb237ce`
**Physical trace checkpoint:** `684c2903cb1675f212a63b4ef0ed64a38a34e58c`
**Accepted Fabric repair checkpoint:** `5d7aec10b9b73cdedb0cde6f00dd6a60c5227fdf`
**Accepted Preview:** `v2.1.13`
**Accepted Android identity:** `2.1.13 / code15`
**Date:** 2026-08-24

## 1. Scope accepted

P10.2 establishes real active-playback candidate discovery, truthful preflight and a narrow opaque request-context security boundary without enabling download transfer execution.

Accepted scope:

- active-playback and exact-session scoped capture;
- direct, HLS, DASH and MIME/shape-based extensionless classification;
- opaque candidate delivery to React presentation;
- reachability, expiry, manifest-shape, storage and protection preflight;
- honest ready, unsupported and action-required outcomes;
- native-only request material ownership;
- job-scoped request-context binding;
- discovered-descendant restrictions;
- provider/session isolation;
- bounded redacted physical diagnostics;
- React Native New Architecture / Fabric delivery of Orion's custom Cinema capture-session property.

No P10.3 transfer engine is claimed by this audit.

## 2. Checklist reconciliation

### `V3-P10-003` - COMPLETE

Physical playback proved that requests from the active Cinema session reach the Android observer and are classified without exposing raw request material.

Representative evidence includes:

- Videasy manifest activation with `capture=true`;
- Videasy main-frame and subresource observation;
- Videasy extensionless, HLS and direct classification;
- VidSrc manifest activation with `capture=true`;
- VidSrc main-frame and subresource observation;
- VidSrc extensionless and HLS classification;
- source switching produced a new source-scoped native session rather than leaking the previous provider context.

Presentation diagnostics contained no raw URLs, cookies, authorization material, request headers, signed URLs or request-context identifiers.

### `V3-P10-004` - COMPLETE

Real provider traffic produced truthful preflight outcomes.

Videasy physically demonstrated:

- extensionless candidate -> `unsupported`;
- reachable but unresolved media shape -> `unsupported-media-shape`;
- HLS candidate -> `action-required` when descendants were not approved;
- direct candidate -> `ready`;
- direct candidate reachability -> `reachable`;
- direct candidate protection -> `clear`;
- direct candidate storage requirement -> `known`;
- direct candidate request context -> `contextReady=true`.

VidSrc physically demonstrated:

- extensionless candidate -> honest `unsupported`;
- HLS candidate -> `ready`;
- HLS reachability -> `reachable`;
- HLS protection -> `clear`;
- HLS expiry -> `session`;
- discovered descendants progressing from `3` to `512`;
- HLS request context -> `contextReady=true`.

No playback-capability result was incorrectly promoted to downloadability without successful preflight.

### `V3-P10-007` - COMPLETE

The request-context broker remains native-only, candidate/job scoped and fail-closed.

Physical evidence proves both sides of the boundary:

- legitimate Videasy direct and VidSrc HLS candidates obtained `contextReady=true`;
- a Videasy HLS candidate with unapproved descendant ownership remained `contextReady=false` with `reason=descendant-origin-not-approved`;
- unsupported extensionless candidates remained `contextReady=false`;
- OPTIONS traffic was rejected rather than treated as a transferable media candidate;
- presentation diagnostics remained free of raw request context and credentials.

The broker therefore demonstrates scoped capability rather than generic authenticated proxy behavior.

## 3. Fabric/native capture-path repair

The original P10.2 candidate physically produced no native candidate diagnostic.

Bounded tracing localized the failure before candidate classification.

The accepted repair:

- preserves the existing `RNCWebViewManager` implementation;
- adds Orion's Java Fabric delegate;
- intercepts only `orionShieldSession`;
- forwards all normal WebView properties through the generated React Native WebView delegate;
- avoids the Kotlin/JVM `receiveCommand` bridge collision discovered during candidate compilation;
- keeps the tracked Expo config plugin responsible for generating the native Android mirror.

Physical `stage=manifest ... capture=true` evidence proves that the custom property now reaches the native Cinema client.

## 4. ViewManagerPropertyUpdater warning classification

A startup warning may still report:

`Could not find generated setter for class com.okali.orion.playback.OrionCinemaWebViewManager`

This warning is NON-BLOCKING at the accepted P10.2 boundary.

Reason:

- the Fabric-specific Orion delegate is compiled and packaged;
- `orionShieldSession` is physically delivered;
- the native manifest becomes active;
- subresource observation executes;
- classification executes;
- real candidates and preflight execute;
- two providers produced real scoped capture results.

The warning therefore does not prove property-delivery failure and must not override direct runtime evidence.

It should be revisited only if it correlates with a functional regression or if later native/codegen maintenance provides a clean reason to remove it.

## 5. Automated and package evidence

Final focused P10.2 candidate proof:

- focused P10.2 suite: `13/13`;
- generated native manager mirror: exact SHA equality;
- generated Java Fabric delegate mirror: exact SHA equality;
- Android native Kotlin/Java compilation: PASS;
- `git diff --check`: PASS;
- exact Fabric repair implementation checkpoint: `5d7aec10b9b73cdedb0cde6f00dd6a60c5227fdf`.

Production candidate:

- version: `2.1.13`;
- versionCode: `15`;
- package: `com.okali.orion`;
- signed production release build: PASS;
- build tasks: `1019`;
- permanent signing certificate SHA-256:
  `4422EC4BC16B1C83C914A0AD1B688BE8F7C158FF7F99BCD223A909966AC7A1BD`;
- APK Signature Scheme v2: verified;
- APK size: `68430016` bytes;
- APK SHA-256:
  `1FA3993724EED6AFC3DD4DE4671B4916840AF00EA265BD1A0A8C815E856072C7`;
- bundled JavaScript: verified;
- bundled app manifest: verified.

Preview publication:

- tag: `v2.1.13`;
- release name: `Orion Mobile 2.1.13 Preview`;
- prerelease: true;
- draft: false;
- target:
  `5d7aec10b9b73cdedb0cde6f00dd6a60c5227fdf`;
- assets: APK + `orion-release-integrity-v1.json`;
- remotely downloaded APK SHA and size matched the local production artifact exactly;
- rollout: `100%`.

## 6. Representative physical acceptance

The final representative pass used real episodic playback and a real provider switch:

`Videasy -> VidSrc`

Observed:

- two unique providers;
- native manifest activation on both providers;
- main-frame observation;
- real subresource observation;
- media classification;
- eight candidate/preflight observations;
- three `ready` candidates with `contextReady=true`;
- truthful unsupported and action-required outcomes;
- no diagnostic secret leakage.

Representative accepted ready outcomes:

Videasy direct:

`observed=direct resolved=direct state=ready reachability=reachable protection=clear expiry=stable contextReady=true storage=known reason=none`

VidSrc HLS:

`observed=hls resolved=hls state=ready reachability=reachable protection=clear expiry=session descendants=3 contextReady=true reason=none`

and later:

`observed=hls resolved=hls state=ready reachability=reachable protection=clear expiry=session descendants=512 contextReady=true reason=none`

This satisfies P10.2's required representative real-playback candidate observation.

## 7. Percentage decision

Phase 10 remains at:

- `10%` phase completion;
- `0.8%` weighted contribution.

Orion v3 therefore remains:

- exact `87.28%`;
- rounded `87%`.

This is intentionally conservative.

P10.2 completes `V3-P10-003`, `V3-P10-004` and `V3-P10-007`, but the Master Audit defines no per-contract subweights and P10.3 has not yet delivered the actual Android transfer engine.

No arbitrary percentage is invented merely because candidate capture is now physically green.

P10.3 is the next appropriate percentage reassessment boundary once real Android-owned transfer/resilience evidence exists.

## 8. Phase boundaries preserved

P10.2 does not:

- enable fake or JavaScript-owned download progress;
- claim a foreground download service;
- claim WorkManager recovery;
- claim resumable ranges;
- claim HLS/DASH transfer execution;
- claim finalization or integrity completion;
- claim Offline Library playback;
- reopen the locked Phase 5/6 player architecture;
- expose request credentials to presentation;
- create a generic request proxy.

Those remain owned by later Phase 10 stages.

## 9. Next stage

Proceed directly to:

**P10.3 - Android native download engine and resilience**

Primary contracts:

- `V3-P10-005`
- `V3-P10-006`
- `V3-P10-008`
- `V3-P10-009`
- `V3-P10-014`

P10.3 owns the first real Android transfer implementation, foreground-service progress, WorkManager recovery, durable native queue, range/fragment acquisition, recovery controls, integrity/finalization and native scoped-storage execution.
