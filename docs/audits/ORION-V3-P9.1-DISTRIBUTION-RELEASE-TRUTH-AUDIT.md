# Orion v3 P9.1 — Distribution & Release Truth Audit

**Date:** 2026-08-22
**Phase:** Phase 9 — Distribution, updates, availability and notifications
**Subphase:** P9.1 — Distribution & Release Truth
**Status:** COMPLETE / ACCEPTED
**Public release status:** Not published
**Validation package version:** 2.0.1
**Final planned public release:** Orion Desktop + Mobile v3.0.0 together at Phase 12

## Boundary

P9.1 establishes truthful cross-platform release/distribution foundations without
claiming that the complete Phase 9 update, rollout, availability or notification
system is finished.

Phase 8 remains locked. The fresh-device My List repair is preserved separately
as post-lock amendment commit:

`4bc0ad3657c906f4c7b3111379981f4e2ee243e4`

Its parent and the canonical Phase 9 rollback anchor is:

`27f71d111a6f64ed84943261b1626989c398b4c4`

## Accepted Desktop product state

Desktop now owns Mobile installation/distribution through the dedicated:

`DEVICES -> Get Orion Mobile`

surface rather than embedding Mobile installation inside Settings.

Accepted behavior includes:

- dedicated Get Orion Mobile route and page;
- Stable and Preview channel presentation;
- shared normalized release truth;
- Mobile version, Android requirement and installer-availability presentation;
- installation QR ownership separated explicitly from Orion Connect pairing;
- honest Not published state when the selected release channel contains no signed
  Mobile APK;
- no fabricated installer URL or QR;
- Orion theme/identity consistency and responsive presentation;
- physically accepted final page composition and iconography.

The locked Desktop sidebar architecture is:

- BROWSE — Home, Search, Discover, Constellation
- LIBRARY — My Library, Downloads
- DEVICES — Orion Connect, Get Orion Mobile
- WORLDS — Music Planet
- SYSTEM footer — Settings, Shortcuts, account/profile

## Accepted Mobile product state

Settings -> Updates now provides the Phase 9 release-truth foundation:

- current application version;
- Stable / Preview channel;
- latest release truth;
- minimum Android requirement;
- installer availability;
- last checked / Check now;
- Current, Available, Unsupported and Failed state foundations;
- local MMKV channel persistence;
- Preview semantics that never downgrade below the newest Stable release;
- truthful unavailable state rather than fake installation execution.

Physical validation accepted:

- Stable / Preview switching;
- Preview persistence across restart;
- return to Stable;
- landscape behavior;
- normal Settings navigation.

## Shared release truth

A shared versioned release-truth contract now provides common Desktop/Mobile
semantics for:

- Stable versus Preview eligibility;
- latest version selection;
- Android minimum version;
- installer availability;
- direct-distribution asset metadata;
- truthful absence of a Mobile installer.

GitHub Releases is the selected common release-truth source for the direct
distribution path. No Mobile release is considered published merely because a
local APK exists.

## Android release signing

P9.1 established a permanent Orion Android release identity.

Keystore remains external to the repository:

`C:\Users\aliwa\.orion\signing\orion-mobile-release.jks`

Alias:

`orion-mobile`

Production certificate SHA-256:

`4422EC4BC16B1C83C914A0AD1B688BE8F7C158FF7F99BCD223A909966AC7A1BD`

Certificate owner:

`CN=Orion, OU=Orion mobile, O=OK-ALI, L=Okara, ST=Punjab, C=PK`

The release pipeline keeps passwords out of source control and keeps the
standalone Debug validation workflow distinct from permanent Release
distribution.

Windows native build shortening uses a same-drive NTFS junction rather than a
cross-drive SUBST mapping so React Native codegen/CMake paths retain one root.

## Validated signed artifact

Internal P9.1 validation artifact:

`apps/mobile/android/app/build/outputs/apk/distribution/orion-mobile-v2.0.1.apk`

Size:

`60.86 MB`

SHA-256:

`785EA4D68A5243B42D68C6D6897711D978931267E1A1007DC1A674F4F346824F`

Verified properties:

- package `com.okali.orion`;
- versionName `2.0.1`;
- versionCode `1`;
- minSdk 24;
- targetSdk 36;
- one permanent Orion signer;
- APK Signature Scheme v2 verified;
- embedded `assets/index.android.bundle` verified.

This APK is an internal validation artifact, not the final public Orion release.

## Real-device production-signer validation

Samsung Galaxy S24 Ultra:

`R5CWC2RYXZF`

The new repaired Release APK and the already-installed Orion APK were
independently pulled/verified and proved to use the identical permanent Orion
certificate.

`adb install -r` therefore performed a normal in-place update without requiring
an uninstall or signer migration.

Application state survived the update, including Google/Orion Cloud identity
and previously restored viewing-state domains.

The same production-signed candidate also physically proved the separate Phase
8 fresh-device My List repair, restoring the 162-title cloud My List and
preserving it across application restart.

That Phase 8 proof remains amendment evidence and does not award additional
Phase 9 roadmap credit.

## Automated gates

Final accepted closure state:

- Shared TypeScript gate — PASS
- Desktop complete `npm run check` — PASS
- Desktop Node tests — PASS
- Desktop renderer tests — PASS
- Desktop production Vite build — PASS
- Mobile typecheck — PASS
- Mobile tests — 283/283 PASS after correction of one stale P9.1 architecture assertion
- Mobile source-size gate — PASS
- Expo Doctor — PASS
- Mobile web export — PASS
- Phase 8 fresh-device My List repair regression tests — PASS
- P9.1 Android release-signing regression tests — PASS
- P9.1 release-truth/productization tests — PASS
- `git diff --check` — PASS

The single temporary 282/283 Mobile result was not a product failure. The stale
test still expected Get Orion Mobile inside General Settings after the
physically accepted redesign moved that product surface into Desktop Devices.
The test was corrected to validate the final architecture and the full Mobile
gate subsequently passed.

## Phase 9 checklist interpretation after P9.1

P9.1 advances the implementation foundations spanning V3-P9-001 through
V3-P9-006, but it does not falsely mark the remaining Phase 9 roadmap complete.

In particular:

- V3-P9-001 updater/status foundations remain established.
- V3-P9-002 Desktop Mobile distribution surface is productized, while a public
  signed Mobile release asset remains intentionally unpublished.
- V3-P9-003 Stable/Preview, Mobile version, Android requirement and availability
  truth are productized.
- V3-P9-004 state normalization is only partially established and continues in
  P9.2.
- V3-P9-005 direct signed GitHub APK infrastructure exists; Play Core and
  runtime-compatible Expo update execution continue in P9.2.
- V3-P9-006 checksum and permanent signing-identity foundations are established;
  installation/update integrity continues in P9.2.
- V3-P9-007 through V3-P9-010 remain open.

## Completion accounting

Overall Orion v3 completion remains conservatively reported as **83%** at this
P9.1 checkpoint.

P9.1 contains substantial verified implementation, but Phase 9 is intentionally
not reweighted upward here because several cross-cutting checklist outcomes
remain unfinished. A later Phase 9 roadmap reconciliation will update weighted
completion from accepted end-to-end evidence rather than file count or
presentation progress.

## Next boundary

Next active engineering subphase:

**P9.2 — Update Engine & Integrity**

P9.2 owns update execution/integrity work including the remaining consistent
state machine, signed direct-update path, Play Core flexible-update path,
runtime-compatible Expo update path, integrity verification and related
retry/restart behavior.

P9.1 is accepted and should not be reopened unless later evidence demonstrates
a regression inside this boundary.