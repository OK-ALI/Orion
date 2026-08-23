# Orion V3 Phase 9 — Expo Runtime Retirement Amendment

## Decision

Orion Mobile production no longer uses Expo Updates as a runtime/OTA update authority. The canonical production update mechanism is Orion's signed direct-APK updater backed by GitHub release truth and the release-integrity manifest.

## Why

Physical P9-F6 recovery candidates 2.1.3 through 2.1.6 repeatedly failed against preserved poisoned Expo Updates state. Rather than continue expanding recovery logic around an overlapping second update engine, production startup is simplified to the code and assets bundled in the signed APK.

## Production boundary

- `expo.updates.enabled = false`.
- `expo.updates.checkAutomatically = NEVER`.
- No Expo update URL or runtime channel request headers are carried in production config.
- Android build preparation enforces disabled Expo runtime metadata and strips remote Expo URL/header metadata.
- Quick Updates / Recovery UI and runtime actions are retired.
- The root Expo Updates patch/postinstall lifecycle and P9-F6 backport test are retired.
- `expo-updates` remains installed temporarily for the first retirement bridge because the existing manual bundle pipeline still generates `assets/app.manifest`; it is not allowed to participate in startup or remote updates.

## Preserved P9 updater

The following remain authoritative and unchanged in behavior:

- GitHub Stable/Preview release truth.
- `OrionUpdateModule` direct APK environment and install bridge.
- Release integrity, SHA-256, package/version and canonical signer gates.
- `REQUEST_INSTALL_PACKAGES` and FileProvider handoff.
- App Updates state, announcement, release notes, notifications and `Download & install` action.

## Physical acceptance plan

1. Keep 2.1.6/code8 frozen as the final Expo-runtime recovery failure artifact.
2. After source/full gates pass, bump Mobile only to 2.1.7/code9.
3. Build and independently inspect the production-signed 2.1.7 APK.
4. Install 2.1.7 in place over the preserved poisoned user-0 2.1.6 state without clear/uninstall.
5. Prove a clean cold launch with no Expo `DatabaseLauncher` startup failure and no Quick Updates/Recovery UI.
6. Publish a later signed Mobile target and complete the genuine Orion GitHub APK self-update lifecycle.

This amendment retires P9-F6 as a production runtime concern by removing the Expo runtime-update authority rather than by accepting an unproven healing path. Historical F6 failure evidence remains part of the Phase 9 audit record.

## Physical acceptance — Mobile 2.1.7 / code 9

Status: **ACCEPTED — Expo runtime responsibility retired by architectural amendment.**

This does **not** classify P9-F6 as repaired or GREEN. The former Expo runtime-recovery contract is retired. Production Orion Mobile now uses the signed native GitHub/APK update path as its canonical update and recovery boundary.

### Validated production artifact

- Package: `com.okali.orion`
- Version: `2.1.7`
- Android versionCode: `9`
- APK bytes: `68,368,340`
- APK SHA-256: `6A3DBE26C4F4A5B0499EF08906D646E80375F62AB325DA4A4DA14AA47062082D`
- Production signer SHA-256: `4422EC4BC16B1C83C914A0AD1B688BE8F7C158FF7F99BCD223A909966AC7A1BD`
- APK Signature Scheme v2: verified
- `REQUEST_INSTALL_PACKAGES`: present
- native Orion update module: compiled
- Expo Updates runtime metadata: `ENABLED=false`
- Expo launch policy: `NEVER`
- Expo remote update URL: absent
- Expo update request/channel headers: absent

### Preserved poisoned-origin installation proof

2.1.7/code9 was installed in place over the exact user0 2.1.6/code8 installation without clearing data or uninstalling Orion.

Preserved user0 evidence:

- dataDir: `/data/user/0/com.okali.orion`
- firstInstallTime before replacement: `2026-08-22 14:53:18`
- firstInstallTime after replacement: `2026-08-22 14:53:18`

Android user10 remained registered and was not explicitly launched or modified by the retirement validation.

### First controlled cold launch

Android reported:

- `LaunchState: COLD`
- `com.okali.orion/.MainActivity`
- user0 Orion process remained alive
- MainActivity remained resumed/foreground

Full launch log:

- SHA-256: `ABE6D2D482353A076607A932DAA50594397B8D523F0465139A9911A3F34F7E65`

User0 PID-scoped launch log:

- SHA-256: `54E6C256AA6B81CA70D9D3372B61283D833BD575050998B5DDE73CC3B4BF0D84`

Forbidden historical failure signatures were absent:

- `DatabaseLauncher`
- `UpdateFailedToLoad`
- `loaderTask onFailure`
- Orion fatal exception
- Orion ANR

No Expo Updates startup diagnostics were observed.

Physical UI validation passed:

- normal Orion UI reached
- no blank/crash/error/loading failure surface
- obsolete Quick Updates / Recovery UI absent
- canonical App Updates surface present

### Second cold-launch repeatability proof

Android again reported `LaunchState: COLD`.

Repeat-launch log:

- SHA-256: `6D4250072AF55E3375BAE6ECC60DD2AF137B2B3D73F47A253BB6E1C87DBE1218`

Again:

- user0 Orion remained alive and foreground
- `DatabaseLauncher` absent
- `UpdateFailedToLoad` absent
- `loaderTask onFailure` absent
- Orion fatal exception absent
- Orion ANR absent
- Expo Updates startup diagnostics absent
- original user0 firstInstallTime remained preserved

Second visual validation also passed:

- normal Orion UI
- no blank/crash/error surface
- Settings → Updates exposes App Updates only

### Architectural conclusion

The inherited Expo state that repeatedly failed production-signed candidates through Mobile 2.1.6 no longer participates in canonical Orion startup.

Therefore:

**P9-F6 Expo runtime recovery is RETIRED BY ARCHITECTURAL AMENDMENT.**

Historical F6 failure evidence remains preserved. No further Expo recovery testing is required for Phase 9.

P9-F9 native signed GitHub/APK updating is now the sole production Mobile update acceptance path.
